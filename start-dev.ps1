# aculion-platform/start-dev.ps1
# Run this script from the aculion-platform directory to start all services.
# Usage: .\start-dev.ps1

param(
    [switch]$FrontendOnly,
    [switch]$BackendOnly
)

$root = $PSScriptRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       ACULION PLATFORM - Dev Launcher" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# ─── FRONTEND (Vite React + Express Email Server) ────────────────────────────
function Start-Frontend {
    $webDir = Join-Path $root "apps\web"

    if (-not (Test-Path (Join-Path $webDir "node_modules"))) {
        Write-Host "[FRONTEND] node_modules not found. Running npm install..." -ForegroundColor Yellow
        Push-Location $webDir
        npm install
        Pop-Location
    }

    Write-Host "[FRONTEND] Starting Vite React App & Express Email Server..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webDir'; npm run dev:full" -WindowStyle Normal
}

# ─── LOCATION SERVICE ────────────────────────────────────────────────────────
function Start-LocationService {
    $backendDir = Join-Path $root "services\location-service"
    $venvPath   = Join-Path $backendDir ".venv"
    $venvActivate = Join-Path $venvPath "Scripts\Activate.ps1"

    if (-not (Test-Path $venvPath)) {
        Write-Host "[LOCATION SERVICE] Virtual environment not found. Creating .venv..." -ForegroundColor Yellow
        python -m venv "$venvPath"
    }

    $uvicornCheck = Join-Path $venvPath "Scripts\uvicorn.exe"
    if (-not (Test-Path $uvicornCheck)) {
        Write-Host "[LOCATION SERVICE] Installing Python dependencies..." -ForegroundColor Yellow
        & "$venvPath\Scripts\pip.exe" install -r "$backendDir\requirements.txt"
    }

    Write-Host "[LOCATION SERVICE] Starting FastAPI server at http://localhost:8000 ..." -ForegroundColor Magenta
    Start-Process powershell -ArgumentList "-NoExit", "-Command", `
        "& '$venvActivate'; cd '$backendDir'; uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload" `
        -WindowStyle Normal
}


# ─── API GATEWAY ─────────────────────────────────────────────────────────────
function Start-ApiGateway {
    $gatewayDir = Join-Path $root "services\api-gateway"
    $venvPath   = Join-Path $gatewayDir ".venv"
    $venvActivate = Join-Path $venvPath "Scripts\Activate.ps1"

    if (-not (Test-Path $venvPath)) {
        Write-Host "[API GATEWAY] Virtual environment not found. Creating .venv..." -ForegroundColor Yellow
        python -m venv "$venvPath"
    }

    $uvicornCheck = Join-Path $venvPath "Scripts\uvicorn.exe"
    if (-not (Test-Path $uvicornCheck)) {
        Write-Host "[API GATEWAY] Installing Python dependencies..." -ForegroundColor Yellow
        & "$venvPath\Scripts\pip.exe" install -r "$gatewayDir\requirements.txt"
    }

    Write-Host "[API GATEWAY] Starting FastAPI server at http://localhost:8080 ..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", `
        "& '$venvActivate'; cd '$gatewayDir'; uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload" `
        -WindowStyle Normal
}

# ─── TRAFFIC SERVICE ──────────────────────────────────────────────────────────
function Start-TrafficService {
    $trafficDir = Join-Path $root "services\traffic-service"
    $venvPath   = Join-Path $trafficDir ".venv"
    $venvActivate = Join-Path $venvPath "Scripts\Activate.ps1"

    if (-not (Test-Path $venvPath)) {
        Write-Host "[TRAFFIC SERVICE] Virtual environment not found. Creating .venv..." -ForegroundColor Yellow
        python -m venv "$venvPath"
    }

    $uvicornCheck = Join-Path $venvPath "Scripts\uvicorn.exe"
    if (-not (Test-Path $uvicornCheck)) {
        Write-Host "[TRAFFIC SERVICE] Installing Python dependencies..." -ForegroundColor Yellow
        & "$venvPath\Scripts\pip.exe" install -r "$trafficDir\requirements.txt"
    }

    Write-Host "[TRAFFIC SERVICE] Starting FastAPI server at http://localhost:8095 ..." -ForegroundColor Blue
    Start-Process powershell -ArgumentList "-NoExit", "-Command", `
        "& '$venvActivate'; cd '$trafficDir'; uvicorn main:app --host 0.0.0.0 --port 8095 --reload" `
        -WindowStyle Normal
}

# ─── TRAFFIC DASHBOARD UI ────────────────────────────────────────────────────
function Start-TrafficUI {
    $uiDir = Join-Path $root "apps\traffic-intelligence\traffic_ui"
    
    if (-not (Test-Path (Join-Path $uiDir "node_modules"))) {
        Write-Host "[TRAFFIC UI] node_modules not found. Running npm install..." -ForegroundColor Yellow
        Push-Location $uiDir
        npm install
        Pop-Location
    }
    
    Write-Host "[TRAFFIC UI] Starting Vite dev server at http://localhost:5176 ..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$uiDir'; npm run dev -- --port 5176" -WindowStyle Normal
}

# ─── LAUNCH ──────────────────────────────────────────────────────────────────
if ($FrontendOnly) {
    Start-Frontend
    Start-TrafficUI
} elseif ($BackendOnly) {
    Start-ApiGateway
    Start-LocationService
    Start-TrafficService
} else {
    Start-Frontend
    Start-ApiGateway
    Start-LocationService
    Start-TrafficService
    Start-TrafficUI
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  All Platform services launching in separate windows:" -ForegroundColor Cyan
Write-Host "  - React Web App:        http://localhost:5173" -ForegroundColor Green
Write-Host "  - Express Email Server: http://localhost:3001" -ForegroundColor Green
Write-Host "  - API Gateway Docs:     http://localhost:8080/docs" -ForegroundColor Cyan
Write-Host "  - Location API Docs:    http://localhost:8000/docs" -ForegroundColor Magenta
Write-Host "  - Traffic API Docs:     http://localhost:8095/docs" -ForegroundColor Blue
Write-Host "  - Traffic Dashboard UI: http://localhost:5176" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan
