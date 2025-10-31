$ErrorActionPreference = 'SilentlyContinue'
$envPath = Join-Path $PSScriptRoot '..\.env'
$PORT = 5002
$PREFIX = 'api'
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^PORT=(.+)$') { $PORT = [int]$Matches[1] }
    if ($_ -match '^API_PREFIX=(.+)$') { $PREFIX = $Matches[1] }
  }
}
$tenantId = '217492b2-f814-4ba0-ae50-4e4f8ecf6216'
$email = 'admin@local'
$pass = 'ChangeMe!123'
$base = "http://localhost:$PORT/$PREFIX"

Write-Host "Health: $base/v1/health"
try { $h = Invoke-WebRequest -Uri "$base/v1/health" -UseBasicParsing -TimeoutSec 10; Write-Host $h.Content } catch { Write-Host 'Health error'; Write-Host $_ }

$body = @{ email=$email; password=$pass } | ConvertTo-Json -Compress
Write-Host "Login: $base/v2/auth/login"
try {
  $res = Invoke-RestMethod -Method Post -Uri "$base/v2/auth/login" -Headers @{ 'x-tenant-id'=$tenantId } -ContentType 'application/json' -Body $body
  $tok = $res.accessToken
  if ($tok) { $mask = $tok.Substring(0,4) + '...' + $tok.Substring($tok.Length-4); Write-Host (ConvertTo-Json @{ ok=$true; token=$mask; user=$res.user } -Compress) }
  else { Write-Host (ConvertTo-Json $res -Compress) }
} catch { Write-Host 'Login error'; Write-Host $_ }


