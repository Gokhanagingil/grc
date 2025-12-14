# =============================================================================
# GRC Platform - Staging Diagnostic Script (PowerShell)
# =============================================================================
# This script diagnoses AUTH + onboarding + audits issues on staging
# READ-ONLY operations only - no code/config changes, no DB writes
# =============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$AdminEmail = "admin@grc-platform.local",
    
    [Parameter(Mandatory=$true)]
    [string]$AdminPassword,
    
    [Parameter(Mandatory=$false)]
    [string]$BackendUrl = "http://localhost:3002",
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectDir = "/opt/grc-platform",
    
    [Parameter(Mandatory=$false)]
    [string]$ComposeFile = "docker-compose.staging.yml"
)

$ErrorActionPreference = "Stop"

# Colors for output (PowerShell)
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "=============================================================================" "Cyan"
Write-ColorOutput "GRC Platform - Staging Diagnostic" "Cyan"
Write-ColorOutput "=============================================================================" "Cyan"
Write-Host ""

# =============================================================================
# STEP 0 - Ensure containers are up
# =============================================================================
Write-ColorOutput "STEP 0: Checking container status..." "Yellow"
Write-Host "Note: This requires SSH access to staging server or local Docker"
Write-Host "Run: docker compose -f $ComposeFile ps"
Write-Host ""

# =============================================================================
# STEP 1 - Inspect /auth/login behavior
# =============================================================================
Write-ColorOutput "STEP 1: Testing /auth/login endpoint..." "Yellow"
Write-Host ""

# Test with empty payload
Write-ColorOutput "Testing with empty payload:{}" "Blue"
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{}' `
        -ErrorAction SilentlyContinue
    
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Body: $($response.Content)"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $reader.ReadToEnd()
    Write-Host "Status: $statusCode"
    Write-Host "Body: $body"
}
Write-Host ""

# Test candidate payloads
$payloads = @(
    @{ name = "A) email + password"; body = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json },
    @{ name = "B) username + password"; body = @{ username = $AdminEmail; password = $AdminPassword } | ConvertTo-Json },
    @{ name = "C) identifier + password"; body = @{ identifier = $AdminEmail; password = $AdminPassword } | ConvertTo-Json },
    @{ name = "D) login + password"; body = @{ login = $AdminEmail; password = $AdminPassword } | ConvertTo-Json },
    @{ name = "E) email + pass"; body = @{ email = $AdminEmail; pass = $AdminPassword } | ConvertTo-Json },
    @{ name = "F) user + password"; body = @{ user = $AdminEmail; password = $AdminPassword } | ConvertTo-Json }
)

$token = $null
$workingPayload = $null

foreach ($payload in $payloads) {
    $maskedBody = $payload.body -replace '"password":"[^"]*"', '"password":"***MASKED***"' -replace '"pass":"[^"]*"', '"pass":"***MASKED***"'
    
    Write-ColorOutput "Testing $($payload.name)" "Blue"
    Write-Host "Payload: $maskedBody"
    
    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body $payload.body
        
        Write-Host "Status: $($response.StatusCode)"
        Write-Host "Body: $($response.Content)"
        Write-Host ""
        
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "✓ SUCCESS! Login worked with $($payload.name)" "Green"
            $workingPayload = $payload.name
            $tokenRaw = $response.Content
            break
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "Status: $statusCode"
        Write-Host "Body: $body"
        Write-Host ""
    }
}

# =============================================================================
# STEP 2 - Extract JWT token
# =============================================================================
if ($tokenRaw) {
    Write-ColorOutput "STEP 2: Extracting JWT token..." "Yellow"
    
    $json = $tokenRaw | ConvertFrom-Json
    $token = $json.accessToken
    if (-not $token) { $token = $json.token }
    if (-not $token) { $token = $json.data.accessToken }
    if (-not $token) { $token = $json.data.token }
    if (-not $token) { $token = $json.data.tokens.accessToken }
    if (-not $token) { $token = $json.data.tokens.token }
    
    if (-not $token) {
        Write-ColorOutput "ERROR: Could not extract token from response" "Red"
        Write-Host "Response was: $tokenRaw"
        exit 1
    }
    
    $tokenLen = $token.Length
    Write-ColorOutput "Token extracted successfully" "Green"
    Write-Host "TOKEN_LEN: $tokenLen"
    Write-Host "Token (first 50 chars): $($token.Substring(0, [Math]::Min(50, $token.Length)))..."
    Write-Host ""
} else {
    Write-ColorOutput "ERROR: No successful login to extract token from" "Red"
    exit 1
}

# =============================================================================
# STEP 3 - Determine tenant id
# =============================================================================
Write-ColorOutput "STEP 3: Getting tenant ID from /tenants/current..." "Yellow"

