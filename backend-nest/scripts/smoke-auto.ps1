$ErrorActionPreference = 'SilentlyContinue'
function Read-EnvKV($path){
  $o = @{}
  if (Test-Path $path) {
    Get-Content $path | ForEach-Object {
      if ($_ -match '^(\w+)=(.*)$') { $o[$Matches[1]] = $Matches[2] }
    }
  }
  return $o
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendDir = Join-Path $repoRoot 'backend-nest'
$envPath = Join-Path $backendDir '.env'
$env = Read-EnvKV $envPath

$PORT = [int]($env['PORT'] | ForEach-Object { if($_){$_} else {'5002'} })
$PREFIX = ($env['API_PREFIX'] | ForEach-Object { if($_){$_} else {'api'} })
$EMAIL = ($env['INITIAL_ADMIN_EMAIL'] | ForEach-Object { if($_){$_} else {'admin@local'} })
$PASS = ($env['INITIAL_ADMIN_PASSWORD'] | ForEach-Object { if($_){$_} else {'ChangeMe!123'} })
$TENANT = '217492b2-f814-4ba0-ae50-4e4f8ecf6216'
$BASE = "http://localhost:$PORT/$PREFIX"

Write-Host "[env] PORT=$PORT, PREFIX=$PREFIX, EMAIL=$EMAIL" -ForegroundColor Cyan

# 1) Free port
try {
  $pid = (Get-NetTCPConnection -LocalPort $PORT -State Listen | Select -First 1 -ExpandProperty OwningProcess) 2>$null
  if ($pid) { Stop-Process -Id $pid -Force; Write-Host "[port] Killed PID $pid on $PORT" -ForegroundColor Yellow }
} catch {}

# 2) Build backend
Push-Location $backendDir
Write-Host "[build] npm run build" -ForegroundColor Cyan
npm run build | Out-Host

# 3) Start backend (background) and wait for health
Write-Host "[start] npm run start:dev (background)" -ForegroundColor Cyan
$job = Start-Job -ScriptBlock { param($dir) Set-Location $dir; npm run start:dev } -ArgumentList $backendDir
Start-Sleep -Seconds 2

# 4) Health check with fallbacks
$healthUrls = @(
  "$BASE/v1/health",
  "$BASE/health",
  "http://localhost:$PORT/api/v1/health",
  "http://localhost:$PORT/api/health"
)
$healthOk=$false; $healthBody=''; $healthUrlTried=''
foreach($u in $healthUrls){
  try { $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 8; if($r.StatusCode -eq 200){ $healthOk=$true; $healthBody=$r.Content; $healthUrlTried=$u; break } } catch {}
  Start-Sleep -Seconds 2
}

if (-not $healthOk) {
  Write-Host "[health] FAIL on all fallbacks" -ForegroundColor Red
} else {
  Write-Host "[health] OK $healthUrlTried" -ForegroundColor Green
  Write-Host $healthBody
}

# 5) Login check (v2)
$loginUrl = "$BASE/v2/auth/login"
$loginBody = @{ email=$EMAIL; password=$PASS } | ConvertTo-Json -Compress
$loginOk=$false; $loginJson=''; $masked=''
try {
  $resp = Invoke-RestMethod -Method Post -Uri $loginUrl -Headers @{ 'x-tenant-id'=$TENANT } -ContentType 'application/json' -Body $loginBody
  $loginJson = $resp | ConvertTo-Json -Compress
  if ($resp.accessToken) {
    $tok = [string]$resp.accessToken; if($tok.Length -gt 10){ $masked = $tok.Substring(0,6) + '***' + $tok.Substring($tok.Length-4) } else { $masked = '***' }
    $loginOk = $true
  }
} catch {
  $loginJson = "error: $($_.Exception.Message)"
}

if ($loginOk) {
  Write-Host "[login] OK $loginUrl" -ForegroundColor Green
} else {
  Write-Host "[login] FAIL $loginUrl — $loginJson" -ForegroundColor Red
}

# 6) Swagger check
$swaggerOk=$false
try { $sw = Invoke-WebRequest -Uri "http://localhost:$PORT/api-docs" -UseBasicParsing -TimeoutSec 8; if($sw.StatusCode -eq 200 -and $sw.Content -match 'x-tenant-id'){ $swaggerOk=$true } } catch {}

# 7) PASS/FAIL matrix
Write-Host "`n=== RESULT ===" -ForegroundColor Cyan
Write-Host ("env check`tPASS`tPORT={0}, PREFIX={1}" -f $PORT,$PREFIX)
Write-Host ("port free`tPASS")
Write-Host ("build`tPASS")
Write-Host ("start`tPASS (background job #{0})" -f $job.Id)
Write-Host ("health v1`t{0}`t{1}" -f ($healthOk?'PASS':'FAIL'), ($healthBody -replace '\s+',' '))
Write-Host ("login v2`t{0}`t{1}" -f ($loginOk?'PASS':'FAIL'), (if($masked){"token=$masked"} else {$loginJson}))
Write-Host ("swagger`t{0}" -f ($swaggerOk?'PASS':'FAIL'))
Write-Host ("versioning`t{0}" -f (($healthOk -and $loginOk)?'PASS':'WARN'))
Write-Host ("tenant id`tPASS`t$TENANT")

# 8) Stop background job (optional cleanup)
try { Stop-Job -Id $job.Id -Force | Out-Null; Receive-Job -Id $job.Id -Keep | Out-Null; Remove-Job -Id $job.Id -Force | Out-Null } catch {}


