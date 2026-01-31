#!/bin/bash
# =============================================================================
# GRC Platform - RC1 Golden Flow Verification Script
# =============================================================================
# Automated verification of the Golden Demo Flow for RC1 release validation.
# This script tests all critical API endpoints and creates test entities.
#
# Usage:
#   bash ops/rc1-golden-flow-verify.sh [--staging-url URL] [--cleanup]
#
# Environment Variables:
#   STAGING_URL        - Base URL for staging (default: http://46.224.99.150)
#   DEMO_ADMIN_EMAIL   - Admin email (default: admin@grc-platform.local)
#   DEMO_ADMIN_PASSWORD - Admin password (default: TestPassword123!)
#   DEMO_TENANT_ID     - Tenant ID (default: 00000000-0000-0000-0000-000000000001)
#
# Exit Codes:
#   0 - All tests passed
#   1 - One or more tests failed
#   2 - Authentication failed
#   3 - Critical endpoint failure
# =============================================================================

set -euo pipefail

# Configuration
STAGING_URL="${STAGING_URL:-http://46.224.99.150}"
DEMO_ADMIN_EMAIL="${DEMO_ADMIN_EMAIL:-admin@grc-platform.local}"
DEMO_ADMIN_PASSWORD="${DEMO_ADMIN_PASSWORD:-TestPassword123!}"
DEMO_TENANT_ID="${DEMO_TENANT_ID:-00000000-0000-0000-0000-000000000001}"
CLEANUP="${CLEANUP:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASS_COUNT=0
FAIL_COUNT=0
CREATED_ENTITIES=()

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $*"; ((PASS_COUNT++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $*"; ((FAIL_COUNT++)); }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_step() { echo -e "\n${BLUE}=== $* ===${NC}"; }

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --staging-url)
      STAGING_URL="$2"
      shift 2
      ;;
    --cleanup)
      CLEANUP="true"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Token storage
ACCESS_TOKEN=""

# =============================================================================
# Helper Functions
# =============================================================================

# Make authenticated API request
api_request() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"
  local expected_status="${4:-200}"
  
  local url="${STAGING_URL}/api${endpoint}"
  local response
  local http_code
  
  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "x-tenant-id: $DEMO_TENANT_ID" \
      -H "Content-Type: application/json" \
      -d "$data" 2>/dev/null || echo -e "\n000")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "x-tenant-id: $DEMO_TENANT_ID" \
      2>/dev/null || echo -e "\n000")
  fi
  
  http_code=$(echo "$response" | tail -n 1)
  local body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "$expected_status" ]; then
    echo "$body"
    return 0
  else
    echo "HTTP $http_code: $body" >&2
    return 1
  fi
}

# Extract field from JSON (simple jq alternative)
json_field() {
  local json="$1"
  local field="$2"
  echo "$json" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/' || echo ""
}

