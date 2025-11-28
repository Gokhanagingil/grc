#!/usr/bin/env pwsh
# Health Check Script - Tests /health and /api/v2/health endpoints

Param(
  [string]$Base = "http://localhost:5002"
)

$ErrorActionPreference = "Stop"

Write-Host "🔍 Health Check" -ForegroundColor Cyan
Write-Host "Base URL: $Base" -ForegroundColor Gray

$total = 0
$failed = 0

# Test 1: Root health
$total++
Write-Host "[1/2] Testing GET /health..." -NoNewline -ForegroundColor Yellow
try {
  $health = Invoke-WebRequest -Uri "$Base/health" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
  if ($health.StatusCode -eq 200) {
    $json = $health.Content | ConvertFrom-Json
    $dbStatus = $json.deps.db
    if ($dbStatus -match '^(ok|down)$') {
      Write-Host " ✅ PASS (status: $($health.StatusCode), db: $dbStatus)" -ForegroundColor Green
    } else {
      Write-Host " ⚠️  WARN (db status: $dbStatus)" -ForegroundColor Yellow
    }
  } else {
    $statusCode = $health.StatusCode.ToString()
    Write-Host (" ❌ FAIL (status: " + $statusCode + ")") -ForegroundColor Red
    $failed++
  }
} catch {
  Write-Host (" ❌ FAIL (" + $_.Exception.Message + ")") -ForegroundColor Red
  $failed++
}

# Test 2: API health
$total++
Write-Host "[2/2] Testing GET /api/v2/health..." -NoNewline -ForegroundColor Yellow
try {
  $apiHealth = Invoke-WebRequest -Uri "$Base/api/v2/health" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
  if ($apiHealth.StatusCode -eq 200) {
    $json = $apiHealth.Content | ConvertFrom-Json
    $status = $json.status
    if ($status -eq 'ok') {
      Write-Host " ✅ PASS (status: $($apiHealth.StatusCode), status: $status)" -ForegroundColor Green
    } else {
      Write-Host " ⚠️  WARN (status field: $status)" -ForegroundColor Yellow
    }
  } else {
    $statusCode = $apiHealth.StatusCode.ToString()
    Write-Host (" ❌ FAIL (status: " + $statusCode + ")") -ForegroundColor Red
    $failed++
  }
} catch {
  Write-Host (" ❌ FAIL (" + $_.Exception.Message + ")") -ForegroundColor Red
  $failed++
}

$summary = "📊 Summary: $($total - $failed)/$total passed"
Write-Host "`n$summary" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -eq 0) {
  exit 0
} else {
  exit 1
}

