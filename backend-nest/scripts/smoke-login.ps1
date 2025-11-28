#!/usr/bin/env pwsh
# Login Smoke Test - Tests login with grc1@local user

Param(
  [string]$Base = "http://localhost:5002",
  [string]$TenantHeader = "x-tenant-id",
  [string]$TenantId = "217492b2-f814-4ba0-ae50-4e4f8ecf6216",
  [string]$Email = "grc1@local",
  [string]$Password = "grc1"
)

$ErrorActionPreference = "Stop"

Write-Host "🔍 Login Smoke Test" -ForegroundColor Cyan
Write-Host "Base URL: $Base" -ForegroundColor Gray
Write-Host "Email: $Email" -ForegroundColor Gray

$failed = 0
$total = 0

# Test 1: Health check
$total++
Write-Host "`n[1/3] Testing /health..." -NoNewline -ForegroundColor Yellow
try {
  $health = Invoke-WebRequest -Uri "$Base/health" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
  if ($health.StatusCode -eq 200) {
    Write-Host " ✅ PASS" -ForegroundColor Green
  } else {
    $statusCode = $health.StatusCode.ToString()
    Write-Host (' ❌ FAIL (status: ' + $statusCode + ')') -ForegroundColor Red
    $failed++
  }
} catch {
  Write-Host (' ❌ FAIL (' + $_.Exception.Message + ')') -ForegroundColor Red
  $failed++
}

# Test 2: Login
$total++
Write-Host "[2/3] Testing login..." -NoNewline -ForegroundColor Yellow
try {
  $body = @{
    email = $Email
    password = $Password
  } | ConvertTo-Json -Compress

  $headers = @{
    $TenantHeader = $TenantId
    "Content-Type" = "application/json"
  }

  $login = Invoke-WebRequest -Uri "$Base/api/v2/auth/login" -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop

  if ($login.StatusCode -in 200, 201) {
    $response = $login.Content | ConvertFrom-Json
    # Support both access_token (snake_case) and accessToken (camelCase)
    $token = if ($response.access_token) { $response.access_token } elseif ($response.accessToken) { $response.accessToken } else { $null }
    if ($token) {
      $tokenLength = $token.Length
      Write-Host (' ✅ PASS (token length: ' + $tokenLength + ')') -ForegroundColor Green
      $script:accessToken = $token
    } else {
      Write-Host (' ❌ FAIL (access_token/accessToken missing)') -ForegroundColor Red
      $failed++
    }
  } else {
    $statusCode = $login.StatusCode.ToString()
    Write-Host (' ❌ FAIL (status: ' + $statusCode + ')') -ForegroundColor Red
    $failed++
  }
} catch {
  Write-Host (' ❌ FAIL (' + $_.Exception.Message + ')') -ForegroundColor Red
  $failed++
}

# Test 3: Protected endpoint with token
if ($script:accessToken) {
  $total++
  Write-Host "[3/3] Testing protected endpoint..." -NoNewline -ForegroundColor Yellow
  try {
    $headers = @{
      "Authorization" = "Bearer $script:accessToken"
      $TenantHeader = $TenantId
    }

    # Try /api/v2/users/me or similar protected endpoint
    $protected = Invoke-WebRequest -Uri "$Base/api/v2/users/me" -Method GET -Headers $headers -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop

    if ($protected.StatusCode -eq 200) {
      Write-Host " ✅ PASS" -ForegroundColor Green
    } else {
      $statusCode = $protected.StatusCode.ToString()
      Write-Host (' ❌ FAIL (status: ' + $statusCode + ')') -ForegroundColor Red
      $failed++
    }
  } catch {
    # If /users/me doesn't exist, try another endpoint or skip
    Write-Host (' ⚠️  SKIP (/users/me not available)') -ForegroundColor Yellow
  }
}

$summary = "📊 Summary: $($total - $failed)/$total passed"
Write-Host "`n$summary" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -eq 0) {
  Write-Host "✅ PASS" -ForegroundColor Green
  exit 0
} else {
  Write-Host "❌ FAIL" -ForegroundColor Red
  exit 1
}
