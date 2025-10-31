$ErrorActionPreference = 'SilentlyContinue'
function Read-EnvKV($path){ $o=@{}; if(Test-Path $path){ Get-Content $path | % { if($_ -match '^(\w+)=(.*)$'){ $o[$Matches[1]]=$Matches[2] } } } return $o }

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envPath = Join-Path $root 'backend-nest\.env'
$env = Read-EnvKV $envPath
$PORT = [int]($env['PORT'] | % { if($_){$_} else {'5002'} })
$PREFIX = ($env['API_PREFIX'] | % { if($_){$_} else {'api'} })
$TENANT = '217492b2-f814-4ba0-ae50-4e4f8ecf6216'
$BASE = "http://localhost:$PORT/$PREFIX"

function Mask-Token($t){ if(-not $t){ return '' }; $s=[string]$t; if($s.Length -le 10){ return '***' }; return $s.Substring(0,6)+'***'+$s.Substring($s.Length-4) }

# Health
$healthUrls = @("$BASE/v1/health","$BASE/health","http://localhost:$PORT/api/v1/health","http://localhost:$PORT/api/health")
$healthOk=$false; $healthBody=''; foreach($u in $healthUrls){ try{ $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 8; if($r.StatusCode -eq 200){ $healthOk=$true; $healthBody=$r.Content; break } } catch{} }
if ($healthOk) { Write-Host ("health`tPASS`t{0}" -f ($healthBody -replace '\s+',' ')) } else { Write-Host "health`tFAIL`t" }

function Try-Login($email,$password){
  $body=@{ email=$email; password=$password } | ConvertTo-Json -Compress
  try { $res = Invoke-RestMethod -Method Post -Uri "$BASE/v2/auth/login" -Headers @{ 'x-tenant-id'=$TENANT } -ContentType 'application/json' -Body $body; return $res } catch { return $null }
}

$r1 = Try-Login 'grc1@local' 'grc1'
$ok1 = ($null -ne $r1 -and $r1.accessToken)
$m1 = Mask-Token ($r1.accessToken)
if ($ok1) { Write-Host ("login_grc1`tPASS`t{0}" -f ("token=$m1")) } else { Write-Host "login_grc1`tFAIL`terr" }

$r2 = Try-Login 'grc2@local' 'grc2'
$ok2 = ($null -ne $r2 -and $r2.accessToken)
$m2 = Mask-Token ($r2.accessToken)
if ($ok2) { Write-Host ("login_grc2`tPASS`t{0}" -f ("token=$m2")) } else { Write-Host "login_grc2`tFAIL`terr" }

if(-not ($healthOk -and $ok1 -and $ok2)){ exit 2 } else { exit 0 }


