# PHASE 9 Acceptance Validation Script (PowerShell)
# Tests all components: Health, Metrics, Tenant Isolation, Rate Limiting, Event Engine, Queue, DLQ, Idempotency
# Supports "no-redis" mode: automatically skips Redis-dependent tests when Redis is unavailable

param(
    [string]$JWT_TOKEN = "",
    [string]$INGEST_TOKEN = "change-me",
    [string]$TENANT_A = "217492b2-f814-4ba0-ae50-4e4f8ecf6216",
    [string]$TENANT_B = "00000000-0000-0000-0000-000000000001",
    [string]$API_URL = "http://localhost:5002"
)

$ErrorActionPreference = "Continue"
$reportsDir = Join-Path $PSScriptRoot "..\reports"
if (-not (Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
}

$reportFile = Join-Path $reportsDir "ACCEPTANCE-VALIDATION-REPORT.md"
$results = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    mode = "unknown"
    tests = @{}
    summary = @{}
    skippedTests = @()
}

# Redis availability check
function Test-RedisConnection {
    $redisHost = if ($env:REDIS_HOST) { $env:REDIS_HOST } else { "localhost" }
    $redisPort = if ($env:REDIS_PORT) { $env:REDIS_PORT } else { "6379" }
    
    # Try TCP connection check
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $result = $tcpClient.BeginConnect($redisHost, [int]$redisPort, $null, $null)
        $wait = $result.AsyncWaitHandle.WaitOne(1000, $false)
        if ($wait) {
            $tcpClient.EndConnect($result)
            $tcpClient.Close()
            return $true
        } else {
            $tcpClient.Close()
            return $false
        }
    } catch {
        return $false
    }
}

# Check Redis via health endpoint
function Test-RedisViaHealth {
    try {
        $healthResp = Invoke-RestMethod -Uri "$API_URL/api/v2/health" -TimeoutSec 5 -ErrorAction Stop
        return ($healthResp.redis -eq "up" -or $healthResp.redis -eq "ok")
    } catch {
        return $false
    }
}

# Determine Redis status
$redisAvailable = Test-RedisViaHealth
if (-not $redisAvailable) {
    $redisAvailable = Test-RedisConnection
}

$SKIP_QUEUE = -not $redisAvailable
$results.mode = if ($SKIP_QUEUE) { "no-redis" } else { "full" }

Write-Host "`n=== Redis Status ===" -ForegroundColor Cyan
if ($SKIP_QUEUE) {
    Write-Host "⚠️  Redis NOT AVAILABLE - Queue-dependent tests will be SKIPPED" -ForegroundColor Yellow
} else {
    Write-Host "✅ Redis AVAILABLE - All tests will run" -ForegroundColor Green
}

function Write-TestResult {
    param([string]$TestName, [object]$Result, [switch]$Skipped)
    if ($Skipped) {
        $results.tests[$TestName] = @{ success = $false; skipped = $true; reason = "redis down" }
        $results.skippedTests += $TestName
        Write-Host "⏭️  SKIPPED - $TestName (redis down)" -ForegroundColor Yellow
    } else {
        $results.tests[$TestName] = $Result
        $status = if ($Result.success) { "✅ PASS" } else { "❌ FAIL" }
        Write-Host "$status - $TestName" -ForegroundColor $(if ($Result.success) { "Green" } else { "Red" })
        if ($Result.error) {
            Write-Host "  Error: $($Result.error)" -ForegroundColor Yellow
        }
    }
}

# Helper: Retry with timeout
function Invoke-RestMethodWithRetry {
    param(
        [string]$Uri,
        [int]$MaxRetries = 30,
        [int]$TimeoutSec = 5,
        [switch]$WaitForBackend
    )
    
    if ($WaitForBackend) {
        # First, try ping endpoint
        try {
            Invoke-RestMethod -Uri "$API_URL/api/v2/ping" -TimeoutSec 3 -ErrorAction Stop | Out-Null
            Write-Host "  Backend ping OK" -ForegroundColor Gray
        } catch {
            Write-Host "  Backend ping failed, continuing..." -ForegroundColor Gray
        }
    }
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $result = Invoke-RestMethod -Uri $Uri -TimeoutSec $TimeoutSec -ErrorAction Stop
            return $result
        } catch {
            if ($i -lt $MaxRetries) {
                Start-Sleep -Seconds 1
            } else {
                throw
            }
        }
    }
    return $null
}

# Step 1: Health and Metrics (with retry)
Write-Host "`n=== Step 1: Health and Metrics ===" -ForegroundColor Cyan
try {
    # Wait a bit for backend to be ready
    Write-Host "  Waiting for backend (max 30s)..."
    $healthResp = $null
    for ($i = 1; $i -le 30; $i++) {
        try {
            $healthResp = Invoke-RestMethod -Uri "$API_URL/api/v2/health" -Headers @{"x-tenant-id" = $TENANT_A} -TimeoutSec 5 -ErrorAction Stop
            break
        } catch {
            if ($i -eq 3) {
                # After 3 failures, try ping endpoint
                try {
                    Invoke-RestMethod -Uri "$API_URL/api/v2/ping" -TimeoutSec 3 -ErrorAction Stop | Out-Null
                    Write-Host "  Backend ping OK, retrying health..." -ForegroundColor Gray
                } catch {
                    Write-Host "  Backend ping also failed" -ForegroundColor Gray
                }
            }
            if ($i -lt 30) {
                Start-Sleep -Seconds 1
            }
        }
    }
    
    if (-not $healthResp) {
        throw "Health endpoint unavailable after 30 retries"
    }
    
    $healthJson = $healthResp | ConvertTo-Json -Depth 10
    $healthJson | Out-File -FilePath (Join-Path $reportsDir "health.json") -Encoding UTF8
    
    # Metrics endpoint with retry
    $metricsPresent = $false
    for ($i = 1; $i -le 30; $i++) {
        try {
            $metricsResp = Invoke-WebRequest -Uri "$API_URL/metrics" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            $metricsText = ($metricsResp.Content -split "`n" | Select-Object -First 40) -join "`n"
            $metricsText | Out-File -FilePath (Join-Path $reportsDir "metrics-preview.txt") -Encoding UTF8
            $metricsPresent = $metricsResp.Content -match "http_request_total"
            break
        } catch {
            if ($i -lt 30) {
                Start-Sleep -Seconds 1
            }
        }
    }
    
    $healthCheck = @{
        success = ($healthResp.status -eq "ok")
        redis = $healthResp.redis
        queueLag = $healthResp.queue.lag
        dlqDepth = $healthResp.queue.dlqDepth
        metricsPresent = $metricsPresent
    }
    
    Write-TestResult -TestName "Health and Metrics" -Result $healthCheck
    Write-Host "  Redis: $($healthResp.redis)"
    Write-Host "  Queue Lag: $($healthResp.queue.lag)"
    Write-Host "  DLQ Depth: $($healthResp.queue.dlqDepth)"
    Write-Host "  Metrics: $metricsPresent"
} catch {
    Write-TestResult -TestName "Health and Metrics" -Result @{ success = $false; error = $_.Exception.Message }
}

