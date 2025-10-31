# E2E Smoke Test Script
# Tests backend endpoints without double /v2 paths

$base = "http://localhost:5002/api/v2"
$token = $null

Write-Host "=== SMOKE TEST START ===" -ForegroundColor Cyan
Write-Host ""

# Health
Write-Host "1. Health:" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "$base/health" -Method GET -TimeoutSec 5
    Write-Host "   ✅ 200 - Status: $($r.status)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Login
Write-Host "2. Login:" -ForegroundColor Yellow
try {
    $body = @{email="admin@local";password="Admin!123"} | ConvertTo-Json -Compress
    $login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body -TimeoutSec 5
    $token = $login.accessToken
    Write-Host "   ✅ 200" -ForegroundColor Green
    Write-Host "   Token: $($token.Substring(0,50))..." -ForegroundColor Gray
    Write-Host "   User: $($login.user.email)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Me
Write-Host "3. /me:" -ForegroundColor Yellow
if ($token) {
    try {
        $me = Invoke-RestMethod -Uri "$base/auth/me" -Method GET -Headers @{"Authorization"="Bearer $token"} -TimeoutSec 5
        Write-Host "   ✅ 200" -ForegroundColor Green
        Write-Host "   UserId: $($me.userId), Email: $($me.email)" -ForegroundColor Gray
    } catch {
        Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "   ⏭️  Skipped (no token)" -ForegroundColor Yellow
}

Write-Host ""

# Policies
Write-Host "4. Policies:" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "$base/policies" -Method GET -TimeoutSec 5
    Write-Host "   ✅ 200" -ForegroundColor Green
} catch {
    Write-Host "   ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== SMOKE TEST END ===" -ForegroundColor Cyan
