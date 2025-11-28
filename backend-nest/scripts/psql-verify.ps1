# PowerShell script for Data Foundations verification
# Usage: .\scripts\psql-verify.ps1

$ErrorActionPreference = "Stop"

$reportsDir = Join-Path $PSScriptRoot "..\reports"
if (-not (Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
}

$env:PGPASSWORD = $env:DB_PASS ?? "grc123"
$dbHost = $env:DB_HOST ?? "localhost"
$dbPort = $env:DB_PORT ?? "5432"
$dbName = $env:DB_NAME ?? "grc"
$dbUser = $env:DB_USER ?? "grc"

Write-Host "=== Data Foundations Verification ===" -ForegroundColor Cyan
Write-Host ""

$sqlFile = Join-Path $PSScriptRoot "verify-data-foundations.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ SQL file not found: $sqlFile" -ForegroundColor Red
    exit 1
}

$output = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host $output
    Write-Host ""
    Write-Host "✅ Verification completed" -ForegroundColor Green
    
    $reportPath = Join-Path $reportsDir "PSQL-VERIFY-OUTPUT.txt"
    $output | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Host "Report saved: $reportPath" -ForegroundColor Gray
} else {
    Write-Host "❌ Verification failed" -ForegroundColor Red
    Write-Host $output
    exit 1
}

