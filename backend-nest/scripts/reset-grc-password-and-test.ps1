<#
SYNOPSIS:
  Reset 'grc' user's password in PostgreSQL, sync .env, and run smoke tests.

USAGE:
  .\reset-grc-password-and-test.ps1 -NewPassword "123456" -PsqlPath "C:\Program Files\PostgreSQL\17\bin\psql.exe"

NOTES:
  - If -NewPassword is not provided, script will read DB_PASS from .env. If .env lacks DB_PASS, defaults to 123456.
  - Requires postgres superuser password interactively (psql -W).
#>

param(
  [string]$DbName = "grc",
  [string]$DbUser = "grc",
  [string]$NewPassword = "",
  [string]$Host = "localhost",
  [int]$Port = 5432,
  [string]$PgSuperUser = "postgres",
  [string]$PsqlPath = "C:\Program Files\PostgreSQL\17\bin\psql.exe",
  [string]$EnvPath = "..\ .env"  # relative to scripts folder
)

function Resolve-EnvPath {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $envPath = Join-Path (Join-Path $scriptDir "..") ".env"
  return (Resolve-Path $envPath).Path
}

# 1) Verify psql path
if (-not (Test-Path $PsqlPath)) {
  Write-Host "ERROR: psql.exe not found at: $PsqlPath" -ForegroundColor Red
  exit 1
}

# 2) Locate .env
try {
  $envFile = Resolve-EnvPath
} catch {
  Write-Host "WARN: .env not found next to backend. Will proceed without reading it." -ForegroundColor Yellow
  $envFile = $null
}

# 3) Parse .env (DB_NAME, DB_USER, DB_PASS) if present
$envMap = @{}
if ($envFile -ne $null -and (Test-Path $envFile)) {
  (Get-Content $envFile) | ForEach-Object {
    if ($_ -match '^\s*#') { return }
    if ($_ -match '^\s*$') { return }
    $kv = $_ -split '=', 2
    if ($kv.Count -eq 2) {
      $key = $kv[0].Trim()
      $val = $kv[1].Trim()
      $envMap[$key] = $val
    }
  }
}

if ($envMap.ContainsKey("DB_NAME")) { $DbName = $envMap["DB_NAME"] }
if ($envMap.ContainsKey("DB_USER")) { $DbUser = $envMap["DB_USER"] }

# Decide final password to set:
if ([string]::IsNullOrWhiteSpace($NewPassword)) {
  if ($envMap.ContainsKey("DB_PASS") -and -not [string]::IsNullOrWhiteSpace($envMap["DB_PASS"])) {
    $NewPassword = $envMap["DB_PASS"]
  } else {
    $NewPassword = "123456"
    Write-Host "INFO: No -NewPassword and .env DB_PASS missing. Using default 123456." -ForegroundColor Yellow
  }
}

Write-Host "INFO: Target DB: Name=$DbName, User=$DbUser, Host=$Host, Port=$Port" -ForegroundColor Cyan

# 4) Build SQL using dollar-quoting to avoid quoting issues
$tpl = @'
ALTER ROLE {DBUSER} WITH LOGIN PASSWORD $${NEWPASS}$$;
ALTER DATABASE {DBNAME} OWNER TO {DBUSER};
ALTER SCHEMA public OWNER TO {DBUSER};
GRANT ALL PRIVILEGES ON DATABASE {DBNAME} TO {DBUSER};
'@

$alterSql = $tpl.Replace("{DBUSER}", $DbUser).Replace("{DBNAME}", $DbName).Replace("{NEWPASS}", $NewPassword)

# 5) Apply changes
Write-Host "Connecting to PostgreSQL ($PgSuperUser@$Host:$Port) ..." -ForegroundColor Cyan
& "$PsqlPath" -U $PgSuperUser -h $Host -p $Port -W -v ON_ERROR_STOP=1 -c $alterSql
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: psql returned non-zero exit code. Check postgres password or connectivity." -ForegroundColor Red
  exit $LASTEXITCODE
}

# 6) Verify psql connectivity with new creds
$verifySql = "select current_user, current_database();"
& "$PsqlPath" -U $DbUser -h $Host -p $Port -W -d $DbName -c $verifySql
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Verification failed when connecting as $DbUser to $DbName." -ForegroundColor Red
  exit $LASTEXITCODE
}
Write-Host "SUCCESS: Password updated and verified for $DbUser@$DbName" -ForegroundColor Green

# 7) Sync .env DB_PASS if needed
if ($envFile -ne $null -and (Test-Path $envFile)) {
  $content = Get-Content $envFile -Raw
  if ($content -match '(^|\r?\n)\s*DB_PASS\s*=') {
    $newContent = [System.Text.RegularExpressions.Regex]::Replace($content, '(^|\r?\n)\s*DB_PASS\s*=.*', "`$1DB_PASS=$NewPassword")
  } else {
    $newline = "`r`n"
    $newContent = $content + "$newline`# added by reset-grc-password-and-test.ps1$newline" + "DB_PASS=$NewPassword$newline"
  }
  Set-Content -Path $envFile -Value $newContent -Encoding UTF8
  Write-Host "INFO: .env updated with new DB_PASS." -ForegroundColor Green
} else {
  Write-Host "WARN: .env not found; skipped .env update." -ForegroundColor Yellow
}

# 8) Try backend start and smoke test
# Note: do not block dev shell. We will try health first then login smoke via existing npm scripts.
$backendDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $backendDir

# Ensure dependencies present (idempotent)
if (Test-Path "package.json") {
  npm install --silent | Out-Null
}

# Start dev in background
$nodeJob = Start-Job -ScriptBlock {
  param($dir)
  Set-Location $dir
  npm run start:dev
} -ArgumentList $backendDir

Start-Sleep -Seconds 6

# Health probe (try several common paths)
$port = 5002
$healths = @(
  "http://localhost:$port/health",
  "http://localhost:$port/api/health",
  "http://localhost:$port/api/v1/health",
  "http://localhost:$port/api/v2/health"
)
$healthy = $false
foreach ($h in $healths) {
  try {
    $resp = Invoke-WebRequest -Uri $h -UseBasicParsing -Method GET -TimeoutSec 4
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
      Write-Host "HEALTH OK: $h -> $($resp.StatusCode)" -ForegroundColor Green
      $healthy = $true
      break
    }
  } catch {}
}
if (-not $healthy) {
  Write-Host "WARN: Health endpoint not confirmed yet. Proceeding to smoke login anyway." -ForegroundColor Yellow
}

# Run existing smoke login (PowerShell variant)
npm run smoke:logins:ps

# Stop background job (dev server)
Stop-Job $nodeJob -Force | Out-Null
Remove-Job $nodeJob -Force | Out-Null

Pop-Location

