#!/usr/bin/env pwsh
# Route Diagnosis Script - Dumps feature flags and mapped routes

$ErrorActionPreference = "Continue"

$BASE_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:5002" }
$DIAG_DIR = ".diag"
$ROUTES_FILE = "$DIAG_DIR/routes.json"
$FEAT_FILE = "$DIAG_DIR/feat.json"

# Create .diag directory
if (-not (Test-Path $DIAG_DIR)) {
  New-Item -ItemType Directory -Path $DIAG_DIR | Out-Null
}

Write-Host "🔍 Route Diagnosis" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Gray

# Collect feature flags
Write-Host "`n📋 Feature Flags:" -ForegroundColor Yellow
$featFlags = @{
  SAFE_MODE = if ($env:SAFE_MODE) { $env:SAFE_MODE } else { "false" }
  ENABLE_POLICY = if ($env:ENABLE_POLICY) { $env:ENABLE_POLICY } else { "true" }
  ENABLE_RISK = if ($env:ENABLE_RISK) { $env:ENABLE_RISK } else { "true" }
  ENABLE_COMPLIANCE = if ($env:ENABLE_COMPLIANCE) { $env:ENABLE_COMPLIANCE } else { "true" }
  ENABLE_AUDIT = if ($env:ENABLE_AUDIT) { $env:ENABLE_AUDIT } else { "true" }
  ENABLE_ISSUE = if ($env:ENABLE_ISSUE) { $env:ENABLE_ISSUE } else { "true" }
  ENABLE_QUEUE = if ($env:ENABLE_QUEUE) { $env:ENABLE_QUEUE } else { "true" }
  ENABLE_RULES = if ($env:ENABLE_RULES) { $env:ENABLE_RULES } else { "true" }
  ENABLE_DATA_FOUNDATION = if ($env:ENABLE_DATA_FOUNDATION) { $env:ENABLE_DATA_FOUNDATION } else { "true" }
  ENABLE_DASHBOARD = if ($env:ENABLE_DASHBOARD) { $env:ENABLE_DASHBOARD } else { "true" }
  ENABLE_GOVERNANCE = if ($env:ENABLE_GOVERNANCE) { $env:ENABLE_GOVERNANCE } else { "true" }
  ENABLE_RISK_INSTANCE = if ($env:ENABLE_RISK_INSTANCE) { $env:ENABLE_RISK_INSTANCE } else { "true" }
  ENABLE_RISK_SCORING = if ($env:ENABLE_RISK_SCORING) { $env:ENABLE_RISK_SCORING } else { "true" }
  ENABLE_SEARCH = if ($env:ENABLE_SEARCH) { $env:ENABLE_SEARCH } else { "true" }
  ENABLE_ENTITY_REGISTRY = if ($env:ENABLE_ENTITY_REGISTRY) { $env:ENABLE_ENTITY_REGISTRY } else { "true" }
  ENABLE_METRICS = if ($env:ENABLE_METRICS) { $env:ENABLE_METRICS } else { "true" }
  ENABLE_BCM = if ($env:ENABLE_BCM) { $env:ENABLE_BCM } else { "true" }
}

$featFlags.GetEnumerator() | Sort-Object Name | ForEach-Object {
  $color = if ($_.Value -eq "true") { "Green" } else { "Red" }
  Write-Host "  $($_.Name.PadRight(25)) = $($_.Value)" -ForegroundColor $color
}

# Save to JSON
$featFlags | ConvertTo-Json | Set-Content $FEAT_FILE
Write-Host "`n✅ Feature flags saved to $FEAT_FILE" -ForegroundColor Green

# Check if backend is running
Write-Host "`n🔌 Checking backend..." -ForegroundColor Yellow
try {
  $health = Invoke-WebRequest -Uri "$BASE_URL/health" -Method GET -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
  Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
  Write-Host "❌ Backend is not running. Start it first." -ForegroundColor Red
  Write-Host "   Run: npm run start:full:ps" -ForegroundColor Yellow
  exit 1
}

# Get routes from /_routes endpoint (if available)
Write-Host "`n📡 Fetching routes..." -ForegroundColor Yellow
$routes = @()
try {
  $routesResponse = Invoke-WebRequest -Uri "$BASE_URL/api/v2/_routes" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
  $routes = $routesResponse.Content | ConvertFrom-Json
  Write-Host "✅ Found $($routes.Count) routes via /_routes endpoint" -ForegroundColor Green
} catch {
  Write-Host "⚠️  /_routes endpoint not available, will try Swagger" -ForegroundColor Yellow
}

# Try Swagger as fallback
if ($routes.Count -eq 0) {
  try {
    $swaggerResponse = Invoke-WebRequest -Uri "$BASE_URL/api-docs" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $swagger = $swaggerResponse.Content | ConvertFrom-Json
    $routes = @()
    foreach ($path in $swagger.paths.PSObject.Properties.Name) {
      foreach ($method in $swagger.paths.$path.PSObject.Properties.Name) {
        $routes += @{
          method = $method.ToUpper()
          path = $path
        }
      }
    }
    Write-Host "✅ Found $($routes.Count) routes via Swagger" -ForegroundColor Green
  } catch {
    Write-Host "❌ Could not fetch routes from Swagger" -ForegroundColor Red
  }
}

# Expected routes to check
$expectedRoutes = @(
  @{ method = "GET"; path = "/api/v2/dashboard/overview" }
  @{ method = "GET"; path = "/api/v2/governance/policies" }
  @{ method = "GET"; path = "/api/v2/compliance/requirements" }
  @{ method = "GET"; path = "/api/v2/risk-catalog" }
  @{ method = "GET"; path = "/api/v2/risk-instances" }
  @{ method = "GET"; path = "/api/v2/entity-registry/entity-types" }
)

# Check expected routes
Write-Host "`n🎯 Expected Routes Check:" -ForegroundColor Yellow
$missingRoutes = @()
foreach ($expected in $expectedRoutes) {
  $found = $routes | Where-Object { $_.method -eq $expected.method -and $_.path -eq $expected.path }
  if ($found) {
    Write-Host "  ✅ $($expected.method) $($expected.path)" -ForegroundColor Green
  } else {
    Write-Host "  ❌ $($expected.method) $($expected.path) - MISSING" -ForegroundColor Red
    $missingRoutes += $expected
  }
}

# Save routes to JSON
$routesJson = @{
  timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
  total = $routes.Count
  routes = $routes
  missing = $missingRoutes
} | ConvertTo-Json -Depth 10

$routesJson | Set-Content $ROUTES_FILE
Write-Host "`n✅ Routes saved to $ROUTES_FILE" -ForegroundColor Green

# Summary
Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "  Total routes: $($routes.Count)" -ForegroundColor Gray
Write-Host "  Missing routes: $($missingRoutes.Count)" -ForegroundColor $(if ($missingRoutes.Count -eq 0) { "Green" } else { "Red" })

if ($missingRoutes.Count -gt 0) {
  Write-Host "`n⚠️  Missing routes detected!" -ForegroundColor Red
  exit 1
} else {
  Write-Host "`n✅ All expected routes are mapped" -ForegroundColor Green
  exit 0
}

