# GRC Platform Backend Startup Script
Write-Host "Starting GRC Platform Backend..." -ForegroundColor Green

# Change to backend directory
Set-Location "C:\Users\Lenovo Thinkpad\grc-platform\backend"

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    npm install
}

# Start backend server
Write-Host "Starting backend server on port 5000..." -ForegroundColor Cyan
node server.js
