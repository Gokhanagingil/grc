# HTTP Probe Helper (PowerShell)
# Probes URLs with GET/HEAD and returns first 200 or summary
# Usage: .\http-probe.ps1 -Urls @("http://127.0.0.1:5002/health") -Method GET -TimeoutMs 1500

param(
    [Parameter(Mandatory=$true)]
    [string[]]$Urls,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("GET", "HEAD")]
    [string]$Method = "GET",
    
    [Parameter(Mandatory=$false)]
    [int]$TimeoutMs = 1500
)

$ErrorActionPreference = "Continue"

# Use .NET HttpClient for reliability
Add-Type -AssemblyName System.Net.Http

$results = @()

foreach ($url in $Urls) {
    $statusCode = $null
    $errorMsg = $null
    $ok = $false
    
    try {
        $client = New-Object System.Net.Http.HttpClient
        $client.Timeout = [System.TimeSpan]::FromMilliseconds($TimeoutMs)
        
        $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::$Method, $url)
        $response = $client.SendAsync($request).Result
        
        $statusCode = [int]$response.StatusCode
        $ok = ($statusCode -eq 200)
        
        $response.Dispose()
        $client.Dispose()
        
        if ($ok) {
            return @{
                url = $url
                statusCode = $statusCode
                ok = $true
            }
        }
    } catch {
        $errorMsg = $_.Exception.Message
        $statusCode = "ERR"
    }
    
    $results += @{
        url = $url
        statusCode = $statusCode
        ok = $false
        error = $errorMsg
    }
}

# No 200 found, return summary
return @{
    ok = $false
    results = $results
}

