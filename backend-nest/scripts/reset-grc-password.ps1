<#
SYNOPSIS:
  Reset 'grc' user's password in PostgreSQL and fix DB ownership.

USAGE:
  .\reset-grc-password.ps1 -NewPassword "123456"
#>

param(
  [string]$DbName = "grc",
  [string]$DbUser = "grc",
  [string]$NewPassword = "123456",
  [string]$Host = "localhost",
  [int]$Port = 5432,
  [string]$PgSuperUser = "postgres",
  [string]$PsqlPath = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
)

if (-not (Test-Path $PsqlPath)) {
  Write-Host "ERROR: psql.exe not found at: $PsqlPath" -ForegroundColor Red
  exit 1
}

Write-Host "Connecting to PostgreSQL ($PgSuperUser@$Host:$Port) ..." -ForegroundColor Cyan

# Build SQL template with token replacement. Use dollar-quoting for the password.
$tpl = @'
ALTER ROLE {DBUSER} WITH LOGIN PASSWORD $${NEWPASS}$$;
ALTER DATABASE {DBNAME} OWNER TO {DBUSER};
ALTER SCHEMA public OWNER TO {DBUSER};
GRANT ALL PRIVILEGES ON DATABASE {DBNAME} TO {DBUSER};
'@

$alterSql = $tpl.Replace("{DBUSER}", $DbUser).Replace("{DBNAME}", $DbName).Replace("{NEWPASS}", $NewPassword)

try {
  & "$PsqlPath" -U $PgSuperUser -h $Host -p $Port -W -v ON_ERROR_STOP=1 -c $alterSql
  if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Password updated and ownership fixed." -ForegroundColor Green
  } else {
    Write-Host "WARN: Non-zero exit code. Check PostgreSQL logs." -ForegroundColor Yellow
  }
}
catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