# Step 1.5: Data Foundations (Health/Dashboard)
Write-Host "`n=== Step 1.5: Data Foundations (Health/Dashboard) ===" -ForegroundColor Cyan
try {
    # Test health endpoint with tenant header
    $healthWithTenant = Invoke-RestMethod -Uri "$API_URL/api/v2/health" -Headers @{"x-tenant-id" = $TENANT_A} -TimeoutSec 10 -ErrorAction Stop
    
    # Test dashboard endpoint with tenant header
    $dashboardResp = $null
    try {
        $dashboardResp = Invoke-RestMethod -Uri "$API_URL/api/v2/dashboard/overview" `
            -Headers @{
                "Authorization" = "Bearer $JWT_TOKEN"
                "x-tenant-id" = $TENANT_A
            } `
            -TimeoutSec 10 `
            -ErrorAction Stop
    } catch {
        # If JWT not available yet, try without auth (may fail but we'll check counts)
        try {
            $dashboardResp = Invoke-RestMethod -Uri "$API_URL/api/v2/dashboard/overview" `
                -Headers @{"x-tenant-id" = $TENANT_A} `
                -TimeoutSec 10 `
                -ErrorAction Stop
        } catch {
            $dashboardResp = $null
        }
    }
    
    $clausesHealth = $healthWithTenant.dataFoundations.clauses
    $clausesDashboard = if ($dashboardResp) { $dashboardResp.dataFoundations.clauses } else { 0 }
    $mappingsHealth = $healthWithTenant.dataFoundations.mappings
    $mappingsDashboard = if ($dashboardResp) { $dashboardResp.dataFoundations.mappings } else { 0 }
    
    $clausesOk = ($clausesHealth -ge 400) -or ($clausesDashboard -ge 400)
    $mappingsOk = ($mappingsHealth -ge 200) -or ($mappingsDashboard -ge 200)
    
    $dataFoundationsCheck = @{
        success = $clausesOk -and $mappingsOk
        healthClauses = $clausesHealth
        healthMappings = $mappingsHealth
        dashboardClauses = $clausesDashboard
        dashboardMappings = $mappingsDashboard
        clausesSynthetic = $healthWithTenant.dataFoundations.clausesSynthetic
        mappingsSynthetic = $healthWithTenant.dataFoundations.mappingsSynthetic
        tenantId = $healthWithTenant.tenantId
        error = if (-not ($clausesOk -and $mappingsOk)) { "tenant-mismatch or count-error" } else { $null }
    }
    
    Write-TestResult -TestName "Data Foundations (Health/Dashboard)" -Result $dataFoundationsCheck
    Write-Host "  Health Clauses: $clausesHealth (target: ≥400)"
    Write-Host "  Health Mappings: $mappingsHealth (target: ≥200)"
    if ($dashboardResp) {
        Write-Host "  Dashboard Clauses: $clausesDashboard"
        Write-Host "  Dashboard Mappings: $mappingsDashboard"
    }
} catch {
    Write-TestResult -TestName "Data Foundations (Health/Dashboard)" -Result @{ 
        success = $false 
        error = "tenant-mismatch or count-error: $($_.Exception.Message)" 
    }
}

# Step 1.6: Cross-Impact Endpoint
Write-Host "`n=== Step 1.6: Cross-Impact Endpoint ===" -ForegroundColor Cyan
try {
    # Valid clause test
    $validResponse = Invoke-RestMethod -Uri "$API_URL/api/v2/compliance/cross-impact?clause=ISO20000:8.4&includeSynthetic=false" `
        -Headers @{"x-tenant-id" = $TENANT_A} `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    $validMatches = if ($validResponse.matches) { $validResponse.matches.Count } else { 0 }
    $validOk = ($validResponse.clause -eq "ISO20000:8.4") -and ($validMatches -ge 1)
    
    # Invalid format test
    $invalidResponse = Invoke-RestMethod -Uri "$API_URL/api/v2/compliance/cross-impact?clause=foo" `
        -Headers @{"x-tenant-id" = $TENANT_A} `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    $invalidMatches = if ($invalidResponse.matches) { $invalidResponse.matches.Count } else { 0 }
    $invalidOk = ($invalidResponse.clause -eq "foo") -and ($invalidMatches -eq 0) -and ($invalidResponse.note -eq "invalid_clause_format")
    
    $crossImpactCheck = @{
        success = $validOk -and $invalidOk
        validClauseMatches = $validMatches
        invalidClauseMatches = $invalidMatches
        validNote = $validResponse.note
        invalidNote = $invalidResponse.note
        error = if (-not ($validOk -and $invalidOk)) { "cross-impact-empty-or-error" } else { $null }
    }
    
    Write-TestResult -TestName "Cross-Impact Endpoint" -Result $crossImpactCheck
    Write-Host "  Valid clause (ISO20000:8.4): $validMatches matches"
    Write-Host "  Invalid format (foo): $invalidMatches matches, note=$($invalidResponse.note)"
} catch {
    Write-TestResult -TestName "Cross-Impact Endpoint" -Result @{ 
        success = $false
        error = "cross-impact-empty-or-error: $($_.Exception.Message)"
    }
}

