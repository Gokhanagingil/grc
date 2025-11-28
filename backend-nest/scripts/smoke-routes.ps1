#!/usr/bin/env pwsh
# Smoke Routes Test - Checks critical routes return 200 (not 404)

$ErrorActionPreference = "Continue"
$BASE_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:5002" }
$TENANT_ID = if ($env:DEFAULT_TENANT_ID) { $env:DEFAULT_TENANT_ID } else { "217492b2-f814-4ba0-ae50-4e4f8ecf6216" }
$DIAG_DIR = ".diag"
$SMOKE_FILE = "$DIAG_DIR/smoke.json"

# Create .diag directory
if (-not (Test-Path $DIAG_DIR)) {
  New-Item -ItemType Directory -Path $DIAG_DIR | Out-Null
}

Write-Host "🔍 Route Smoke Test" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Gray

$routes = @(
  @{ method = "GET"; path = "/api/v2/dashboard/overview"; name = "Dashboard Overview" }
  @{ method = "GET"; path = "/api/v2/governance/policies"; name = "Governance Policies"; query = "?page=1&limit=20" }
  @{ method = "GET"; path = "/api/v2/compliance/requirements"; name = "Compliance Requirements"; query = "?page=1&limit=20" }
  @{ method = "GET"; path = "/api/v2/risk-catalog"; name = "Risk Catalog"; query = "?page=1&pageSize=20" }
  @{ method = "GET"; path = "/api/v2/risk-instances"; name = "Risk Instances"; query = "?page=1&pageSize=20" }
  @{ method = "GET"; path = "/api/v2/entity-registry/entity-types"; name = "Entity Registry Types"; query = "?page=1&pageSize=20" }
)

$results = @()
$failed = 0
$total = $routes.Count

foreach ($route in $routes) {
  $fullPath = $route.path + ($route.query ?? "")
  $url = "$BASE_URL$fullPath"
  
  Write-Host "`n[$($routes.IndexOf($route) + 1)/$total] Testing $($route.method) $($route.name)..." -NoNewline -ForegroundColor Yellow
  
  try {
    $headers = @{
      "x-tenant-id" = $TENANT_ID
      "Content-Type" = "application/json"
    }
    
    $response = Invoke-WebRequest -Uri $url -Method $route.method -Headers $headers -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    
    if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 201) {
      Write-Host " ✅ PASS ($($response.StatusCode))" -ForegroundColor Green
      $results += @{
        route = $route.name
        method = $route.method
        path = $fullPath
        status = $response.StatusCode
        success = $true
      }
    } else {
      Write-Host " ⚠️  WARN ($($response.StatusCode))" -ForegroundColor Yellow
      $results += @{
        route = $route.name
        method = $route.method
        path = $fullPath
        status = $response.StatusCode
        success = $false
      }
      $failed++
    }
  } catch {
    $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
    if ($statusCode -eq 404) {
      Write-Host " ❌ FAIL (404 - Route Missing)" -ForegroundColor Red
      $failed++
    } else {
      Write-Host " ❌ FAIL ($($_.Exception.Message))" -ForegroundColor Red
      $failed++
    }
    $results += @{
      route = $route.name
      method = $route.method
      path = $fullPath
      status = $statusCode
      success = $false
      error = $_.Exception.Message
    }
  }
}

# Save results
$summary = @{
  timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
  total = $total
  passed = $total - $failed
  failed = $failed
  results = $results
} | ConvertTo-Json -Depth 10

$summary | Set-Content $SMOKE_FILE
Write-Host "`n✅ Results saved to $SMOKE_FILE" -ForegroundColor Green

# Summary
Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "  Total routes: $total" -ForegroundColor Gray
Write-Host "  Passed: $($total - $failed)" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -gt 0) {
  Write-Host "`n⚠️  Some routes returned 404 or failed!" -ForegroundColor Red
  exit 12 # RouteMissing exit code
} else {
  Write-Host "`n✅ All routes are accessible" -ForegroundColor Green
  exit 0
}

