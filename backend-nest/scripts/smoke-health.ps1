#!/usr/bin/env pwsh
# Backend Health Check Smoke Test (PowerShell)

$ErrorActionPreference = "Stop"

$BASE_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:5002" }
$TIMEOUT = 10

Write-Host "🔍 Backend Health Check Smoke Test" -ForegroundColor Cyan
Write-Host "Base URL: $BASE_URL" -ForegroundColor Gray

$failed = 0
$total = 0

function Test-Endpoint {
    param(
        [string]$url,
        [string]$name,
        [string]$expectedStatus = "200"
    )
    
    $total++
    Write-Host "  Testing $name..." -NoNewline -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec $TIMEOUT -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode
        
        if ($statusCode -eq [int]$expectedStatus) {
            Write-Host " ✅ PASS ($statusCode)" -ForegroundColor Green
            return $true
        } else {
            Write-Host " ❌ FAIL (expected $($expectedStatus), got $($statusCode))" -ForegroundColor Red
            $script:failed++
            return $false
        }
    } catch {
        Write-Host " ❌ FAIL ($($_.Exception.Message))" -ForegroundColor Red
        $script:failed++
        return $false
    }
}

# Test endpoints
Test-Endpoint -url "$BASE_URL/health" -name "/health"
Test-Endpoint -url "$BASE_URL/api/v2/health" -name "/api/v2/health"

Write-Host ""
Write-Host "📊 Summary: $($total - $failed)/$total passed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -eq 0) {
    Write-Host "✅ PASS" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ FAIL" -ForegroundColor Red
    exit 1
}
