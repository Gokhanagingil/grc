param(
    [string]$BaseUrl = $env:API_BASE_URL
)

if (-not $BaseUrl -or [string]::IsNullOrWhiteSpace($BaseUrl)) {
    $port = if ($env:PORT) { $env:PORT } else { '5002' }
    $BaseUrl = "http://localhost:$port"
}

$healthUrl = "$BaseUrl/api/v2/health"
Write-Host "?? Health smoke against $healthUrl" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $healthUrl -Method Get -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "PASS Health 200" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "FAIL Health returned status $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    $status = $null
    if ($_.Exception -and $_.Exception.Response) {
        $status = $_.Exception.Response.StatusCode.value__
    }
    $message = $_.Exception.Message
    Write-Host "FAIL Health request failed (status: $status) - $message" -ForegroundColor Red
    exit 1
}
