#!/usr/bin/env pwsh
# Retry build script - npm ci → npm run build:once with 3 retries

$ErrorActionPreference = "Stop"

$MAX_RETRIES = 3
$retryCount = 0

Write-Host "🔨 Retry Build Script" -ForegroundColor Cyan

# Log versions
Write-Host "Checking versions..." -ForegroundColor Yellow
try {
  $nodeVersion = node --version
  Write-Host "  Node.js: $nodeVersion" -ForegroundColor Gray
} catch {
  Write-Host "  ❌ Node.js not found" -ForegroundColor Red
  exit 1
}

try {
  $tscVersion = npx tsc --version
  Write-Host "  TypeScript: $tscVersion" -ForegroundColor Gray
} catch {
  Write-Host "  ⚠️  TypeScript not found (will use from node_modules)" -ForegroundColor Yellow
}

# Clean install
Write-Host "`n📦 Running npm ci..." -ForegroundColor Yellow
try {
  npm ci
  if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm ci failed" -ForegroundColor Red
    exit 1
  }
  Write-Host "✅ npm ci completed" -ForegroundColor Green
} catch {
  Write-Host "❌ npm ci failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# Retry build
while ($retryCount -lt $MAX_RETRIES) {
  $retryCount++
  Write-Host "`n🔨 Build attempt $retryCount/$MAX_RETRIES..." -ForegroundColor Yellow
  
  try {
    npm run build:once
    if ($LASTEXITCODE -eq 0) {
      Write-Host "✅ Build successful!" -ForegroundColor Green
      exit 0
    } else {
      Write-Host "❌ Build failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
      if ($retryCount -lt $MAX_RETRIES) {
        Write-Host "Retrying in 2 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
      }
    }
  } catch {
    Write-Host "❌ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($retryCount -lt $MAX_RETRIES) {
      Write-Host "Retrying in 2 seconds..." -ForegroundColor Yellow
      Start-Sleep -Seconds 2
    }
  }
}

Write-Host "`n❌ Build failed after $MAX_RETRIES attempts" -ForegroundColor Red
exit 1

