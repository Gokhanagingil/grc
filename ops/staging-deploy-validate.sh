#!/bin/bash
# =============================================================================
# GRC Platform - Staging Deploy & Validate Script
# =============================================================================
# One-command staging deployment with validation and evidence generation.
#
# Usage:
#   bash ops/staging-deploy-validate.sh
#
# Environment Variables:
#   STAGING_ADMIN_EMAIL    - Admin email for smoke tests (required)
#   STAGING_ADMIN_PASSWORD - Admin password for smoke tests (required)
#   STAGING_TENANT_ID     - Tenant ID for smoke tests (optional, default: DEMO_TENANT_ID)
#   ALLOW_DIRTY           - Set to "1" to allow dirty git working tree (optional)
#
# Exit Codes:
#   0 - Success (all checks passed)
#   2 - Pre-check failure (docker/git/repo/issues)
#   3 - Git update failure (fast-forward pull failed)
#   4 - Deploy/build failure
#   5 - Preflight failure (memory check failed)
#   6 - Health check failure
#   7 - Smoke test failure
#   8 - Evidence generation failure
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.staging.yml"
BACKEND_CONTAINER="grc-staging-backend"
FRONTEND_CONTAINER="grc-staging-frontend"
BACKEND_PORT="3002"
EVIDENCE_BASE="${REPO_ROOT}/evidence"
DEMO_TENANT_ID="00000000-0000-0000-0000-000000000001"
STAGING_TENANT_ID="${STAGING_TENANT_ID:-${DEMO_TENANT_ID}}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*"
}

# Evidence directory
EVIDENCE_DIR=""
RAW_LOG=""
SUMMARY_MD=""
META_JSON=""
HEALTH_RESULTS=()

# Initialize evidence directory
init_evidence() {
  local timestamp
  timestamp=$(date +%Y%m%d-%H%M%S)
  EVIDENCE_DIR="${EVIDENCE_BASE}/staging-${timestamp}"
  RAW_LOG="${EVIDENCE_DIR}/raw.log"
  SUMMARY_MD="${EVIDENCE_DIR}/summary.md"
  META_JSON="${EVIDENCE_DIR}/meta.json"

  mkdir -p "${EVIDENCE_DIR}"
  exec > >(tee -a "${RAW_LOG}") 2>&1
  log_info "Evidence directory: ${EVIDENCE_DIR}"
}

