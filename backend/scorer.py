from indicators import compute_indicators


def score_stock(stock_data, history, fii_net_10d=0, sector_change=0, rs_score=0):
    """
    rs_score: 0/10/20 — Relative Strength vs Nifty (Layer 3), precomputed by
    the caller across the whole scanned universe (see
    data_fetcher.get_relative_strength_map). It lives inside the 40-pt
    Technical budget — indicator-based technical points are scaled down to
    a 20-pt ceiling to make room, so composite still maxes at 100:
        technical(40) = indicators(20) + relative_strength(20)
        + fii_dii(25) + fundamental(20) + sector(15)
    """
    ind = compute_indicators(history)

    # ── Technical: indicator component (20 pts ceiling — was 40 before RS) ────
    tech = 0

    rsi = ind.get('rsi', 50)
    if 40 <= rsi <= 60:
        tech += 6
    elif 30 <= rsi < 40 or 60 < rsi <= 68:
        tech += 4
    elif rsi < 30:
        tech += 7    # oversold bounce candidate
    elif rsi > 70:
        tech += 2    # overbought risk

    macd_hist = ind.get('macd_hist', 0)
    if macd_hist > 0:
        tech += 5
    elif macd_hist > -0.5:
        tech += 2

    c      = ind.get('close', 0)
    ema20  = ind.get('ema20', c)
    ema50  = ind.get('ema50', c)
    ema200 = ind.get('ema200', c)
    if c > ema20 > ema50 > ema200:
        tech += 6    # perfect alignment
    elif c > ema20 > ema50:
        tech += 4
    elif c > ema20:
        tech += 2

    adx = ind.get('adx', 15)
    if adx > 25:
        tech += 3
    elif adx > 20:
        tech += 1

    indicator_score = min(20, tech)

    # ── Technical: Relative Strength component (20 pts ceiling) ───────────────
    # Precomputed by caller — see data_fetcher.get_relative_strength_map().
    relative_strength_score = max(0, min(20, rs_score))

    tech = min(40, indicator_score + relative_strength_score)

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
        'composite_score':         composite,
        'tech_score':              tech,                       # indicator_score + relative_strength_score, ≤40
        'indicator_score':         indicator_score,             # ≤20 — RSI/MACD/EMA/ADX only
        'relative_strength_score': relative_strength_score,     # ≤20 — Layer 3
        'fii_dii_score':           fii_score,
        'fundamental_score':       fund,
        'sector_score':            sector_score,
        'indicators':              ind,
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

    # Breakeven trail trigger = entry + 1R (one full initial-risk multiple)
    breakeven_trigger = round(price + risk, 2) if risk > 0 else None

    return {
        'entry_zone_low':    entry_low,
        'entry_zone_high':   entry_high,
        'stop_loss':         sl,
        'target_1':          t1,
        'target_2':          t2,
        'risk_reward':       rr,
        'sl_pct':            sl_pct,
        't1_pct':            t1_pct,
        'hold_days':         '7-15',
        'breakeven_trigger': breakeven_trigger,
        'trail_note':        'At +1R move stop to breakeven',
    }


# ── Layer 4: Position Size Calculator ────────────────────────────────────────

MAX_POSITION_PCT_OF_CAPITAL = 15.0   # warn if a single position exceeds this


def compute_position_size(capital, risk_pct, entry_price, stop_loss):
    """
    risk_amount      = capital × risk%
    stop_distance    = entry − stop loss
    shares            = risk_amount ÷ stop_distance, rounded DOWN
    position_value   = shares × entry_price
    max_loss          = shares × stop_distance  (== risk_amount, by construction)
    """
    capital     = float(capital or 0)
    risk_pct    = float(risk_pct or 0)
    entry_price = float(entry_price or 0)
    stop_loss   = float(stop_loss or 0)

    risk_amount   = round(capital * risk_pct / 100, 2)
    stop_distance = round(entry_price - stop_loss, 2)

    if stop_distance <= 0 or entry_price <= 0:
        shares = 0
    else:
        shares = int(risk_amount // stop_distance)

    position_value = round(shares * entry_price, 2)
    max_loss        = round(shares * stop_distance, 2)
    pct_of_capital  = round(position_value / capital * 100, 2) if capital > 0 else 0

    return {
        'capital':        capital,
        'risk_pct':       risk_pct,
        'risk_amount':    risk_amount,
        'stop_distance':  stop_distance,
        'shares':         shares,
        'position_value': position_value,
        'max_loss':       max_loss,
        'pct_of_capital': pct_of_capital,
        'too_large':      pct_of_capital > MAX_POSITION_PCT_OF_CAPITAL,
    }


# ── Layer 9: Tax & Cost Calculator ───────────────────────────────────────────

STCG_TAX_RATE     = 0.20   # short-term capital gains (swing trades held < 12mo)
STCG_CESS_RATE    = 0.04   # health & education cess, applied ON the tax amount
ROUNDTRIP_COST_PCT = 0.001  # ~0.1% — brokerage + STT + exchange/DP charges + slippage


def compute_net_pnl(gross_pnl, position_value):
    """
    Real take-home after round-trip costs and STCG tax.
    Costs apply either way (you pay brokerage/STT on any closed trade).
    Tax applies only to a net gain after costs — losses get no tax credit
    here (that requires offsetting against other realized gains, which this
    per-trade calculator doesn't know about).
    """
    gross_pnl      = float(gross_pnl or 0)
    position_value = float(position_value or 0)

    cost       = round(position_value * ROUNDTRIP_COST_PCT, 2)
    after_cost = round(gross_pnl - cost, 2)

    if after_cost > 0:
        tax = round(after_cost * STCG_TAX_RATE * (1 + STCG_CESS_RATE), 2)
    else:
        tax = 0.0

    net = round(after_cost - tax, 2)

    return {
        'gross_pnl': round(gross_pnl, 2),
        'cost':      cost,
        'tax':       tax,
        'net_pnl':   net,
    }
