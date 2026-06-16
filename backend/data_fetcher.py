import hashlib
import json
import math
import os
import requests
import time
import random
import threading
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

CACHE = {}

HEALTH = {
    'yfinance_ok':         None,
    'nse_ok':              None,
    'nse_stocklist_ok':    None,
    'active_source':       'unknown',
    'last_live_fetch':     None,
    'last_attempt':        None,
    'bulk_deals_real':     None,
    'fii_dii_real':        None,    # today's NSE figure
    'fii_dii_history_real': None,   # niftytrader historical scrape
    'prices_real':         None,    # all 50 stock prices from live yfinance
}

# ── Disk cache ─────────────────────────────────────────────────────────────────
# Persists computed prices and scores across server restarts so the data is
# identical after a restart as it was before — no recomputation needed.

CACHE_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data_cache')
_disk_lock = threading.Lock()

# Per-process in-memory store of today's price histories (loaded from disk once).
_DISK_PRICES: dict = {}
_DISK_PRICES_LOADED = False


def get_today_str() -> str:
    """IST date string used as disk-cache filename suffix (YYYY-MM-DD)."""
    ist = datetime.utcnow() + timedelta(hours=5, minutes=30)
    return ist.strftime('%Y-%m-%d')


def _ensure_cache_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)


def disk_cache_path(name: str) -> str:
    _ensure_cache_dir()
    return os.path.join(CACHE_DIR, f'{name}_{get_today_str()}.json')


def disk_cache_get(name: str):
    """Read today's named cache from disk. Returns None if missing or corrupt."""
    path = disk_cache_path(name)
    if not os.path.exists(path):
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f'[DISK CACHE] Read error {name}: {e}')
        return None


def disk_cache_set(name: str, data) -> None:
    """Atomically write data to today's named cache on disk."""
    path = disk_cache_path(name)
    try:
        tmp = path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, separators=(',', ':'))
        os.replace(tmp, path)   # atomic on Windows and POSIX
    except Exception as e:
        print(f'[DISK CACHE] Write error {name}: {e}')


def disk_cache_clear_today() -> list:
    """Delete all cache files for today. Returns list of deleted filenames."""
    today   = get_today_str()
    cleared = []
    try:
        if os.path.exists(CACHE_DIR):
            for fname in os.listdir(CACHE_DIR):
                if today in fname:
                    try:
                        os.remove(os.path.join(CACHE_DIR, fname))
                        cleared.append(fname)
                    except Exception:
                        pass
    except Exception:
        pass
    return cleared


def _sym_seed(sym: str) -> int:
    """Deterministic 0..99999 seed for a stock symbol.
    Uses MD5 so it is immune to PYTHONHASHSEED randomization between restarts."""
    return int(hashlib.md5(sym.encode()).hexdigest(), 16) % 100_000


def _load_disk_prices() -> dict:
    """Load today's price histories from disk into the module-level dict (once)."""
    global _DISK_PRICES, _DISK_PRICES_LOADED
    if _DISK_PRICES_LOADED:
        return _DISK_PRICES
    loaded = disk_cache_get('prices')
    if isinstance(loaded, dict) and loaded:
        _DISK_PRICES = loaded
        print(f'[DISK CACHE] Loaded prices for {len(loaded)} stocks from disk')
    _DISK_PRICES_LOADED = True
    return _DISK_PRICES


def _save_disk_prices() -> None:
    """Persist the in-memory price dict to disk (called under _disk_lock)."""
    if _DISK_PRICES:
        disk_cache_set('prices', _DISK_PRICES)


def is_market_open():
    """True only during NSE trading hours (IST Mon-Fri 09:15-15:30)."""
    ist = datetime.utcnow() + timedelta(hours=5, minutes=30)
    if ist.weekday() >= 5:
        return False
    t = ist.hour * 100 + ist.minute
    return 915 <= t <= 1530


def stable_ttl():
    """
    During market hours  → 15-minute cache (prices change).
    Outside market hours → cache until midnight IST (scores must not drift).
    """
    if is_market_open():
        return 900  # 15 minutes during market hours so prices stay fresh
    ist = datetime.utcnow() + timedelta(hours=5, minutes=30)
    midnight = ist.replace(hour=23, minute=59, second=59, microsecond=0)
    return max(3600, int((midnight - ist).total_seconds()))


def scanner_ttl():
    """
    Scanner scores refresh at most once per 30 min during market hours.
    After close: locked until midnight (scores won't change — prices frozen).
    """
    if is_market_open():
        return 1800   # 30 minutes — long enough to be stable, short enough to be useful
    ist = datetime.utcnow() + timedelta(hours=5, minutes=30)
    midnight = ist.replace(hour=23, minute=59, second=59, microsecond=0)
    return max(3600, int((midnight - ist).total_seconds()))

NSE_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept':          'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer':         'https://www.nseindia.com/',
    'Connection':      'keep-alive',
}


# ── Cache helpers ──────────────────────────────────────────────────────────────

def cache_get(key):
    if key in CACHE:
        data, ts, ttl = CACHE[key]
        if (datetime.now() - ts).total_seconds() < ttl:
            return data
    return None


def cache_set(key, data, ttl=None):
    CACHE[key] = (data, datetime.now(), ttl if ttl is not None else stable_ttl())


# ── NSE session ────────────────────────────────────────────────────────────────

def get_nse_session():
    s = requests.Session()
    s.headers.update(NSE_HEADERS)
    try:
        s.get('https://www.nseindia.com', timeout=10)
        time.sleep(1.0)
    except Exception:
        pass
    return s


# ── FII / DII — real data only, no fabrication ──────────────────────────────────
#
# Two real sources, merged honestly:
#   1. nsepython.nse_fiidii()    → TODAY's real full buy/sell/net breakdown.
#      Every day this server runs, that real reading is appended to a
#      permanent on-disk log (fii_dii_log.json) — an honest archive that
#      grows richer over time. Never overwritten with guesses.
#   2. niftytrader.in scrape     → real historical NET-only values (verified
#      to match NSE's own numbers exactly — see HISTORY.md). Used only to
#      backfill days before our own log existed. No buy/sell breakdown is
#      invented for those days; fii_buy/fii_sell/dii_buy/dii_sell are left
#      as None and the record is tagged 'source': 'net_only'.
#
# If a day has neither a log entry nor a scrape entry, it is simply omitted.
# No random numbers are ever generated for FII/DII data.

FIIDII_LOG_PATH = os.path.join(CACHE_DIR, 'fii_dii_log.json')   # not date-suffixed — persists forever


def _load_fiidii_log() -> dict:
    _ensure_cache_dir()
    if os.path.exists(FIIDII_LOG_PATH):
        try:
            with open(FIIDII_LOG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f'[FII/DII LOG] read error: {e}')
    return {}


def _save_fiidii_log(log: dict) -> None:
    try:
        tmp = FIIDII_LOG_PATH + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(log, f, separators=(',', ':'))
        os.replace(tmp, FIIDII_LOG_PATH)
    except Exception as e:
        print(f'[FII/DII LOG] write error: {e}')