# Truncate text to max length
truncate_text() {
  local text="$1"
  local max_len="${2:-2048}"
  if [ ${#text} -gt "${max_len}" ]; then
    echo "${text:0:${max_len}}... [truncated]"
  else
    echo "${text}"
  fi
}

# =============================================================================
# A) Pre-checks
# =============================================================================
pre_checks() {
  log_info "=== Pre-checks ==="

  # Check OS (must be Linux)
  if [[ "$(uname)" != "Linux" ]]; then
    log_error "This script must run on Linux (detected: $(uname))"
    exit 2
  fi

  # Detect repo root
  if [ ! -d "${REPO_ROOT}/.git" ]; then
    log_error "Not a git repository: ${REPO_ROOT}"
    log_error "Please run this script from the repository root or ensure .git exists"
    exit 2
  fi

  # Change to repo root
  cd "${REPO_ROOT}"
  log_info "Working directory: ${REPO_ROOT}"

  # Check git status (must be clean unless ALLOW_DIRTY=1)
  local git_status
  git_status=$(git status --porcelain 2>/dev/null || echo "")
  if [ -n "${git_status}" ]; then
    if [ "${ALLOW_DIRTY:-}" != "1" ]; then
      log_error "Working directory has uncommitted changes"
      log_error "Set ALLOW_DIRTY=1 to override this check"
      echo "Uncommitted changes:" >> "${RAW_LOG}"
      echo "${git_status}" >> "${RAW_LOG}"
      exit 2
    else
      log_warn "Working directory has uncommitted changes (ALLOW_DIRTY=1 set)"
      echo "${git_status}" >> "${RAW_LOG}"
    fi
  fi

  # Check docker
  if ! command -v docker &> /dev/null; then
    log_error "docker command not found"
    exit 2
  fi

  # Check docker compose
  if ! docker compose version &> /dev/null; then
    log_error "docker compose command not found"
    exit 2
  fi

  # Check compose file
  if [ ! -f "${COMPOSE_FILE}" ]; then
    log_error "Compose file not found: ${COMPOSE_FILE}"
    exit 2
  fi

  # Get git metadata
  local git_commit git_branch
  git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Store metadata
  cat > "${META_JSON}" <<EOF
{
  "timestamp": "${timestamp}",
  "git_commit": "${git_commit}",
  "git_branch": "${git_branch}",
  "git_dirty": $([ -n "${git_status}" ] && echo "true" || echo "false"),
  "script_version": "1.0.0"
}
EOF

  log_info "Git commit: ${git_commit}"
  log_info "Git branch: ${git_branch}"
  log_info "Pre-checks passed"
}

# =============================================================================
# B) Update
# =============================================================================
update_repo() {
  log_info "=== Update Repository ==="

  local old_commit new_commit
  old_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
  
  git fetch origin || {
    log_error "git fetch origin failed"
    exit 3
  }
  
  git pull --ff-only || {
    log_error "git pull --ff-only failed (not a fast-forward merge or conflicts)"
    exit 3
  }

  new_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
  
  if [ "${old_commit}" != "${new_commit}" ] && [ -n "${old_commit}" ]; then
    log_info "Repository updated: ${old_commit} -> ${new_commit}"
    echo "Repository updated: ${old_commit} -> ${new_commit}" >> "${RAW_LOG}"
  else
    log_info "Repository already up to date"
  fi
}

# =============================================================================
# C) Deploy/Build
# =============================================================================
build_and_up() {
  log_info "=== Build and Start Containers ==="

  # Build and start backend and frontend (not db)
  if ! docker compose -f "${COMPOSE_FILE}" up -d --build backend frontend; then
    log_error "docker compose up failed"
    exit 4
  fi

  # Wait for containers to be running
  sleep 5

  # Get container status
  log_info "Container status:"
  docker compose -f "${COMPOSE_FILE}" ps >> "${RAW_LOG}" 2>&1 || true

  # Wait for backend health (max 90s)
  log_info "Waiting for backend to be ready (max 90s)..."
  local max_wait=90
  local wait_interval=3
  local elapsed=0
  local backend_ready=false

  while [ ${elapsed} -lt ${max_wait} ]; do
    if docker exec "${BACKEND_CONTAINER}" sh -c \
      "command -v curl >/dev/null 2>&1 && curl -sf http://localhost:${BACKEND_PORT}/health/ready >/dev/null 2>&1 || \
       (command -v wget >/dev/null 2>&1 && wget -q --spider http://localhost:${BACKEND_PORT}/health/ready >/dev/null 2>&1) || \
       node -e \"const http=require('http');const r=http.get('http://localhost:${BACKEND_PORT}/health/ready',{timeout:10000},(res)=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1));r.on('timeout',()=>{r.destroy();process.exit(1)});\" 2>/dev/null"; then
      backend_ready=true
      break
    fi
    sleep ${wait_interval}
    elapsed=$((elapsed + wait_interval))
    echo -n "."
  done
  echo ""

  if [ "${backend_ready}" = "false" ]; then
    log_error "Backend did not become ready within ${max_wait}s"
    exit 4
  fi

  log_info "Backend is ready"
}

# =============================================================================
# D) Preflight (Memory Check)
# =============================================================================
preflight_check() {
  log_info "=== Preflight Check (Memory) ==="

  local preflight_output
  preflight_output=$(docker compose -f "${COMPOSE_FILE}" exec -T backend sh -lc "node dist/scripts/check-memory.js" 2>&1 || true)

  echo "${preflight_output}" >> "${RAW_LOG}"

  # Check for ERROR in output
  if echo "${preflight_output}" | grep -qi "\[ERROR\]"; then
    log_error "Preflight check failed (ERROR detected)"
    echo "${preflight_output}"
    exit 5
  fi

  # Check for WARN (don't fail, but note it)
  if echo "${preflight_output}" | grep -qi "\[WARN\]"; then
    log_warn "Preflight check has warnings (non-fatal)"
    echo "${preflight_output}"
    echo "WARNINGS:" >> "${RAW_LOG}"
    echo "${preflight_output}" | grep -i "\[WARN\]" >> "${RAW_LOG}" || true
  else
    log_info "Preflight check passed"
    echo "${preflight_output}"
  fi
}

# =============================================================================
# E) Health Checks
# =============================================================================
health_checks() {
  log_info "=== Health Checks ==="

  local health_endpoints=(
    "/health/live"
    "/health/db"
    "/health/auth"
    "/health/ready"
  )

  HEALTH_RESULTS=()
  local all_healthy=true

  for endpoint in "${health_endpoints[@]}"; do
    log_info "Checking ${endpoint}..."

    # Run Node script to check health endpoint
    # Node script outputs: status_code\nresponse_body (if 200)
    # Exit code: 0 = HTTP 200, !=0 = failed
    local node_output node_exit_code
    set +e
    node_output=$(docker exec "${BACKEND_CONTAINER}" node -e "
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port: ${BACKEND_PORT},
        path: '${endpoint}',
        method: 'GET',
        timeout: 10000
      };
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          // Output: status_code\nbody (if 200, else empty body)
          console.log(res.statusCode);
          if (res.statusCode === 200 && body) {
            console.log(body);
          }
          process.exit(res.statusCode === 200 ? 0 : 1);
        });
      });
      req.on('error', (err) => {
        console.log('000');
        process.exit(1);
      });
      req.on('timeout', () => {
        req.destroy();
        console.log('000');
        process.exit(1);
      });
      req.setTimeout(10000);
      req.end();
    " 2>&1)
    node_exit_code=$?
    set -e

    # Parse output: first line is status code, rest is body (if present)
    local response_code response_body
    response_code=$(echo "${node_output}" | head -n 1)
    # Ensure response_code is numeric, default to "000" if not
    if ! [[ "${response_code}" =~ ^[0-9]+$ ]]; then
      response_code="000"
    fi
    response_body=$(echo "${node_output}" | tail -n +2 | head -c 2048 || echo "")

    # Determine health status: HTTP 200 is primary success criterion
    local health_status
    if [ "${node_exit_code}" -eq 0 ] && [ "${response_code}" = "200" ]; then
      health_status="OK"
      HEALTH_RESULTS+=("${endpoint}: OK")
      log_info "${endpoint}: OK (HTTP 200)"
    else
      health_status="FAILED"
      all_healthy=false
      HEALTH_RESULTS+=("${endpoint}: FAILED (HTTP ${response_code})")
      log_error "Health check failed for ${endpoint} (HTTP ${response_code})"
    fi

    # Log to raw.log: status and result lines
    echo "HEALTH ${endpoint} status=${response_code}" >> "${RAW_LOG}"
    echo "HEALTH ${endpoint} result=${health_status}" >> "${RAW_LOG}"
    
    # Optionally log response body (truncated to 2048 chars)
    if [ "${response_code}" = "200" ] && [ -n "${response_body}" ]; then
      local truncated_body
      truncated_body=$(truncate_text "${response_body}" 2048)
      echo "${truncated_body}" >> "${RAW_LOG}"
    fi
    echo "" >> "${RAW_LOG}"
  done

  if [ "${all_healthy}" = "false" ]; then
    log_error "One or more health checks failed"
    exit 6
  fi

  log_info "All health checks passed"
}

