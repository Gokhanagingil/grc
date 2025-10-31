$base = "http://localhost:5002/api/v2"
$tenant = "demo"

Write-Host "=== SMOKE START ==="

try { 
    $r = Invoke-WebRequest "$base/health" -UseBasicParsing
    Write-Host "health: PASS - Status $($r.StatusCode)"
} catch { 
    Write-Host "health: FAIL - $($_.Exception.Message)"
}

try { 
    $r = Invoke-WebRequest "$base/risks" -Headers @{'x-tenant-id'=$tenant} -UseBasicParsing
    Write-Host "risks: PASS - Status $($r.StatusCode)"
} catch { 
    Write-Host "risks: FAIL - $($_.Exception.Message)"
}

try { 
    $r = Invoke-WebRequest "$base/audits" -Headers @{'x-tenant-id'=$tenant} -UseBasicParsing
    Write-Host "audits: PASS - Status $($r.StatusCode)"
} catch { 
    Write-Host "audits: FAIL - $($_.Exception.Message)"
}

try { 
    $r = Invoke-WebRequest "$base/policies" -Headers @{'x-tenant-id'=$tenant} -UseBasicParsing
    Write-Host "policies: PASS - Status $($r.StatusCode)"
} catch { 
    Write-Host "policies: FAIL - $($_.Exception.Message)"
}

try { 
    $r = Invoke-WebRequest "$base/issues" -Headers @{'x-tenant-id'=$tenant} -UseBasicParsing
    Write-Host "issues: PASS - Status $($r.StatusCode)"
} catch { 
    Write-Host "issues: FAIL - $($_.Exception.Message)"
}

Write-Host "=== SMOKE END ==="

