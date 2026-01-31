#!/bin/bash
# =============================================================================
# Test: COMPOSE_FILE Unbound Variable Regression Guard
# =============================================================================
# This test ensures that ops/staging-deploy-validate.sh can run with COMPOSE_FILE
# unset under strict mode (set -euo pipefail).
#
# Usage:
#   bash ops/tests/test-compose-file-unbound.sh
#
# Exit Codes:
#   0 - Test passed
#   1 - Test failed
#
# This test is designed to be run in CI to prevent regression of the
# COMPOSE_FILE unbound variable issue (PR #319 follow-up).
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
# Test 1: VALIDATE_ONLY mode with COMPOSE_FILE unset
# =============================================================================
test_validate_only_unset_compose_file() {
  log_info "Test 1: VALIDATE_ONLY=1 with COMPOSE_FILE unset"
  
  # Ensure COMPOSE_FILE is unset
  unset COMPOSE_FILE 2>/dev/null || true
  
  # Run the script in VALIDATE_ONLY mode
  local output exit_code
  set +e
  output=$(VALIDATE_ONLY=1 bash "${DEPLOY_SCRIPT}" 2>&1)
  exit_code=$?
  set -e
  
  if [ ${exit_code} -eq 0 ]; then
    log_info "  PASSED: Script exited with code 0"
    return 0
  else
    log_error "  FAILED: Script exited with code ${exit_code}"
    log_error "  Output:"
    echo "${output}" | head -50
    return 1
  fi
}

# =============================================================================
# Test 2: VALIDATE_ONLY mode with COMPOSE_FILE set (legacy mode)
# =============================================================================
test_validate_only_with_compose_file() {
  log_info "Test 2: VALIDATE_ONLY=1 with COMPOSE_FILE set (legacy mode)"
  
  # Set COMPOSE_FILE to the base compose file
  export COMPOSE_FILE="${REPO_ROOT}/docker-compose.staging.yml"
  
  # Run the script in VALIDATE_ONLY mode
  local output exit_code
  set +e
  output=$(VALIDATE_ONLY=1 bash "${DEPLOY_SCRIPT}" 2>&1)
  exit_code=$?
  set -e
  
  # Clean up
  unset COMPOSE_FILE
  
  if [ ${exit_code} -eq 0 ]; then
    log_info "  PASSED: Script exited with code 0"
    return 0
  else
    log_error "  FAILED: Script exited with code ${exit_code}"
    log_error "  Output:"
    echo "${output}" | head -50
    return 1
  fi
}

# =============================================================================
# Test 3: DRY_RUN mode (alias for VALIDATE_ONLY)
# =============================================================================
test_dry_run_mode() {
  log_info "Test 3: DRY_RUN=1 mode (alias for VALIDATE_ONLY)"
  
  # Ensure COMPOSE_FILE is unset
  unset COMPOSE_FILE 2>/dev/null || true
  
  # Run the script in DRY_RUN mode
  local output exit_code
  set +e
  output=$(DRY_RUN=1 bash "${DEPLOY_SCRIPT}" 2>&1)
  exit_code=$?
  set -e
  
  if [ ${exit_code} -eq 0 ]; then
    log_info "  PASSED: Script exited with code 0"
    return 0
  else
    log_error "  FAILED: Script exited with code ${exit_code}"
    log_error "  Output:"
    echo "${output}" | head -50
    return 1
  fi
}

# =============================================================================
# Test 4: Verify compose args are printed in VALIDATE_ONLY mode
# =============================================================================
test_compose_args_printed() {
  log_info "Test 4: Verify compose configuration is printed in VALIDATE_ONLY mode"
  
  # Ensure COMPOSE_FILE is unset
  unset COMPOSE_FILE 2>/dev/null || true
  
  # Run the script in VALIDATE_ONLY mode
  local output
  output=$(VALIDATE_ONLY=1 bash "${DEPLOY_SCRIPT}" 2>&1)
  
  # Check for expected output
  if echo "${output}" | grep -q "Compose configuration:"; then
    log_info "  PASSED: Compose configuration section found"
  else
    log_error "  FAILED: Compose configuration section not found"
    return 1
  fi
  
  if echo "${output}" | grep -q "HTTPS_MODE:"; then
    log_info "  PASSED: HTTPS_MODE printed"
  else
    log_error "  FAILED: HTTPS_MODE not printed"
    return 1
  fi
  
  if echo "${output}" | grep -q "BASE_COMPOSE:"; then
    log_info "  PASSED: BASE_COMPOSE printed"
  else
    log_error "  FAILED: BASE_COMPOSE not printed"
    return 1
  fi
  
  return 0
}

# =============================================================================
# Main
# =============================================================================
main() {
  log_info "=== COMPOSE_FILE Unbound Variable Regression Tests ==="
  log_info "Testing: ${DEPLOY_SCRIPT}"
  log_info ""
  
  local failed=0
  
  # Run tests
  test_validate_only_unset_compose_file || failed=$((failed + 1))
  test_validate_only_with_compose_file || failed=$((failed + 1))
  test_dry_run_mode || failed=$((failed + 1))
  test_compose_args_printed || failed=$((failed + 1))
  
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
