#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  ⚡  SWING INTELLIGENCE TERMINAL"
echo "  ================================"
echo ""

# ── Backend ──────────────────────────────────────────────────────────────────
echo "→ Setting up backend..."
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
  echo "  Creating Python virtual environment..."
  python -m venv .venv
fi

# Activate venv
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || -n "$WINDIR" ]]; then
  source .venv/Scripts/activate
else
  source .venv/bin/activate
fi

echo "  Installing Python dependencies..."
pip install -q -r requirements.txt

echo "  Starting FastAPI backend on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# ── Frontend ─────────────────────────────────────────────────────────────────
echo ""
echo "→ Setting up frontend..."
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "  Installing npm packages..."
  npm install
fi

echo "  Starting Vite dev server on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "  ✅  Both servers running!"
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

trap "echo ''; echo '  Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