def _scrape_fiidii_history_niftytrader(limit_days=90):
    """
    Real historical FII/DII NET values, scraped from the __NEXT_DATA__ JSON
    niftytrader.in embeds in its fii-dii-data page. These are NSE's own
    provisional figures republished — verified against nse_fiidii() to
    match exactly for the current day. NET only; no buy/sell breakdown.
    Cached once per day (the page itself only updates once per day, after
    NSE publishes provisional figures each evening).
    """
    cached = cache_get('fiidii_history_scrape')
    if cached is not None:
        return cached
    try:
        import re
        s = requests.Session()
        s.headers.update({'User-Agent': NSE_HEADERS['User-Agent']})
        r = s.get('https://www.niftytrader.in/fii-dii-data', timeout=15)
        m = re.search(r'__NEXT_DATA__"\s*type="application/json">(.*?)</script>', r.text)
        if not m:
            raise ValueError('__NEXT_DATA__ blob not found — page structure may have changed')
        blob = json.loads(m.group(1))
        series = blob['props']['pageProps']['series']
        result = []
        for row in series[-limit_days:]:
            d = datetime.strptime(row['created_at'][:10], '%Y-%m-%d')
            result.append({
                'date':    d.strftime('%d-%b-%Y'),
                'fii_net': round(float(row.get('fii_net_value', 0) or 0), 2),
                'dii_net': round(float(row.get('dii_net_value', 0) or 0), 2),
            })
        result.reverse()   # newest first
        cache_set('fiidii_history_scrape', result, stable_ttl())
        HEALTH['fii_dii_history_real'] = True
        print(f'[FII/DII] niftytrader scrape OK: {len(result)} real historical days (net-only)')
        return result
    except Exception as e:
        HEALTH['fii_dii_history_real'] = False
        print(f'[FII/DII] WARNING: niftytrader scrape failed: {e} — only days in our own log will show')
        return []


def get_fii_dii_data(days=30):
    cached = cache_get(f'fii_{days}')
    if cached is not None:
        return cached

    # 1. TODAY's real full buy/sell/net breakdown straight from NSE
    today_real = None
    try:
        from nsepython import nse_fiidii
        df = nse_fiidii()
        fii_row = df[df['category'].str.contains('FII', case=False)].iloc[0]
        dii_row = df[df['category'].str.contains('DII', case=False)].iloc[0]
        today_real = {
            'date':     fii_row['date'],
            'fii_buy':  round(float(fii_row['buyValue']), 2),
            'fii_sell': round(float(fii_row['sellValue']), 2),
            'fii_net':  round(float(fii_row['netValue']), 2),
            'dii_buy':  round(float(dii_row['buyValue']), 2),
            'dii_sell': round(float(dii_row['sellValue']), 2),
            'dii_net':  round(float(dii_row['netValue']), 2),
            'source':   'nse_real',
        }
        HEALTH['fii_dii_real'] = True
        print(f"[FII/DII] Real today: FII net={today_real['fii_net']}, DII net={today_real['dii_net']}")
    except Exception as e:
        HEALTH['fii_dii_real'] = False
        print(f'[FII/DII] WARNING: NSE real data failed: {e}')

    # 2. Persist today's real reading into our own permanent log (honest
    #    archive — grows by one real day every day the server runs)
    log = _load_fiidii_log()
    if today_real and log.get(today_real['date']) != today_real:
        log[today_real['date']] = today_real
        _save_fiidii_log(log)

    # 3. Real net-only history from niftytrader, to backfill days before
    #    our own log existed
    scraped = _scrape_fiidii_history_niftytrader(max(days, 30))
    scraped_by_date = {row['date']: row for row in scraped}

    # 4. Merge — prefer our own full-breakdown log entry; else the real
    #    net-only scrape entry; never fabricate a missing day.
    all_dates = sorted(
        set(log.keys()) | set(scraped_by_date.keys()),
        key=lambda d: datetime.strptime(d, '%d-%b-%Y'),
        reverse=True,   # newest first — matches frontend's expectation
    )

    result = []
    for d in all_dates[:days]:
        if d in log:
            result.append(log[d])
        else:
            net_row = scraped_by_date[d]
            result.append({
                'date':     d,
                'fii_buy':  None,
                'fii_sell': None,
                'fii_net':  net_row['fii_net'],
                'dii_buy':  None,
                'dii_sell': None,
                'dii_net':  net_row['dii_net'],
                'source':   'net_only',
            })

    cache_set(f'fii_{days}', result, stable_ttl())
    return result


# ── Indices ────────────────────────────────────────────────────────────────────

_YF_INDEX_MAP = {
    '^NSEI':     ('nifty50',      'nifty50_change'),
    '^BSESN':    ('sensex',       'sensex_change'),
    '^INDIAVIX': ('india_vix',    'india_vix_change'),
    '^NSEBANK':  ('nifty_bank',   'nifty_bank_change'),
    '^CNXIT':    ('nifty_it',     'nifty_it_change'),
    '^CNXPHARMA':('nifty_pharma', 'nifty_pharma_change'),
    '^CNXAUTO':  ('nifty_auto',   'nifty_auto_change'),
    '^CNXFMCG':  ('nifty_fmcg',  'nifty_fmcg_change'),
    '^CNXMETAL': ('nifty_metal',  'nifty_metal_change'),
}

_NSE_INDEX_MAP = {
    'NIFTY 50':      ('nifty50',       'nifty50_change'),
    'INDIA VIX':     ('india_vix',     'india_vix_change'),
    'NIFTY BANK':    ('nifty_bank',    'nifty_bank_change'),
    'NIFTY IT':      ('nifty_it',      'nifty_it_change'),
    'NIFTY PHARMA':  ('nifty_pharma',  'nifty_pharma_change'),
    'NIFTY AUTO':    ('nifty_auto',    'nifty_auto_change'),
    'NIFTY FMCG':    ('nifty_fmcg',   'nifty_fmcg_change'),
    'NIFTY METAL':   ('nifty_metal',   'nifty_metal_change'),
    'NIFTY REALTY':  ('nifty_realty',  'nifty_realty_change'),
    'NIFTY ENERGY':  ('nifty_energy',  'nifty_energy_change'),
    'NIFTY INFRA':   ('nifty_infra',   'nifty_infra_change'),
    'NIFTY TELECOM': ('nifty_telecom', 'nifty_telecom_change'),
}


def _fetch_one_index(ticker):
    """Download one index ticker via yfinance. Returns (last_price, pct_change) or None."""
    import yfinance as yf
    # Use Ticker().history() — yf.download() returns MultiIndex columns in v1.4+
    # which breaks df['Close'] access (returns DataFrame not Series)
    df = yf.Ticker(ticker).history(period='5d')
    if df.empty:
        return None
    closes = df['Close'].dropna()
    if len(closes) == 0:
        return None
    last = float(closes.iloc[-1])
    pct  = 0.0
    if len(closes) >= 2:
        prev = float(closes.iloc[-2])
        if prev:
            pct = round((last - prev) / prev * 100, 2)
    return (round(last, 2), pct)


