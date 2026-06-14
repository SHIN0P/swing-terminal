from indicators import compute_indicators


def score_stock(stock_data, history, fii_net_10d=0, sector_change=0):
    ind = compute_indicators(history)

    # ── Technical Score (40 pts) ──────────────────────────────────────────────
    tech = 0

    rsi = ind.get('rsi', 50)
    if 40 <= rsi <= 60:
        tech += 12
    elif 30 <= rsi < 40 or 60 < rsi <= 68:
        tech += 8
    elif rsi < 30:
        tech += 14   # oversold bounce candidate
    elif rsi > 70:
        tech += 4    # overbought risk

    macd_hist = ind.get('macd_hist', 0)
    if macd_hist > 0:
        tech += 10
    elif macd_hist > -0.5:
        tech += 5

    c      = ind.get('close', 0)
    ema20  = ind.get('ema20', c)
    ema50  = ind.get('ema50', c)
    ema200 = ind.get('ema200', c)
    if c > ema20 > ema50 > ema200:
        tech += 12   # perfect alignment
    elif c > ema20 > ema50:
        tech += 8
    elif c > ema20:
        tech += 4

    adx = ind.get('adx', 15)
    if adx > 25:
        tech += 6
    elif adx > 20:
        tech += 3

    tech = min(40, tech)

    # ── FII / DII Score (25 pts) ──────────────────────────────────────────────
    fii_score = 0

    delivery  = float(stock_data.get('deliveryToTradedQuantity', 50) or 50)
    vol_ratio = ind.get('vol_ratio', 1.0)

    if delivery >= 65:
        fii_score += 10
    elif delivery >= 55:
        fii_score += 7
    elif delivery >= 45:
        fii_score += 4

    if fii_net_10d > 10000:
        fii_score += 10
    elif fii_net_10d > 5000:
        fii_score += 7
    elif fii_net_10d > 0:
        fii_score += 4
    elif fii_net_10d < -5000:
        fii_score -= 5

    if vol_ratio > 2.0:
        fii_score += 5
    elif vol_ratio > 1.5:
        fii_score += 3

    fii_score = max(0, min(25, fii_score))

    # ── Fundamental Score (20 pts) ────────────────────────────────────────────
    fund = 0

    mkt_cap = float(stock_data.get('marketCap', 0) or 0)
    if mkt_cap > 500000:
        fund += 8    # large-cap stability
    elif mkt_cap > 50000:
        fund += 12   # mid-cap opportunity
    elif mkt_cap > 5000:
        fund += 6

    roc = ind.get('roc', 0)
    if 2 < roc < 20:
        fund += 8    # momentum without being extended
    elif roc >= 20:
        fund += 3
    elif roc < -15:
        fund += 4    # deep reversal candidate

    fund = min(20, fund)

    # ── Sector Score (15 pts) ─────────────────────────────────────────────────
    if sector_change > 2:
        sector_score = 15
    elif sector_change > 1:
        sector_score = 12
    elif sector_change > 0:
        sector_score = 9
    elif sector_change > -1:
        sector_score = 5
    elif sector_change > -2:
        sector_score = 2
    else:
        sector_score = 0

    composite = max(0, min(100, tech + fii_score + fund + sector_score))

    return {
        'composite_score':    composite,
        'tech_score':         tech,
        'fii_dii_score':      fii_score,
        'fundamental_score':  fund,
        'sector_score':       sector_score,
        'indicators':         ind,
    }


def get_signal(score):
    if score >= 80: return 'STRONG BUY', '#00E5A0'
    if score >= 65: return 'BUY',        '#58A6FF'
    if score >= 50: return 'WATCHLIST',  '#E3B341'
    if score >= 35: return 'HOLD',       '#F97316'
    return 'AVOID', '#F85149'


def get_trade_levels(price, atr, signal='BUY'):
    price    = float(price or 1000)
    atr      = float(atr  or price * 0.02)

    entry_low  = round(price * 0.998, 2)
    entry_high = round(price * 1.005, 2)
    sl         = round(price - atr * 1.5, 2)
    t1         = round(price + atr * 2.5, 2)
    t2         = round(price + atr * 4.5, 2)

    risk   = price - sl
    reward = t1 - price
    rr     = round(reward / risk, 1) if risk > 0 else 1.5

    sl_pct = round((price - sl) / price * 100, 2)
    t1_pct = round((t1 - price) / price * 100, 2)

    return {
        'entry_zone_low':  entry_low,
        'entry_zone_high': entry_high,
        'stop_loss':       sl,
        'target_1':        t1,
        'target_2':        t2,
        'risk_reward':     rr,
        'sl_pct':          sl_pct,
        't1_pct':          t1_pct,
        'hold_days':       '7-15',
    }
