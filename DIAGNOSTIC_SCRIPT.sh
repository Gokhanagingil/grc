#!/bin/bash
# =============================================================================
# GRC Platform - Staging Diagnostic Script
# =============================================================================
# This script diagnoses AUTH + onboarding + audits issues on staging
# READ-ONLY operations only - no code/config changes, no DB writes
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/grc-platform"
BACKEND_URL="http://localhost:3002"
COMPOSE_FILE="docker-compose.staging.yml"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@grc-platform.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD}"

if [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${RED}ERROR: ADMIN_PASSWORD environment variable is required${NC}"
    echo "Usage: ADMIN_PASSWORD='your-password' $0"
    exit 1
fi

echo -e "${BLUE}=============================================================================${NC}"
echo -e "${BLUE}GRC Platform - Staging Diagnostic${NC}"
echo -e "${BLUE}=============================================================================${NC}"
echo ""

# =============================================================================
# STEP 0 - Ensure containers are up
# =============================================================================
echo -e "${YELLOW}STEP 0: Checking container status...${NC}"
cd "$PROJECT_DIR" || exit 1
docker compose -f "$COMPOSE_FILE" ps
echo ""

# =============================================================================
# STEP 1 - Inspect /auth/login behavior
# =============================================================================
echo -e "${YELLOW}STEP 1: Testing /auth/login endpoint...${NC}"
echo ""

# Test with empty payload
echo -e "${BLUE}Testing with empty payload:{}${NC}"
RESPONSE_EMPTY=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BACKEND_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{}' 2>&1)
HTTP_STATUS_EMPTY=$(echo "$RESPONSE_EMPTY" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY_EMPTY=$(echo "$RESPONSE_EMPTY" | sed '/HTTP_STATUS:/d')
echo "Status: $HTTP_STATUS_EMPTY"
echo "Body: $BODY_EMPTY"
echo ""

# Test candidate payloads
declare -a PAYLOADS=(
    '{"email":"'$ADMIN_EMAIL'","password":"'$ADMIN_PASSWORD'"}'
    '{"username":"'$ADMIN_EMAIL'","password":"'$ADMIN_PASSWORD'"}'
    '{"identifier":"'$ADMIN_EMAIL'","password":"'$ADMIN_PASSWORD'"}'
    '{"login":"'$ADMIN_EMAIL'","password":"'$ADMIN_PASSWORD'"}'
    '{"email":"'$ADMIN_EMAIL'","pass":"'$ADMIN_PASSWORD'"}'
    '{"user":"'$ADMIN_EMAIL'","password":"'$ADMIN_PASSWORD'"}'
)

declare -a PAYLOAD_NAMES=(
    "A) email + password"
    "B) username + password"
    "C) identifier + password"
    "D) login + password"
    "E) email + pass"
    "F) user + password"
)

TOKEN=""
WORKING_PAYLOAD=""

for i in "${!PAYLOADS[@]}"; do
    PAYLOAD="${PAYLOADS[$i]}"
    PAYLOAD_NAME="${PAYLOAD_NAMES[$i]}"
    MASKED_PAYLOAD=$(echo "$PAYLOAD" | sed "s/\"password\":\"[^\"]*\"/\"password\":\"***MASKED***\"/g" | sed "s/\"pass\":\"[^\"]*\"/\"pass\":\"***MASKED***\"/g")
    
    echo -e "${BLUE}Testing ${PAYLOAD_NAME}${NC}"
    echo "Payload: $MASKED_PAYLOAD"
    
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BACKEND_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" 2>&1)
    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')
    
    echo "Status: $HTTP_STATUS"
    echo "Body: $BODY"
    echo ""
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ SUCCESS! Login worked with ${PAYLOAD_NAME}${NC}"
        WORKING_PAYLOAD="$PAYLOAD_NAME"
        TOKEN_RAW="$BODY"
        break
    fi
done

# If no 200, check backend logs
if [ -z "$TOKEN" ] && [ "$HTTP_STATUS" != "200" ]; then
    echo -e "${YELLOW}No successful login. Checking backend logs...${NC}"
    docker compose -f "$COMPOSE_FILE" logs --tail=200 backend | grep -iE "auth|login|error|exception|validation|bad request" || true
    echo ""
fi

# =============================================================================
# STEP 2 - Extract JWT token
# =============================================================================
if [ -n "$TOKEN_RAW" ]; then
    echo -e "${YELLOW}STEP 2: Extracting JWT token...${NC}"
    
    # Try to extract token from various possible response structures
    TOKEN=$(echo "$TOKEN_RAW" | jq -r '.accessToken // .token // .data.accessToken // .data.token // .data.tokens.accessToken // .data.tokens.token // empty' 2>/dev/null || echo "")
    
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo -e "${RED}ERROR: Could not extract token from response${NC}"
        echo "Response was: $TOKEN_RAW"
        exit 1
    fi
    
    TOKEN_LEN=${#TOKEN}
    echo -e "${GREEN}Token extracted successfully${NC}"
    echo "TOKEN_LEN: $TOKEN_LEN"
    echo "Token (first 50 chars): ${TOKEN:0:50}..."
    echo ""
else
    echo -e "${RED}ERROR: No successful login to extract token from${NC}"
    exit 1
fi

# =============================================================================
# STEP 3 - Determine tenant id
# =============================================================================
echo -e "${YELLOW}STEP 3: Getting tenant ID from /tenants/current...${NC}"
TENANT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$BACKEND_URL/tenants/current" 2>&1)
TENANT_HTTP_STATUS=$(echo "$TENANT_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
TENANT_BODY=$(echo "$TENANT_RESPONSE" | sed '/HTTP_STATUS:/d')

echo "Status: $TENANT_HTTP_STATUS"
echo "Body: $TENANT_BODY"
echo ""

TENANT_ID=""
if [ "$TENANT_HTTP_STATUS" = "200" ]; then
    TENANT_ID=$(echo "$TENANT_BODY" | jq -r '.tenantId // .id // .data.tenantId // .data.id // empty' 2>/dev/null || echo "")
    if [ -n "$TENANT_ID" ] && [ "$TENANT_ID" != "null" ]; then
        echo -e "${GREEN}TENANT_ID: $TENANT_ID${NC}"
    else
        echo -e "${YELLOW}WARNING: No tenant ID found in response${NC}"
    fi
else
    echo -e "${YELLOW}WARNING: /tenants/current returned status $TENANT_HTTP_STATUS${NC}"
fi
echo ""

# =============================================================================
# STEP 4 - Run critical calls (with and without x-tenant-id)
# =============================================================================
echo -e "${YELLOW}STEP 4: Testing onboarding and audits endpoints...${NC}"
echo ""

# Onboarding without header
echo -e "${BLUE}Onboarding Context (WITHOUT x-tenant-id):${NC}"
ONBOARDING_RESPONSE_NO_HEADER=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$BACKEND_URL/onboarding/context" 2>&1)
ONBOARDING_STATUS_NO_HEADER=$(echo "$ONBOARDING_RESPONSE_NO_HEADER" | grep "HTTP_STATUS:" | cut -d: -f2)
ONBOARDING_BODY_NO_HEADER=$(echo "$ONBOARDING_RESPONSE_NO_HEADER" | sed '/HTTP_STATUS:/d')
echo "Status: $ONBOARDING_STATUS_NO_HEADER"
echo "Body: $ONBOARDING_BODY_NO_HEADER"
echo ""

# Onboarding with header
if [ -n "$TENANT_ID" ] && [ "$TENANT_ID" != "null" ]; then
    echo -e "${BLUE}Onboarding Context (WITH x-tenant-id: $TENANT_ID):${NC}"
    ONBOARDING_RESPONSE_WITH_HEADER=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        -H "x-tenant-id: $TENANT_ID" \
        "$BACKEND_URL/onboarding/context" 2>&1)
    ONBOARDING_STATUS_WITH_HEADER=$(echo "$ONBOARDING_RESPONSE_WITH_HEADER" | grep "HTTP_STATUS:" | cut -d: -f2)
    ONBOARDING_BODY_WITH_HEADER=$(echo "$ONBOARDING_RESPONSE_WITH_HEADER" | sed '/HTTP_STATUS:/d')
    echo "Status: $ONBOARDING_STATUS_WITH_HEADER"
    echo "Body: $ONBOARDING_BODY_WITH_HEADER"
    echo ""
else
    echo -e "${YELLOW}Skipping onboarding with header (no tenant ID available)${NC}"
    ONBOARDING_STATUS_WITH_HEADER="SKIPPED"
    ONBOARDING_BODY_WITH_HEADER="No tenant ID available"
    echo ""
fi

# Audits without header
echo -e "${BLUE}Audits (WITHOUT x-tenant-id):${NC}"
AUDITS_RESPONSE_NO_HEADER=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$BACKEND_URL/grc/audits" 2>&1)
AUDITS_STATUS_NO_HEADER=$(echo "$AUDITS_RESPONSE_NO_HEADER" | grep "HTTP_STATUS:" | cut -d: -f2)
AUDITS_BODY_NO_HEADER=$(echo "$AUDITS_RESPONSE_NO_HEADER" | sed '/HTTP_STATUS:/d')
echo "Status: $AUDITS_STATUS_NO_HEADER"
echo "Body: $AUDITS_BODY_NO_HEADER"
echo ""

# Audits with header
if [ -n "$TENANT_ID" ] && [ "$TENANT_ID" != "null" ]; then
    echo -e "${BLUE}Audits (WITH x-tenant-id: $TENANT_ID):${NC}"
    AUDITS_RESPONSE_WITH_HEADER=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        -H "x-tenant-id: $TENANT_ID" \
        "$BACKEND_URL/grc/audits" 2>&1)
    AUDITS_STATUS_WITH_HEADER=$(echo "$AUDITS_RESPONSE_WITH_HEADER" | grep "HTTP_STATUS:" | cut -d: -f2)
    AUDITS_BODY_WITH_HEADER=$(echo "$AUDITS_RESPONSE_WITH_HEADER" | sed '/HTTP_STATUS:/d')
    echo "Status: $AUDITS_STATUS_WITH_HEADER"
    echo "Body: $AUDITS_BODY_WITH_HEADER"
    echo ""
else
    echo -e "${YELLOW}Skipping audits with header (no tenant ID available)${NC}"
    AUDITS_STATUS_WITH_HEADER="SKIPPED"
    AUDITS_BODY_WITH_HEADER="No tenant ID available"
    echo ""
fi

# =============================================================================
# STEP 5 - Classify outcomes
# =============================================================================
echo -e "${YELLOW}STEP 5: Classifying issues...${NC}"
echo ""

classify_status() {
    local status=$1
    local body=$2
    local endpoint=$3
    
    case "$status" in
        401)
            echo -e "${RED}  → AUTH ISSUE: Authentication failed or guard rejected token${NC}"
            ;;
        403)
            echo -e "${RED}  → PERMISSION ISSUE: User lacks required permissions${NC}"
            echo "    Body excerpt: $(echo "$body" | head -c 200)"
            ;;
        400)
            if echo "$body" | grep -qiE "tenant|header"; then
                echo -e "${RED}  → TENANT HEADER REQUIRED: Frontend must send x-tenant-id header${NC}"
            else
                echo -e "${RED}  → BAD REQUEST: Invalid request format${NC}"
            fi
            echo "    Body excerpt: $(echo "$body" | head -c 200)"
            ;;
        404)
            echo -e "${RED}  → ROUTE MISMATCH: Frontend calls wrong path or route not registered${NC}"
            ;;
        500)
            echo -e "${RED}  → BACKEND EXCEPTION: Server error - check backend logs${NC}"
            echo "    Body excerpt: $(echo "$body" | head -c 200)"
            ;;
        200)
            if [ "$endpoint" = "onboarding" ]; then
                # Check if context is empty/default
                if echo "$body" | jq -e '. == {} or . == null or .step == null' >/dev/null 2>&1; then
                    echo -e "${YELLOW}  → EMPTY CONTEXT: Needs onboarding seed OR UI empty-state${NC}"
                else
                    echo -e "${GREEN}  → OK: Context returned${NC}"
                fi
            else
                echo -e "${GREEN}  → OK: Request successful${NC}"
            fi
            ;;
        *)
            echo -e "${YELLOW}  → UNKNOWN STATUS: $status${NC}"
            ;;
    esac
}