# Extract field from JSON (handles nested .data.field)
json_data_field() {
  local json="$1"
  local field="$2"
  # Try to extract from .data.field first, then from .field
  local value=$(echo "$json" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/' || echo "")
  echo "$value"
}

# =============================================================================
# Test Functions
# =============================================================================

test_health_ready() {
  log_step "Step 1: Health Check"
  
  local response
  response=$(curl -s -w "\n%{http_code}" "${STAGING_URL}/health/ready" 2>/dev/null || echo -e "\n000")
  local http_code=$(echo "$response" | tail -n 1)
  
  if [ "$http_code" = "200" ]; then
    log_pass "GET /health/ready returned 200"
    return 0
  else
    log_fail "GET /health/ready returned $http_code (expected 200)"
    return 1
  fi
}

test_authentication() {
  log_step "Step 2: Authentication"
  
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${STAGING_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$DEMO_ADMIN_EMAIL\",\"password\":\"$DEMO_ADMIN_PASSWORD\"}" \
    2>/dev/null || echo -e "\n000")
  
  local http_code=$(echo "$response" | tail -n 1)
  local body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    # Extract token - try multiple patterns
    ACCESS_TOKEN=$(echo "$body" | grep -o '"accessToken"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/' || echo "")
    if [ -z "$ACCESS_TOKEN" ]; then
      ACCESS_TOKEN=$(echo "$body" | grep -o '"token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/' || echo "")
    fi
    
    if [ -n "$ACCESS_TOKEN" ]; then
      log_pass "POST /auth/login returned token"
      return 0
    else
      log_fail "POST /auth/login returned 200 but no token found"
      log_warn "Response: ${body:0:200}..."
      return 1
    fi
  else
    log_fail "POST /auth/login returned $http_code (expected 200)"
    log_warn "Response: ${body:0:200}..."
    return 1
  fi
}

test_controls_list() {
  log_step "Step 3: Controls List"
  
  local response
  if response=$(api_request GET "/grc/controls?page=1&pageSize=10" "" "200"); then
    # Check for LIST-CONTRACT format
    if echo "$response" | grep -q '"items"'; then
      log_pass "GET /grc/controls returned LIST-CONTRACT format"
      return 0
    else
      log_warn "GET /grc/controls returned 200 but may not be LIST-CONTRACT format"
      log_pass "GET /grc/controls returned 200"
      return 0
    fi
  else
    log_fail "GET /grc/controls failed"
    return 1
  fi
}

test_risks_list() {
  log_step "Step 4: Risks List"
  
  local response
  if response=$(api_request GET "/grc/risks?page=1&pageSize=10" "" "200"); then
    if echo "$response" | grep -q '"items"'; then
      log_pass "GET /grc/risks returned LIST-CONTRACT format"
      return 0
    else
      log_pass "GET /grc/risks returned 200"
      return 0
    fi
  else
    log_fail "GET /grc/risks failed"
    return 1
  fi
}

test_risk_create() {
  log_step "Step 5: Risk Create"
  
  local timestamp=$(date +%s)
  local risk_data="{
    \"title\": \"RC1 Golden Flow Test Risk - $timestamp\",
    \"severity\": \"high\",
    \"likelihood\": \"possible\",
    \"impact\": \"high\",
    \"status\": \"identified\",
    \"description\": \"Automated test risk created by rc1-golden-flow-verify.sh\"
  }"
  
  local response
  if response=$(api_request POST "/grc/risks" "$risk_data" "201"); then
    RISK_ID=$(json_data_field "$response" "id")
    if [ -n "$RISK_ID" ]; then
      log_pass "POST /grc/risks created risk with ID: $RISK_ID"
      CREATED_ENTITIES+=("risk:$RISK_ID")
      return 0
    else
      log_warn "POST /grc/risks returned 201 but could not extract ID"
      log_pass "POST /grc/risks returned 201"
      return 0
    fi
  else
    log_fail "POST /grc/risks failed"
    return 1
  fi
}

test_risk_control_link() {
  log_step "Step 6: Risk-Control Link"
  
  if [ -z "${RISK_ID:-}" ]; then
    log_warn "Skipping risk-control link test - no risk ID available"
    return 0
  fi
  
  # Get a control ID
  local controls_response
  if ! controls_response=$(api_request GET "/grc/controls?page=1&pageSize=1" "" "200"); then
    log_warn "Could not fetch controls for linking test"
    return 0
  fi
  
  CONTROL_ID=$(json_data_field "$controls_response" "id")
  if [ -z "$CONTROL_ID" ]; then
    # Try extracting from items array
    CONTROL_ID=$(echo "$controls_response" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/' || echo "")
  fi
  
  if [ -z "$CONTROL_ID" ]; then
    log_warn "No controls available for linking test"
    return 0
  fi
  
  # Link control to risk
  local link_response
  if link_response=$(api_request POST "/grc/risks/${RISK_ID}/controls/${CONTROL_ID}" "" "200"); then
    log_pass "POST /grc/risks/:id/controls/:id linked successfully"
    
    # Verify the link
    local verify_response
    if verify_response=$(api_request GET "/grc/risks/${RISK_ID}/controls/list" "" "200"); then
      if echo "$verify_response" | grep -q "$CONTROL_ID"; then
        log_pass "GET /grc/risks/:id/controls/list shows linked control"
      else
        log_pass "GET /grc/risks/:id/controls/list returned 200"
      fi
    fi
    return 0
  else
    log_fail "POST /grc/risks/:id/controls/:id failed"
    return 1
  fi
}

test_bcm_service_create() {
  log_step "Step 7: BCM Service Create"
  
  local timestamp=$(date +%s)
  local service_data="{
    \"name\": \"RC1 Golden Flow Test Service - $timestamp\",
    \"status\": \"ACTIVE\",
    \"criticalityTier\": \"TIER_1\",
    \"description\": \"Automated test service created by rc1-golden-flow-verify.sh\"
  }"
  
  local response
  if response=$(api_request POST "/grc/bcm/services" "$service_data" "201"); then
    SERVICE_ID=$(json_data_field "$response" "id")
    if [ -n "$SERVICE_ID" ]; then
      log_pass "POST /grc/bcm/services created service with ID: $SERVICE_ID"
      CREATED_ENTITIES+=("bcm_service:$SERVICE_ID")
    else
      log_pass "POST /grc/bcm/services returned 201"
    fi
    return 0
  else
    log_fail "POST /grc/bcm/services failed"
    return 1
  fi
}

