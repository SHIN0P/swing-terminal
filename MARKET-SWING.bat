@echo off
title MARKET SWING - Starting...
echo.
echo  ========================================
echo    MARKET SWING TERMINAL
echo  ========================================
echo.
start "Backend" cmd /k "cd /d C:\Users\Shivam Agarwal\OneDrive\Documents\terminal\swing-terminal\backend && .venv\Scripts\activate && uvicorn main:app --port 8000"
timeout /t 6 /nobreak >nul
start "Frontend" cmd /k "cd /d C:\Users\Shivam Agarwal\OneDrive\Documents\terminal\swing-terminal\frontend && npm run dev"
timeout /t 8 /nobreak >nul
start http://localhost:5173
echo App is opening in your browser. Keep both windows open while using it.
exit
