#!/usr/bin/env pwsh
# Quick health probe for backend health endpoints

param(
    [string[]]$Bases = @("http://127.0.0.1:5002", "http://localhost:5002"),
    [int]$TimeoutSec = 5
)

$ErrorActionPreference = "Stop"

$paths = @("/health", "/v2/health", "/api/v2/health")
$failed = @()

foreach ($base in $Bases) {
    foreach ($path in $paths) {
        $url = "$base$path"
        try {
            $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
            if ($response.StatusCode -ne 200) {
                $failed += "$url -> $($response.StatusCode)"
            } else {
                Write-Host "OK $url" -ForegroundColor Green
            }
        } catch {
            $failed += "$url -> $($_.Exception.Message)"
        }
    }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Health probe FAILED:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
}

Write-Host ""
Write-Host "All health endpoints returned 200." -ForegroundColor Green
exit 0