def _yf_indices_parallel(yf_map):
    """Fetch all tickers in parallel threads. Returns {k1: val, k2: pct, ...}."""
    results = {}
    try:
        with ThreadPoolExecutor(max_workers=len(yf_map)) as ex:
            future_to_keys = {
                ex.submit(_fetch_one_index, ticker): (k1, k2)
                for ticker, (k1, k2) in yf_map.items()
            }
            for fut in as_completed(future_to_keys, timeout=25):
                k1, k2 = future_to_keys[fut]
                try:
                    res = fut.result()
                    if res:
                        results[k1] = res[0]
                        results[k2] = res[1]
                except Exception:
                    pass
    except Exception as e:
        print(f'[INDICES] parallel pool error: {e}')
    return results


def get_indices():
    cached = cache_get('indices')
    if cached:
        return cached

    defaults = {
        'nifty50': 23623.0,         'nifty50_change': 1.2,
        'sensex':  77414.0,         'sensex_change':  1.1,
        'india_vix': 16.8,          'india_vix_change': -0.5,
        'nifty_bank': 52341.0,      'nifty_bank_change': 1.8,
        'nifty_it': 38920.0,        'nifty_it_change': 0.6,
        'nifty_pharma': 21450.0,    'nifty_pharma_change': 1.4,
        'nifty_auto': 23180.0,      'nifty_auto_change': -0.3,
        'nifty_fmcg': 57230.0,      'nifty_fmcg_change': 0.2,
        'nifty_metal': 9870.0,      'nifty_metal_change': -1.2,
        'nifty_realty': 1043.0,     'nifty_realty_change': 0.8,
        'nifty_energy': 41200.0,    'nifty_energy_change': -0.4,
        'nifty_infra': 8921.0,      'nifty_infra_change': 0.5,
        'nifty_telecom': 2150.0,    'nifty_telecom_change': 2.1,
        'nifty_midcap150': 19820.0, 'nifty_midcap150_change': 0.9,
        'data_source': 'fallback',
        'last_updated': datetime.now().strftime('%d %b %Y, %I:%M %p IST'),
    }

    HEALTH['last_attempt'] = datetime.now()

    # PRIMARY: yfinance — parallel fetch, retry up to 3 times on partial results
    yf_results = {}
    for attempt in range(3):
        pending = {t: v for t, v in _YF_INDEX_MAP.items() if v[0] not in yf_results}
        if not pending:
            break
        batch = _yf_indices_parallel(pending)
        yf_results.update(batch)

        fetched = sum(1 for t in _YF_INDEX_MAP if _YF_INDEX_MAP[t][0] in yf_results)
        if fetched >= 4:
            break
        if attempt < 2:
            print(f'[INDICES] yfinance attempt {attempt + 1}: {fetched}/9 — retrying in 2s')
            time.sleep(2)

    fetched = sum(1 for t in _YF_INDEX_MAP if _YF_INDEX_MAP[t][0] in yf_results)
    if fetched >= 2:
        defaults.update(yf_results)
        defaults['data_source']  = 'live'
        defaults['last_updated'] = datetime.now().strftime('%d %b %Y, %I:%M %p IST')
        HEALTH.update({'yfinance_ok': True, 'active_source': 'yfinance',
                       'last_live_fetch': datetime.now()})
        print(f'[INDICES] yfinance OK: {fetched}/9 tickers live')
    else:
        HEALTH['yfinance_ok'] = False
        print(f'[INDICES] yfinance: only {fetched}/9 after 3 attempts — trying NSE')

    # SECONDARY: NSE allIndices API
    if defaults['data_source'] == 'fallback':
        try:
            s = get_nse_session()
            r = s.get('https://www.nseindia.com/api/allIndices', timeout=15)
            data = r.json().get('data', [])
            nse_count = 0
            for item in data:
                sym = item.get('indexSymbol', '')
                if sym in _NSE_INDEX_MAP:
                    k1, k2 = _NSE_INDEX_MAP[sym]
                    defaults[k1] = float(item.get('last',          defaults[k1]) or defaults[k1])
                    defaults[k2] = float(item.get('percentChange', defaults[k2]) or defaults[k2])
                    nse_count += 1
            if nse_count >= 2:
                defaults['data_source']  = 'nse'
                defaults['last_updated'] = datetime.now().strftime('%d %b %Y, %I:%M %p IST')
                HEALTH.update({'nse_ok': True, 'active_source': 'nse',
                               'last_live_fetch': datetime.now()})
                print(f'[INDICES] NSE API OK: {nse_count} indices live')
            else:
                HEALTH['nse_ok'] = False
        except Exception as e:
            HEALTH['nse_ok'] = False
            print(f'[INDICES] NSE failed: {e}')

    if defaults['data_source'] == 'fallback':
        HEALTH['active_source'] = 'fallback'
        print('[INDICES] WARNING: Both yfinance and NSE failed — using hardcoded defaults')

    cache_set('indices', defaults)
    return defaults


def _fetch_index_changes(ticker):
    """Real 1d/5d/20d % change for one index ticker, from actual historical closes."""
    import yfinance as yf
    df = yf.Ticker(ticker).history(period='2mo')
    closes = df['Close'].dropna()
    if len(closes) < 2:
        return None
    last = float(closes.iloc[-1])

    def pct_back(n):
        if len(closes) <= n:
            return None
        prev = float(closes.iloc[-1 - n])
        return round((last - prev) / prev * 100, 2) if prev else None

    return {
        'last':       round(last, 2),
        'change_1d':  pct_back(1),
        'change_5d':  pct_back(5),
        'change_20d': pct_back(20),
    }


def get_sector_index_changes():
    """
    Real 1d/5d/20d % change for every sector index, computed from actual
    historical closes via yfinance — NOT extrapolated/guessed from the
    1-day change. Replaces the old static-multiplier estimate.
    """
    cached = cache_get('sector_index_changes')
    if cached is not None:
        return cached

    results = {}
    try:
        with ThreadPoolExecutor(max_workers=len(_YF_INDEX_MAP)) as ex:
            future_to_key = {
                ex.submit(_fetch_index_changes, ticker): key1
                for ticker, (key1, _key2) in _YF_INDEX_MAP.items()
            }
            for fut in as_completed(future_to_key, timeout=30):
                key1 = future_to_key[fut]
                try:
                    res = fut.result()
                    if res:
                        results[key1] = res
                except Exception:
                    pass
    except Exception as e:
        print(f'[SECTOR CHANGES] parallel pool error: {e}')

    cache_set('sector_index_changes', results, stable_ttl())
    print(f'[SECTOR CHANGES] real 5d/20d computed for {len(results)}/{len(_YF_INDEX_MAP)} indices')
    return results


