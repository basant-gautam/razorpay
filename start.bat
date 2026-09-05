@echo off
title Aegis AI - Full Stack Launcher
color 0A

echo ============================================
echo    AEGIS AI - Autonomous Merchant Platform
echo    Starting all services...
echo ============================================
echo.

:: Kill any existing processes on ports 8000 and 3000
echo [1/4] Cleaning up existing processes...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

:: Remove old database for fresh seed data
echo [2/4] Preparing fresh database...
if exist "%~dp0backend\aegis.db" del /f /q "%~dp0backend\aegis.db"

:: Start Backend (FastAPI)
echo [3/4] Starting Backend on port 8000...
start "Aegis Backend" cmd /c "cd /d %~dp0backend && call venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8000"

timeout /t 5 /nobreak >nul
echo    Backend started: http://localhost:8000

:: Start Frontend (Vite + React)
echo [4/4] Starting Frontend on port 3000...
start "Aegis Frontend" cmd /c "cd /d %~dp0frontend && npm run dev"

timeout /t 5 /nobreak >nul
echo    Frontend started: http://localhost:3000

echo.
echo ============================================
echo    ALL SERVICES ARE RUNNING!
echo    Backend :  http://localhost:8000
echo    Frontend:  http://localhost:3000
echo ============================================
echo.
echo Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo Press any key to STOP all services...
pause >nul

:: Kill processes on exit
taskkill /F /FI "WINDOWTITLE eq Aegis Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Aegis Frontend*" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo All services stopped. Goodbye!
timeout /t 3 /nobreak >nul