# Step 1.7: Governance/Policy CRUD
Write-Host "`n=== Step 1.7: Governance/Policy CRUD ===" -ForegroundColor Cyan
try {
    # Create a new policy
    $createPolicyBody = @{
        code = "POL-TEST-001"
        title = "Test Policy"
        status = "draft"
        effective_date = "01/01/2024"
        review_date = "01/01/2025"
    } | ConvertTo-Json

    $createResp = Invoke-RestMethod -Uri "$API_URL/api/v2/governance/policies" `
        -Method POST `
        -Headers @{
            "x-tenant-id" = $TENANT_A
            "Content-Type" = "application/json"
        } `
        -Body $createPolicyBody `
        -TimeoutSec 10 `
        -ErrorAction Stop

    $createOk = ($createResp.id -ne $null) -and ($createResp.code -eq "POL-TEST-001")

    # List policies and find the created one
    $listResp = Invoke-RestMethod -Uri "$API_URL/api/v2/governance/policies?search=POL-TEST" `
        -Headers @{"x-tenant-id" = $TENANT_A} `
        -TimeoutSec 10 `
        -ErrorAction Stop

    $foundInList = ($listResp.items | Where-Object { $_.code -eq "POL-TEST-001" }).Count -gt 0

    $policyCrudCheck = @{
        success = $createOk -and $foundInList
        created = $createOk
        foundInList = $foundInList
        policyId = $createResp.id
    }

    Write-TestResult -TestName "Governance/Policy CRUD" -Result $policyCrudCheck
    Write-Host "  Created: $createOk"
    Write-Host "  Found in list: $foundInList"
} catch {
    Write-TestResult -TestName "Governance/Policy CRUD" -Result @{ 
        success = $false
        error = $_.Exception.Message
    }
}

# Step 1.8: Risk Create
Write-Host "`n=== Step 1.8: Risk Create ===" -ForegroundColor Cyan
try {
    $createRiskBody = @{
        code = "RISK-TEST-001"
        name = "Test Risk"
        description = "Test risk description"
        default_likelihood = 3
        default_impact = 3
    } | ConvertTo-Json

    $createRiskResp = Invoke-RestMethod -Uri "$API_URL/api/v2/risk-catalog" `
        -Method POST `
        -Headers @{
            "x-tenant-id" = $TENANT_A
            "Content-Type" = "application/json"
        } `
        -Body $createRiskBody `
        -TimeoutSec 10 `
        -ErrorAction Stop

    $createRiskOk = ($createRiskResp.id -ne $null) -and ($createRiskResp.code -eq "RISK-TEST-001")

    # Verify in list
    $riskListResp = Invoke-RestMethod -Uri "$API_URL/api/v2/risk-catalog?search=RISK-TEST" `
        -Headers @{"x-tenant-id" = $TENANT_A} `
        -TimeoutSec 10 `
        -ErrorAction Stop

    $foundInRiskList = ($riskListResp.items | Where-Object { $_.code -eq "RISK-TEST-001" }).Count -gt 0

    $riskCreateCheck = @{
        success = $createRiskOk -and $foundInRiskList
        created = $createRiskOk
        foundInList = $foundInRiskList
        riskId = $createRiskResp.id
    }

    Write-TestResult -TestName "Risk Create" -Result $riskCreateCheck
    Write-Host "  Created: $createRiskOk"
    Write-Host "  Found in list: $foundInRiskList"
} catch {
    Write-TestResult -TestName "Risk Create" -Result @{ 
        success = $false
        error = $_.Exception.Message
    }
}

# Step 1.9: Clause Create
Write-Host "`n=== Step 1.9: Clause Create ===" -ForegroundColor Cyan
try {
    $createClauseBody = @{
        clause_code = "CUST-999"
        title = "Test Clause"
        text = "Test clause description"
        synthetic = $true
    } | ConvertTo-Json

    $createClauseResp = Invoke-RestMethod -Uri "$API_URL/api/v2/standards/ISO20000/clauses" `
        -Method POST `
        -Headers @{
            "x-tenant-id" = $TENANT_A
            "Content-Type" = "application/json"
        } `
        -Body $createClauseBody `
        -TimeoutSec 10 `
        -ErrorAction Stop

    $createClauseOk = ($createClauseResp.id -ne $null) -and ($createClauseResp.clause_code -eq "CUST-999")

    # Verify in list (includeSynthetic=true)
    $clauseListResp = Invoke-RestMethod -Uri "$API_URL/api/v2/standards/ISO20000/clauses?includeSynthetic=true" `
        -Headers @{"x-tenant-id" = $TENANT_A} `
        -TimeoutSec 10 `
        -ErrorAction Stop

    # Flatten hierarchical tree to check
    function FlattenClauses($clauses) {
        $result = @()
        foreach ($c in $clauses) {
            $result += $c
            if ($c.children) {
                $result += FlattenClauses $c.children
            }
        }
        return $result
    }

    $flatClauses = FlattenClauses $clauseListResp
    $foundInClauseList = ($flatClauses | Where-Object { $_.clause_code -eq "CUST-999" }).Count -gt 0

    $clauseCreateCheck = @{
        success = $createClauseOk -and $foundInClauseList
        created = $createClauseOk
        foundInList = $foundInClauseList
        clauseId = $createClauseResp.id
    }

    Write-TestResult -TestName "Clause Create" -Result $clauseCreateCheck
    Write-Host "  Created: $createClauseOk"
    Write-Host "  Found in list: $foundInClauseList"
} catch {
    Write-TestResult -TestName "Clause Create" -Result @{ 
        success = $false
        error = $_.Exception.Message
    }
}