# ── Market Regime Gate (Layer 1) + Relative Strength (Layer 3) ──────────────────
# Both need a real daily close series for Nifty 50, so they share one fetch.

def get_index_daily_closes(ticker='^NSEI', period='6mo'):
    """Real daily closes for an index — used for the 50DMA regime check and
    for ranking stocks' relative strength against Nifty."""
    cache_key = f'idx_hist_{ticker}'
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        import yfinance as yf
        df = yf.Ticker(ticker).history(period=period)
        closes = df['Close'].dropna()
        result = [round(float(c), 2) for c in closes.tolist()]
    except Exception as e:
        print(f'[REGIME] Failed to fetch {ticker} history: {e}')
        result = []
    cache_set(cache_key, result, stable_ttl())
    return result


def _compute_breadth():
    """% of the TOP50_DATA universe currently trading above their own 50DMA."""
    above, total = 0, 0
    for stock in TOP50_DATA:
        hist = get_stock_history(stock['symbol'])
        if not hist or len(hist) < 50:
            continue
        closes = [r['close'] for r in hist[-50:]]
        dma50  = sum(closes) / len(closes)
        total += 1
        if hist[-1]['close'] > dma50:
            above += 1
    if total == 0:
        return None
    return round(above / total * 100, 1)


def get_market_regime():
    """
    Layer 1 — Market Regime Gate.
      RISK-ON:  Nifty > 50DMA AND 50DMA rising            → full size
      NEUTRAL:  Nifty > 50DMA but flat/choppy, OR breadth
                drops below 40% even with a healthy index → half size
      RISK-OFF: Nifty < 50DMA and falling                 → no new longs
    """
    cached = cache_get('market_regime')
    if cached is not None:
        return cached

    closes = get_index_daily_closes('^NSEI', period='6mo')
    if len(closes) < 56:
        result = {
            'regime':       'NEUTRAL',
            'label':        'Half size, fewer positions',
            'nifty_price':  closes[-1] if closes else None,
            'dma_50':       None,
            'above_dma':    None,
            'dma_rising':   None,
            'breadth_pct':  None,
            'breadth_downgrade': False,
            'reason':       'Insufficient Nifty history to compute 50DMA — defaulting to caution',
            'data_quality': 'estimated',
        }
        cache_set('market_regime', result, stable_ttl())
        return result

    dma_series  = [sum(closes[i - 49:i + 1]) / 50 for i in range(49, len(closes))]
    dma_today   = dma_series[-1]
    dma_5ago    = dma_series[-6] if len(dma_series) > 5 else dma_today
    nifty_price = closes[-1]
    above_dma   = nifty_price > dma_today
    dma_rising  = dma_today > dma_5ago

    breadth_pct = _compute_breadth()

    if above_dma and dma_rising:
        regime, label = 'RISK-ON', 'Full position sizing allowed'
    elif (not above_dma) and (not dma_rising):
        regime, label = 'RISK-OFF', 'No new longs — manage existing only'
    else:
        regime, label = 'NEUTRAL', 'Half size, fewer positions'

    downgraded = False
    if regime == 'RISK-ON' and breadth_pct is not None and breadth_pct < 40:
        regime, label = 'NEUTRAL', 'Half size, fewer positions (weak breadth)'
        downgraded = True

    result = {
        'regime':            regime,
        'label':             label,
        'nifty_price':       round(nifty_price, 2),
        'dma_50':            round(dma_today, 2),
        'above_dma':         above_dma,
        'dma_rising':        dma_rising,
        'breadth_pct':       breadth_pct,
        'breadth_downgrade': downgraded,
        'data_quality':      'live',
    }
    cache_set('market_regime', result, scanner_ttl())
    print(f"[REGIME] {regime} — Nifty {nifty_price:.0f} vs 50DMA {dma_today:.0f} "
          f"(rising={dma_rising}), breadth={breadth_pct}%")
    return result


def get_relative_strength_map():
    """
    Layer 3 — each stock's 50-day return vs Nifty's 50-day return.
      beats Nifty AND top 25% of all beaters → 20 pts
      beats Nifty, mid-pack                  → 10 pts
      underperforms Nifty                    → 0 pts
    Returns {symbol: {'rs_score', 'stock_return_50d', 'nifty_return_50d'}}.
    """
    cached = cache_get('relative_strength_map')
    if cached is not None:
        return cached

    nifty_closes = get_index_daily_closes('^NSEI', period='6mo')
    nifty_ret = None
    if len(nifty_closes) >= 51 and nifty_closes[-51]:
        nifty_ret = (nifty_closes[-1] - nifty_closes[-51]) / nifty_closes[-51] * 100

    stock_returns = {}
    for stock in TOP50_DATA:
        sym  = stock['symbol']
        hist = get_stock_history(sym)
        if hist and len(hist) >= 51 and hist[-51]['close']:
            c0, c1 = hist[-51]['close'], hist[-1]['close']
            stock_returns[sym] = round((c1 - c0) / c0 * 100, 2)
        else:
            stock_returns[sym] = None

    result = {}
    if nifty_ret is None:
        for sym, ret in stock_returns.items():
            result[sym] = {'rs_score': 0, 'stock_return_50d': ret, 'nifty_return_50d': None}
        cache_set('relative_strength_map', result, scanner_ttl())
        return result

    beaters = sorted(
        [(sym, ret) for sym, ret in stock_returns.items() if ret is not None and ret > nifty_ret],
        key=lambda x: -x[1],
    )
    cutoff = max(1, math.ceil(len(beaters) * 0.25)) if beaters else 0
    top25  = {sym for sym, _ in beaters[:cutoff]}

    for sym, ret in stock_returns.items():
        if ret is None or ret <= nifty_ret:
            rs_score = 0
        elif sym in top25:
            rs_score = 20
        else:
            rs_score = 10
        result[sym] = {
            'rs_score':         rs_score,
            'stock_return_50d': ret,
            'nifty_return_50d': round(nifty_ret, 2),
        }

    cache_set('relative_strength_map', result, scanner_ttl())
    print(f'[RELATIVE STRENGTH] Nifty 50d return={nifty_ret:.2f}% — '
          f'{len(beaters)}/{len(stock_returns)} stocks beating it, top25 cutoff={cutoff}')
    return result


# ── Stock list ─────────────────────────────────────────────────────────────────

