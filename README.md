# ⚡ Swing Intelligence Terminal

A full-stack swing trading dashboard for Indian stock markets — completely free to run.

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + Recharts |
| Backend  | FastAPI (Python) |
| Database | SQLite |
| Data     | NSE public APIs → yfinance fallback → synthetic fallback |

---

## Quick Start

### Option A — One command (Git Bash / WSL / macOS / Linux)

```bash
bash start.sh
```

### Option B — Manual (Windows / any platform)

**Backend:**
```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend (separate terminal):**
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Features

| Page | Description |
|------|-------------|
| Dashboard | Nifty 50, Sensex, India VIX, Bank Nifty — live market pulse + FII/DII today + sector heatmap + top 5 setups |
| FII / DII Intel | 30-day institutional flow charts, cumulative FII vs DII line chart, sector flow table, bulk deals |
| Sector Rotation | Rotation clock (Recovery → Expansion → Late Expansion → Slowdown), sortable sector rankings table |
| Scanner | Filtered stock screener — min score slider, sector & signal filters, expandable score breakdown, CSV export |
| Opportunities | Top 15 high-score swing setups with entry / SL / T1 / T2 levels, R:R, score breakdown, reasons + risks |
| Portfolio | Add / remove positions, live P&L tracking, status badges (ON TRACK / TRAIL STOP / REVIEW / EXIT / TARGET HIT) |

## Scoring Model

Each stock is scored out of 100:

- **Technical (40 pts)** — EMA alignment, RSI, MACD crossover, ADX trend strength  
- **FII / DII (25 pts)** — Delivery %, FII 10-day net flow, volume surge  
- **Fundamental (20 pts)** — Market cap tier, rate of change momentum  
- **Sector (15 pts)** — Sector index performance vs Nifty  

| Score | Signal |
|-------|--------|
| 80–100 | STRONG BUY |
| 65–79 | BUY |
| 50–64 | WATCHLIST |
| 35–49 | HOLD |
| 0–34 | AVOID |

## Data Sources

1. **NSE public API** — real-time indices, FII/DII flows, bulk deals (primary)  
2. **yfinance** — historical OHLCV for indicator calculation (fallback)  
3. **Synthetic data** — realistic random walk using last known price (offline fallback)

No API keys required. No paid services. 100% free.

## Requirements

- Python 3.9+
- Node.js 18+
- Internet connection (for live NSE data; offline mode uses built-in fallback data)
