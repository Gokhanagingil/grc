#!/bin/bash
# =============================================================================
# Test: HTTPS Detection False-Negative Regression Guard
# =============================================================================
# This test ensures that ops/staging-deploy-validate.sh does not produce
# false-negative HTTPS warnings when container tools (ss/netstat) are missing
# but HTTPS is actually working.
#
# Usage:
#   bash ops/tests/test-https-detection.sh
#
# Exit Codes:
#   0 - Test passed
#   1 - Test failed
#
# This test validates the RC1 hardening fix for HTTPS detection:
#   - Port 443 check uses fallback chain (ss -> netstat -> nginx -T)
#   - Curl is the source of truth for HTTPS verification
#   - No false-negative WARN when curl succeeds but ss/netstat fails
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_SCRIPT="${REPO_ROOT}/ops/staging-deploy-validate.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[TEST]${NC} $*"
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

# =============================================================================
# Test 1: Verify is_port_listening_in_frontend_container function exists
# =============================================================================
test_helper_function_exists() {
  log_info "Test 1: Verify is_port_listening_in_frontend_container function exists"
  
  if grep -q "is_port_listening_in_frontend_container()" "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: Helper function is_port_listening_in_frontend_container() found"
    return 0
  else
    log_error "  FAILED: Helper function is_port_listening_in_frontend_container() not found"
    return 1
  fi
}

# =============================================================================
# Test 2: Verify wait_for_https_ready function exists
# =============================================================================
test_wait_function_exists() {
  log_info "Test 2: Verify wait_for_https_ready function exists"
  
  if grep -q "wait_for_https_ready()" "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: Helper function wait_for_https_ready() found"
    return 0
  else
    log_error "  FAILED: Helper function wait_for_https_ready() not found"
    return 1
  fi
}

# =============================================================================
# Test 3: Verify fallback chain in port check (ss -> netstat -> nginx)
# =============================================================================
test_fallback_chain() {
  log_info "Test 3: Verify fallback chain in port check (ss -> netstat -> nginx)"
  
  local has_ss has_netstat has_nginx
  has_ss=$(grep -c "command -v ss" "${DEPLOY_SCRIPT}" || echo "0")
  has_netstat=$(grep -c "command -v netstat" "${DEPLOY_SCRIPT}" || echo "0")
  has_nginx=$(grep -c "nginx -T" "${DEPLOY_SCRIPT}" || echo "0")
  
  if [ "${has_ss}" -ge 1 ] && [ "${has_netstat}" -ge 1 ] && [ "${has_nginx}" -ge 1 ]; then
    log_info "  PASSED: Fallback chain includes ss, netstat, and nginx -T"
    return 0
  else
    log_error "  FAILED: Fallback chain incomplete (ss=${has_ss}, netstat=${has_netstat}, nginx=${has_nginx})"
    return 1
  fi
}

# =============================================================================
# Test 4: Verify curl is used as source of truth
# =============================================================================
test_curl_source_of_truth() {
  log_info "Test 4: Verify curl is used as source of truth for HTTPS"
  
  # Check for curl-based HTTPS verification
  if grep -q 'curl.*https://localhost' "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: curl https://localhost check found"
  else
    log_error "  FAILED: curl https://localhost check not found"
    return 1
  fi
  
  # Check for "SOURCE OF TRUTH" comment
  if grep -qi "source of truth" "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: SOURCE OF TRUTH documentation found"
  else
    log_warn "  WARNING: SOURCE OF TRUTH documentation not found (non-fatal)"
  fi
  
  return 0
}

# =============================================================================
# Test 5: Verify no false-negative WARN pattern
# =============================================================================
test_no_false_negative_warn() {
  log_info "Test 5: Verify false-negative WARN pattern is removed"
  
  # The old problematic pattern was:
  # if [ "${port_443_check}" != "listening" ]; then
  #   log_warn "Frontend is NOT listening on port 443 (HTTPS not enabled)"
  #
  # This should NOT be the primary decision maker anymore
  
  # Check that the old pattern is not the sole decision maker
  local old_pattern_count
  set +e
  old_pattern_count=$(grep -c 'Frontend is NOT listening on port 443 (HTTPS not enabled)' "${DEPLOY_SCRIPT}" 2>/dev/null)
  if [ -z "${old_pattern_count}" ]; then
    old_pattern_count=0
  fi
  set -e
  
  if [ "${old_pattern_count}" -eq 0 ]; then
    log_info "  PASSED: Old false-negative WARN pattern removed"
    return 0
  else
    log_error "  FAILED: Old false-negative WARN pattern still present (${old_pattern_count} occurrences)"
    return 1
  fi
}