TOP50_DATA = [
    {'symbol':'RELIANCE','companyName':'Reliance Industries','lastPrice':1293,'pChange':0.8,'totalTradedVolume':8500000,'deliveryToTradedQuantity':58,'marketCap':876000,'sector':'Energy'},
    {'symbol':'TCS','companyName':'Tata Consultancy Services','lastPrice':3820,'pChange':0.4,'totalTradedVolume':2100000,'deliveryToTradedQuantity':62,'marketCap':1392000,'sector':'IT'},
    {'symbol':'HDFCBANK','companyName':'HDFC Bank','lastPrice':1732,'pChange':1.1,'totalTradedVolume':9200000,'deliveryToTradedQuantity':55,'marketCap':1318000,'sector':'Banking'},
    {'symbol':'ICICIBANK','companyName':'ICICI Bank','lastPrice':1331,'pChange':1.4,'totalTradedVolume':11000000,'deliveryToTradedQuantity':67,'marketCap':940000,'sector':'Banking'},
    {'symbol':'INFY','companyName':'Infosys','lastPrice':1589,'pChange':0.3,'totalTradedVolume':5400000,'deliveryToTradedQuantity':59,'marketCap':659000,'sector':'IT'},
    {'symbol':'HINDUNILVR','companyName':'Hindustan Unilever','lastPrice':2380,'pChange':0.2,'totalTradedVolume':1800000,'deliveryToTradedQuantity':61,'marketCap':558000,'sector':'FMCG'},
    {'symbol':'SBIN','companyName':'State Bank of India','lastPrice':1004,'pChange':1.8,'totalTradedVolume':18000000,'deliveryToTradedQuantity':52,'marketCap':896000,'sector':'Banking'},
    {'symbol':'BHARTIARTL','companyName':'Bharti Airtel','lastPrice':1803,'pChange':2.1,'totalTradedVolume':4200000,'deliveryToTradedQuantity':64,'marketCap':1069000,'sector':'Telecom'},
    {'symbol':'ITC','companyName':'ITC Limited','lastPrice':285,'pChange':-0.1,'totalTradedVolume':22000000,'deliveryToTradedQuantity':48,'marketCap':358000,'sector':'FMCG'},
    {'symbol':'KOTAKBANK','companyName':'Kotak Mahindra Bank','lastPrice':1892,'pChange':0.9,'totalTradedVolume':3100000,'deliveryToTradedQuantity':58,'marketCap':377000,'sector':'Banking'},
    {'symbol':'LT','companyName':'Larsen & Toubro','lastPrice':3953,'pChange':0.7,'totalTradedVolume':1900000,'deliveryToTradedQuantity':61,'marketCap':558000,'sector':'Infra'},
    {'symbol':'AXISBANK','companyName':'Axis Bank','lastPrice':1142,'pChange':1.2,'totalTradedVolume':8800000,'deliveryToTradedQuantity':56,'marketCap':353000,'sector':'Banking'},
    {'symbol':'SUNPHARMA','companyName':'Sun Pharmaceutical','lastPrice':1654,'pChange':1.4,'totalTradedVolume':3200000,'deliveryToTradedQuantity':63,'marketCap':397000,'sector':'Pharma'},
    {'symbol':'ASIANPAINT','companyName':'Asian Paints','lastPrice':2298,'pChange':-0.3,'totalTradedVolume':1200000,'deliveryToTradedQuantity':57,'marketCap':220000,'sector':'Consumer'},
    {'symbol':'MARUTI','companyName':'Maruti Suzuki','lastPrice':12540,'pChange':0.5,'totalTradedVolume':890000,'deliveryToTradedQuantity':65,'marketCap':380000,'sector':'Auto'},
    {'symbol':'TITAN','companyName':'Titan Company','lastPrice':3420,'pChange':0.6,'totalTradedVolume':1500000,'deliveryToTradedQuantity':60,'marketCap':304000,'sector':'Consumer'},
    {'symbol':'WIPRO','companyName':'Wipro Limited','lastPrice':465,'pChange':-0.2,'totalTradedVolume':6200000,'deliveryToTradedQuantity':53,'marketCap':242000,'sector':'IT'},
    {'symbol':'HCLTECH','companyName':'HCL Technologies','lastPrice':1698,'pChange':0.4,'totalTradedVolume':3100000,'deliveryToTradedQuantity':58,'marketCap':461000,'sector':'IT'},
    {'symbol':'BAJFINANCE','companyName':'Bajaj Finance','lastPrice':8920,'pChange':1.1,'totalTradedVolume':1200000,'deliveryToTradedQuantity':62,'marketCap':538000,'sector':'Finance'},
    {'symbol':'NTPC','companyName':'NTPC Limited','lastPrice':342,'pChange':0.8,'totalTradedVolume':14000000,'deliveryToTradedQuantity':54,'marketCap':332000,'sector':'Infra'},
    {'symbol':'POWERGRID','companyName':'Power Grid Corp','lastPrice':298,'pChange':0.6,'totalTradedVolume':11000000,'deliveryToTradedQuantity':56,'marketCap':277000,'sector':'Infra'},
    {'symbol':'TECHM','companyName':'Tech Mahindra','lastPrice':1542,'pChange':0.1,'totalTradedVolume':2800000,'deliveryToTradedQuantity':55,'marketCap':150000,'sector':'IT'},
    {'symbol':'DIVISLAB','companyName':"Divi's Laboratories",'lastPrice':5890,'pChange':1.2,'totalTradedVolume':620000,'deliveryToTradedQuantity':66,'marketCap':156000,'sector':'Pharma'},
    {'symbol':'CIPLA','companyName':'Cipla Limited','lastPrice':1423,'pChange':1.1,'totalTradedVolume':2800000,'deliveryToTradedQuantity':64,'marketCap':115000,'sector':'Pharma'},
    {'symbol':'DRREDDY','companyName':"Dr. Reddy's Labs",'lastPrice':6820,'pChange':0.9,'totalTradedVolume':780000,'deliveryToTradedQuantity':63,'marketCap':114000,'sector':'Pharma'},
    {'symbol':'COALINDIA','companyName':'Coal India','lastPrice':383,'pChange':-0.4,'totalTradedVolume':9200000,'deliveryToTradedQuantity':49,'marketCap':237000,'sector':'Energy'},
    {'symbol':'ONGC','companyName':'Oil & Natural Gas Corp','lastPrice':248,'pChange':-0.6,'totalTradedVolume':16000000,'deliveryToTradedQuantity':47,'marketCap':312000,'sector':'Energy'},
    {'symbol':'TATAMOTORS','companyName':'Tata Motors','lastPrice':724,'pChange':0.9,'totalTradedVolume':12000000,'deliveryToTradedQuantity':55,'marketCap':266000,'sector':'Auto'},
    {'symbol':'JSWSTEEL','companyName':'JSW Steel','lastPrice':892,'pChange':-0.8,'totalTradedVolume':6800000,'deliveryToTradedQuantity':52,'marketCap':220000,'sector':'Metal'},
    {'symbol':'TATASTEEL','companyName':'Tata Steel','lastPrice':158,'pChange':-1.1,'totalTradedVolume':38000000,'deliveryToTradedQuantity':50,'marketCap':198000,'sector':'Metal'},
    {'symbol':'HINDALCO','companyName':'Hindalco Industries','lastPrice':674,'pChange':-0.7,'totalTradedVolume':7200000,'deliveryToTradedQuantity':51,'marketCap':152000,'sector':'Metal'},
    {'symbol':'INDUSINDBK','companyName':'IndusInd Bank','lastPrice':834,'pChange':1.3,'totalTradedVolume':7800000,'deliveryToTradedQuantity':58,'marketCap':65000,'sector':'Banking'},
    {'symbol':'BAJAJFINSV','companyName':'Bajaj Finserv','lastPrice':1892,'pChange':0.8,'totalTradedVolume':1800000,'deliveryToTradedQuantity':59,'marketCap':302000,'sector':'Finance'},
    {'symbol':'APOLLOHOSP','companyName':'Apollo Hospitals','lastPrice':6240,'pChange':1.6,'totalTradedVolume':480000,'deliveryToTradedQuantity':68,'marketCap':89000,'sector':'Pharma'},
    {'symbol':'ADANIPORTS','companyName':'Adani Ports','lastPrice':1342,'pChange':0.3,'totalTradedVolume':3400000,'deliveryToTradedQuantity':55,'marketCap':289000,'sector':'Infra'},
    {'symbol':'EICHERMOT','companyName':'Eicher Motors','lastPrice':4820,'pChange':0.4,'totalTradedVolume':680000,'deliveryToTradedQuantity':61,'marketCap':132000,'sector':'Auto'},
    {'symbol':'HEROMOTOCO','companyName':'Hero MotoCorp','lastPrice':3920,'pChange':0.2,'totalTradedVolume':890000,'deliveryToTradedQuantity':58,'marketCap':78000,'sector':'Auto'},
    {'symbol':'BRITANNIA','companyName':'Britannia Industries','lastPrice':5420,'pChange':0.3,'totalTradedVolume':320000,'deliveryToTradedQuantity':62,'marketCap':130000,'sector':'FMCG'},
    {'symbol':'NESTLEIND','companyName':'Nestle India','lastPrice':2289,'pChange':0.1,'totalTradedVolume':450000,'deliveryToTradedQuantity':64,'marketCap':220000,'sector':'FMCG'},
    {'symbol':'PIDILITIND','companyName':'Pidilite Industries','lastPrice':2890,'pChange':0.5,'totalTradedVolume':580000,'deliveryToTradedQuantity':65,'marketCap':147000,'sector':'Consumer'},
    {'symbol':'SBILIFE','companyName':'SBI Life Insurance','lastPrice':1742,'pChange':0.7,'totalTradedVolume':1200000,'deliveryToTradedQuantity':60,'marketCap':174000,'sector':'Finance'},
    {'symbol':'HDFCLIFE','companyName':'HDFC Life Insurance','lastPrice':692,'pChange':0.6,'totalTradedVolume':3800000,'deliveryToTradedQuantity':59,'marketCap':148000,'sector':'Finance'},
    {'symbol':'GRASIM','companyName':'Grasim Industries','lastPrice':2698,'pChange':0.4,'totalTradedVolume':980000,'deliveryToTradedQuantity':57,'marketCap':178000,'sector':'Consumer'},
    {'symbol':'ULTRACEMCO','companyName':'UltraTech Cement','lastPrice':10820,'pChange':0.2,'totalTradedVolume':420000,'deliveryToTradedQuantity':62,'marketCap':312000,'sector':'Consumer'},
    {'symbol':'BPCL','companyName':'Bharat Petroleum','lastPrice':324,'pChange':-0.5,'totalTradedVolume':8900000,'deliveryToTradedQuantity':50,'marketCap':145000,'sector':'Energy'},
    {'symbol':'SIEMENS','companyName':'Siemens India','lastPrice':6890,'pChange':0.8,'totalTradedVolume':320000,'deliveryToTradedQuantity':63,'marketCap':246000,'sector':'Infra'},
    {'symbol':'HAVELLS','companyName':'Havells India','lastPrice':1689,'pChange':0.6,'totalTradedVolume':1100000,'deliveryToTradedQuantity':61,'marketCap':106000,'sector':'Consumer'},
    {'symbol':'GODREJCP','companyName':'Godrej Consumer Products','lastPrice':1189,'pChange':0.3,'totalTradedVolume':1400000,'deliveryToTradedQuantity':59,'marketCap':121000,'sector':'FMCG'},
    {'symbol':'TATACONSUM','companyName':'Tata Consumer Products','lastPrice':1089,'pChange':0.5,'totalTradedVolume':1800000,'deliveryToTradedQuantity':60,'marketCap':97000,'sector':'FMCG'},
    {'symbol':'MUTHOOTFIN','companyName':'Muthoot Finance','lastPrice':2140,'pChange':1.3,'totalTradedVolume':980000,'deliveryToTradedQuantity':62,'marketCap':86000,'sector':'Finance'},
]