echo -e "${BLUE}Onboarding (no header):${NC}"
classify_status "$ONBOARDING_STATUS_NO_HEADER" "$ONBOARDING_BODY_NO_HEADER" "onboarding"

echo -e "${BLUE}Onboarding (with header):${NC}"
if [ "$ONBOARDING_STATUS_WITH_HEADER" != "SKIPPED" ]; then
    classify_status "$ONBOARDING_STATUS_WITH_HEADER" "$ONBOARDING_BODY_WITH_HEADER" "onboarding"
else
    echo "  → SKIPPED (no tenant ID)"
fi

echo -e "${BLUE}Audits (no header):${NC}"
classify_status "$AUDITS_STATUS_NO_HEADER" "$AUDITS_BODY_NO_HEADER" "audits"

echo -e "${BLUE}Audits (with header):${NC}"
if [ "$AUDITS_STATUS_WITH_HEADER" != "SKIPPED" ]; then
    classify_status "$AUDITS_STATUS_WITH_HEADER" "$AUDITS_BODY_WITH_HEADER" "audits"
else
    echo "  → SKIPPED (no tenant ID)"
fi

echo ""

# =============================================================================
# STEP 6 - Diagnostic Summary
# =============================================================================
echo -e "${BLUE}=============================================================================${NC}"
echo -e "${BLUE}DIAGNOSTIC SUMMARY${NC}"
echo -e "${BLUE}=============================================================================${NC}"
echo ""
echo "WORKING LOGIN PAYLOAD: $WORKING_PAYLOAD"
echo "TOKEN_LEN: $TOKEN_LEN"
echo "TENANT_ID: ${TENANT_ID:-NOT_FOUND}"
echo ""
echo "--- ONBOARDING /context ---"
echo "Without header: $ONBOARDING_STATUS_NO_HEADER"
echo "Body (trimmed): $(echo "$ONBOARDING_BODY_NO_HEADER" | head -c 300)"
echo ""
if [ "$ONBOARDING_STATUS_WITH_HEADER" != "SKIPPED" ]; then
    echo "With header: $ONBOARDING_STATUS_WITH_HEADER"
    echo "Body (trimmed): $(echo "$ONBOARDING_BODY_WITH_HEADER" | head -c 300)"