# =============================================================================
# F) Smoke Tests
# =============================================================================

# Retry helper function with exponential backoff
# Usage: retry max_attempts initial_sleep_seconds "function_name" [args...]
# Returns: last exit code from function
# Note: Functions should set RETRY_SHOULD_SKIP=1 if retry should be skipped (e.g., 4xx errors)
retry() {
  local max_attempts="$1"
  local initial_sleep="$2"
  local func_name="$3"
  shift 3
  local func_args=("$@")
  local attempt=1
  local current_sleep="${initial_sleep}"
  local last_exit_code=1
  
  while [ ${attempt} -le ${max_attempts} ]; do
    # Reset skip flag
    RETRY_SHOULD_SKIP=0
    
    # Call function with attempt number as first argument
    if "${func_name}" ${attempt} "${func_args[@]}"; then
      return 0
    fi
    last_exit_code=$?
    
    # Check if retry should be skipped (e.g., 4xx errors)
    if [ "${RETRY_SHOULD_SKIP:-0}" = "1" ]; then
      return ${last_exit_code}
    fi
    
    if [ ${attempt} -lt ${max_attempts} ]; then
      sleep ${current_sleep}
      current_sleep=$((current_sleep * 2))  # Exponential backoff (2, 4, 8)
    fi
    
    attempt=$((attempt + 1))
  done
  
  return ${last_exit_code}
}

