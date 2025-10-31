$base = "http://localhost:5002/api/v2"

Write-Host "=== SMOKE START ==="

foreach ($p in @("health","risks","audits","issues","policies")) {
  try {
    $r = Invoke-WebRequest "$base/$p" -UseBasicParsing -TimeoutSec 5
    Write-Host "$p`: Status $($r.StatusCode)"
  } catch { 
    Write-Host "$p`: FAIL - $($_.Exception.Message)"
  }
}

Write-Host "=== SMOKE END ==="

