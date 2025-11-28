#!/usr/bin/env pwsh
# Minimal Seed Script - Creates demo data for list endpoints

$ErrorActionPreference = "Continue"

$BASE_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:5002" }
$TENANT_ID = if ($env:DEFAULT_TENANT_ID) { $env:DEFAULT_TENANT_ID } else { "217492b2-f814-4ba0-ae50-4e4f8ecf6216" }
$EMAIL = if ($env:LOGIN_EMAIL) { $env:LOGIN_EMAIL } else { "grc1@local" }
$PASSWORD = if ($env:LOGIN_PASSWORD) { $env:LOGIN_PASSWORD } else { "grc1" }

Write-Host "🌱 Minimal Seed Script" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Gray
Write-Host "Tenant ID: $TENANT_ID" -ForegroundColor Gray
Write-Host "Base URL: $BASE_URL" -ForegroundColor Gray

# Step 1: Login to get token
Write-Host "`n[1/6] Logging in..." -ForegroundColor Yellow
try {
  $loginBody = @{
    email = $EMAIL
    password = $PASSWORD
  } | ConvertTo-Json -Compress

  $loginHeaders = @{
    "x-tenant-id" = $TENANT_ID
    "Content-Type" = "application/json"
  }

  $loginResponse = Invoke-WebRequest -Uri "$BASE_URL/api/v2/auth/login" -Method POST -Headers $loginHeaders -Body $loginBody -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
  $loginData = $loginResponse.Content | ConvertFrom-Json
  $token = if ($loginData.access_token) { $loginData.access_token } elseif ($loginData.accessToken) { $loginData.accessToken } else { $null }

  if (-not $token) {
    Write-Host "❌ Login failed: No token received" -ForegroundColor Red
    exit 1
  }

  Write-Host "✅ Login successful" -ForegroundColor Green
} catch {
  Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$authHeaders = @{
  "Authorization" = "Bearer $token"
  "x-tenant-id" = $TENANT_ID
  "Content-Type" = "application/json"
}

# Step 2: Seed Policies (Governance)
Write-Host "`n[2/6] Seeding Governance Policies..." -ForegroundColor Yellow
$policies = @(
  @{ code = "POL-001"; title = "Information Security Policy"; status = "active" }
  @{ code = "POL-002"; title = "Data Privacy Policy"; status = "active" }
  @{ code = "POL-003"; title = "Access Control Policy"; status = "draft" }
  @{ code = "POL-004"; title = "Incident Response Policy"; status = "active" }
  @{ code = "POL-005"; title = "Business Continuity Policy"; status = "review" }
)

$policiesCreated = 0
foreach ($policy in $policies) {
  try {
    $body = $policy | ConvertTo-Json -Compress
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/v2/governance/policies" -Method POST -Headers $authHeaders -Body $body -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -in 200, 201) {
      $policiesCreated++
    }
  } catch {
    # Ignore duplicates
  }
}
Write-Host "✅ Created $policiesCreated policies" -ForegroundColor Green

# Step 3: Seed Requirements (Compliance)
Write-Host "`n[3/6] Seeding Compliance Requirements..." -ForegroundColor Yellow
$requirements = @(
  @{ title = "GDPR Article 32 Compliance"; regulation = "GDPR"; status = "pending" }
  @{ title = "ISO 27001 Control A.9.1"; regulation = "ISO 27001"; status = "in_progress" }
  @{ title = "SOC 2 Type II Requirement"; regulation = "SOC 2"; status = "pending" }
  @{ title = "HIPAA Security Rule"; regulation = "HIPAA"; status = "completed" }
  @{ title = "PCI DSS Requirement 3.4"; regulation = "PCI DSS"; status = "pending" }
)

$requirementsCreated = 0
foreach ($req in $requirements) {
  try {
    $body = $req | ConvertTo-Json -Compress
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/v2/compliance/requirements" -Method POST -Headers $authHeaders -Body $body -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -in 200, 201) {
      $requirementsCreated++
    }
  } catch {
    # Ignore duplicates
  }
}
Write-Host "✅ Created $requirementsCreated requirements" -ForegroundColor Green

# Step 4: Seed Risk Catalog (via Data Foundation)
Write-Host "`n[4/6] Seeding Risk Catalog..." -ForegroundColor Yellow
$risks = @(
  @{ code = "RISK-001"; name = "Data Breach"; default_likelihood = 3; default_impact = 5 }
  @{ code = "RISK-002"; name = "System Downtime"; default_likelihood = 4; default_impact = 4 }
  @{ code = "RISK-003"; name = "Compliance Violation"; default_likelihood = 2; default_impact = 5 }
  @{ code = "RISK-004"; name = "Insider Threat"; default_likelihood = 2; default_impact = 4 }
  @{ code = "RISK-005"; name = "Third-Party Risk"; default_likelihood = 3; default_impact = 3 }
)

$risksCreated = 0
foreach ($risk in $risks) {
  try {
    $body = $risk | ConvertTo-Json -Compress
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/v2/risk-catalog" -Method POST -Headers $authHeaders -Body $body -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -in 200, 201) {
      $risksCreated++
    }
  } catch {
    # Ignore duplicates
  }
}
Write-Host "✅ Created $risksCreated risk catalog entries" -ForegroundColor Green

# Step 5: Seed Entity Types
Write-Host "`n[5/6] Seeding Entity Types..." -ForegroundColor Yellow
$entityTypes = @(
  @{ code = "APP"; name = "Application" }
  @{ code = "SRV"; name = "Server" }
  @{ code = "DB"; name = "Database" }
  @{ code = "NET"; name = "Network" }
  @{ code = "PRC"; name = "Process" }
)

$entityTypesCreated = 0
foreach ($et in $entityTypes) {
  try {
    $body = $et | ConvertTo-Json -Compress
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/v2/entity-registry/entity-types" -Method POST -Headers $authHeaders -Body $body -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -in 200, 201) {
      $entityTypesCreated++
    }
  } catch {
    # Ignore duplicates
  }
}
Write-Host "✅ Created $entityTypesCreated entity types" -ForegroundColor Green

# Step 6: Summary
Write-Host "`n📊 Seed Summary:" -ForegroundColor Cyan
Write-Host "  Policies: $policiesCreated" -ForegroundColor Gray
Write-Host "  Requirements: $requirementsCreated" -ForegroundColor Gray
Write-Host "  Risk Catalog: $risksCreated" -ForegroundColor Gray
Write-Host "  Entity Types: $entityTypesCreated" -ForegroundColor Gray

Write-Host "`n✅ Minimal seed completed!" -ForegroundColor Green
exit 0