# Sanitize response body: mask JWT tokens and Bearer tokens
# Usage: sanitize_response_body "response_body"
sanitize_response_body() {
  local body="$1"
  # Mask JWT tokens (eyJ...)
  body=$(echo "${body}" | sed -E 's/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/[JWT_MASKED]/g')
  # Mask Bearer tokens
  body=$(echo "${body}" | sed -E 's/Bearer [A-Za-z0-9._-]{10,}/Bearer [TOKEN_MASKED]/g')
  # Mask accessToken values
  body=$(echo "${body}" | sed -E 's/"accessToken"\s*:\s*"[^"]{10,}"/"accessToken":"[MASKED]"/g')
  # Mask any token-like values
  body=$(echo "${body}" | sed -E 's/"token"\s*:\s*"[^"]{10,}"/"token":"[MASKED]"/g')
  echo "${body}"
}

# Login test helper function (called by retry)
# Usage: _login_test attempt_number
# Sets: login_token (in parent scope)
# Sets: RETRY_SHOULD_SKIP=1 if 4xx error (should not retry)
# Returns: 0 on success, 1 on failure
_login_test() {
  local attempt="$1"
  local login_status login_http_code login_response_body
  login_status=""
  login_http_code="000"
  login_response_body=""
  
  set +e
  login_status=$(docker exec -e ADMIN_EMAIL="${STAGING_ADMIN_EMAIL}" \
    -e ADMIN_PASSWORD="${STAGING_ADMIN_PASSWORD}" \
    "${BACKEND_CONTAINER}" sh -c \
    'node - <<NODE
      const http = require("http");
      const fs = require("fs");
      const data = JSON.stringify({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
      });
      const options = {
        hostname: "localhost",
        port: '"${BACKEND_PORT}"',
        path: "/auth/login",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length
        },
        timeout: 10000
      };
      const req = http.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(body);
              const token = json.accessToken || (json.data && json.data.accessToken);
              if (token) {
                fs.writeFileSync("'"${token_file_in_container}"'", token, "utf8");
                process.stderr.write("LOGIN_OK\n");
                process.stderr.write("HTTP_" + res.statusCode + "\n");
                process.exit(0);
              } else {
                process.stderr.write("ERROR: No accessToken in response\n");
                process.stderr.write("HTTP_" + res.statusCode + "\n");
                process.stderr.write("BODY_START\n");
                process.stderr.write(body.substring(0, 2048) + "\n");
                process.stderr.write("BODY_END\n");
                process.exit(1);
              }
            } catch (e) {
              process.stderr.write("ERROR: Invalid JSON response\n");
              process.stderr.write("HTTP_" + res.statusCode + "\n");
              process.stderr.write("BODY_START\n");
              process.stderr.write(body.substring(0, 2048) + "\n");
              process.stderr.write("BODY_END\n");
              process.exit(1);
            }
          } else {
            process.stderr.write("ERROR: Login failed with status " + res.statusCode + "\n");
            process.stderr.write("HTTP_" + res.statusCode + "\n");
            process.stderr.write("BODY_START\n");
            process.stderr.write(body.substring(0, 2048) + "\n");
            process.stderr.write("BODY_END\n");
            process.exit(1);
          }
        });
      });
      req.on("error", () => {
        process.stderr.write("ERROR: Request error\n");
        process.stderr.write("HTTP_000\n");
        process.exit(1);
      });
      req.on("timeout", () => {
        req.destroy();
        process.stderr.write("ERROR: Request timeout\n");
        process.stderr.write("HTTP_000\n");
        process.exit(1);
      });
      req.write(data);
      req.end();