def get_stock_list():
    """
    Returns the 50-stock universe with REAL live prices.

    TOP50_DATA only ever supplies identity fields (symbol, companyName,
    sector) and a static marketCap reference. lastPrice / pChange are ALWAYS
    overwritten with the real latest close from get_stock_history() (which
    itself is yfinance-backed, self-healing — see get_stock_history). NSE's
    NIFTY 500 list is used only as a best-effort source for delivery% and
    traded volume; if it fails, those two fields fall back to the static
    TOP50_DATA estimate and are tagged so callers can tell the difference.
    """
    cached = cache_get('stocks')
    if cached:
        return cached

    nse_extra = {}
    try:
        s = get_nse_session()
        r = s.get('https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20500', timeout=20)
        data = r.json().get('data', [])
        nse_extra = {d['symbol']: d for d in data if d.get('symbol')}
        HEALTH['nse_stocklist_ok'] = bool(nse_extra)
    except Exception as e:
        HEALTH['nse_stocklist_ok'] = False
        print(f'[STOCK LIST] NSE NIFTY 500 fetch failed: {e} — delivery%% will use static estimate')

    result = []
    real_price_count = 0
    for base in TOP50_DATA:
        sym    = base['symbol']
        merged = {**base}
        extra  = nse_extra.get(sym)

        if extra:
            merged['deliveryToTradedQuantity'] = extra.get('deliveryToTradedQuantity', merged.get('deliveryToTradedQuantity'))
            merged['totalTradedVolume']        = extra.get('totalTradedVolume',        merged.get('totalTradedVolume'))
            merged['delivery_source']          = 'nse_real'
        else:
            merged['delivery_source']          = 'estimated'

        # PRICE: always derived from real price history, never from the
        # hardcoded literal in TOP50_DATA. price_source reflects what
        # get_stock_history ACTUALLY used (yfinance vs synthetic fallback),
        # not just "did we get any rows back" — synthetic fallback also
        # returns non-empty rows and must not be mistaken for real.
        hist = get_stock_history(sym)
        src  = get_price_source(sym)
        if hist:
            last = hist[-1]
            prev = hist[-2] if len(hist) >= 2 else last
            merged['lastPrice']    = last['close']
            merged['pChange']      = round((last['close'] - prev['close']) / prev['close'] * 100, 2) if prev['close'] else 0.0
            merged['price_source'] = 'yfinance' if src == 'yfinance' else 'synthetic'
            if src == 'yfinance':
                real_price_count += 1
        else:
            merged['price_source'] = 'unavailable'

        merged['marketCap_source'] = 'static_estimate'   # no free live market-cap source wired up
        result.append(merged)

    # Strict by design: ANY synthetic price flips this to False so
    # any_fake_data/fake_data_list never hide a single stale stock just
    # because most others are real.
    HEALTH['prices_real'] = real_price_count >= len(TOP50_DATA)
    cache_set('stocks', result, stable_ttl())
    return result