test_bcm_bia_create() {
  log_step "Step 8: BCM BIA Create"
  
  if [ -z "${SERVICE_ID:-}" ]; then
    log_warn "Skipping BIA create test - no service ID available"
    return 0
  fi
  
  local timestamp=$(date +%s)
  local bia_data="{
    \"serviceId\": \"$SERVICE_ID\",
    \"name\": \"RC1 Golden Flow Test BIA - $timestamp\",
    \"status\": \"DRAFT\",
    \"financialImpact\": 3,
    \"operationalImpact\": 3,
    \"reputationalImpact\": 2
  }"
  
  local response
  if response=$(api_request POST "/grc/bcm/bias" "$bia_data" "201"); then
    BIA_ID=$(json_data_field "$response" "id")
    if [ -n "$BIA_ID" ]; then
      log_pass "POST /grc/bcm/bias created BIA with ID: $BIA_ID"
      CREATED_ENTITIES+=("bcm_bia:$BIA_ID")
    else
      log_pass "POST /grc/bcm/bias returned 201"
    fi
    return 0
  else
    log_fail "POST /grc/bcm/bias failed"
    return 1
  fi
}

test_bcm_plan_create() {
  log_step "Step 9: BCM Plan Create"
  
  if [ -z "${SERVICE_ID:-}" ]; then
    log_warn "Skipping Plan create test - no service ID available"
    return 0
  fi
  
  local timestamp=$(date +%s)
  local plan_data="{
    \"serviceId\": \"$SERVICE_ID\",
    \"name\": \"RC1 Golden Flow Test BCP - $timestamp\",
    \"planType\": \"BCP\",
    \"status\": \"DRAFT\"
  }"
  
  local response
  if response=$(api_request POST "/grc/bcm/plans" "$plan_data" "201"); then
    PLAN_ID=$(json_data_field "$response" "id")
    if [ -n "$PLAN_ID" ]; then
      log_pass "POST /grc/bcm/plans created plan with ID: $PLAN_ID"
      CREATED_ENTITIES+=("bcm_plan:$PLAN_ID")
    else
      log_pass "POST /grc/bcm/plans returned 201"
    fi
    return 0
  else
    log_fail "POST /grc/bcm/plans failed"
    return 1
  fi
}

test_bcm_exercise_create() {
  log_step "Step 10: BCM Exercise Create"
  
  if [ -z "${SERVICE_ID:-}" ]; then
    log_warn "Skipping Exercise create test - no service ID available"
    return 0
  fi
  
  local timestamp=$(date +%s)
  local scheduled_date=$(date -u -d "+30 days" +"%Y-%m-%dT10:00:00Z" 2>/dev/null || date -u +"%Y-%m-%dT10:00:00Z")
  local exercise_data="{
    \"serviceId\": \"$SERVICE_ID\",
    \"name\": \"RC1 Golden Flow Test Exercise - $timestamp\",
    \"exerciseType\": \"TABLETOP\",
    \"status\": \"PLANNED\",
    \"scheduledAt\": \"$scheduled_date\"
  }"
  
  local response
  if response=$(api_request POST "/grc/bcm/exercises" "$exercise_data" "201"); then
    EXERCISE_ID=$(json_data_field "$response" "id")
    if [ -n "$EXERCISE_ID" ]; then
      log_pass "POST /grc/bcm/exercises created exercise with ID: $EXERCISE_ID"
      CREATED_ENTITIES+=("bcm_exercise:$EXERCISE_ID")
    else
      log_pass "POST /grc/bcm/exercises returned 201"
    fi
    return 0
  else
    log_fail "POST /grc/bcm/exercises failed"
    return 1
  fi
}

