Param(
  [string]$Base="http://localhost:5002",
  [string]$TenantHeader="x-tenant-id",
  [string]$TenantId="217492b2-f814-4ba0-ae50-4e4f8ecf6216",
  [string]$Email1 = $env:SMOKE_EMAIL_1,
  [string]$Pass1  = $env:SMOKE_PASS_1,
  [string]$Email2 = $env:SMOKE_EMAIL_2,
  [string]$Pass2  = $env:SMOKE_PASS_2
)

# Defaults if env vars are missing
if ([string]::IsNullOrWhiteSpace($Email1)) { $Email1 = "test1@local" }
if ([string]::IsNullOrWhiteSpace($Pass1))  { $Pass1  = "test1" }
if ([string]::IsNullOrWhiteSpace($Email2)) { $Email2 = "test1@local" }
if ([string]::IsNullOrWhiteSpace($Pass2))  { $Pass2  = "test1" }

$ErrorActionPreference = "SilentlyContinue"

function Try-Health {
  $paths = @("/health","/api/health","/api/v1/health","/api/v2/health")
  foreach ($p in $paths) {
    try {
      $r = Invoke-WebRequest -Uri ($Base + $p) -UseBasicParsing -TimeoutSec 4 -Method GET
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) {
        Write-Host ("health  PASS  " + $p + " -> " + $r.StatusCode)
        return $true
      }
    } catch {}
  }
  Write-Host "health  FAIL"
  return $false
}

function Try-Login([string]$email,[string]$pass,[string]$label) {
  try {
    $body = @{ email=$email; password=$pass } | ConvertTo-Json -Compress
    $r = Invoke-WebRequest -Uri ($Base + "/api/v2/auth/login") `
         -Headers @{ $TenantHeader = $TenantId; "Content-Type"="application/json" } `
         -Body $body -Method POST -UseBasicParsing -TimeoutSec 6
    if ($r.StatusCode -eq 201 -or $r.StatusCode -eq 200) {
      Write-Host ("login_" + $label + "  PASS  " + $r.StatusCode)
      return $true
    } else {
      Write-Host ("login_" + $label + "  FAIL  status=" + $r.StatusCode)
      return $false
    }
  } catch {
    Write-Host ("login_" + $label + "  FAIL  err")
    return $false
  }
}

$okH = Try-Health | Out-Null
$ok1 = Try-Login $Email1 $Pass1 "usr1"
$ok2 = Try-Login $Email2 $Pass2 "usr2"