# ── Price history ──────────────────────────────────────────────────────────────

def _make_deterministic_history(symbol: str) -> list:
    """
    Generate 90 trading days of synthetic price history for a symbol.
    Uses MD5-based seed so output is IDENTICAL across Python restarts
    (immune to PYTHONHASHSEED).  Never call random without this function.
    """
    rng        = random.Random(_sym_seed(symbol))
    stocks_ref = {s['symbol']: s for s in TOP50_DATA}
    base_price = float(stocks_ref.get(symbol, {}).get('lastPrice', 1000))
    price      = base_price * rng.uniform(0.88, 1.0)
    result     = []
    # Use a fixed anchor date (today at midnight IST) so row dates don't shift each run
    anchor = (datetime.utcnow() + timedelta(hours=5, minutes=30)).replace(
        hour=0, minute=0, second=0, microsecond=0)
    for i in range(90, 0, -1):
        d = anchor - timedelta(days=i)
        if d.weekday() >= 5:
            continue
        price *= (1 + rng.uniform(-0.025, 0.028))
        h  = price * rng.uniform(1.005, 1.02)
        lv = price * rng.uniform(0.98,  0.995)
        result.append({
            'date':   d.strftime('%Y-%m-%d'),
            'open':   round(price * 0.998, 2),
            'high':   round(h,  2),
            'low':    round(lv, 2),
            'close':  round(price, 2),
            'volume': rng.randint(500_000, 5_000_000),
        })
    if result and base_price:
        drift = base_price / result[-1]['close']
        result[-1]['close'] = round(result[-1]['close'] * drift, 2)
    return result


def get_price_source(symbol: str) -> str:
    """'yfinance' (real) or 'synthetic' (fallback) for this symbol's cached price history."""
    entry = _load_disk_prices().get(symbol)
    return entry.get('source', 'unknown') if entry else 'unknown'


def _fetch_yfinance_history(symbol: str):
    """
    Real OHLCV history from yfinance. Returns rows list, or raises on failure.

    yfinance occasionally returns a trailing row for the most recent session
    with NaN OHLC (data not finalized yet by Yahoo) while still reporting a
    volume figure. That NaN would otherwise corrupt every price computed
    downstream (and break JSON serialization outright) — so such rows are
    dropped before anything else sees this data, same as a finalized close
    is required everywhere else in the app.
    """
    import math
    import yfinance as yf
    yf_sym = symbol if '.NS' in symbol else f'{symbol}.NS'
    df = yf.Ticker(yf_sym).history(period='3mo')
    if df.empty:
        raise ValueError('empty dataframe')
    rows = []
    for date, row in df.iterrows():
        close = float(row['Close'])
        if math.isnan(close):
            continue   # unfinalized session — wait for a real close instead
        rows.append({
            'date':   str(date)[:10],
            'open':   round(float(row['Open']),   2),
            'high':   round(float(row['High']),   2),
            'low':    round(float(row['Low']),    2),
            'close':  round(close, 2),
            'volume': int(row['Volume']),
        })
    if not rows:
        raise ValueError('all rows had NaN close')
    return rows


def get_stock_history(symbol, days=90):
    """
    Real price history for `symbol`, with self-healing fallback.

    Priority every call:
      1. Memory cache (hot path within this process run).
      2. Disk cache TAGGED 'yfinance' (real data already confirmed today) — trusted as-is.
      3. Disk cache TAGGED 'synthetic' OR no disk entry at all — ALWAYS retries
         yfinance before accepting synthetic data. This means a stale synthetic
         entry from an earlier outage gets silently replaced with real data the
         moment yfinance starts working again — it never blocks real data for
         the rest of the day.
    """
    cache_key = f'hist_{symbol}'

    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    disk_prices = _load_disk_prices()
    entry = disk_prices.get(symbol)
    if entry and entry.get('source') == 'yfinance':
        cache_set(cache_key, entry['rows'])
        return entry['rows']

    # No real data on disk yet (either missing, or previously synthetic) —
    # always attempt a real fetch before falling back.
    try:
        rows   = _fetch_yfinance_history(symbol)
        source = 'yfinance'
        print(f'[yfinance] {symbol}: {len(rows)} real rows fetched')
    except Exception as e:
        source = 'synthetic'
        if entry and entry.get('source') == 'synthetic':
            rows = entry['rows']   # deterministic — identical to a fresh regen anyway
        else:
            rows = _make_deterministic_history(symbol)
        print(f'[FALLBACK] yfinance failed for {symbol} ({e}) — using synthetic data for {symbol} - NOT REAL')

    with _disk_lock:
        disk_prices[symbol] = {'source': source, 'rows': rows}
        _save_disk_prices()
    cache_set(cache_key, rows)
    return rows


# ── Bulk deals ─────────────────────────────────────────────────────────────────

def last_trading_day():
    """Return the most recent weekday (Mon-Fri) as a formatted date string."""
    d = datetime.now()
    while d.weekday() >= 5:   # 5=Sat, 6=Sun
        d -= timedelta(days=1)
    return d.strftime('%d-%b-%Y')


