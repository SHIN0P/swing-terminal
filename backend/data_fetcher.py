import requests
import time
import random
import threading
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

CACHE = {}

HEALTH = {
    'yfinance_ok':     None,   # True/False/None (None = not tested yet)
    'nse_ok':          None,
    'active_source':   'unknown',
    'last_live_fetch': None,
    'last_attempt':    None,
    'bulk_deals_real': None,
    'fii_dii_real':    None,
}


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


# ── Sample / fallback data ─────────────────────────────────────────────────────

def make_sample_fii_dii(days=30):
    # Each calendar day gets its own seed → same day always returns same numbers.
    result = []
    for i in range(days, 0, -1):
        d = datetime.now() - timedelta(days=i)
        if d.weekday() >= 5:
            continue
        rng = random.Random(int(d.strftime('%Y%m%d')))
        fii_net = rng.randint(-3000, 4000)
        dii_net = rng.randint(-500,  5000)
        result.append({
            'date':     d.strftime('%d-%b-%Y'),
            'fii_buy':  abs(fii_net) + rng.randint(5000, 15000),
            'fii_sell': abs(fii_net) + rng.randint(4000, 13000),
            'fii_net':  fii_net,
            'dii_buy':  abs(dii_net) + rng.randint(3000, 10000),
            'dii_sell': abs(dii_net) + rng.randint(2000,  8000),
            'dii_net':  dii_net,
        })
    return result[-days:]


# ── FII / DII ──────────────────────────────────────────────────────────────────

def get_fii_dii_data(days=30):
    cached = cache_get(f'fii_{days}')
    if cached:
        return cached

    # Step 1: Try to get TODAY's real FII/DII from NSE via nsepython
    today_real = None
    try:
        from nsepython import nse_fiidii
        df = nse_fiidii()
        fii_row = df[df['category'].str.contains('FII', case=False)].iloc[0]
        dii_row = df[df['category'].str.contains('DII', case=False)].iloc[0]
        today_real = {
            'date':     fii_row['date'],
            'fii_buy':  float(fii_row['buyValue']),
            'fii_sell': float(fii_row['sellValue']),
            'fii_net':  float(fii_row['netValue']),
            'dii_buy':  float(dii_row['buyValue']),
            'dii_sell': float(dii_row['sellValue']),
            'dii_net':  float(dii_row['netValue']),
        }
        HEALTH['fii_dii_real'] = True
        print(f"[FII/DII] Real today: FII net={today_real['fii_net']}, DII net={today_real['dii_net']}")
    except Exception as e:
        HEALTH['fii_dii_real'] = False
        print(f'[FII/DII] WARNING: NSE real data failed: {e} — chart will use estimated history')

    # Step 2: Build 30-day chart from deterministic seeds (stable per-day history)
    result = make_sample_fii_dii(days)

    # Step 3: Replace the last entry with real today's data if we got it
    if today_real:
        if result and result[-1]['date'] == today_real['date']:
            result[-1] = today_real
        else:
            result.append(today_real)
            result = result[-days:]

    cache_set(f'fii_{days}', result)
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
    cached = cache_get('stocks')
    if cached:
        return cached
    try:
        s = get_nse_session()
        r = s.get('https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20500', timeout=20)
        data = r.json().get('data', [])
        result = [d for d in data if d.get('symbol') and d.get('symbol') != 'NIFTY 500']
        if result:
            cache_set('stocks', result)
            return result
    except Exception as e:
        print(f'Stock list fetch failed: {e} — using top 50 dataset')
    cache_set('stocks', TOP50_DATA)
    return TOP50_DATA


# ── Price history ──────────────────────────────────────────────────────────────

def get_stock_history(symbol, days=90):
    cache_key = f'hist_{symbol}'
    cached = cache_get(cache_key)
    if cached:
        return cached

    # Use Ticker().history() — yf.download() returns MultiIndex columns in v1.4+
    # which breaks row['Date'], row['Close'] etc. history() always uses simple columns.
    import yfinance as yf
    yf_sym = symbol if '.NS' in symbol else f'{symbol}.NS'
    try:
        df = yf.Ticker(yf_sym).history(period='3mo')
        if df.empty:
            raise ValueError('empty dataframe')
        result = []
        for date, row in df.iterrows():
            result.append({
                'date':   str(date)[:10],
                'open':   float(row['Open']),
                'high':   float(row['High']),
                'low':    float(row['Low']),
                'close':  float(row['Close']),
                'volume': int(row['Volume']),
            })
        cache_set(cache_key, result)
        print(f'yfinance OK: {symbol} ({len(result)} rows)')
        return result
    except Exception as e:
        print(f'yfinance failed for {symbol}: {e} — using deterministic fallback')

    # Deterministic fallback: fixed per-symbol seed → scores never drift between refreshes.
    rng        = random.Random(hash(symbol) % 100_000)
    stocks_ref = {s['symbol']: s for s in TOP50_DATA}
    base_price = float(stocks_ref.get(symbol, {}).get('lastPrice', 1000))
    price      = base_price * rng.uniform(0.88, 1.0)
    result     = []
    for i in range(90, 0, -1):
        d = datetime.now() - timedelta(days=i)
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
    # Anchor last close to the reference price so trade levels make sense.
    if result and base_price:
        drift = base_price / result[-1]['close']
        result[-1]['close'] = round(result[-1]['close'] * drift, 2)

    cache_set(cache_key, result)   # stable_ttl() → holds until midnight IST when market closed
    return result


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


# ── Background cache pre-warmer ────────────────────────────────────────────────
# Runs once at startup in a daemon thread so the first real request is instant.
# Uses only the deterministic synthetic path — no yfinance on startup — so it
# completes in <5 seconds regardless of network conditions.

def _prewarm():
    print('[PREWARM] Starting background cache warm-up...')
    try:
        get_indices()
        get_fii_dii_data(30)
        for stock in TOP50_DATA:
            sym = stock['symbol']
            if cache_get(f'hist_{sym}') is None:
                # Bypass yfinance for prewarm — just fill synthetic cache instantly
                rng        = random.Random(hash(sym) % 100_000)
                base_price = float(stock.get('lastPrice', 1000))
                price      = base_price * rng.uniform(0.88, 1.0)
                result     = []
                for i in range(90, 0, -1):
                    d = datetime.now() - timedelta(days=i)
                    if d.weekday() >= 5:
                        continue
                    price *= (1 + rng.uniform(-0.025, 0.028))
                    h  = price * rng.uniform(1.005, 1.02)
                    lv = price * rng.uniform(0.98,  0.995)
                    result.append({
                        'date':   d.strftime('%Y-%m-%d'),
                        'open':   round(price * 0.998, 2),
                        'high':   round(h, 2),
                        'low':    round(lv, 2),
                        'close':  round(price, 2),
                        'volume': rng.randint(500_000, 5_000_000),
                    })
                if result:
                    drift = base_price / result[-1]['close']
                    result[-1]['close'] = round(result[-1]['close'] * drift, 2)
                cache_set(f'hist_{sym}', result)
        print('[PREWARM] Cache warm-up complete — all 50 stocks ready.')
    except Exception as e:
        print(f'[PREWARM] Error during warm-up: {e}')

threading.Thread(target=_prewarm, daemon=True).start()
