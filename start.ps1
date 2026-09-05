$host.UI.RawUI.WindowTitle = "Aegis AI - Full Stack Launcher"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   AEGIS AI - Autonomous Merchant Platform" -ForegroundColor Yellow
Write-Host "   Starting all services..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Kill existing processes on ports 8000 and 3000
Write-Host "[1/4] Cleaning up existing processes..." -ForegroundColor Green
$ports = @(8000, 3000)
foreach ($port in $ports) {
    $connections = netstat -ano | Select-String ":$port" | Select-String "LISTENING"
    foreach ($conn in $connections) {
        $pidMatch = [regex]::Match($conn, '\s+(\d+)\s*$')
        if ($pidMatch.Success) {
            taskkill /F /PID $pidMatch.Groups[1].Value 2>$null | Out-Null
        }
    }
}

Start-Sleep -Seconds 2

# Remove old database for fresh seed data
Write-Host "[2/4] Preparing fresh database..." -ForegroundColor Green
$dbPath = Join-Path $PSScriptRoot "backend\aegis.db"
if (Test-Path $dbPath) {
    Remove-Item -Force $dbPath
    Write-Host "    Fresh database created" -ForegroundColor Gray
}

# Start Backend
Write-Host "[3/4] Starting Backend on port 8000..." -ForegroundColor Green
$backendDir = Join-Path $PSScriptRoot "backend"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$backendDir'; .\venv\Scripts\activate; Write-Host 'Backend starting...' -ForegroundColor Yellow; uvicorn main:app --host 0.0.0.0 --port 8000"
Start-Sleep -Seconds 5
Write-Host "    Backend:  http://localhost:8000" -ForegroundColor Gray

# Start Frontend
Write-Host "[4/4] Starting Frontend on port 3000..." -ForegroundColor Green
$frontendDir = Join-Path $PSScriptRoot "frontend"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$frontendDir'; Write-Host 'Frontend starting...' -ForegroundColor Yellow; npm run dev"
Start-Sleep -Seconds 5
Write-Host "    Frontend: http://localhost:3000" -ForegroundColor Gray

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   ALL SERVICES ARE RUNNING!" -ForegroundColor Yellow
Write-Host "   Backend :  http://localhost:8000" -ForegroundColor White
Write-Host "   Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Open browser
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

Write-Host "Press Enter to STOP all services..." -ForegroundColor Red
Read-Host

# Kill processes
Write-Host "Stopping all services..." -ForegroundColor Yellow
taskkill /F /IM python.exe 2>$null | Out-Null
taskkill /F /IM node.exe 2>$null | Out-Null
Write-Host "All services stopped. Goodbye!" -ForegroundColor Green