NODE
' 2>&1)
  local login_exit_code=$?
  set -e
  
  # Extract HTTP code
  login_http_code=$(echo "${login_status}" | grep "^HTTP_" | head -1 | cut -d'_' -f2 || echo "000")
  if ! [[ "${login_http_code}" =~ ^[0-9]+$ ]]; then
    login_http_code="000"
  fi
  
  # Extract response body (between BODY_START and BODY_END)
  if echo "${login_status}" | grep -q "BODY_START"; then
    login_response_body=$(echo "${login_status}" | sed -n '/BODY_START/,/BODY_END/p' | sed '1d;$d' | head -c 2048 || echo "")
  fi
  
  # Check login status
  if echo "${login_status}" | grep -q "LOGIN_OK"; then
    # Extract token from container file (not logged) and set in parent scope
    login_token=$(docker exec "${BACKEND_CONTAINER}" cat "${token_file_in_container}" 2>/dev/null || echo "")
    
    if [ -n "${login_token}" ]; then
      echo "SMOKE login attempt=${attempt} result=OK" >> "${RAW_LOG}"
      return 0
    fi
  fi
  
  # Determine if this is a 4xx error (client error - should not retry)
  local is_4xx=false
  if [[ "${login_http_code}" =~ ^[4][0-9]{2}$ ]]; then
    is_4xx=true
    RETRY_SHOULD_SKIP=1
  fi
  
  # Sanitize and log response body
  local sanitized_body=""
  if [ -n "${login_response_body}" ]; then
    sanitized_body=$(sanitize_response_body "${login_response_body}")
    sanitized_body=$(truncate_text "${sanitized_body}" 2048)
  fi
  
  # Log failure attempt with sanitized response body
  echo "SMOKE login attempt=${attempt} status=${login_http_code} result=FAILED" >> "${RAW_LOG}"
  if [ -n "${sanitized_body}" ]; then
    echo "SMOKE login response_body=<SANITIZED_TRUNCATED>${sanitized_body}</SANITIZED_TRUNCATED>" >> "${RAW_LOG}"
  fi
  
  # Log to console with appropriate level
  if [ "${is_4xx}" = "true" ]; then
    log_error "Login attempt ${attempt} failed with HTTP ${login_http_code} (client error - no retry)"
    if [ -n "${sanitized_body}" ]; then
      log_error "Response: ${sanitized_body}"
    fi
  else
    if [ ${attempt} -lt 3 ]; then
      local backoff_seconds=$((2 ** (attempt - 1)))
      log_warn "Login attempt ${attempt}/3 failed (HTTP ${login_http_code}), retrying in ${backoff_seconds}s..."
    else
      log_error "Login attempt ${attempt} failed with HTTP ${login_http_code}"
      if [ -n "${sanitized_body}" ]; then
        log_error "Response: ${sanitized_body}"
      fi
    fi
  fi
  
  return 1
}

