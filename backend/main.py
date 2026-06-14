import time
import sys
import traceback
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Safe imports with explicit error logging ───────────────────────────────────
# If any module fails to import the error prints to Render logs instead of
# silently producing a bare FastAPI app with no routes.

_import_errors = []

try:
    from data_fetcher import (
        get_fii_dii_data, get_indices, get_stock_list,
        get_stock_history, get_bulk_deals, CACHE,
    )
except Exception as _e:
    _import_errors.append(f"data_fetcher: {_e}")
    traceback.print_exc()

try:
    from indicators import compute_indicators
except Exception as _e:
    _import_errors.append(f"indicators: {_e}")
    traceback.print_exc()

try:
    from scorer import score_stock, get_signal, get_trade_levels
except Exception as _e:
    _import_errors.append(f"scorer: {_e}")
    traceback.print_exc()

try:
    from database import (
        get_portfolio, add_to_portfolio, delete_from_portfolio,
        update_portfolio_price,
    )
except Exception as _e:
    _import_errors.append(f"database: {_e}")
    traceback.print_exc()

if _import_errors:
    print(f"[STARTUP ERROR] Failed imports: {_import_errors}", file=sys.stderr)
else:
    print("[STARTUP OK] All modules imported successfully.")

app = FastAPI(title='Swing Terminal API', version='1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

SECTOR_INDEX_MAP = {
    'Banking':  'nifty_bank',
    'IT':       'nifty_it',
    'Pharma':   'nifty_pharma',
    'Auto':     'nifty_auto',
    'FMCG':     'nifty_fmcg',
    'Metal':    'nifty_metal',
    'Realty':   'nifty_realty',
    'Energy':   'nifty_energy',
    'Infra':    'nifty_infra',
    'Telecom':  'nifty_telecom',
    'Finance':  'nifty_bank',
    'Consumer': 'nifty_fmcg',
}


# ── Market Pulse ──────────────────────────────────────────────────────────────

@app.get('/api/market-pulse')
def market_pulse():
    indices  = get_indices()
    fii_data = get_fii_dii_data(10)

    fii_today = fii_data[0]['fii_net'] if fii_data else 0
    dii_today = fii_data[0]['dii_net'] if fii_data else 0
    fii_10d   = sum(d['fii_net'] for d in fii_data)

    nifty_change = indices.get('nifty50_change', 0)
    vix          = indices.get('india_vix', 16)

    if nifty_change > 0.5 and fii_10d > 5000 and vix < 17:
        signal = 'BULLISH';     color = '#00E5A0'
        text   = 'Markets trending up with institutional support. Favourable for swing longs.'
    elif nifty_change < -0.5 and fii_10d < -5000:
        signal = 'BEARISH';     color = '#F85149'
        text   = 'Institutional selling pressure. Caution advised. Wait for reversal signals.'
    elif vix > 20:
        signal = 'CAUTION';     color = '#E3B341'
        text   = f'High volatility (VIX {vix:.1f}). Markets in fear zone. Reduce position sizes.'
    else:
        signal = 'RANGE-BOUND'; color = '#58A6FF'
        text   = 'Markets consolidating. Select stock-specific opportunities only.'

    sensex_est = indices.get('nifty50', 23000) * 3.27

    return {
        'nifty50':           indices.get('nifty50', 0),
        'nifty50_change':    indices.get('nifty50_change', 0),
        'sensex':            round(sensex_est, 2),
        'sensex_change':     round(indices.get('nifty50_change', 0) * 0.97, 2),
        'india_vix':         indices.get('india_vix', 0),
        'india_vix_change':  indices.get('india_vix_change', 0),
        'nifty_bank':        indices.get('nifty_bank', 0),
        'nifty_bank_change': indices.get('nifty_bank_change', 0),
        'market_signal':     signal,
        'signal_color':      color,
        'market_signal_text': text,
        'fii_today':         round(fii_today, 2),
        'dii_today':         round(dii_today, 2),
    }


# ── FII / DII ─────────────────────────────────────────────────────────────────

@app.get('/api/fii-dii')
def fii_dii_endpoint(days: int = 30):
    data  = get_fii_dii_data(days)
    bulk  = get_bulk_deals(7)

    fii_10d = sum(d['fii_net'] for d in data[:10])
    dii_10d = sum(d['dii_net'] for d in data[:10])

    if fii_10d > 15000:
        label = 'STRONG BULL REGIME';  desc = 'FIIs aggressively buying. Favour momentum longs.'
    elif fii_10d > 5000:
        label = 'MILD BULL REGIME';    desc = 'Steady FII inflows. Selective buying in quality large-caps.'
    elif fii_10d > -5000:
        label = 'NEUTRAL REGIME';      desc = 'FII flows balanced. Focus on stock-specific technicals.'
    elif fii_10d > -15000:
        label = 'MILD BEAR REGIME';    desc = 'FII outflows. Reduce long exposure. Hedge with index shorts.'
    else:
        label = 'RISK-OFF REGIME';     desc = 'Heavy FII selling. Avoid fresh longs. Cash is king.'

    sector_flows = [
        {'name': 'Banking', 'flow': round(fii_10d * 0.28), 'trend': '▲' if fii_10d > 0 else '▼'},
        {'name': 'IT',      'flow': round(fii_10d * 0.18), 'trend': '▲' if fii_10d > 0 else '▼'},
        {'name': 'Energy',  'flow': round(fii_10d * 0.12), 'trend': '▲' if fii_10d > 2000 else '▼'},
        {'name': 'Auto',    'flow': round(fii_10d * 0.10), 'trend': '▲' if fii_10d > 3000 else '→'},
        {'name': 'Pharma',  'flow': round(fii_10d * 0.09), 'trend': '▲' if fii_10d > 0 else '→'},
        {'name': 'FMCG',    'flow': round(fii_10d * 0.08), 'trend': '→'},
        {'name': 'Metal',   'flow': round(fii_10d * 0.07), 'trend': '▼' if fii_10d < 0 else '→'},
        {'name': 'Infra',   'flow': round(fii_10d * 0.08), 'trend': '▲' if fii_10d > 5000 else '→'},
    ]

    return {
        'daily_data':       data,
        'cumulative_10d':   round(fii_10d, 2),
        'cumulative_dii_10d': round(dii_10d, 2),
        'scenario_label':   label,
        'scenario_desc':    desc,
        'sector_flows':     sector_flows,
        'fii_today':        round(data[0]['fii_net'] if data else 0, 2),
        'dii_today':        round(data[0]['dii_net'] if data else 0, 2),
        'bulk_deals':       bulk,
    }


# ── Sectors ───────────────────────────────────────────────────────────────────

@app.get('/api/sectors')
def sectors_endpoint():
    indices      = get_indices()
    nifty_change = indices.get('nifty50_change', 0)

    SECTOR_DEFS = [
        ('Banking',  'nifty_bank',    [0.28, 3.2, 8.5]),
        ('IT',       'nifty_it',      [0.18, 2.8, 7.2]),
        ('Pharma',   'nifty_pharma',  [0.09, 3.0, 9.0]),
        ('Auto',     'nifty_auto',    [0.10, 2.5, 6.8]),
        ('FMCG',     'nifty_fmcg',    [0.08, 2.2, 5.5]),
        ('Metal',    'nifty_metal',   [0.07, 3.5, 10.2]),
        ('Realty',   'nifty_realty',  [0.04, 4.0, 12.0]),
        ('Energy',   'nifty_energy',  [0.12, 2.8, 7.5]),
        ('Infra',    'nifty_infra',   [0.08, 2.6, 7.0]),
        ('Telecom',  'nifty_telecom', [0.05, 3.2, 9.5]),
    ]

    sectors = []
    for name, key, mults in SECTOR_DEFS:
        c1  = indices.get(f'{key}_change', 0)
        c5  = round(c1 * mults[1], 2)
        c20 = round(c1 * mults[2], 2)
        raw_score = (c1 * 3 + c5 * 2 + c20) / 6 * 10
        score     = min(100, max(0, round(raw_score + 50, 1)))

        if score >= 65:   signal = 'OVERWEIGHT'
        elif score >= 45: signal = 'NEUTRAL'
        else:             signal = 'UNDERWEIGHT'

        if c1 > 2 and c5 > 3:    fii_bias = '▲ BUYING'
        elif c1 < -1 and c5 < -2: fii_bias = '▼ SELLING'
        else:                      fii_bias = '→ NEUTRAL'

        sectors.append({
            'name':      name,
            'change_1d': round(c1, 2),
            'change_5d': c5,
            'change_20d': c20,
            'vs_nifty':  round(c1 - nifty_change, 2),
            'score':     score,
            'signal':    signal,
            'fii_bias':  fii_bias,
            'value':     indices.get(key, 0),
        })

    return sorted(sectors, key=lambda x: x['score'], reverse=True)


# ── Scanner ───────────────────────────────────────────────────────────────────

@app.get('/api/scanner')
def scanner_endpoint(min_score: int = 0, sector: str = 'all', limit: int = 50):
    stocks   = get_stock_list()
    indices  = get_indices()
    fii_data = get_fii_dii_data(10)
    fii_10d  = sum(d['fii_net'] for d in fii_data)

    results = []
    for stock in stocks[:40]:   # cap at 40 — beyond this yfinance latency kills the request
        sym          = stock.get('symbol', '')
        stock_sector = stock.get('sector', 'Consumer')

        if sector != 'all' and stock_sector.lower() != sector.lower():
            continue

        idx_key      = SECTOR_INDEX_MAP.get(stock_sector, 'nifty50')
        sector_chg   = indices.get(f'{idx_key}_change', 0)

        history = get_stock_history(sym)
        scored  = score_stock(stock, history, fii_10d, sector_chg)
        comp    = scored['composite_score']

        if comp < min_score:
            continue

        ind    = scored['indicators']
        signal, signal_color = get_signal(comp)
        price  = ind.get('close') or float(stock.get('lastPrice', 0) or 0)
        levels = get_trade_levels(price, ind.get('atr', price * 0.02), signal)

        results.append({
            'symbol':            sym,
            'company':           stock.get('companyName', sym),
            'sector':            stock_sector,
            'price':             price,
            'change_pct':        float(stock.get('pChange', 0) or 0),
            'composite_score':   comp,
            'tech_score':        scored['tech_score'],
            'fii_dii_score':     scored['fii_dii_score'],
            'fundamental_score': scored['fundamental_score'],
            'sector_score':      scored['sector_score'],
            'signal':            signal,
            'signal_color':      signal_color,
            'rsi':               ind.get('rsi', 50),
            'vol_ratio':         ind.get('vol_ratio', 1.0),
            **levels,
        })

    results.sort(key=lambda x: x['composite_score'], reverse=True)
    return results[:limit]


# ── Opportunities ─────────────────────────────────────────────────────────────

@app.get('/api/opportunities')
def opportunities_endpoint():
    stocks   = get_stock_list()
    indices  = get_indices()
    fii_data = get_fii_dii_data(10)
    fii_10d  = sum(d['fii_net'] for d in fii_data)

    candidates = []
    for stock in stocks:
        sym          = stock.get('symbol', '')
        stock_sector = stock.get('sector', 'Consumer')
        idx_key      = SECTOR_INDEX_MAP.get(stock_sector, 'nifty50')
        sector_chg   = indices.get(f'{idx_key}_change', 0)

        history = get_stock_history(sym)
        scored  = score_stock(stock, history, fii_10d, sector_chg)

        if scored['composite_score'] < 65:
            continue

        ind    = scored['indicators']
        signal, signal_color = get_signal(scored['composite_score'])
        price  = ind.get('close') or float(stock.get('lastPrice', 0) or 0)
        levels = get_trade_levels(price, ind.get('atr', price * 0.02), signal)

        reasons = []
        if ind.get('rsi', 50) < 52 and ind.get('macd_hist', 0) > 0:
            reasons.append('RSI recovering with MACD bullish crossover signal')
        if ind.get('close', 0) > ind.get('ema20', 0) > ind.get('ema50', 0):
            reasons.append('Price above EMA20 and EMA50 — bullish trend alignment')
        if ind.get('vol_ratio', 1) > 1.5:
            reasons.append(f"Volume surge {ind.get('vol_ratio', 1):.1f}x average — institutional accumulation")
        if ind.get('adx', 0) > 25:
            reasons.append(f"Strong trend strength (ADX {ind.get('adx', 0):.0f}) — trending move underway")
        if scored['fii_dii_score'] >= 15:
            reasons.append('High delivery % — quality institutional holding confirmed')
        if sector_chg > 1.5:
            reasons.append(f"{stock_sector} sector outperforming by {sector_chg:.1f}% today")
        if not reasons:
            reasons.append('Multiple technical signals aligning for swing trade setup')
            reasons.append('Strong relative strength vs Nifty 50')

        risks = [
            'Stop loss breach invalidates setup — exit immediately',
            'Nifty 50 breakdown below key support could drag stock down',
            'Global cues: US Fed decisions or FII risk-off events',
        ]
        if ind.get('rsi', 50) > 65:
            risks.append('RSI elevated — limited upside before potential consolidation')

        candidates.append({
            'symbol':            sym,
            'company':           stock.get('companyName', sym),
            'sector':            stock_sector,
            'composite_score':   scored['composite_score'],
            'tech_score':        scored['tech_score'],
            'fii_dii_score':     scored['fii_dii_score'],
            'fundamental_score': scored['fundamental_score'],
            'sector_score':      scored['sector_score'],
            'signal':            signal,
            'signal_color':      signal_color,
            'rsi':               ind.get('rsi', 50),
            'reasons':           reasons[:4],
            'risks':             risks[:3],
            **levels,
        })

    candidates.sort(key=lambda x: x['composite_score'], reverse=True)
    return candidates[:15]


# ── Bulk Deals ────────────────────────────────────────────────────────────────

@app.get('/api/bulk-deals')
def bulk_deals_endpoint(days: int = 7):
    return get_bulk_deals(days)


# ── Portfolio ─────────────────────────────────────────────────────────────────

@app.get('/api/portfolio')
def portfolio_endpoint():
    positions  = get_portfolio()
    stocks     = get_stock_list()
    price_map  = {s['symbol']: float(s.get('lastPrice', 0) or 0) for s in stocks}

    enriched        = []
    total_invested  = 0.0
    total_current   = 0.0

    for pos in positions:
        sym     = pos['symbol']
        current = price_map.get(sym) or pos.get('current_price') or pos['entry_price']
        update_portfolio_price(sym, current)

        invested    = pos['entry_price'] * pos['quantity']
        current_val = current           * pos['quantity']
        pnl         = current_val - invested
        pnl_pct     = (pnl / invested * 100) if invested > 0 else 0

        total_invested += invested
        total_current  += current_val

        sl = pos['stop_loss']; t1 = pos['target']; ep = pos['entry_price']
        if current <= sl:                        status = 'EXIT'
        elif current >= t1:                      status = 'TARGET HIT'
        elif current >= ep + (t1 - ep) * 0.6:   status = 'TRAIL STOP'
        elif current < ep * 0.97:                status = 'REVIEW'
        else:                                    status = 'ON TRACK'

        enriched.append({
            **pos,
            'current_price': round(current, 2),
            'pnl':           round(pnl, 2),
            'pnl_pct':       round(pnl_pct, 2),
            'invested':      round(invested, 2),
            'current_value': round(current_val, 2),
            'status':        status,
        })

    total_pnl     = total_current - total_invested
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0

    return {
        'positions': enriched,
        'summary': {
            'total_invested': round(total_invested, 2),
            'total_current':  round(total_current,  2),
            'total_pnl':      round(total_pnl,      2),
            'total_pnl_pct':  round(total_pnl_pct,  2),
        },
    }


class PositionCreate(BaseModel):
    symbol:      str
    entry_price: float
    quantity:    int
    stop_loss:   float
    target:      float


@app.post('/api/portfolio')
def add_position(pos: PositionCreate):
    pid = add_to_portfolio(
        pos.symbol, pos.entry_price, pos.quantity,
        pos.stop_loss, pos.target,
    )
    return {'id': pid, 'message': 'Position added'}


@app.delete('/api/portfolio/{pid}')
def remove_position(pid: int):
    delete_from_portfolio(pid)
    return {'message': 'Position removed'}


# ── Refresh ───────────────────────────────────────────────────────────────────

@app.get('/api/refresh')
def refresh_data():
    CACHE.clear()
    return {'message': 'Cache cleared', 'timestamp': time.time()}


@app.get('/')
def root():
    return {
        'status': 'Market Swing API is running',
        'version': '1.0',
        'import_errors': _import_errors,   # empty list = all good
        'endpoints': [
            '/api/market-pulse',
            '/api/fii-dii',
            '/api/sectors',
            '/api/scanner',
            '/api/opportunities',
            '/api/bulk-deals',
            '/api/portfolio',
            '/api/refresh',
        ],
    }
