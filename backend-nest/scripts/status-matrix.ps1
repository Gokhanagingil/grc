#!/usr/bin/env pwsh
# Status matrix probe - SAFE friendly, PowerShell 5.1 compatible

$ErrorActionPreference = "Stop"

$bases = @("http://127.0.0.1:5002", "http://localhost:5002")
$paths = @(
    @{ Name = "health_root"; Path = "/health" },
    @{ Name = "health_v2"; Path = "/v2/health" },
    @{ Name = "health_api_v2"; Path = "/api/v2/health" }
)

$results = @{}
$healthOk = $false

foreach ($entry in $paths) {
    $statusCode = 0
    foreach ($base in $bases) {
        $url = "$base$($entry.Path)"
        try {
            $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 1.5
            if ($response -and $response.StatusCode) {
                $statusCode = [int]$response.StatusCode
            }
        } catch {
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            } else {
                $statusCode = 0
            }
        }

        if ($statusCode -eq 200) {
            $healthOk = $true
            break
        }
    }

    $results[$entry.Name] = $statusCode
    Write-Output ("{0}={1}" -f $entry.Name, $statusCode)
}

$exitCode = if ($healthOk) { 0 } else { 4 }
Write-Output ("exit={0}" -f $exitCode)

exit $exitCode