# Context test helper function (called by retry)
# Usage: _context_test attempt_number
# Uses: login_token (from parent scope)
# Returns: 0 on success, 1 on failure
_context_test() {
  local attempt="$1"
  local context_status context_http_code
  context_status=""
  context_http_code="000"
  
  set +e
  context_status=$(docker exec -e AUTH_TOKEN="${login_token}" \
    -e TENANT_ID="${STAGING_TENANT_ID}" \
    "${BACKEND_CONTAINER}" sh -c \
    'node - <<NODE
      const http = require("http");
      const token = process.env.AUTH_TOKEN;
      const tenantId = process.env.TENANT_ID;
      const options = {
        hostname: "localhost",
        port: '"${BACKEND_PORT}"',
        path: "/onboarding/context",
        method: "GET",
        headers: {
          "Authorization": "Bearer " + token,
          "x-tenant-id": tenantId
        },
        timeout: 10000
      };
      const req = http.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(body);
              const context = json.context || (json.data && json.data.context);
              if (context) {
                console.log("OK");
                process.stderr.write("HTTP_" + res.statusCode + "\n");
                process.exit(0);
              } else {
                console.error("ERROR: No context in response (HTTP 200)");
                process.stderr.write("HTTP_" + res.statusCode + "\n");
                process.exit(1);
              }
            } catch (e) {
              console.error("ERROR: Invalid JSON (HTTP 200)");
              process.stderr.write("HTTP_" + res.statusCode + "\n");
              process.exit(1);
            }
          } else {
            console.error("ERROR: HTTP " + res.statusCode);
            process.stderr.write("HTTP_" + res.statusCode + "\n");
            process.exit(1);
          }
        });
      });
      req.on("error", () => {
        console.error("ERROR: Request error");
        process.stderr.write("HTTP_000\n");
        process.exit(1);
      });
      req.on("timeout", () => {
        req.destroy();
        console.error("ERROR: Request timeout");
        process.stderr.write("HTTP_000\n");
        process.exit(1);
      });
      req.end();
NODE
' 2>&1)
  local context_exit_code=$?
  set -e
  
  # Extract HTTP code
  context_http_code=$(echo "${context_status}" | grep "^HTTP_" | head -1 | cut -d'_' -f2 || echo "000")
  if ! [[ "${context_http_code}" =~ ^[0-9]+$ ]]; then
    context_http_code="000"
  fi
  
  if echo "${context_status}" | grep -q "^OK$"; then
    echo "SMOKE context attempt=${attempt} result=OK" >> "${RAW_LOG}"
    return 0
  fi
  
  # Determine if this is a 4xx error (client error - should not retry)
  local is_4xx=false
  if [[ "${context_http_code}" =~ ^[4][0-9]{2}$ ]]; then
    is_4xx=true
    RETRY_SHOULD_SKIP=1
  fi
  
  # Log failure attempt
  echo "SMOKE context attempt=${attempt} status=${context_http_code} result=FAILED" >> "${RAW_LOG}"
  
  # Log to console with appropriate level
  if [ "${is_4xx}" = "true" ]; then
    log_error "Context test attempt ${attempt} failed with HTTP ${context_http_code} (client error - no retry)"
  else
    if [ ${attempt} -lt 3 ]; then
      local backoff_seconds=$((2 ** (attempt - 1)))
      log_warn "Context test attempt ${attempt}/3 failed (HTTP ${context_http_code}), retrying in ${backoff_seconds}s..."
    else
      log_error "Context test attempt ${attempt} failed with HTTP ${context_http_code}"
    fi
  fi
  
  return 1
}

