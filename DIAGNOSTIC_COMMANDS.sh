#!/bin/bash
# =============================================================================
# GRC Platform - Staging Diagnostic Commands
# =============================================================================
# Run these commands on the staging server via SSH
# Copy-paste and execute each section
# =============================================================================

set -euo pipefail

ADMIN_EMAIL="admin@grc-platform.local"
ADMIN_PASSWORD="TestPassword123!"
BACKEND_URL="http://localhost:3002"

echo "============================================================================="
echo "GRC Platform - Staging Diagnostic"
echo "============================================================================="
echo ""

# STEP 0 - Check containers
echo "STEP 0: Checking container status..."
cd /opt/grc-platform
docker compose -f docker-compose.staging.yml ps
echo ""

# STEP 1 - Test login with empty payload
echo "STEP 1: Testing /auth/login with empty payload..."
curl -i -X POST "$BACKEND_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{}'
echo ""
echo ""

# STEP 1A - Test login with email + password (expected format)
echo "STEP 1A: Testing login with email + password..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BACKEND_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "Status: $HTTP_STATUS"
echo "Response: $BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✓ Login successful!"
    
    # Extract token
    TOKEN=$(echo "$BODY" | jq -r '.accessToken // .token // .data.accessToken // .data.token // .data.tokens.accessToken // .data.tokens.token // empty' 2>/dev/null || echo "")
    
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo "ERROR: Could not extract token"
        exit 1
    fi
    
    TOKEN_LEN=${#TOKEN}
    echo "Token length: $TOKEN_LEN"
    echo "Token (first 50 chars): ${TOKEN:0:50}..."
    echo ""
    
    # STEP 3 - Get tenant ID
    echo "STEP 3: Getting tenant ID from /tenants/current..."
    TENANT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "$BACKEND_URL/tenants/current")
    
    TENANT_HTTP_STATUS=$(echo "$TENANT_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    TENANT_BODY=$(echo "$TENANT_RESPONSE" | sed '/HTTP_STATUS:/d')
    
    echo "Status: $TENANT_HTTP_STATUS"
    echo "Response: $TENANT_BODY"
    echo ""
    
    TENANT_ID=$(echo "$TENANT_BODY" | jq -r '.tenantId // .id // .data.tenantId // .data.id // empty' 2>/dev/null || echo "")
    
    if [ -n "$TENANT_ID" ] && [ "$TENANT_ID" != "null" ]; then
        echo "TENANT_ID: $TENANT_ID"
    else
        echo "WARNING: No tenant ID found"
        TENANT_ID=""
    fi
    echo ""
    
    # STEP 4 - Test onboarding without header
    echo "STEP 4A: Testing /onboarding/context WITHOUT x-tenant-id header..."
    ONBOARDING_NO_HEADER=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "$BACKEND_URL/onboarding/context")
    
    ONBOARDING_STATUS_NO=$(echo "$ONBOARDING_NO_HEADER" | grep "HTTP_STATUS:" | cut -d: -f2)
    ONBOARDING_BODY_NO=$(echo "$ONBOARDING_NO_HEADER" | sed '/HTTP_STATUS:/d')
    
    echo "Status: $ONBOARDING_STATUS_NO"
    echo "Response: $ONBOARDING_BODY_NO"
    echo ""
    
    # STEP 4B - Test onboarding with header
    if [ -n "$TENANT_ID" ]; then
        echo "STEP 4B: Testing /onboarding/context WITH x-tenant-id: $TENANT_ID..."
        ONBOARDING_WITH_HEADER=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
            -H "Authorization: Bearer $TOKEN" \
            -H "x-tenant-id: $TENANT_ID" \
            "$BACKEND_URL/onboarding/context")
        
        ONBOARDING_STATUS_WITH=$(echo "$ONBOARDING_WITH_HEADER" | grep "HTTP_STATUS:" | cut -d: -f2)
        ONBOARDING_BODY_WITH=$(echo "$ONBOARDING_WITH_HEADER" | sed '/HTTP_STATUS:/d')
        
        echo "Status: $ONBOARDING_STATUS_WITH"
        echo "Response: $ONBOARDING_BODY_WITH"
        echo ""
    else
        echo "STEP 4B: Skipping onboarding with header (no tenant ID)"
        ONBOARDING_STATUS_WITH="SKIPPED"
        ONBOARDING_BODY_WITH="No tenant ID"
        echo ""
    fi
    
    # STEP 4C - Test audits without header
    echo "STEP 4C: Testing /grc/audits WITHOUT x-tenant-id header..."
    AUDITS_NO_HEADER=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "$BACKEND_URL/grc/audits")
    
    AUDITS_STATUS_NO=$(echo "$AUDITS_NO_HEADER" | grep "HTTP_STATUS:" | cut -d: -f2)
    AUDITS_BODY_NO=$(echo "$AUDITS_NO_HEADER" | sed '/HTTP_STATUS:/d')
    
    echo "Status: $AUDITS_STATUS_NO"
    echo "Response: $AUDITS_BODY_NO"
    echo ""
    
    # STEP 4D - Test audits with header
    if [ -n "$TENANT_ID" ]; then
        echo "STEP 4D: Testing /grc/audits WITH x-tenant-id: $TENANT_ID..."
        AUDITS_WITH_HEADER=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
            -H "Authorization: Bearer $TOKEN" \
            -H "x-tenant-id: $TENANT_ID" \
            "$BACKEND_URL/grc/audits")
        
        AUDITS_STATUS_WITH=$(echo "$AUDITS_WITH_HEADER" | grep "HTTP_STATUS:" | cut -d: -f2)
        AUDITS_BODY_WITH=$(echo "$AUDITS_WITH_HEADER" | sed '/HTTP_STATUS:/d')
        
        echo "Status: $AUDITS_STATUS_WITH"
        echo "Response: $AUDITS_BODY_WITH"
        echo ""
    else
        echo "STEP 4D: Skipping audits with header (no tenant ID)"
        AUDITS_STATUS_WITH="SKIPPED"
        AUDITS_BODY_WITH="No tenant ID"
        echo ""
    fi
    
    # STEP 5 - Summary
    echo "============================================================================="
    echo "DIAGNOSTIC SUMMARY"
    echo "============================================================================="
    echo ""
    echo "WORKING LOGIN PAYLOAD: email + password"
    echo "TOKEN_LEN: $TOKEN_LEN"
    echo "TENANT_ID: ${TENANT_ID:-NOT_FOUND}"
    echo ""
    echo "--- ONBOARDING /context ---"
    echo "Without header: $ONBOARDING_STATUS_NO"
    echo "Body (first 300 chars): $(echo "$ONBOARDING_BODY_NO" | head -c 300)"
    echo ""
    echo "With header: $ONBOARDING_STATUS_WITH"
    echo "Body (first 300 chars): $(echo "$ONBOARDING_BODY_WITH" | head -c 300)"
    echo ""
    echo "--- AUDITS /grc/audits ---"
    echo "Without header: $AUDITS_STATUS_NO"
    echo "Body (first 300 chars): $(echo "$AUDITS_BODY_NO" | head -c 300)"
    echo ""
    echo "With header: $AUDITS_STATUS_WITH"
    echo "Body (first 300 chars): $(echo "$AUDITS_BODY_WITH" | head -c 300)"
    echo ""
    
else
    echo "ERROR: Login failed with status $HTTP_STATUS"
    echo "Checking backend logs..."
    docker compose -f docker-compose.staging.yml logs --tail=200 backend | grep -iE "auth|login|error|exception|validation|bad request" || true
fi