else
    echo "With header: SKIPPED (no tenant ID)"
fi
echo ""
echo "--- AUDITS /grc/audits ---"
echo "Without header: $AUDITS_STATUS_NO_HEADER"
echo "Body (trimmed): $(echo "$AUDITS_BODY_NO_HEADER" | head -c 300)"
echo ""
if [ "$AUDITS_STATUS_WITH_HEADER" != "SKIPPED" ]; then
    echo "With header: $AUDITS_STATUS_WITH_HEADER"
    echo "Body (trimmed): $(echo "$AUDITS_BODY_WITH_HEADER" | head -c 300)"
else
    echo "With header: SKIPPED (no tenant ID)"
fi
echo ""
echo -e "${BLUE}--- ROOT CAUSE ANALYSIS ---${NC}"
echo ""

# Determine root causes
ROOT_CAUSES=()

if [ "$ONBOARDING_STATUS_NO_HEADER" = "400" ] || [ "$AUDITS_STATUS_NO_HEADER" = "400" ]; then
    if echo "$ONBOARDING_BODY_NO_HEADER $AUDITS_BODY_NO_HEADER" | grep -qiE "tenant|header"; then
        ROOT_CAUSES+=("TENANT_HEADER_REQUIRED: Frontend must propagate x-tenant-id header")
    fi
