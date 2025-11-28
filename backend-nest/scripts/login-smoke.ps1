param(
    [string]$BaseUrl = $env:API_BASE_URL,
    [string]$Email = $env:SMOKE_EMAIL ?? 'grc1@local',
    [string]$Password = $env:SMOKE_PASSWORD ?? 'grc1',
    [string]$TenantId = $env:SMOKE_TENANT_ID
)

if (-not $BaseUrl -or [string]::IsNullOrWhiteSpace($BaseUrl)) {
    $port = if ($env:PORT) { $env:PORT } else { '5002' }
    $BaseUrl = "http://localhost:$port"
}

if (-not $TenantId) {
    $TenantId = $env:DEFAULT_TENANT_ID
}

$loginUrl = "$BaseUrl/api/v2/auth/login"
Write-Host "?? Login smoke against $loginUrl" -ForegroundColor Cyan

function Invoke-LoginRequest {
    param(
        [bool]$IncludeTenant,
        [string]$TenantValue
    )

    $headers = @{ 'Content-Type' = 'application/json' }
    if ($IncludeTenant -and $TenantValue) {
        $headers['x-tenant-id'] = $TenantValue
    }

    $payload = @{ email = $Email; password = $Password } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri $loginUrl -Method Post -Headers $headers -Body $payload -UseBasicParsing -TimeoutSec 10
        $body = $null
        if ($response.Content) {
            $body = $response.Content | ConvertFrom-Json
        }
        return [pscustomobject]@{
            StatusCode = $response.StatusCode
            Body        = $body
            Raw         = $response.Content
        }
    } catch {
        $resp = $_.Exception.Response
        $status = $resp?.StatusCode.value__
        $raw = $null
        if ($resp -and $resp.GetResponseStream()) {
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $raw = $reader.ReadToEnd()
            $reader.Dispose()
        }
        $body = $null
        if ($raw) {
            try { $body = $raw | ConvertFrom-Json } catch { }
        }
        return [pscustomobject]@{
            StatusCode = $status
            Body        = $body
            Raw         = $raw
        }
    }
}

$withTenant = Invoke-LoginRequest -IncludeTenant:$true -TenantValue:$TenantId
$withoutTenant = Invoke-LoginRequest -IncludeTenant:$false -TenantValue:$TenantId

$passWithTenant = ($withTenant.StatusCode -eq 200) -and $withTenant.Body?.accessToken
$passWithoutTenant = $false
$missingTenantMsg = $withoutTenant.Body?.message
if (($withoutTenant.StatusCode -eq 200) -and $withoutTenant.Body?.accessToken) {
    $passWithoutTenant = $true
} elseif (($withoutTenant.StatusCode -eq 400) -and $missingTenantMsg -and $missingTenantMsg -like 'Tenant context required*') {
    $passWithoutTenant = $true
}

Write-Host ("{0,-25}{1}" -f 'With tenant header:', ($passWithTenant ? 'PASS' : 'FAIL')) -ForegroundColor ($passWithTenant ? 'Green' : 'Red')
Write-Host ("{0,-25}{1}" -f 'Without tenant header:', ($passWithoutTenant ? 'PASS' : 'FAIL')) -ForegroundColor ($passWithoutTenant ? 'Green' : 'Red')

if (-not $passWithTenant) {
    Write-Host "  status: $($withTenant.StatusCode)" -ForegroundColor Yellow
    if ($withTenant.Raw) { Write-Host "  body: $($withTenant.Raw)" -ForegroundColor Yellow }
}

if (-not $passWithoutTenant) {
    Write-Host "  status: $($withoutTenant.StatusCode)" -ForegroundColor Yellow
    if ($withoutTenant.Raw) { Write-Host "  body: $($withoutTenant.Raw)" -ForegroundColor Yellow }
}

if ($passWithTenant -and $passWithoutTenant) {
    exit 0
} else {
    exit 1
}