smoke_tests() {
  log_info "=== Smoke Tests ==="

  # Check environment variables
  if [ -z "${STAGING_ADMIN_EMAIL:-}" ] || [ -z "${STAGING_ADMIN_PASSWORD:-}" ]; then
    log_error "STAGING_ADMIN_EMAIL and STAGING_ADMIN_PASSWORD must be set"
    exit 7
  fi

  # Login test with retry (token must never be logged - use temp file in container)
  log_info "Testing login..."
  token_file_in_container="/tmp/grc_smoke_token_$$"
  login_token=""
  
  # Cleanup function for token file
  local cleanup_token
  cleanup_token() {
    docker exec "${BACKEND_CONTAINER}" rm -f "${token_file_in_container}" 2>/dev/null || true
  }
  trap cleanup_token EXIT
  
  # Use retry helper for login (3 attempts, 2s initial backoff: 2, 4, 8)
  if ! retry 3 2 _login_test; then
    cleanup_token
    trap - EXIT
    log_error "Login test failed after 3 attempts"
    exit 7
  fi
  
  # Extract token from container file (not logged)
  login_token=$(docker exec "${BACKEND_CONTAINER}" cat "${token_file_in_container}" 2>/dev/null || echo "")
  
  if [ -z "${login_token}" ]; then
    cleanup_token
    trap - EXIT
    log_error "Login test failed (token is empty)"
    exit 7
  fi
  
  log_info "Login successful (token obtained, not logged)"
  
  # Cleanup token file
  cleanup_token
  trap - EXIT

  # Test onboarding/context endpoint with retry (requires x-tenant-id header)
  log_info "Testing /onboarding/context with tenant ID: ${STAGING_TENANT_ID}..."
  
  # Use retry helper for context (3 attempts, 2s initial backoff: 2, 4, 8)
  if ! retry 3 2 _context_test; then
    log_error "Onboarding context test failed after 3 attempts"
    exit 7
  fi
  
  log_info "Onboarding context test successful"

  log_info "All smoke tests passed"
}