fi

if [ "$ONBOARDING_STATUS_NO_HEADER" = "401" ] || [ "$AUDITS_STATUS_NO_HEADER" = "401" ]; then
    ROOT_CAUSES+=("AUTH_GUARD_ISSUE: Token validation or guard configuration problem")
fi

if [ "$ONBOARDING_STATUS_NO_HEADER" = "403" ] || [ "$AUDITS_STATUS_NO_HEADER" = "403" ]; then
    ROOT_CAUSES+=("PERMISSION_ISSUE: User missing GRC_AUDIT_READ or similar permissions")
fi

if [ "$ONBOARDING_STATUS_NO_HEADER" = "404" ] || [ "$AUDITS_STATUS_NO_HEADER" = "404" ]; then
    ROOT_CAUSES+=("ROUTE_MISMATCH: Frontend calls wrong path or backend route not registered")
fi

if [ "$ONBOARDING_STATUS_NO_HEADER" = "500" ] || [ "$AUDITS_STATUS_NO_HEADER" = "500" ]; then
    ROOT_CAUSES+=("BACKEND_EXCEPTION: Check backend logs for stack trace")
fi

if [ "$ONBOARDING_STATUS_WITH_HEADER" = "200" ] && echo "$ONBOARDING_BODY_WITH_HEADER" | jq -e '. == {} or . == null' >/dev/null 2>&1; then
    ROOT_CAUSES+=("ONBOARDING_SEED_NEEDED: Database needs onboarding context seed data")
