import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'swing_terminal.db')


def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS portfolio (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol       TEXT    NOT NULL,
            entry_price  REAL    NOT NULL,
            quantity     INTEGER NOT NULL,
            stop_loss    REAL    NOT NULL,
            target       REAL    NOT NULL,
            added_at     TEXT    NOT NULL,
            current_price REAL   DEFAULT 0,
            status       TEXT    DEFAULT 'ON TRACK'
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()


# ── Risk settings (capital + risk-per-trade %) — Layer 4 ────────────────────
DEFAULT_SETTINGS = {'capital': '100000', 'risk_pct': '0.75'}


def get_settings():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT key, value FROM settings')
    stored = {r['key']: r['value'] for r in cursor.fetchall()}
    conn.close()
    merged = {**DEFAULT_SETTINGS, **stored}
    return {'capital': float(merged['capital']), 'risk_pct': float(merged['risk_pct'])}


def update_settings(capital=None, risk_pct=None):
    conn = get_connection()
    cursor = conn.cursor()
    if capital is not None:
        cursor.execute(
            'INSERT INTO settings (key, value) VALUES (?, ?) '
            'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            ('capital', str(capital)),
        )
    if risk_pct is not None:
        cursor.execute(
            'INSERT INTO settings (key, value) VALUES (?, ?) '
            'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            ('risk_pct', str(risk_pct)),
        )
    conn.commit()
    conn.close()
    return get_settings()


def get_portfolio():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM portfolio ORDER BY added_at DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_to_portfolio(symbol, entry_price, quantity, stop_loss, target):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO portfolio (symbol, entry_price, quantity, stop_loss, target, added_at) VALUES (?,?,?,?,?,?)',
        (symbol.upper(), entry_price, quantity, stop_loss, target, datetime.now().isoformat())
    )
    conn.commit()
    pid = cursor.lastrowid
    conn.close()
    return pid


def delete_from_portfolio(pid):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM portfolio WHERE id = ?', (pid,))
    conn.commit()
    conn.close()


def update_portfolio_price(symbol, current_price):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM portfolio WHERE symbol = ?', (symbol,))
    rows = cursor.fetchall()
    for row in rows:
        sl = row['stop_loss']
        t1 = row['target']
        ep = row['entry_price']
        if current_price <= sl:
            status = 'EXIT'
        elif current_price >= t1:
            status = 'TARGET HIT'
        elif current_price >= ep + (t1 - ep) * 0.6:
            status = 'TRAIL STOP'
        elif current_price < ep * 0.97:
            status = 'REVIEW'
        else:
            status = 'ON TRACK'
        cursor.execute(
            'UPDATE portfolio SET current_price = ?, status = ? WHERE id = ?',
            (current_price, status, row['id'])
        )
    conn.commit()
    conn.close()


init_db()
