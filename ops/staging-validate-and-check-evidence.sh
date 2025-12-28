#!/bin/bash
# =============================================================================
# GRC Platform - Staging Validation & Evidence Check Script
# =============================================================================
# This script runs after PR merge to validate staging deployment and check evidence.
#
# Usage (on staging server via tmux):
#   ssh root@46.224.99.150
#   tmux new -s deploy
#   cd /opt/grc-platform
#   git checkout main
#   git pull --ff-only
#   export STAGING_ADMIN_EMAIL="admin@grc-platform.local"
#   export STAGING_ADMIN_PASSWORD="GERCEK_SIFREYI_YAZ"
#   bash ops/staging-deploy-validate.sh
#   
#   # After completion, in same or new tmux session:
#   bash ops/staging-validate-and-check-evidence.sh
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

EVIDENCE_BASE="${REPO_ROOT}/evidence"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*"
}

# Find latest evidence directory
log_info "=== Finding Latest Evidence Directory ==="
if [ ! -d "${EVIDENCE_BASE}" ]; then
  log_error "Evidence base directory not found: ${EVIDENCE_BASE}"
  exit 1
fi

LATEST=$(ls -td "${EVIDENCE_BASE}"/staging-* 2>/dev/null | head -1 || echo "")
if [ -z "${LATEST}" ]; then
  log_error "No evidence directories found in ${EVIDENCE_BASE}"
  exit 1
fi

log_info "Latest evidence directory: ${LATEST}"

# Check evidence files exist
RAW_LOG="${LATEST}/raw.log"
SUMMARY_MD="${LATEST}/summary.md"
META_JSON="${LATEST}/meta.json"

if [ ! -f "${RAW_LOG}" ]; then
  log_error "raw.log not found: ${RAW_LOG}"
  exit 1
fi

if [ ! -f "${SUMMARY_MD}" ]; then
  log_error "summary.md not found: ${SUMMARY_MD}"
  exit 1
fi

if [ ! -f "${META_JSON}" ]; then
  log_error "meta.json not found: ${META_JSON}"
  exit 1
fi

log_info "Evidence files found"

# Check smoke test results
log_info "=== Checking Smoke Test Results ==="
SMOKE_COUNT=$(grep -c "SMOKE " "${RAW_LOG}" || echo "0")
SMOKE_LOGIN_COUNT=$(grep -c "SMOKE login" "${RAW_LOG}" || echo "0")
SMOKE_CONTEXT_COUNT=$(grep -c "SMOKE context" "${RAW_LOG}" || echo "0")

log_info "Total SMOKE lines: ${SMOKE_COUNT}"
log_info "SMOKE login lines: ${SMOKE_LOGIN_COUNT}"
log_info "SMOKE context lines: ${SMOKE_CONTEXT_COUNT}"

# Show last 60 SMOKE lines
log_info "=== Last 60 SMOKE Lines ==="
grep -n "SMOKE " "${RAW_LOG}" | tail -n 60 || log_warn "No SMOKE lines found"

# Show SMOKE login details
log_info "=== SMOKE Login Details (last 200 lines) ==="
grep -n "SMOKE login" "${RAW_LOG}" | tail -n 200 || log_warn "No SMOKE login lines found"

# Show SMOKE context details
log_info "=== SMOKE Context Details (last 200 lines) ==="
grep -n "SMOKE context" "${RAW_LOG}" | tail -n 200 || log_warn "No SMOKE context lines found"

# Check health check results
log_info "=== Health Check Results ==="
grep -n "HEALTH " "${RAW_LOG}" || log_warn "No HEALTH lines found"

# Token leak check
log_info "=== Token Leak Check ==="
set +e
TOKEN_MATCHES=$(grep -E "eyJ[a-zA-Z0-9_-]{10,}\.|Bearer [A-Za-z0-9._-]{10,}|accessToken\"\s*:\s*\"|Authorization:" "${RAW_LOG}" 2>/dev/null | wc -l || echo "0")
set -e

if [ "${TOKEN_MATCHES}" -gt 0 ]; then
  log_error "LEAK DETECTED: ${TOKEN_MATCHES} token pattern(s) found in raw.log"
  log_error "This is a security issue - tokens must never appear in logs"
  exit 1
else
  log_info "OK: no token patterns detected"
fi

# Show summary.md
log_info "=== Summary Report (last 80 lines) ==="
tail -n 80 "${SUMMARY_MD}" || log_warn "Could not read summary.md"

# Show meta.json
log_info "=== Metadata (first 80 lines) ==="
head -n 80 "${META_JSON}" || log_warn "Could not read meta.json"

# Check for credential guard results
log_info "=== Credential Guard Results ==="
grep -i "credential_guard\|Credential guard" "${RAW_LOG}" || log_warn "No credential guard lines found"

# Final summary
log_info "=== Validation Summary ==="
log_info "Evidence directory: ${LATEST}"
log_info "Raw log size: $(wc -l < "${RAW_LOG}" | tr -d ' ') lines"
log_info "Token leak check: PASSED (no leaks detected)"

# Check for exit codes in raw.log (indicating script completion status)
log_info "=== Script Completion Status ==="
if grep -q "Exit code: 0" "${RAW_LOG}"; then
  log_info "✅ Deployment script completed successfully (Exit code: 0)"
elif grep -q "Exit code:" "${RAW_LOG}"; then
  log_warn "Deployment script exit code found (check raw.log for details)"
  grep "Exit code:" "${RAW_LOG}" | tail -1
else
  log_warn "No exit code found in raw.log (script may have been interrupted)"
fi

log_info "=== Validation Complete ==="
log_info "Evidence directory: ${LATEST}"
log_info "All checks completed successfully"