def get_bulk_deals(days=7):
    # PRIMARY: nsepython handles NSE session/cookies automatically
    try:
        from nsepython import get_bulkdeals
        df = get_bulkdeals()
        if df is not None and not df.empty:
            result = []
            for _, row in df.iterrows():
                result.append({
                    'date':        str(row.get('Date', '')),
                    'symbol':      str(row.get('Symbol', '')),
                    'client_name': str(row.get('Client Name', '')),
                    'buy_sell':    str(row.get('Buy/Sell', '')),
                    'quantity':    int(row.get('Quantity Traded', 0) or 0),
                    'price':       float(row.get('Trade Price / Wght. Avg. Price', 0) or 0),
                })
            if result:
                HEALTH['bulk_deals_real'] = True
                print(f'[BULK DEALS] nsepython: {len(result)} real deals fetched')
                return result
    except Exception as e:
        print(f'[BULK DEALS] nsepython failed: {e}')

    # SECONDARY: direct NSE API
    try:
        s = get_nse_session()
        r = s.get('https://www.nseindia.com/api/bulk-deals', timeout=15)
        data = r.json().get('data', [])
        result = []
        for d in data:
            result.append({
                'date':        d.get('date', ''),
                'symbol':      d.get('symbol', ''),
                'client_name': d.get('clientName', ''),
                'buy_sell':    d.get('buySell', ''),
                'quantity':    int(d.get('quantityTraded', 0) or 0),
                'price':       float(d.get('tradePrice', 0) or 0),
            })
        if result:
            HEALTH['bulk_deals_real'] = True
            print(f'[BULK DEALS] NSE API: {len(result)} deals fetched')
            return result
    except Exception as e:
        print(f'[BULK DEALS] NSE API failed: {e}')

    # FALLBACK: hardcoded sample (last resort only)
    HEALTH['bulk_deals_real'] = False
    print('[BULK DEALS] WARNING: Both sources failed — using hardcoded fallback')
    last_day = last_trading_day()
    return [
        {'date': last_day, 'symbol': 'ICICIBANK',  'client_name': 'HDFC Mutual Fund — HDFC Flexi Cap Fund', 'buy_sell': 'BUY',  'quantity': 1200000, 'price': 1325.50},
        {'date': last_day, 'symbol': 'SUNPHARMA',  'client_name': 'LIC of India',                           'buy_sell': 'BUY',  'quantity':  850000, 'price': 1652.00},
        {'date': last_day, 'symbol': 'BHARTIARTL', 'client_name': 'SBI Mutual Fund',                        'buy_sell': 'BUY',  'quantity':  620000, 'price': 1803.25},
        {'date': last_day, 'symbol': 'TATASTEEL',  'client_name': 'Goldman Sachs Asset Mgmt',               'buy_sell': 'SELL', 'quantity': 9000000, 'price':  158.75},
        {'date': last_day, 'symbol': 'HDFCBANK',   'client_name': 'Nippon India Mutual Fund',               'buy_sell': 'BUY',  'quantity':  500000, 'price': 1732.00},
        {'date': last_day, 'symbol': 'SBIN',       'client_name': 'Axis Mutual Fund',                       'buy_sell': 'BUY',  'quantity': 2100000, 'price': 1004.50},
        {'date': last_day, 'symbol': 'RELIANCE',   'client_name': 'Mirae Asset MF',                         'buy_sell': 'BUY',  'quantity':  780000, 'price': 1293.00},
    ]


# ── Data honesty ─────────────────────────────────────────────────────────────
# Single source of truth for "what in this app is real vs estimated right now".
# Surfaced via /api/health and /api/data-quality so nothing fake is silent.

def get_data_quality() -> dict:
    fake_list = []
    if HEALTH.get('prices_real') is False:
        synthetic_syms = [s['symbol'] for s in TOP50_DATA if get_price_source(s['symbol']) == 'synthetic']
        names = ', '.join(synthetic_syms) if synthetic_syms else 'unknown'
        fake_list.append(f'stock_prices: {names} — yfinance has no data for these symbols right now, using synthetic fallback')
    if HEALTH.get('fii_dii_real') is False:
        fake_list.append('fii_dii_today (NSE unreachable)')
    if HEALTH.get('fii_dii_history_real') is False:
        fake_list.append('fii_dii_history (niftytrader scrape unreachable)')
    if HEALTH.get('bulk_deals_real') is False:
        fake_list.append('bulk_deals (NSE + nsepython unreachable — using hardcoded sample)')
    if HEALTH.get('nse_stocklist_ok') is False:
        fake_list.append('delivery_pct (NSE NIFTY 500 unreachable — using static estimate)')

    return {
        'prices':        'live' if HEALTH.get('prices_real')         else 'estimated',
        'fii_dii_today': 'live' if HEALTH.get('fii_dii_real')         else 'estimated',
        'fii_dii_history': 'live' if HEALTH.get('fii_dii_history_real') else 'estimated',
        'bulk_deals':    'live' if HEALTH.get('bulk_deals_real')      else 'estimated',
        'delivery_pct':  'live' if HEALTH.get('nse_stocklist_ok')     else 'estimated',
        'shareholding':  'not_used',     # no shareholding data is fetched or shown anywhere in this app
        'market_cap':    'static_reference',  # no free live market-cap source wired up
        'sector_5d_20d_change': 'live',  # computed from real index history — see get_sector_index_changes()
        'sector_fii_flows':     'estimated',  # fii_total × static sector weight — no real per-sector flow source exists free
        'any_fake_data': len(fake_list) > 0,
        'fake_data_list': fake_list,
    }


# ── Background cache pre-warmer ────────────────────────────────────────────────
# Runs once at startup in a daemon thread so the first real request doesn't
# block on 50 sequential yfinance calls. Fetches real data in parallel;
# only falls back to deterministic synthetic data (loudly logged) per-symbol
# if yfinance genuinely fails for that symbol.

def _prewarm():
    """
    Fill memory + disk cache with REAL price histories for all 50 stocks
    before the first request arrives. Tries yfinance in parallel for every
    symbol that isn't already confirmed-real on disk; only falls back to
    deterministic synthetic data (loudly logged) for symbols yfinance can't
    serve. This is what makes the very first /api/scanner call of the day
    show real prices instead of stale hardcoded ones.
    """
    print('[PREWARM] Starting background cache warm-up (live yfinance fetch)...')
    try:
        get_indices()
        get_fii_dii_data(30)

        disk_prices = _load_disk_prices()
        pending     = []
        for stock in sorted(TOP50_DATA, key=lambda x: x['symbol']):
            sym = stock['symbol']
            if cache_get(f'hist_{sym}') is not None:
                continue
            entry = disk_prices.get(sym)
            if entry and entry.get('source') == 'yfinance':
                cache_set(f'hist_{sym}', entry['rows'])
                continue
            pending.append(sym)

        real_count, fake_count = 0, 0
        if pending:
            with ThreadPoolExecutor(max_workers=10) as ex:
                future_to_sym = {ex.submit(_fetch_yfinance_history, sym): sym for sym in pending}
                for fut in as_completed(future_to_sym, timeout=60):
                    sym = future_to_sym[fut]
                    try:
                        rows   = fut.result()
                        source = 'yfinance'
                        real_count += 1
                    except Exception as e:
                        existing = disk_prices.get(sym)
                        rows     = existing['rows'] if existing and existing.get('source') == 'synthetic' else _make_deterministic_history(sym)
                        source   = 'synthetic'
                        fake_count += 1
                        print(f'[FALLBACK] yfinance failed for {sym} ({e}) — using synthetic data for {sym} - NOT REAL')
                    cache_set(f'hist_{sym}', rows)
                    disk_prices[sym] = {'source': source, 'rows': rows}

            with _disk_lock:
                _save_disk_prices()

        HEALTH['prices_real'] = fake_count == 0
        print(f'[PREWARM] Done — {len(TOP50_DATA)} stocks warm. '
              f'{real_count} fetched live this run, {fake_count} synthetic, '
              f'{len(TOP50_DATA) - len(pending)} already cached real from disk.')
    except Exception as e:
        print(f'[PREWARM] Error: {e}')

threading.Thread(target=_prewarm, daemon=True).start()
