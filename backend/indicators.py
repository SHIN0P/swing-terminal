import pandas as pd
import numpy as np


def compute_indicators(price_data):
    if not price_data or len(price_data) < 14:
        last_price = float(price_data[-1]['close']) if price_data else 1000.0
        return {
            'close': last_price, 'ema20': last_price, 'ema50': last_price, 'ema200': last_price,
            'rsi': 50.0, 'macd': 0.0, 'macd_signal': 0.0, 'macd_hist': 0.0,
            'adx': 15.0, 'atr': last_price * 0.02, 'obv': 0, 'roc': 0.0,
            'bb_upper': last_price * 1.02, 'bb_lower': last_price * 0.98,
            'bb_mid': last_price, 'bb_width': 0.04,
            'vol_ratio': 1.0, 'volume': 1000000,
        }

    df = pd.DataFrame(price_data)
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df = df.dropna(subset=['close']).sort_values('date').reset_index(drop=True)

    if len(df) < 5:
        p = float(df['close'].iloc[-1])
        return {
            'close': p, 'ema20': p, 'ema50': p, 'ema200': p,
            'rsi': 50.0, 'macd': 0.0, 'macd_signal': 0.0, 'macd_hist': 0.0,
            'adx': 15.0, 'atr': p * 0.02, 'obv': 0, 'roc': 0.0,
            'bb_upper': p * 1.02, 'bb_lower': p * 0.98,
            'bb_mid': p, 'bb_width': 0.04, 'vol_ratio': 1.0,
            'volume': int(df['volume'].iloc[-1]) if 'volume' in df else 1000000,
        }

    close  = df['close']
    high   = df['high']
    low    = df['low']
    volume = df['volume'].fillna(1000000)

    # EMAs
    ema20  = close.ewm(span=20, adjust=False).mean()
    ema50  = close.ewm(span=50, adjust=False).mean()
    ema200 = close.ewm(span=200, adjust=False).mean()

    # RSI (14)
    delta    = close.diff()
    gain     = delta.clip(lower=0)
    loss     = (-delta).clip(lower=0)
    avg_gain = gain.ewm(com=13, adjust=False).mean()
    avg_loss = loss.ewm(com=13, adjust=False).mean()
    rs       = avg_gain / avg_loss.replace(0, 1e-10)
    rsi      = 100 - (100 / (1 + rs))

    # MACD (12,26,9)
    ema12       = close.ewm(span=12, adjust=False).mean()
    ema26       = close.ewm(span=26, adjust=False).mean()
    macd        = ema12 - ema26
    macd_signal = macd.ewm(span=9, adjust=False).mean()
    macd_hist   = macd - macd_signal

    # ATR (14)
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low  - prev_close).abs(),
    ], axis=1).max(axis=1)
    atr = tr.ewm(span=14, adjust=False).mean()

    # ADX (14)
    up_move   = high.diff()
    down_move = -low.diff()
    dm_plus   = up_move.where((up_move > down_move) & (up_move > 0), 0.0)
    dm_minus  = down_move.where((down_move > up_move) & (down_move > 0), 0.0)
    di_plus   = 100 * dm_plus.ewm(span=14, adjust=False).mean() / atr.replace(0, 1e-10)
    di_minus  = 100 * dm_minus.ewm(span=14, adjust=False).mean() / atr.replace(0, 1e-10)
    dx        = 100 * (di_plus - di_minus).abs() / (di_plus + di_minus).replace(0, 1e-10)
    adx       = dx.ewm(span=14, adjust=False).mean()

    # Bollinger Bands (20,2)
    sma20     = close.rolling(20).mean()
    std20     = close.rolling(20).std()
    bb_upper  = sma20 + 2 * std20
    bb_lower  = sma20 - 2 * std20
    bb_width  = ((bb_upper - bb_lower) / sma20.replace(0, 1e-10)).fillna(0.04)

    # OBV
    direction = ((close > close.shift(1)).astype(int) * 2 - 1)
    direction.iloc[0] = 0
    obv = (volume * direction).cumsum()

    # ROC (10)
    roc = close.pct_change(10) * 100

    # Volume ratio
    vol_avg20 = volume.rolling(20).mean()
    vol_ratio = (volume / vol_avg20.replace(0, 1)).fillna(1.0)

    i = -1

    def safe(series, fallback=0.0):
        v = series.iloc[i]
        return float(v) if pd.notna(v) else fallback

    c_last = safe(close, 1000.0)

    return {
        'close':       round(c_last, 2),
        'ema20':       round(safe(ema20, c_last), 2),
        'ema50':       round(safe(ema50, c_last), 2),
        'ema200':      round(safe(ema200, c_last), 2),
        'rsi':         round(safe(rsi, 50.0), 1),
        'macd':        round(safe(macd, 0.0), 3),
        'macd_signal': round(safe(macd_signal, 0.0), 3),
        'macd_hist':   round(safe(macd_hist, 0.0), 3),
        'adx':         round(safe(adx, 15.0), 1),
        'atr':         round(safe(atr, c_last * 0.02), 2),
        'obv':         int(safe(obv, 0)),
        'roc':         round(safe(roc, 0.0), 2),
        'bb_upper':    round(safe(bb_upper, c_last * 1.02), 2),
        'bb_lower':    round(safe(bb_lower, c_last * 0.98), 2),
        'bb_mid':      round(safe(sma20, c_last), 2),
        'bb_width':    round(safe(bb_width, 0.04), 4),
        'vol_ratio':   round(safe(vol_ratio, 1.0), 2),
        'volume':      int(safe(volume, 1000000)),
    }