fi

if [ ${#ROOT_CAUSES[@]} -eq 0 ]; then
    echo -e "${GREEN}No obvious issues detected - all endpoints returned 200${NC}"
else
    for cause in "${ROOT_CAUSES[@]}"; do
        echo -e "${RED}→ $cause${NC}"
    done
fi

echo ""
echo -e "${BLUE}--- NEXT ACTIONS ---${NC}"
echo ""
if [[ " ${ROOT_CAUSES[@]} " =~ " TENANT_HEADER_REQUIRED " ]]; then
    echo "1. Fix frontend to send x-tenant-id header in API requests"
    echo "   - Check AuthContext.tsx for header injection"
    echo "   - Ensure tenantId is stored after login and sent with requests"
fi
if [[ " ${ROOT_CAUSES[@]} " =~ " PERMISSION_ISSUE " ]]; then
    echo "2. Grant required permissions to user/role"
    echo "   - Check user permissions in database"
    echo "   - Verify role has GRC_AUDIT_READ permission"
fi
if [[ " ${ROOT_CAUSES[@]} " =~ " ONBOARDING_SEED_NEEDED " ]]; then
    echo "3. Seed onboarding context data"
    echo "   - Run database seed script for onboarding"
fi
if [[ " ${ROOT_CAUSES[@]} " =~ " ROUTE_MISMATCH " ]]; then
    echo "4. Fix route paths"
    echo "   - Verify backend routes match frontend API calls"
    echo "   - Check API_PATHS constants in frontend"
fi
if [[ " ${ROOT_CAUSES[@]} " =~ " BACKEND_EXCEPTION " ]]; then
    echo "5. Investigate backend exception"
    echo "   - Run: docker compose -f $COMPOSE_FILE logs --tail=500 backend"
fi
if [[ " ${ROOT_CAUSES[@]} " =~ " AUTH_GUARD_ISSUE " ]]; then
    echo "6. Fix authentication guard"
    echo "   - Check JWT validation in guards"
    echo "   - Verify token format and expiry"
fi

echo ""
echo -e "${BLUE}=============================================================================${NC}"