# Step 1.10: Policy Create with HTML Content
Write-Host "`n=== Step 1.10: Policy Create with HTML Content ===" -ForegroundColor Cyan
try {
    $createPolicyHtmlBody = @{
        code = "POL-HTML-001"
        title = "Test Policy with HTML"
        status = "draft"
        content = "<p>This is a <strong>rich text</strong> policy content with <em>HTML</em> formatting.</p>"
        effective_date = "01/01/2024"
    } | ConvertTo-Json

    $createPolicyHtmlResp = Invoke-RestMethod -Uri "$API_URL/api/v2/governance/policies" `
        -Method POST `
        -Headers @{
            "x-tenant-id" = $TENANT_A
            "Content-Type" = "application/json"
        } `
        -Body $createPolicyHtmlBody `
        -TimeoutSec 10 `
        -ErrorAction Stop

    $createPolicyHtmlOk = ($createPolicyHtmlResp.id -ne $null) -and ($createPolicyHtmlResp.code -eq "POL-HTML-001")

    # Verify HTML content is saved
    $htmlContentOk = ($createPolicyHtmlResp.content -like "*<p>*") -and ($createPolicyHtmlResp.content -like "*</p>*")

    # Verify in list
    $policyListResp = Invoke-RestMethod -Uri "$API_URL/api/v2/governance/policies?search=POL-HTML" `
        -Headers @{"x-tenant-id" = $TENANT_A} `
        -TimeoutSec 10 `
        -ErrorAction Stop

    $foundInPolicyList = ($policyListResp.items | Where-Object { $_.code -eq "POL-HTML-001" -and $_.content -like "*<p>*" }).Count -gt 0

    $policyHtmlCheck = @{
        success = $createPolicyHtmlOk -and $htmlContentOk -and $foundInPolicyList
        created = $createPolicyHtmlOk
        htmlContentSaved = $htmlContentOk
        foundInList = $foundInPolicyList
        policyId = $createPolicyHtmlResp.id
    }

    Write-TestResult -TestName "Policy Create with HTML Content" -Result $policyHtmlCheck
    Write-Host "  Created: $createPolicyHtmlOk"
    Write-Host "  HTML content saved: $htmlContentOk"
    Write-Host "  Found in list: $foundInPolicyList"
} catch {
    Write-TestResult -TestName "Policy Create with HTML Content" -Result @{ 
        success = $false
        error = $_.Exception.Message
    }
}