$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/tenants/current" `
        -Headers $headers
    
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Body: $($response.Content)"
    Write-Host ""
    
    if ($response.StatusCode -eq 200) {
        $json = $response.Content | ConvertFrom-Json
        $tenantId = $json.tenantId
        if (-not $tenantId) { $tenantId = $json.id }
        if (-not $tenantId) { $tenantId = $json.data.tenantId }
        if (-not $tenantId) { $tenantId = $json.data.id }
        
        if ($tenantId) {
            Write-ColorOutput "TENANT_ID: $tenantId" "Green"
        } else {
            Write-ColorOutput "WARNING: No tenant ID found in response" "Yellow"
        }
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $reader.ReadToEnd()
    Write-Host "Status: $statusCode"
    Write-Host "Body: $body"
    Write-Host ""
    Write-ColorOutput "WARNING: /tenants/current returned status $statusCode" "Yellow"
    $tenantId = $null
}
Write-Host ""

# =============================================================================
# STEP 4 - Run critical calls (with and without x-tenant-id)
# =============================================================================
Write-ColorOutput "STEP 4: Testing onboarding and audits endpoints..." "Yellow"
Write-Host ""

# Helper function to make API call
function Invoke-ApiCall {
    param(
        [string]$Url,
        [hashtable]$Headers,
        [string]$EndpointName
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Headers $Headers
        return @{
            Status = $response.StatusCode
            Body = $response.Content
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        return @{
            Status = $statusCode
            Body = $body
        }
    }
}

# Onboarding without header
Write-ColorOutput "Onboarding Context (WITHOUT x-tenant-id):" "Blue"
$onboardingHeaders = @{ "Authorization" = "Bearer $token" }
$onboardingResultNoHeader = Invoke-ApiCall -Url "$BackendUrl/onboarding/context" -Headers $onboardingHeaders -EndpointName "onboarding"
Write-Host "Status: $($onboardingResultNoHeader.Status)"
Write-Host "Body: $($onboardingResultNoHeader.Body)"
Write-Host ""

# Onboarding with header
if ($tenantId) {
    Write-ColorOutput "Onboarding Context (WITH x-tenant-id: $tenantId):" "Blue"
    $onboardingHeadersWithTenant = @{
        "Authorization" = "Bearer $token"
        "x-tenant-id" = $tenantId
    }
    $onboardingResultWithHeader = Invoke-ApiCall -Url "$BackendUrl/onboarding/context" -Headers $onboardingHeadersWithTenant -EndpointName "onboarding"
    Write-Host "Status: $($onboardingResultWithHeader.Status)"
    Write-Host "Body: $($onboardingResultWithHeader.Body)"
    Write-Host ""
} else {
    Write-ColorOutput "Skipping onboarding with header (no tenant ID available)" "Yellow"
    $onboardingResultWithHeader = @{ Status = "SKIPPED"; Body = "No tenant ID available" }
    Write-Host ""
}

# Audits without header
Write-ColorOutput "Audits (WITHOUT x-tenant-id):" "Blue"
$auditsHeaders = @{ "Authorization" = "Bearer $token" }
$auditsResultNoHeader = Invoke-ApiCall -Url "$BackendUrl/grc/audits" -Headers $auditsHeaders -EndpointName "audits"
Write-Host "Status: $($auditsResultNoHeader.Status)"
Write-Host "Body: $($auditsResultNoHeader.Body)"
Write-Host ""

# Audits with header
if ($tenantId) {
    Write-ColorOutput "Audits (WITH x-tenant-id: $tenantId):" "Blue"
    $auditsHeadersWithTenant = @{
        "Authorization" = "Bearer $token"
        "x-tenant-id" = $tenantId
    }
    $auditsResultWithHeader = Invoke-ApiCall -Url "$BackendUrl/grc/audits" -Headers $auditsHeadersWithTenant -EndpointName "audits"
    Write-Host "Status: $($auditsResultWithHeader.Status)"
    Write-Host "Body: $($auditsResultWithHeader.Body)"
    Write-Host ""
} else {
    Write-ColorOutput "Skipping audits with header (no tenant ID available)" "Yellow"
    $auditsResultWithHeader = @{ Status = "SKIPPED"; Body = "No tenant ID available" }
    Write-Host ""
}

# =============================================================================
# STEP 5 - Classify outcomes
# =============================================================================
Write-ColorOutput "STEP 5: Classifying issues..." "Yellow"
Write-Host ""

function Classify-Status {
    param(
        [object]$Result,
        [string]$Endpoint
    )
    
    $status = $Result.Status
    $body = $Result.Body
    
    switch ($status) {
        401 {
            Write-ColorOutput "  → AUTH ISSUE: Authentication failed or guard rejected token" "Red"
        }
        403 {
            Write-ColorOutput "  → PERMISSION ISSUE: User lacks required permissions" "Red"
            $bodyExcerpt = if ($body.Length -gt 200) { $body.Substring(0, 200) } else { $body }
            Write-Host "    Body excerpt: $bodyExcerpt"
        }
        400 {
            if ($body -match "tenant|header") {
                Write-ColorOutput "  → TENANT HEADER REQUIRED: Frontend must send x-tenant-id header" "Red"
            } else {
                Write-ColorOutput "  → BAD REQUEST: Invalid request format" "Red"
            }
            $bodyExcerpt = if ($body.Length -gt 200) { $body.Substring(0, 200) } else { $body }
            Write-Host "    Body excerpt: $bodyExcerpt"
        }
        404 {
            Write-ColorOutput "  → ROUTE MISMATCH: Frontend calls wrong path or route not registered" "Red"
        }
        500 {
            Write-ColorOutput "  → BACKEND EXCEPTION: Server error - check backend logs" "Red"
            $bodyExcerpt = if ($body.Length -gt 200) { $body.Substring(0, 200) } else { $body }
            Write-Host "    Body excerpt: $bodyExcerpt"
        }
        200 {
            if ($Endpoint -eq "onboarding") {
                try {
                    $json = $body | ConvertFrom-Json
                    if (-not $json -or (-not $json.step)) {
                        Write-ColorOutput "  → EMPTY CONTEXT: Needs onboarding seed OR UI empty-state" "Yellow"
                    } else {
                        Write-ColorOutput "  → OK: Context returned" "Green"
                    }
                } catch {
                    Write-ColorOutput "  → OK: Request successful" "Green"
                }
            } else {
                Write-ColorOutput "  → OK: Request successful" "Green"
            }
        }
        default {
            Write-ColorOutput "  → UNKNOWN STATUS: $status" "Yellow"
        }
    }
}

Write-ColorOutput "Onboarding (no header):" "Blue"
Classify-Status -Result $onboardingResultNoHeader -Endpoint "onboarding"

Write-ColorOutput "Onboarding (with header):" "Blue"
if ($onboardingResultWithHeader.Status -ne "SKIPPED") {
    Classify-Status -Result $onboardingResultWithHeader -Endpoint "onboarding"
} else {
    Write-Host "  → SKIPPED (no tenant ID)"
}

Write-ColorOutput "Audits (no header):" "Blue"
Classify-Status -Result $auditsResultNoHeader -Endpoint "audits"

Write-ColorOutput "Audits (with header):" "Blue"
if ($auditsResultWithHeader.Status -ne "SKIPPED") {
    Classify-Status -Result $auditsResultWithHeader -Endpoint "audits"
} else {
    Write-Host "  → SKIPPED (no tenant ID)"
}

Write-Host ""

# =============================================================================
# STEP 6 - Diagnostic Summary
# =============================================================================
Write-ColorOutput "=============================================================================" "Cyan"
Write-ColorOutput "DIAGNOSTIC SUMMARY" "Cyan"
Write-ColorOutput "=============================================================================" "Cyan"
Write-Host ""
Write-Host "WORKING LOGIN PAYLOAD: $workingPayload"
Write-Host "TOKEN_LEN: $tokenLen"
Write-Host "TENANT_ID: $(if ($tenantId) { $tenantId } else { 'NOT_FOUND' })"
Write-Host ""
Write-Host "--- ONBOARDING /context ---"
Write-Host "Without header: $($onboardingResultNoHeader.Status)"
$onboardingBodyTrimmed = if ($onboardingResultNoHeader.Body.Length -gt 300) { $onboardingResultNoHeader.Body.Substring(0, 300) } else { $onboardingResultNoHeader.Body }
Write-Host "Body (trimmed): $onboardingBodyTrimmed"
Write-Host ""
if ($onboardingResultWithHeader.Status -ne "SKIPPED") {
    Write-Host "With header: $($onboardingResultWithHeader.Status)"
    $onboardingBodyWithHeaderTrimmed = if ($onboardingResultWithHeader.Body.Length -gt 300) { $onboardingResultWithHeader.Body.Substring(0, 300) } else { $onboardingResultWithHeader.Body }
    Write-Host "Body (trimmed): $onboardingBodyWithHeaderTrimmed"
} else {
    Write-Host "With header: SKIPPED (no tenant ID)"
}
Write-Host ""
Write-Host "--- AUDITS /grc/audits ---"
Write-Host "Without header: $($auditsResultNoHeader.Status)"
$auditsBodyTrimmed = if ($auditsResultNoHeader.Body.Length -gt 300) { $auditsResultNoHeader.Body.Substring(0, 300) } else { $auditsResultNoHeader.Body }
Write-Host "Body (trimmed): $auditsBodyTrimmed"
Write-Host ""
if ($auditsResultWithHeader.Status -ne "SKIPPED") {
    Write-Host "With header: $($auditsResultWithHeader.Status)"
    $auditsBodyWithHeaderTrimmed = if ($auditsResultWithHeader.Body.Length -gt 300) { $auditsResultWithHeader.Body.Substring(0, 300) } else { $auditsResultWithHeader.Body }
    Write-Host "Body (trimmed): $auditsBodyWithHeaderTrimmed"
} else {
    Write-Host "With header: SKIPPED (no tenant ID)"
}
Write-Host ""
Write-ColorOutput "--- ROOT CAUSE ANALYSIS ---" "Cyan"
Write-Host ""

$rootCauses = @()

if ($onboardingResultNoHeader.Status -eq 400 -or $auditsResultNoHeader.Status -eq 400) {
    if ($onboardingResultNoHeader.Body -match "tenant|header" -or $auditsResultNoHeader.Body -match "tenant|header") {
        $rootCauses += "TENANT_HEADER_REQUIRED: Frontend must propagate x-tenant-id header"
    }
}

if ($onboardingResultNoHeader.Status -eq 401 -or $auditsResultNoHeader.Status -eq 401) {
    $rootCauses += "AUTH_GUARD_ISSUE: Token validation or guard configuration problem"
}

if ($onboardingResultNoHeader.Status -eq 403 -or $auditsResultNoHeader.Status -eq 403) {
    $rootCauses += "PERMISSION_ISSUE: User missing GRC_AUDIT_READ or similar permissions"
}

if ($onboardingResultNoHeader.Status -eq 404 -or $auditsResultNoHeader.Status -eq 404) {
    $rootCauses += "ROUTE_MISMATCH: Frontend calls wrong path or backend route not registered"
}

if ($onboardingResultNoHeader.Status -eq 500 -or $auditsResultNoHeader.Status -eq 500) {
    $rootCauses += "BACKEND_EXCEPTION: Check backend logs for stack trace"
}

if ($onboardingResultWithHeader.Status -eq 200) {
    try {
        $json = $onboardingResultWithHeader.Body | ConvertFrom-Json
        if (-not $json -or (-not $json.step)) {
            $rootCauses += "ONBOARDING_SEED_NEEDED: Database needs onboarding context seed data"
        }
    } catch { }
}

if ($rootCauses.Count -eq 0) {
    Write-ColorOutput "No obvious issues detected - all endpoints returned 200" "Green"
} else {
    foreach ($cause in $rootCauses) {
        Write-ColorOutput "→ $cause" "Red"
    }
}

Write-Host ""
Write-ColorOutput "--- NEXT ACTIONS ---" "Cyan"
Write-Host ""

if ($rootCauses -contains "TENANT_HEADER_REQUIRED: Frontend must propagate x-tenant-id header") {
    Write-Host "1. Fix frontend to send x-tenant-id header in API requests"
    Write-Host "   - Check AuthContext.tsx for header injection"
    Write-Host "   - Ensure tenantId is stored after login and sent with requests"
}

if ($rootCauses -contains "PERMISSION_ISSUE: User missing GRC_AUDIT_READ or similar permissions") {
    Write-Host "2. Grant required permissions to user/role"
    Write-Host "   - Check user permissions in database"
    Write-Host "   - Verify role has GRC_AUDIT_READ permission"
}

if ($rootCauses -contains "ONBOARDING_SEED_NEEDED: Database needs onboarding context seed data") {
    Write-Host "3. Seed onboarding context data"
    Write-Host "   - Run database seed script for onboarding"
}

if ($rootCauses -contains "ROUTE_MISMATCH: Frontend calls wrong path or backend route not registered") {
    Write-Host "4. Fix route paths"
    Write-Host "   - Verify backend routes match frontend API calls"
    Write-Host "   - Check API_PATHS constants in frontend"
}

if ($rootCauses -contains "BACKEND_EXCEPTION: Check backend logs for stack trace") {
    Write-Host "5. Investigate backend exception"
    Write-Host "   - Run: docker compose -f $ComposeFile logs --tail=500 backend"
}

if ($rootCauses -contains "AUTH_GUARD_ISSUE: Token validation or guard configuration problem") {
    Write-Host "6. Fix authentication guard"
    Write-Host "   - Check JWT validation in guards"
    Write-Host "   - Verify token format and expiry"
}

Write-Host ""
Write-ColorOutput "=============================================================================" "Cyan"