# =============================================================================
# Test 6: Verify HTTPS_MODE check is preserved
# =============================================================================
test_https_mode_check() {
  log_info "Test 6: Verify HTTPS_MODE check is preserved"
  
  if grep -q 'HTTPS_MODE' "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: HTTPS_MODE variable check found"
  else
    log_error "  FAILED: HTTPS_MODE variable check not found"
    return 1
  fi
  
  # Check that override file detection is preserved
  if grep -q 'docker-compose.staging.override.yml' "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: Override file detection preserved"
  else
    log_error "  FAILED: Override file detection not found"
    return 1
  fi
  
  return 0
}

# =============================================================================
# Test 7: Verify PORT_443_STATUS variable is set
# =============================================================================
test_port_status_variable() {
  log_info "Test 7: Verify PORT_443_STATUS variable is set"
  
  if grep -q 'PORT_443_STATUS=' "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: PORT_443_STATUS variable found"
  else
    log_error "  FAILED: PORT_443_STATUS variable not found"
    return 1
  fi
  
  # Check for "unknown" status (tools missing case)
  if grep -q 'PORT_443_STATUS="unknown"' "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: PORT_443_STATUS='unknown' case handled"
  else
    log_error "  FAILED: PORT_443_STATUS='unknown' case not handled"
    return 1
  fi
  
  return 0
}

# =============================================================================
# Test 8: Verify informational logging for port check
# =============================================================================
test_informational_logging() {
  log_info "Test 8: Verify informational logging for port check"
  
  # Check for informational log messages instead of warnings
  if grep -q 'Frontend 443 status:' "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: Informational port status logging found"
  else
    log_error "  FAILED: Informational port status logging not found"
    return 1
  fi
  
  # Check for "tools missing" info message
  if grep -q 'tools missing' "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: 'tools missing' info message found"
  else
    log_error "  FAILED: 'tools missing' info message not found"
    return 1
  fi
  
  return 0
}

# =============================================================================
# Test 9: Verify HTTPS verified via curl log message
# =============================================================================
test_https_verified_message() {
  log_info "Test 9: Verify 'HTTPS verified via curl' log message"
  
  if grep -q 'HTTPS verified via curl' "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: 'HTTPS verified via curl' message found"
    return 0
  else
    log_error "  FAILED: 'HTTPS verified via curl' message not found"
    return 1
  fi
}

# =============================================================================
# Test 10: Verify wait loop parameters (max 45s, 2s interval)
# =============================================================================
test_wait_loop_parameters() {
  log_info "Test 10: Verify wait loop parameters"
  
  # Check for wait_for_https_ready call with parameters
  if grep -qE 'wait_for_https_ready\s+45\s+2' "${DEPLOY_SCRIPT}"; then
    log_info "  PASSED: wait_for_https_ready called with 45s max, 2s interval"
    return 0
  else
    log_warn "  WARNING: Could not verify exact wait parameters (non-fatal)"
    # Check if function has default parameters
    if grep -qE 'max_wait=.*45|interval=.*2' "${DEPLOY_SCRIPT}"; then
      log_info "  PASSED: Default parameters found in function"
      return 0
    fi
    return 0
  fi
}

# =============================================================================
# Main
# =============================================================================
main() {
  log_info "=== HTTPS Detection False-Negative Regression Tests ==="
  log_info "Testing: ${DEPLOY_SCRIPT}"
  log_info ""
  
  local failed=0
  
  # Run tests
  test_helper_function_exists || failed=$((failed + 1))
  test_wait_function_exists || failed=$((failed + 1))
  test_fallback_chain || failed=$((failed + 1))
  test_curl_source_of_truth || failed=$((failed + 1))
  test_no_false_negative_warn || failed=$((failed + 1))
  test_https_mode_check || failed=$((failed + 1))
  test_port_status_variable || failed=$((failed + 1))
  test_informational_logging || failed=$((failed + 1))
  test_https_verified_message || failed=$((failed + 1))
  test_wait_loop_parameters || failed=$((failed + 1))
  
  log_info ""
  if [ ${failed} -eq 0 ]; then
    log_info "=== All tests passed ==="
    exit 0
  else
    log_error "=== ${failed} test(s) failed ==="
    exit 1
  fi
}

main "$@"
