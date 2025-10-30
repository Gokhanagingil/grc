# GRC Platform Frontend Startup Script
Write-Host "Starting GRC Platform Frontend..." -ForegroundColor Green

# Change to frontend directory
Set-Location "C:\Users\Lenovo Thinkpad\grc-platform\frontend"

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}

# Start frontend server
Write-Host "Starting frontend server on port 3000..." -ForegroundColor Cyan
npm start