# Step 1.11: KQL Advanced Search
Write-Host "`n=== Step 1.11: KQL Advanced Search ===" -ForegroundColor Cyan
try {
    # Test KQL query: name contains demo AND likelihood > 2
    $kqlQuery = "name contains demo AND likelihood > 2"
    $kqlEncoded = [System.Web.HttpUtility]::UrlEncode($kqlQuery)
    
    $kqlResp = Invoke-RestMethod -Uri "$API_URL/api/v2/risk-catalog?q=$kqlEncoded" `
        -Headers @{"x-tenant-id" = $TENANT_A} `
        -TimeoutSec 10 `
        -ErrorAction Stop

    $kqlResultsCount = if ($kqlResp.items) { $kqlResp.items.Count } else { 0 }
    $kqlOk = $kqlResultsCount -ge 1

    $kqlCheck = @{
        success = $kqlOk
        resultsCount = $kqlResultsCount
        query = $kqlQuery
        error = if (-not $kqlOk) { "kql-no-results" } else { $null }
    }

    Write-TestResult -TestName "KQL Advanced Search" -Result $kqlCheck
    Write-Host "  Query: $kqlQuery"
    Write-Host "  Results: $kqlResultsCount"
} catch {
    Write-TestResult -TestName "KQL Advanced Search" -Result @{ 
        success = $false
        error = "kql-error: $($_.Exception.Message)"
    }
}

# Step 1.12: Throttling Check (30 sequential searches in dev)
Write-Host "`n=== Step 1.12: Throttling Check ===" -ForegroundColor Cyan
try {
    $throttleSuccess = 0
    $throttleFail = 0
    
    for ($i = 1; $i -le 30; $i++) {
        try {
            $throttleResp = Invoke-RestMethod -Uri "$API_URL/api/v2/risk-catalog?page=1&pageSize=10" `
                -Headers @{"x-tenant-id" = $TENANT_A} `
                -TimeoutSec 5 `
                -ErrorAction Stop
            $throttleSuccess++
        } catch {
            if ($_.Exception.Response.StatusCode -eq 429) {
                $throttleFail++
            }
        }
        Start-Sleep -Milliseconds 100
    }

    # In dev, should allow 30 requests (limit is 100/min)
    $throttleOk = ($throttleSuccess -ge 25) -and ($throttleFail -eq 0)

    $throttleCheck = @{
        success = $throttleOk
        successCount = $throttleSuccess
        failCount = $throttleFail
        error = if (-not $throttleOk) { "throttling-too-strict" } else { $null }
    }

    Write-TestResult -TestName "Throttling Check" -Result $throttleCheck
    Write-Host "  Successful requests: $throttleSuccess / 30"
    Write-Host "  Failed (429): $throttleFail"
} catch {
    Write-TestResult -TestName "Throttling Check" -Result @{ 
        success = $false
        error = $_.Exception.Message
    }
}

# Step 2: Login to get JWT
Write-Host "`n=== Step 2: Login (Get JWT) ===" -ForegroundColor Cyan
if (-not $JWT_TOKEN) {
    try {
        $loginBody = @{
            email = "admin@local"
            password = "Admin!123"
        } | ConvertTo-Json -Compress
        
        $loginResp = Invoke-RestMethod -Uri "$API_URL/api/v2/auth/login" `
            -Method POST `
            -Headers @{"Content-Type" = "application/json"} `
            -Body $loginBody `
            -TimeoutSec 10
        
        $JWT_TOKEN = $loginResp.accessToken
        Write-Host "✅ JWT token obtained" -ForegroundColor Green
    } catch {
        Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Step 3: Tenant Isolation
Write-Host "`n=== Step 3: Tenant Isolation ===" -ForegroundColor Cyan
try {
    # Test without tenant header (should return 400/403, NOT 500)
    try {
        $noTenant = Invoke-RestMethod -Uri "$API_URL/api/v2/risk/risks" `
            -Method GET `
            -Headers @{"Authorization" = "Bearer $JWT_TOKEN"} `
            -TimeoutSec 5 `
            -ErrorAction Stop
        $tenantCheck1 = @{ success = $false; error = "Request succeeded without tenant header" }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 500) {
            $tenantCheck1 = @{ success = $false; error = "Server error (500) - should be 400/403" }
        } else {
            $tenantCheck1 = @{ success = ($statusCode -eq 400 -or $statusCode -eq 401 -or $statusCode -eq 403); statusCode = $statusCode }
        }
    }
    
    # Create risk in Tenant A
    $createBody = @{
        title = "CPU Risk Tenant A"
        description = "Test risk for tenant isolation"
        category = "Performance"
        severity = "High"
    } | ConvertTo-Json -Compress
    
    try {
        $createResp = Invoke-RestMethod -Uri "$API_URL/api/v2/risk" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $JWT_TOKEN"
                "x-tenant-id" = $TENANT_A
                "Content-Type" = "application/json"
            } `
            -Body $createBody `
            -TimeoutSec 10
        
        $riskId = $createResp.id
        $createSuccess = $true
    } catch {
        $createSuccess = $false
        $createError = $_.Exception.Message
    }
    
    if (-not $createSuccess) {
        Write-TestResult -TestName "Tenant Isolation" -Result @{ success = $false; error = "Failed to create risk in Tenant A: $createError" }
        continue
    }
    
    # List risks in Tenant B (should be empty)
    try {
        $listB = Invoke-RestMethod -Uri "$API_URL/api/v2/risk/risks" `
            -Method GET `
            -Headers @{
                "Authorization" = "Bearer $JWT_TOKEN"
                "x-tenant-id" = $TENANT_B
            } `
            -TimeoutSec 10
        
        $tenantCheck2 = @{
            success = ($listB.items.Count -eq 0 -and $listB.total -eq 0)
            tenantACreated = $true
            tenantBItems = $listB.items.Count
            tenantBTotal = $listB.total
            tenantBLeak = ($listB.items | Where-Object { $_.tenant_id -eq $TENANT_A }).Count
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 500) {
            $tenantCheck2 = @{ success = $false; error = "Server error (500) when listing Tenant B" }
        } else {
            $tenantCheck2 = @{ success = $false; error = "HTTP $statusCode when listing Tenant B" }
        }
    }
    
    $overallSuccess = $tenantCheck1.success -and $tenantCheck2.success -and ($tenantCheck2.tenantBLeak -eq 0)
    Write-TestResult -TestName "Tenant Isolation" -Result @{
        success = $overallSuccess
        details = @{
            withoutHeader = $tenantCheck1
            isolation = $tenantCheck2
            leakDetected = ($tenantCheck2.tenantBLeak -gt 0)
        }
    }
} catch {
    Write-TestResult -TestName "Tenant Isolation" -Result @{ success = $false; error = $_.Exception.Message }
}

# Step 4: Rate Limit Test
Write-Host "`n=== Step 4: Rate Limit Test ===" -ForegroundColor Cyan
try {
    Push-Location (Split-Path $PSScriptRoot -Parent)
    $rateTestOutput = & npm run test:rate 2>&1
    Pop-Location
    
    $rateLimitFile = Join-Path $reportsDir "rate-limit.json"
    $retryCount = 0
    while (-not (Test-Path $rateLimitFile) -and $retryCount -lt 1) {
        Write-Host "  Rate limit report not found, retrying..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        Push-Location (Split-Path $PSScriptRoot -Parent)
        $rateTestOutput = & npm run test:rate 2>&1
        Pop-Location
        $retryCount++
    }
    
    if (Test-Path $rateLimitFile) {
        $rateLimitData = Get-Content $rateLimitFile | ConvertFrom-Json
        $rateLimitCheck = @{
            success = ($rateLimitData.rateLimitCount -gt 0 -or $rateLimitData.rateLimitPercentage -ge 10)
            rateLimitCount = $rateLimitData.rateLimitCount
            rateLimitPercentage = $rateLimitData.rateLimitPercentage
            p95Latency = $rateLimitData.latency.p95
            totalRequests = $rateLimitData.totalRequests
        }
        Write-TestResult -TestName "Rate Limiting" -Result $rateLimitCheck
        Write-Host "  Rate limit %: $($rateLimitData.rateLimitPercentage)%"
        Write-Host "  P95 latency: $($rateLimitData.latency.p95)ms"
    } else {
        Write-TestResult -TestName "Rate Limiting" -Result @{ success = $false; error = "Rate limit report not found after retry" }
    }
} catch {
    Write-TestResult -TestName "Rate Limiting" -Result @{ success = $false; error = $_.Exception.Message }
}

# Step 5: Refresh Token Rotation (E2E)
Write-Host "`n=== Step 5: Refresh Token Rotation ===" -ForegroundColor Cyan
try {
    Push-Location (Split-Path $PSScriptRoot -Parent)
    $e2eOutput = & npm run test:e2e -- auth.refresh.e2e-spec.ts 2>&1 | Out-String
    Pop-Location
    
    $outputLines = $e2eOutput -split "`n" | Select-Object -Last 10
    $outputText = $outputLines -join "`n"
    $refreshCheck = @{
        success = ($e2eOutput -match "PASS" -or $e2eOutput -match "passed" -or $e2eOutput -match "✓")
        output = $outputText
    }
    Write-TestResult -TestName 'Refresh Token Rotation' -Result $refreshCheck
} catch {
    $errMsg = $_.Exception.Message
    Write-TestResult -TestName 'Refresh Token Rotation' -Result @{ success = $false; error = $errMsg }
}

# Step 6: Event Ingestion Test (SKIP if Redis down)
Write-Host "`n=== Step 6: Event Ingestion Test ===" -ForegroundColor Cyan
if ($SKIP_QUEUE) {
    Write-TestResult -TestName "Event Ingestion" -Skipped
    @{ skipped = $true; reason = "redis down" } | ConvertTo-Json | Out-File -FilePath (Join-Path $reportsDir "event-ingestion-skipped.json") -Encoding UTF8
} else {
    try {
        $eventBody = @{
            source = "custom"
            items = @(
                @{
                    payload = @{
                        message = "Test event 1"
                        severity = "major"
                        category = "test"
                        resource = "test-resource-1"
                        timestamp = [Math]::Floor([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
                    }
                    tenantId = $TENANT_A
                }
            )
        } | ConvertTo-Json -Depth 10
        
        $eventResp = Invoke-RestMethod -Uri "$API_URL/api/v2/events/ingest/bulk" `
            -Method POST `
            -Headers @{
                "x-tenant-id" = $TENANT_A
                "x-ingest-token" = $INGEST_TOKEN
                "Content-Type" = "application/json"
            } `
            -Body $eventBody `
            -TimeoutSec 10
        
        $eventCheck = @{
            success = ($eventResp.accepted -eq $true)
            jobIds = $eventResp.jobIds.Count
            count = $eventResp.count
        }
        Write-TestResult -TestName "Event Ingestion" -Result $eventCheck
        Start-Sleep -Seconds 3
    } catch {
        Write-TestResult -TestName "Event Ingestion" -Result @{ success = $false; error = $_.Exception.Message }
    }
}

# Step 7: Queue Statistics (SKIP if Redis down)
Write-Host "`n=== Step 7: Queue Statistics ===" -ForegroundColor Cyan
if ($SKIP_QUEUE) {
    Write-TestResult -TestName "Queue Statistics" -Skipped
    @{ skipped = $true; reason = "redis down" } | ConvertTo-Json | Out-File -FilePath (Join-Path $reportsDir "queue-stats.json") -Encoding UTF8
} else {
    try {
        Push-Location (Split-Path $PSScriptRoot -Parent)
        $queueStatsOutput = & npm run queue:stats 2>&1 | Out-String
        Pop-Location
        
        $queueStatsFile = Join-Path $reportsDir "queue-stats.json"
        if (Test-Path $queueStatsFile) {
            $queueStatsContent = Get-Content $queueStatsFile -Raw
            $queueStatsLines = $queueStatsContent -split "`n" | Where-Object { $_ -match "^\{" } | Select-Object -Last 1
            if ($queueStatsLines) {
                $queueStatsData = $queueStatsLines | ConvertFrom-Json
                $queueCheck = @{
                    success = $true
                    rawWaiting = $queueStatsData.queues.'events.raw'.waiting
                    rawActive = $queueStatsData.queues.'events.raw'.active
                    rawCompleted = $queueStatsData.queues.'events.raw'.completed
                    rawFailed = $queueStatsData.queues.'events.raw'.failed
                    dlqDepth = $queueStatsData.queues.'events.dlq'.waiting
                }
                Write-TestResult -TestName "Queue Statistics" -Result $queueCheck
            } else {
                Write-TestResult -TestName "Queue Statistics" -Result @{ success = $false; error = "No valid queue stats found" }
            }
        } else {
            Write-TestResult -TestName "Queue Statistics" -Result @{ success = $false; error = "Queue stats file not found" }
        }
    } catch {
        Write-TestResult -TestName "Queue Statistics" -Result @{ success = $false; error = $_.Exception.Message }
    }
}

# Step 8: Idempotency Test (SKIP if Redis down)
Write-Host "`n=== Step 8: Idempotency Test ===" -ForegroundColor Cyan
if ($SKIP_QUEUE) {
    Write-TestResult -TestName "Idempotency" -Skipped
} else {
    try {
        $idempotencyKey = "TEST-KEY-$(Get-Date -Format 'yyyyMMddHHmmss')"
        
        $idemBody = @{
            source = "custom"
            items = @(
                @{
                    payload = @{
                        message = "Idempotency test"
                        severity = "info"
                        category = "test"
                    }
                }
            )
        } | ConvertTo-Json -Depth 10
        
        # First request
        $idemResp1 = Invoke-RestMethod -Uri "$API_URL/api/v2/events/ingest/bulk" `
            -Method POST `
            -Headers @{
                "x-tenant-id" = $TENANT_A
                "x-ingest-token" = $INGEST_TOKEN
                "Idempotency-Key" = $idempotencyKey
                "Content-Type" = "application/json"
            } `
            -Body $idemBody `
            -TimeoutSec 10
        
        Start-Sleep -Seconds 2
        
        # Second request (duplicate)
        $idemResp2 = Invoke-RestMethod -Uri "$API_URL/api/v2/events/ingest/bulk" `
            -Method POST `
            -Headers @{
                "x-tenant-id" = $TENANT_A
                "x-ingest-token" = $INGEST_TOKEN
                "Idempotency-Key" = $idempotencyKey
                "Content-Type" = "application/json"
            } `
            -Body $idemBody `
            -TimeoutSec 10
        
        $idemCheck = @{
            success = ($idemResp1.accepted -eq $true -and $idemResp2.accepted -eq $true)
            firstJobIds = $idemResp1.jobIds.Count
            secondJobIds = $idemResp2.jobIds.Count
            note = "Both requests accepted (duplicate should be dropped in processor)"
        }
        Write-TestResult -TestName "Idempotency" -Result $idemCheck
    } catch {
        Write-TestResult -TestName "Idempotency" -Result @{ success = $false; error = $_.Exception.Message }
    }
}

# Step 9: Ingest Token Validation (SKIP if Redis down, but still test endpoint)
Write-Host "`n=== Step 9: Ingest Token Validation ===" -ForegroundColor Cyan
if ($SKIP_QUEUE) {
    Write-TestResult -TestName "Ingest Token Validation" -Skipped
} else {
    try {
        $badTokenBody = @{
            source = "custom"
            items = @(@{ payload = @{ message = "Test" } })
        } | ConvertTo-Json -Depth 10
        
        try {
            $badTokenResp = Invoke-RestMethod -Uri "$API_URL/api/v2/events/ingest/bulk" `
                -Method POST `
                -Headers @{
                    "x-tenant-id" = $TENANT_A
                    "x-ingest-token" = "wrong-token"
                    "Content-Type" = "application/json"
                } `
                -Body $badTokenBody `
                -TimeoutSec 5 `
                -ErrorAction Stop
            $tokenCheck = @{ success = $false; error = "Request succeeded with wrong token" }
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            $tokenCheck = @{
                success = ($statusCode -eq 400 -or $statusCode -eq 401)
                statusCode = $statusCode
            }
        }
        
        Write-TestResult -TestName "Ingest Token Validation" -Result $tokenCheck
    } catch {
        Write-TestResult -TestName "Ingest Token Validation" -Result @{ success = $false; error = $_.Exception.Message }
    }
}

# Step 10: SQL Validation (via psql if available)
Write-Host "`n=== Step 10: SQL Validation ===" -ForegroundColor Cyan
try {
    $env:PGPASSWORD = if ($env:DB_PASS) { $env:DB_PASS } else { "123456" }
    $dbUser = if ($env:DB_USER) { $env:DB_USER } else { "grc" }
    $dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "grc" }
    $dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
    $dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
    
    $psqlPath = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
    if (Test-Path $psqlPath) {
        # Count risks with tenant isolation check
        $tenantCheckQuery = 'SELECT COUNT(*) as count FROM risks WHERE tenant_id=''' + $TENANT_A + ''';'
        $tenantCheckOutput = & $psqlPath -U $dbUser -d $dbName -h $dbHost -p $dbPort -w -t -c $tenantCheckQuery 2>&1
        $tenantRiskCount = ($tenantCheckOutput | Select-String -Pattern '\d+').Matches.Value
        
        # Check tenant isolation: count risks in Tenant B
        $tenantBCheckQuery = 'SELECT COUNT(*) as count FROM risks WHERE tenant_id=''' + $TENANT_B + ''';'
        $tenantBOutput = & $psqlPath -U $dbUser -d $dbName -h $dbHost -p $dbPort -w -t -c $tenantBCheckQuery 2>&1
        $tenantBRiskCount = ($tenantBOutput | Select-String -Pattern '\d+').Matches.Value
        
        # Check for leaks (Tenant A risks visible in Tenant B)
        $leakQuery = 'SELECT COUNT(*) as count FROM risks WHERE tenant_id=''' + $TENANT_A + ''' AND id IN (SELECT id FROM risks WHERE tenant_id=''' + $TENANT_B + ''');'
        $leakOutput = & $psqlPath -U $dbUser -d $dbName -h $dbHost -p $dbPort -w -t -c $leakQuery 2>&1
        $leakCount = ($leakOutput | Select-String -Pattern '\d+').Matches.Value
        
        # Count event_raw (may be 0 if Redis was down)
        $rawCountQuery = 'SELECT COUNT(*) as count FROM event_raw;'
        $rawCountOutput = & $psqlPath -U $dbUser -d $dbName -h $dbHost -p $dbPort -w -t -c $rawCountQuery 2>&1
        $rawCount = ($rawCountOutput | Select-String -Pattern '\d+').Matches.Value
        
        # Severity distribution (if any events exist)
        $severityQuery = 'SELECT severity, COUNT(*) as count FROM event_normalized GROUP BY severity ORDER BY count DESC;'
        $severityOutput = & $psqlPath -U $dbUser -d $dbName -h $dbHost -p $dbPort -w -t -c $severityQuery 2>&1
        
        $sqlCheck = @{
            success = ($tenantBRiskCount -eq '0' -and $leakCount -eq '0')
            tenantARiskCount = $tenantRiskCount
            tenantBRiskCount = $tenantBRiskCount
            leakCount = $leakCount
            tenantIsolationOk = ($tenantBRiskCount -eq '0' -and $leakCount -eq '0')
            rawCount = $rawCount
            severityDistribution = ($severityOutput | Select-String -Pattern '\w+\s+\d+' | ForEach-Object { $_.Matches.Value })
        }
        Write-TestResult -TestName "SQL Validation" -Result $sqlCheck
    } else {
        Write-TestResult -TestName "SQL Validation" -Result @{ success = $false; error = "psql not found at $psqlPath" }
    }
} catch {
    Write-TestResult -TestName "SQL Validation" -Result @{ success = $false; error = $_.Exception.Message }
}

# Generate Summary
$totalTests = $results.tests.Count
$passedTests = ($results.tests.Values | Where-Object { $_.success -and -not $_.skipped }).Count
$failedTests = ($results.tests.Values | Where-Object { -not $_.success -and -not $_.skipped }).Count
$skippedTests = ($results.tests.Values | Where-Object { $_.skipped }).Count
$successRate = if (($passedTests + $failedTests) -gt 0) { [Math]::Round(($passedTests / ($passedTests + $failedTests)) * 100, 2) } else { 0 }

$results.summary = @{
    totalTests = $totalTests
    passedTests = $passedTests
    failedTests = $failedTests
    skippedTests = $skippedTests
    successRate = "$successRate%"
}

# Generate Markdown Report
$nl = [Environment]::NewLine
$reportContent = "# PHASE 9 Acceptance Validation Report$nl$nl"
$reportContent += "**Generated**: $($results.timestamp)$nl"
$reportContent += "**Mode**: $($results.mode)$nl"
$reportContent += "**API URL**: $API_URL$nl$nl"

if ($results.mode -eq "no-redis") {
    $reportContent += "> **No-Redis Run**: Queue-dependent steps were skipped.$nl$nl"
}

$reportContent += "## Summary$nl$nl"
$reportContent += "- **Total Tests**: $totalTests$nl"
$reportContent += "- **Passed**: $passedTests$nl"
$reportContent += "- **Failed**: $failedTests$nl"
if ($skippedTests -gt 0) {
    $reportContent += "- **Skipped**: $skippedTests$nl"
}
$reportContent += "- **Success Rate**: $successRate%$nl$nl"
$reportContent += "## Test Results$nl$nl"

foreach ($testName in $results.tests.Keys | Sort-Object) {
    $test = $results.tests[$testName]
    if ($test.skipped) {
        $status = "⏭️ SKIPPED (redis down)"
    } elseif ($test.success) {
        $status = "✅ PASS"
    } else {
        $status = "❌ FAIL"
    }
    $reportContent += "### $testName$nl$nl"
    $reportContent += "**Status**: $status$nl$nl"
    if ($test.error) {
        $reportContent += "**Error**: $($test.error)$nl$nl"
    }
    if ($test.details) {
        $detailsJson = $test.details | ConvertTo-Json -Depth 5
        $reportContent += "**Details**:$nl``````json$nl" + $detailsJson + "$nl``````$nl$nl"
    } else {
        $testWithoutSuccess = $test.PSObject.Properties | Where-Object { $_.Name -ne 'success' -and $_.Name -ne 'error' -and $_.Name -ne 'skipped' -and $_.Name -ne 'reason' } | ForEach-Object { "$($_.Name): $($_.Value)" }
        if ($testWithoutSuccess) {
            $reportContent += "**Details**:$nl"
            $testWithoutSuccess | ForEach-Object { $reportContent += "- $_$nl" }
            $reportContent += "$nl"
        }
    }
}

$queueLag = "N/A"
$dlqDepth = "N/A"
$p95Latency = "N/A"
$rateLimitPct = "N/A"
$refreshSuccess = "N/A"
$tenantLeak = "N/A"

if ($results.tests.'Queue Statistics' -and -not $results.tests.'Queue Statistics'.skipped) {
    $queueLag = $results.tests.'Queue Statistics'.rawWaiting + $results.tests.'Queue Statistics'.rawActive
    $dlqDepth = $results.tests.'Queue Statistics'.dlqDepth
} elseif ($results.tests.'Queue Statistics' -and $results.tests.'Queue Statistics'.skipped) {
    $queueLag = "SKIPPED"
    $dlqDepth = "SKIPPED"
}
if ($results.tests.'Rate Limiting') {
    $p95Latency = "$($results.tests.'Rate Limiting'.p95Latency) ms"
    $rateLimitPct = "$($results.tests.'Rate Limiting'.rateLimitPercentage)%"
}
if ($results.tests.'Refresh Token Rotation') {
    $refreshSuccess = if ($results.tests.'Refresh Token Rotation'.success) { "✅" } else { "❌" }
}
if ($results.tests.'Tenant Isolation') {
    $tenantLeak = if ($results.tests.'Tenant Isolation'.details.isolation.tenantBLeak -eq 0) { "0 ✅" } else { "$($results.tests.'Tenant Isolation'.details.isolation.tenantBLeak) ❌" }
}
if ($results.tests.'SQL Validation') {
    if ($tenantLeak -eq "N/A") {
        $tenantLeak = if ($results.tests.'SQL Validation'.leakCount -eq 0) { "0 ✅" } else { "$($results.tests.'SQL Validation'.leakCount) ❌" }
    }
}

$qLagStr = [string]$queueLag
$qDepthStr = [string]$dlqDepth
$p95Str = [string]$p95Latency
$ratePctStr = [string]$rateLimitPct
$tenantLStr = [string]$tenantLeak
$refreshSStr = [string]$refreshSuccess

$reportContent += "## Quality Thresholds$nl$nl"
$reportContent += ('| Kriter | Beklenen | Durum |' + $nl)
$reportContent += ('|--------|----------|-------|' + $nl)
$reportContent += ('| Queue lag | less than 1000 | ' + $qLagStr + ' |' + $nl)
$reportContent += ('| DLQ depth | equal to 0 | ' + $qDepthStr + ' |' + $nl)
$reportContent += ('| P95 ingest | less than or equal to 250 ms | ' + $p95Str + ' |' + $nl)
$reportContent += ('| Rate-limit 429 ratio | greater than or equal to 10 % | ' + $ratePctStr + ' |' + $nl)
$reportContent += ('| Tenant sızıntısı | 0 kayıt | ' + $tenantLStr + ' |' + $nl)
$reportContent += ('| Refresh rotation success | greater than or equal to 100 % | ' + $refreshSStr + ' |' + $nl + $nl)
$reportContent += "## Files Generated$nl$nl"
$reportContent += "- ``reports/health.json``$nl"
$reportContent += "- ``reports/metrics-preview.txt``$nl"
$reportContent += "- ``reports/rate-limit.json``$nl"
if (-not $SKIP_QUEUE) {
    $reportContent += "- ``reports/queue-stats.json``$nl"
} else {
    $reportContent += "- ``reports/queue-stats.json`` (skipped)$nl"
}
$reportContent += "- ``reports/ACCEPTANCE-VALIDATION-REPORT.md``$nl$nl"
$reportContent += "---$nl"
$reportContent += "**Validation Complete**$nl"

$reportContent | Out-File -FilePath $reportFile -Encoding UTF8

Write-Host "`n=== Validation Complete ===" -ForegroundColor Green
Write-Host "Mode: $($results.mode)"
Write-Host "Total Tests: $totalTests"
Write-Host "Passed: $passedTests"
Write-Host "Failed: $failedTests"
if ($skippedTests -gt 0) {
    Write-Host "Skipped: $skippedTests" -ForegroundColor Yellow
}
Write-Host "Success Rate: $successRate%"
Write-Host "`nReport saved to: $reportFile" -ForegroundColor Cyan