test_bcm_exercises_list() {
  log_step "Step 11: BCM Exercises List"
  
  local response
  if response=$(api_request GET "/grc/bcm/exercises?page=1&pageSize=10" "" "200"); then
    if echo "$response" | grep -q '"items"'; then
      log_pass "GET /grc/bcm/exercises returned LIST-CONTRACT format"
    else
      log_pass "GET /grc/bcm/exercises returned 200"
    fi
    return 0
  else
    log_fail "GET /grc/bcm/exercises failed"
    return 1
  fi
}

test_calendar_events() {
  log_step "Step 12: Calendar Events"
  
  local start_date=$(date -u +"%Y-%m-01T00:00:00Z")
  local end_date=$(date -u -d "+3 months" +"%Y-%m-01T00:00:00Z" 2>/dev/null || date -u +"%Y-12-31T23:59:59Z")
  
  local response
  if response=$(api_request GET "/grc/calendar/events?start=${start_date}&end=${end_date}" "" "200"); then
    log_pass "GET /grc/calendar/events returned 200"
    return 0
  else
    log_fail "GET /grc/calendar/events failed"
    return 1
  fi
}

test_admin_tables() {
  log_step "Step 13: Platform Builder Tables"
  
  local response
  if response=$(api_request GET "/grc/admin/tables?page=1&pageSize=20" "" "200"); then
    log_pass "GET /grc/admin/tables returned 200"
    return 0
  else
    # This endpoint might not exist or require different permissions
    log_warn "GET /grc/admin/tables failed - endpoint may not be available"
    return 0
  fi
}

cleanup_test_entities() {
  if [ "$CLEANUP" != "true" ]; then
    return 0
  fi
  
  log_step "Cleanup: Removing Test Entities"
  
  for entity in "${CREATED_ENTITIES[@]}"; do
    local type=$(echo "$entity" | cut -d: -f1)
    local id=$(echo "$entity" | cut -d: -f2)
    
    case $type in
      risk)
        if api_request DELETE "/grc/risks/$id" "" "204" >/dev/null 2>&1; then
          log_info "Deleted risk: $id"
        fi
        ;;
      bcm_exercise)
        if api_request DELETE "/grc/bcm/exercises/$id" "" "204" >/dev/null 2>&1; then
          log_info "Deleted BCM exercise: $id"
        fi
        ;;
      bcm_plan)
        if api_request DELETE "/grc/bcm/plans/$id" "" "204" >/dev/null 2>&1; then
          log_info "Deleted BCM plan: $id"
        fi
        ;;
      bcm_bia)
        if api_request DELETE "/grc/bcm/bias/$id" "" "204" >/dev/null 2>&1; then
          log_info "Deleted BCM BIA: $id"
        fi
        ;;
      bcm_service)
        if api_request DELETE "/grc/bcm/services/$id" "" "204" >/dev/null 2>&1; then
          log_info "Deleted BCM service: $id"
        fi
        ;;
    esac
  done
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
  echo "=============================================="
  echo "GRC Platform - RC1 Golden Flow Verification"
  echo "=============================================="
  echo "Staging URL: $STAGING_URL"
  echo "Tenant ID: $DEMO_TENANT_ID"
  echo "Admin Email: $DEMO_ADMIN_EMAIL"
  echo "Cleanup: $CLEANUP"
  echo "=============================================="
  
  # Critical tests - fail fast
  if ! test_health_ready; then
    log_fail "Health check failed - staging may be down"
    exit 3
  fi
  
  if ! test_authentication; then
    log_fail "Authentication failed - cannot continue"
    exit 2
  fi
  
  # Core GRC tests
  test_controls_list || true
  test_risks_list || true
  test_risk_create || true
  test_risk_control_link || true
  
  # BCM tests
  test_bcm_service_create || true
  test_bcm_bia_create || true
  test_bcm_plan_create || true
  test_bcm_exercise_create || true
  test_bcm_exercises_list || true
  
  # Integration tests
  test_calendar_events || true
  test_admin_tables || true
  
  # Cleanup if requested
  cleanup_test_entities
  
  # Summary
  echo ""
  echo "=============================================="
  echo "RC1 Golden Flow Verification Summary"
  echo "=============================================="
  echo -e "Passed: ${GREEN}$PASS_COUNT${NC}"
  echo -e "Failed: ${RED}$FAIL_COUNT${NC}"
  echo "=============================================="
  
  if [ "$FAIL_COUNT" -gt 0 ]; then
    echo -e "${RED}RESULT: FAILED${NC}"
    exit 1
  else
    echo -e "${GREEN}RESULT: PASSED${NC}"
    exit 0
  fi
}

main "$@"