# =============================================================================
# G) Evidence Pack
# =============================================================================
generate_evidence() {
  log_info "=== Generating Evidence Pack ==="

  # Evidence integrity check: scan raw.log for token-like patterns
  log_info "Checking evidence integrity (scanning for token leaks)..."
  set +e
  if grep -qE "eyJ[a-zA-Z0-9_-]{10,}\.|Bearer [A-Za-z0-9._-]{10,}" "${RAW_LOG}" 2>/dev/null; then
    log_error "Evidence integrity check FAILED: Token-like patterns detected in raw.log"
    log_error "This indicates a security issue - tokens must never appear in logs"
    set -e
    exit 8
  fi
  set -e
  log_info "Evidence integrity check passed (no token patterns detected)"

  # Get container status as text (store as string - avoid forcing JSON parsing across compose versions)
  local container_status_text
  container_status_text=$(docker compose -f "${COMPOSE_FILE}" ps 2>&1 || echo "")

  # Get docker image IDs
  local backend_image frontend_image
  backend_image=$(docker inspect "${BACKEND_CONTAINER}" --format '{{.Image}}' 2>/dev/null || echo "unknown")
  frontend_image=$(docker inspect "${FRONTEND_CONTAINER}" --format '{{.Image}}' 2>/dev/null || echo "unknown")

  # Read metadata and add container info (with fallback if jq not available)
  local git_commit git_branch timestamp git_dirty
  if command -v jq &> /dev/null; then
    git_commit=$(jq -r '.git_commit' "${META_JSON}" 2>/dev/null || echo "unknown")
    git_branch=$(jq -r '.git_branch' "${META_JSON}" 2>/dev/null || echo "unknown")
    timestamp=$(jq -r '.timestamp' "${META_JSON}" 2>/dev/null || echo "unknown")
    git_dirty=$(jq -r '.git_dirty' "${META_JSON}" 2>/dev/null || echo "false")
    
    # Store container status as string (not JSON array - safer across compose versions)
    jq --arg backend_img "${backend_image}" \
       --arg frontend_img "${frontend_image}" \
       --arg containers_text "${container_status_text}" \
       '. + {
         backend_image: $backend_img,
         frontend_image: $frontend_img,
         containers: $containers_text
       }' "${META_JSON}" > "${META_JSON}.tmp" && mv "${META_JSON}.tmp" "${META_JSON}"
  else
    # Fallback: parse JSON manually (basic)
    git_commit=$(grep -o '"git_commit":\s*"[^"]*"' "${META_JSON}" | cut -d'"' -f4 || echo "unknown")
    git_branch=$(grep -o '"git_branch":\s*"[^"]*"' "${META_JSON}" | cut -d'"' -f4 || echo "unknown")
    timestamp=$(grep -o '"timestamp":\s*"[^"]*"' "${META_JSON}" | cut -d'"' -f4 || echo "unknown")
    git_dirty=$(grep -o '"git_dirty":\s*\(true\|false\)' "${META_JSON}" | grep -o 'true\|false' || echo "false")
    
    # Escape JSON special characters in container status text
    local escaped_text
    escaped_text=$(printf '%s' "${container_status_text}" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n')
    escaped_text="${escaped_text%\\n}"
    
    # Update meta.json: remove closing brace, add new fields
    sed -i 's/}$//' "${META_JSON}" 2>/dev/null || sed -i '' 's/}$//' "${META_JSON}"
    cat >> "${META_JSON}" <<EOF
,
  "backend_image": "${backend_image}",
  "frontend_image": "${frontend_image}",
  "containers": "${escaped_text}"
}
EOF
  fi

  # Generate summary.md with deterministic health check results
  local health_results_section
  health_results_section=""
  if [ ${#HEALTH_RESULTS[@]} -gt 0 ]; then
    for result in "${HEALTH_RESULTS[@]}"; do
      if [[ "${result}" =~ ^.*:\ OK ]]; then
        health_results_section="${health_results_section}✅ ${result}\n"
      else
        health_results_section="${health_results_section}❌ ${result}\n"
      fi
    done
  else
    health_results_section="See raw.log for details"
  fi
  
  # Generate summary.md
  cat > "${SUMMARY_MD}" <<EOF
# Staging Deploy & Validate Report

**Timestamp:** ${timestamp}  
**Git Commit:** ${git_commit}  
**Git Branch:** ${git_branch}  
**Git Dirty:** ${git_dirty}

## Container Status

\`\`\`
$(docker compose -f "${COMPOSE_FILE}" ps)
\`\`\`

## Docker Images

- **Backend:** ${backend_image}
- **Frontend:** ${frontend_image}

## Health Check Results

${health_results_section}

## Smoke Test Results

✅ Login: Success  
✅ Onboarding Context: Success

## Warnings

$(grep -i "\[WARN\]" "${RAW_LOG}" 2>/dev/null | head -10 || echo "None")

## Next Actions

$(if grep -qi "restart\|restart required" "${RAW_LOG}" 2>/dev/null; then
  echo "- Container restart may be required"
fi)
$(if [ "${git_dirty}" = "true" ]; then
  echo "- Working directory has uncommitted changes"
fi)

## Evidence Files

- \`raw.log\` - Complete command output
- \`meta.json\` - Metadata (commit, branch, images, etc.)
- \`summary.md\` - This file

---
*Generated by ops/staging-deploy-validate.sh*
EOF

  log_info "Evidence pack generated: ${EVIDENCE_DIR}"
  log_info "  - summary.md"
  log_info "  - raw.log"
  log_info "  - meta.json"
}

# =============================================================================
# Main Execution
# =============================================================================
main() {
  log_info "=== GRC Platform Staging Deploy & Validate ==="
  log_info "Started at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  local start_time
  start_time=$(date +%s)

  # Initialize evidence
  init_evidence

  # Execute steps
  pre_checks
  update_repo
  build_and_up
  preflight_check
  health_checks
  smoke_tests
  generate_evidence

  local end_time duration
  end_time=$(date +%s)
  duration=$((end_time - start_time))

  log_info "=== Deployment Complete ==="
  log_info "Duration: ${duration}s"
  log_info "Evidence: ${EVIDENCE_DIR}"
  log_info "Exit code: 0 (Success)"

  exit 0
}

# Run main
main "$@"


