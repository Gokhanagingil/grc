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
BACKEND_CONTAINER="grc-staging-backend"
FRONTEND_CONTAINER="grc-staging-frontend"
BACKEND_PORT="3002"
EVIDENCE_BASE="${REPO_ROOT}/evidence"
DEMO_TENANT_ID="00000000-0000-0000-0000-000000000001"
STAGING_TENANT_ID="${STAGING_TENANT_ID:-${DEMO_TENANT_ID}}"

# Compose file paths (COMPOSE_ARGS initialized after logging functions)
BASE_COMPOSE="${REPO_ROOT}/docker-compose.staging.yml"
OVERRIDE_COMPOSE="${REPO_ROOT}/_local_ignored/docker-compose.staging.override.yml"
COMPOSE_ARGS=()
HTTPS_MODE=0

# Validate-only mode (for CI regression testing)
# Set VALIDATE_ONLY=1 or DRY_RUN=1 to skip build/start steps
VALIDATE_ONLY="${VALIDATE_ONLY:-${DRY_RUN:-0}}"

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

# =============================================================================
# Initialize Compose Args
# =============================================================================
# Determine docker compose arguments based on environment and override file presence.
# Priority:
#   1. If COMPOSE_FILE env var is set by user, use plain docker compose (respects user's setting)
#   2. If _local_ignored/docker-compose.staging.override.yml exists, use both files (HTTPS mode)
#   3. Otherwise, use only docker-compose.staging.yml (HTTP mode)
#
# This allows automatic HTTPS support when the override file is present on staging.
# =============================================================================
init_compose_args() {
  if [ -n "${COMPOSE_FILE:-}" ]; then
    # User has set COMPOSE_FILE env var - let docker compose use it directly
    log_info "COMPOSE_FILE env var is set (legacy mode), using docker compose defaults"
    log_info "  COMPOSE_FILE=${COMPOSE_FILE}"
    COMPOSE_ARGS=()
    HTTPS_MODE=0
  elif [ -f "${OVERRIDE_COMPOSE}" ]; then
    # Override file exists - use both base and override (HTTPS mode)
    log_info "Found staging override file, enabling HTTPS mode"
    log_info "  Base: ${BASE_COMPOSE}"
    log_info "  Override: ${OVERRIDE_COMPOSE}"
    COMPOSE_ARGS=(-f "${BASE_COMPOSE}" -f "${OVERRIDE_COMPOSE}")
    HTTPS_MODE=1
  else
    # No override - use base file only (HTTP mode)
    log_info "No override file found, using HTTP mode"
    log_info "  Base: ${BASE_COMPOSE}"
    COMPOSE_ARGS=(-f "${BASE_COMPOSE}")
    HTTPS_MODE=0
  fi
  
  # Validate base compose file exists (required in all modes except legacy COMPOSE_FILE)
  if [ -z "${COMPOSE_FILE:-}" ] && [ ! -f "${BASE_COMPOSE}" ]; then
    log_error "Base compose file not found: ${BASE_COMPOSE}"
    exit 2
  fi
}

# =============================================================================
# Docker Compose Helper
# =============================================================================
# Wrapper function for docker compose that applies the correct compose files.
# Usage: dc up -d --build backend frontend
# =============================================================================
dc() {
  docker compose "${COMPOSE_ARGS[@]}" "$@"
}

# =============================================================================
# Load Smoke Test Credentials
# =============================================================================
# Attempts to load credentials from _local_ignored/staging-smoke.env if not already set.
# Returns 0 if credentials are available, 1 if not (smoke tests should be skipped).
# =============================================================================
SMOKE_TESTS_SKIPPED=false
SMOKE_SKIP_REASON=""

load_smoke_credentials() {
  local credentials_file="${REPO_ROOT}/_local_ignored/staging-smoke.env"
  
  # Check if credentials are already set via environment
  if [ -n "${STAGING_ADMIN_EMAIL:-}" ] && [ -n "${STAGING_ADMIN_PASSWORD:-}" ]; then
    log_info "Smoke credentials provided via environment variables"
    return 0
  fi
  
  # Try to load from credentials file
  if [ -f "${credentials_file}" ]; then
    log_info "Loading smoke credentials from ${credentials_file}"
    set -a
    # shellcheck source=/dev/null
    source "${credentials_file}"
    set +a
    
    # Verify credentials were loaded
    if [ -n "${STAGING_ADMIN_EMAIL:-}" ] && [ -n "${STAGING_ADMIN_PASSWORD:-}" ]; then
      log_info "Smoke credentials loaded successfully"
      return 0
    else
      log_warn "Credentials file exists but STAGING_ADMIN_EMAIL/PASSWORD not defined"
      SMOKE_SKIP_REASON="credentials file missing required variables"
      return 1
    fi
  fi
  
  # No credentials available
  log_warn "No smoke credentials available"
  log_warn "  - STAGING_ADMIN_EMAIL/PASSWORD not set in environment"
  log_warn "  - Credentials file not found: ${credentials_file}"
  SMOKE_SKIP_REASON="no credentials (env vars not set, file not found)"
  return 1
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

  # Note: Compose file validation is now done in init_compose_args() which runs before pre_checks()
  # This ensures COMPOSE_FILE is never accessed while unbound under set -u

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
  if ! dc up -d --build backend frontend; then
    log_error "docker compose up failed"
    exit 4
  fi

  # Wait for containers to be running
  sleep 5

  # Get container status
  log_info "Container status:"
  dc ps >> "${RAW_LOG}" 2>&1 || true

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
  preflight_output=$(dc exec -T backend sh -lc "node dist/scripts/check-memory.js" 2>&1 || true)

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
# E.1) Uploads Directory Verification
# =============================================================================
verify_uploads_directory() {
  log_info "=== Uploads Directory Verification ==="

  # Check if /app/data/uploads exists
  log_info "Checking /app/data/uploads directory..."
  local uploads_check
  set +e
  uploads_check=$(docker exec "${BACKEND_CONTAINER}" sh -c 'ls -ld /app/data/uploads 2>&1')
  local uploads_exit_code=$?
  set -e

  echo "UPLOADS ls_check: ${uploads_check}" >> "${RAW_LOG}"

  if [ ${uploads_exit_code} -ne 0 ]; then
    log_error "Uploads directory does not exist: /app/data/uploads"
    log_error "Output: ${uploads_check}"
    echo "UPLOADS directory_exists=false" >> "${RAW_LOG}"
    exit 6
  fi

  log_info "Directory exists: ${uploads_check}"
  echo "UPLOADS directory_exists=true" >> "${RAW_LOG}"

  # Test write access
  log_info "Testing write access to /app/data/uploads..."
  local write_test
  set +e
  write_test=$(docker exec "${BACKEND_CONTAINER}" sh -c 'echo ok > /app/data/uploads/.deploy-write-test && cat /app/data/uploads/.deploy-write-test && rm /app/data/uploads/.deploy-write-test 2>&1')
  local write_exit_code=$?
  set -e

  echo "UPLOADS write_test_output: ${write_test}" >> "${RAW_LOG}"

  if [ ${write_exit_code} -ne 0 ] || [ "${write_test}" != "ok" ]; then
    log_error "Uploads directory is not writable: /app/data/uploads"
    log_error "Write test output: ${write_test}"
    echo "UPLOADS writable=false" >> "${RAW_LOG}"
    exit 6
  fi

  log_info "Write test passed"
  echo "UPLOADS writable=true" >> "${RAW_LOG}"

  # Check if fallback is being used (warning only, not a failure)
  log_info "Checking storage initialization logs..."
  local storage_logs
  set +e
  storage_logs=$(docker logs "${BACKEND_CONTAINER}" 2>&1 | grep -i "storage\|fallback" | tail -5 || echo "")
  set -e

  echo "UPLOADS storage_logs: ${storage_logs}" >> "${RAW_LOG}"

  if echo "${storage_logs}" | grep -qi "fallback"; then
    log_warn "Storage is using fallback path (/tmp/uploads) - this may indicate a volume mount issue"
    log_warn "Check that grc_uploads volume is properly mounted to /app/data/uploads"
    echo "UPLOADS using_fallback=true" >> "${RAW_LOG}"
  else
    log_info "Storage is using primary path (no fallback detected)"
    echo "UPLOADS using_fallback=false" >> "${RAW_LOG}"
  fi

  log_info "Uploads directory verification passed"
}

# =============================================================================
# E.2) SSL/HTTPS Verification (Optional - only when HTTPS override is active)
# =============================================================================
# This verification runs only when the staging HTTPS override is active.
# It checks:
#   1. Frontend container is listening on port 443 (via ss -lnt inside container)
#   2. SSL certificate files exist inside the frontend container
#   3. Nginx configuration is valid (nginx -t)
#   4. HTTPS endpoints respond correctly (when enabled)
#
# This function is non-blocking - it logs warnings but does not fail the deploy
# if HTTPS is not configured (HTTP-only mode is valid for dev/CI).
#
# Global variable set by this function:
#   HTTPS_ENABLED - "true" if HTTPS is active, "false" otherwise
# =============================================================================
HTTPS_ENABLED="false"

verify_ssl_configuration() {
  log_info "=== SSL/HTTPS Configuration Verification ==="

  # Check if frontend is listening on port 443 using ss inside the container
  # This is the most reliable method as it checks from within the container
  log_info "Checking if frontend listens on port 443 (container-based check)..."
  local port_443_check
  set +e
  # Use ss -lnt which is more portable than netstat
  port_443_check=$(dc exec -T frontend sh -lc 'ss -lnt | grep -q ":443 " && echo "listening" || echo ""' 2>&1)
  set -e

  echo "SSL port_443_check: ${port_443_check}" >> "${RAW_LOG}"

  if [ "${port_443_check}" != "listening" ]; then
    log_warn "Frontend is NOT listening on port 443 (HTTPS not enabled)"
    log_warn "This is expected for HTTP-only mode (dev/CI)"
    echo "SSL https_enabled=false" >> "${RAW_LOG}"
    HTTPS_ENABLED="false"
    log_info "SSL verification skipped (HTTP-only mode)"
    return 0
  fi

  log_info "Frontend is listening on port 443 - HTTPS enabled"
  echo "SSL https_enabled=true" >> "${RAW_LOG}"
  HTTPS_ENABLED="true"

  # Check if SSL certificate files exist
  log_info "Checking SSL certificate files..."
  local cert_check key_check
  set +e
  cert_check=$(docker exec "${FRONTEND_CONTAINER}" sh -c 'test -f /etc/nginx/ssl/origin-cert.pem && echo "exists" || echo "missing"' 2>&1)
  key_check=$(docker exec "${FRONTEND_CONTAINER}" sh -c 'test -f /etc/nginx/ssl/origin-key.pem && echo "exists" || echo "missing"' 2>&1)
  set -e

  echo "SSL cert_file: ${cert_check}" >> "${RAW_LOG}"
  echo "SSL key_file: ${key_check}" >> "${RAW_LOG}"

  if [ "${cert_check}" != "exists" ]; then
    log_error "SSL certificate not found: /etc/nginx/ssl/origin-cert.pem"
    echo "SSL cert_exists=false" >> "${RAW_LOG}"
  else
    log_info "SSL certificate found: /etc/nginx/ssl/origin-cert.pem"
    echo "SSL cert_exists=true" >> "${RAW_LOG}"
  fi

  if [ "${key_check}" != "exists" ]; then
    log_error "SSL key not found: /etc/nginx/ssl/origin-key.pem"
    echo "SSL key_exists=false" >> "${RAW_LOG}"
  else
    log_info "SSL key found: /etc/nginx/ssl/origin-key.pem"
    echo "SSL key_exists=true" >> "${RAW_LOG}"
  fi

  # Verify nginx configuration
  log_info "Verifying nginx configuration..."
  local nginx_test
  set +e
  nginx_test=$(docker exec "${FRONTEND_CONTAINER}" nginx -t 2>&1)
  local nginx_exit_code=$?
  set -e

  echo "SSL nginx_test: ${nginx_test}" >> "${RAW_LOG}"

  if [ ${nginx_exit_code} -ne 0 ]; then
    log_error "Nginx configuration test failed"
    log_error "${nginx_test}"
    echo "SSL nginx_config_valid=false" >> "${RAW_LOG}"
  else
    log_info "Nginx configuration is valid"
    echo "SSL nginx_config_valid=true" >> "${RAW_LOG}"
  fi

  # Test HTTPS endpoints (only if certs exist and nginx is valid)
  if [ "${cert_check}" = "exists" ] && [ "${key_check}" = "exists" ] && [ ${nginx_exit_code} -eq 0 ]; then
    log_info "Testing HTTPS endpoints..."
    
    # Test HTTPS root endpoint from inside frontend container
    # Using curl with -k to skip certificate verification (self-signed/origin cert)
    local https_root_test https_api_test
    set +e
    
    # Test https://localhost (frontend)
    log_info "Testing https://localhost..."
    https_root_test=$(docker exec "${FRONTEND_CONTAINER}" sh -c 'curl -sSI https://localhost -k 2>&1 | head -n 5' 2>&1 || echo "curl failed")
    echo "SSL https_root_test:" >> "${RAW_LOG}"
    echo "${https_root_test}" >> "${RAW_LOG}"
    
    if echo "${https_root_test}" | grep -qE "^HTTP.*200|^HTTP.*301|^HTTP.*302"; then
      log_info "HTTPS root endpoint: OK"
      echo "SSL https_root_status=OK" >> "${RAW_LOG}"
    else
      log_warn "HTTPS root endpoint returned unexpected response"
      echo "SSL https_root_status=UNEXPECTED" >> "${RAW_LOG}"
    fi
    
    # Test https://localhost/api/health/ready (backend via nginx proxy)
    log_info "Testing https://localhost/api/health/ready..."
    https_api_test=$(docker exec "${FRONTEND_CONTAINER}" sh -c 'curl -sSI https://localhost/api/health/ready -k 2>&1 | head -n 5' 2>&1 || echo "curl failed")
    echo "SSL https_api_test:" >> "${RAW_LOG}"
    echo "${https_api_test}" >> "${RAW_LOG}"
    
    if echo "${https_api_test}" | grep -qE "^HTTP.*200"; then
      log_info "HTTPS API health endpoint: OK"
      echo "SSL https_api_status=OK" >> "${RAW_LOG}"
    else
      log_warn "HTTPS API health endpoint returned unexpected response"
      echo "SSL https_api_status=UNEXPECTED" >> "${RAW_LOG}"
    fi
    
    set -e
    
    log_info "SSL/HTTPS configuration verification passed"
    echo "SSL verification_status=PASSED" >> "${RAW_LOG}"
  else
    log_warn "SSL/HTTPS configuration has issues - check logs above"
    echo "SSL verification_status=ISSUES" >> "${RAW_LOG}"
  fi
}

# =============================================================================
# F) Smoke Tests
# =============================================================================

# Retry helper function with exponential backoff
# Usage: retry max_attempts initial_sleep_seconds "function_name" "test_name" [args...]
# Returns: last exit code from function
# Note: Functions should set RETRY_SHOULD_SKIP=1 if retry should be skipped (e.g., 4xx errors)
#       Functions should set RETRY_HTTP_CODE with the HTTP status code
retry() {
  local max_attempts="$1"
  local initial_sleep="$2"
  local func_name="$3"
  local test_name="$4"
  shift 4
  local func_args=("$@")
  local attempt=1
  local current_sleep="${initial_sleep}"
  local last_exit_code=1
  local http_code="000"
  
  while [ ${attempt} -le ${max_attempts} ]; do
    # Reset skip flag and HTTP code
    RETRY_SHOULD_SKIP=0
    RETRY_HTTP_CODE="000"
    
    # Call function with attempt number as first argument
    if "${func_name}" ${attempt} "${func_args[@]}"; then
      http_code="${RETRY_HTTP_CODE:-200}"
      echo "SMOKE ${test_name} attempt=${attempt} http=${http_code} retry=NO reason=success" >> "${RAW_LOG}"
      return 0
    fi
    last_exit_code=$?
    http_code="${RETRY_HTTP_CODE:-000}"
    
    # Check if retry should be skipped (e.g., 4xx client errors)
    if [ "${RETRY_SHOULD_SKIP:-0}" = "1" ]; then
      echo "SMOKE ${test_name} attempt=${attempt} http=${http_code} retry=NO reason=client_error_4xx" >> "${RAW_LOG}"
      return ${last_exit_code}
    fi
    
    # Determine retry decision
    local retry_decision="YES"
    local retry_reason="retryable_error"
    if [ ${attempt} -ge ${max_attempts} ]; then
      retry_decision="NO"
      retry_reason="max_attempts_reached"
    fi
    
    echo "SMOKE ${test_name} attempt=${attempt} http=${http_code} retry=${retry_decision} reason=${retry_reason}" >> "${RAW_LOG}"
    
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
# Sets: RETRY_HTTP_CODE with HTTP status code
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
        process.stderr.write("HTTP_408\n");
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
  RETRY_HTTP_CODE="${login_http_code}"
  
  # Extract response body (between BODY_START and BODY_END)
  if echo "${login_status}" | grep -q "BODY_START"; then
    login_response_body=$(echo "${login_status}" | sed -n '/BODY_START/,/BODY_END/p' | sed '1d;$d' | head -c 2048 || echo "")
  fi
  
  # Check login status
  if echo "${login_status}" | grep -q "LOGIN_OK"; then
    # Extract token from container file (not logged) and set in parent scope
    login_token=$(docker exec "${BACKEND_CONTAINER}" cat "${token_file_in_container}" 2>/dev/null || echo "")
    
    if [ -n "${login_token}" ]; then
      RETRY_HTTP_CODE="200"
      return 0
    fi
  fi
  
  # Determine retry policy based on HTTP status code:
  # 400/401/403/404 => client error (no retry)
  # 429 => rate limit (retryable)
  # 408/5xx => server error/timeout (retryable)
  # 000 => network error (retryable)
  local is_client_error=false
  if [ "${login_http_code}" = "400" ] || [ "${login_http_code}" = "401" ] || [ "${login_http_code}" = "403" ] || [ "${login_http_code}" = "404" ]; then
    # Specifically 400, 401, 403, 404 are client errors (no retry)
    is_client_error=true
    RETRY_SHOULD_SKIP=1
  elif [ "${login_http_code}" = "429" ]; then
    # Rate limit - retryable
    is_client_error=false
    RETRY_SHOULD_SKIP=0
  elif [[ "${login_http_code}" =~ ^[5][0-9]{2}$ ]] || [ "${login_http_code}" = "408" ] || [ "${login_http_code}" = "000" ]; then
    # Server errors, timeout, network errors - retryable
    is_client_error=false
    RETRY_SHOULD_SKIP=0
  elif [[ "${login_http_code}" =~ ^[4][0-9]{2}$ ]]; then
    # Other 4xx - treat as client error (no retry)
    is_client_error=true
    RETRY_SHOULD_SKIP=1
  else
    # Unknown - retryable by default
    is_client_error=false
    RETRY_SHOULD_SKIP=0
  fi
  
  # Sanitize and log response body (always sanitize before logging)
  local sanitized_body=""
  if [ -n "${login_response_body}" ]; then
    sanitized_body=$(sanitize_response_body "${login_response_body}")
    sanitized_body=$(truncate_text "${sanitized_body}" 500)  # Max 500 chars for console
  fi
  
  # Always log sanitized response body to raw.log (full sanitized version)
  if [ -n "${login_response_body}" ]; then
    local sanitized_body_full
    sanitized_body_full=$(sanitize_response_body "${login_response_body}")
    sanitized_body_full=$(truncate_text "${sanitized_body_full}" 2048)
    echo "SMOKE login response_body=<${sanitized_body_full}>" >> "${RAW_LOG}"
  fi
  
  # Log to console with appropriate level
  if [ "${is_client_error}" = "true" ]; then
    log_error "Login attempt ${attempt} failed with HTTP ${login_http_code} (client error - no retry)"
    if [ -n "${sanitized_body}" ]; then
      log_error "Response: ${sanitized_body}"
    fi
  else
    if [ ${attempt} -lt 3 ]; then
      local backoff_seconds=$((2 ** (attempt - 1)))
      log_warn "Login attempt ${attempt}/3 failed (HTTP ${login_http_code}), retrying in ${backoff_seconds}s..."
      if [ -n "${sanitized_body}" ]; then
        log_warn "Response: ${sanitized_body}"
      fi
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
# Sets: RETRY_HTTP_CODE with HTTP status code
# Sets: RETRY_SHOULD_SKIP=1 if 4xx error (should not retry)
# Returns: 0 on success, 1 on failure
_context_test() {
  local attempt="$1"
  local context_status context_http_code context_response_body
  context_status=""
  context_http_code="000"
  context_response_body=""
  
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
                process.stderr.write("BODY_START\n");
                process.stderr.write(body.substring(0, 2048) + "\n");
                process.stderr.write("BODY_END\n");
                process.exit(1);
              }
            } catch (e) {
              console.error("ERROR: Invalid JSON (HTTP 200)");
              process.stderr.write("HTTP_" + res.statusCode + "\n");
              process.stderr.write("BODY_START\n");
              process.stderr.write(body.substring(0, 2048) + "\n");
              process.stderr.write("BODY_END\n");
              process.exit(1);
            }
          } else {
            console.error("ERROR: HTTP " + res.statusCode);
            process.stderr.write("HTTP_" + res.statusCode + "\n");
            process.stderr.write("BODY_START\n");
            process.stderr.write(body.substring(0, 2048) + "\n");
            process.stderr.write("BODY_END\n");
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
        process.stderr.write("HTTP_408\n");
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
  RETRY_HTTP_CODE="${context_http_code}"
  
  # Extract response body (between BODY_START and BODY_END)
  if echo "${context_status}" | grep -q "BODY_START"; then
    context_response_body=$(echo "${context_status}" | sed -n '/BODY_START/,/BODY_END/p' | sed '1d;$d' | head -c 2048 || echo "")
  fi
  
  if echo "${context_status}" | grep -q "^OK$"; then
    RETRY_HTTP_CODE="200"
    return 0
  fi
  
  # Determine retry policy based on HTTP status code:
  # 400/401/403/404 => client error (no retry)
  # 429 => rate limit (retryable)
  # 408/5xx => server error/timeout (retryable)
  # 000 => network error (retryable)
  local is_client_error=false
  if [ "${context_http_code}" = "400" ] || [ "${context_http_code}" = "401" ] || [ "${context_http_code}" = "403" ] || [ "${context_http_code}" = "404" ]; then
    # Specifically 400, 401, 403, 404 are client errors
    is_client_error=true
    RETRY_SHOULD_SKIP=1
  elif [ "${context_http_code}" = "429" ]; then
    # Rate limit - retryable
    is_client_error=false
    RETRY_SHOULD_SKIP=0
  elif [[ "${context_http_code}" =~ ^[5][0-9]{2}$ ]] || [ "${context_http_code}" = "408" ] || [ "${context_http_code}" = "000" ]; then
    # Server errors, timeout, network errors - retryable
    is_client_error=false
    RETRY_SHOULD_SKIP=0
  elif [[ "${context_http_code}" =~ ^[4][0-9]{2}$ ]]; then
    # Other 4xx - treat as client error (no retry)
    is_client_error=true
    RETRY_SHOULD_SKIP=1
  else
    # Unknown - retryable by default
    is_client_error=false
    RETRY_SHOULD_SKIP=0
  fi
  
  # Sanitize and log response body (always sanitize before logging)
  local sanitized_body=""
  if [ -n "${context_response_body}" ]; then
    sanitized_body=$(sanitize_response_body "${context_response_body}")
    sanitized_body=$(truncate_text "${sanitized_body}" 500)  # Max 500 chars for console
  fi
  
  # Always log sanitized response body to raw.log (full sanitized version)
  if [ -n "${context_response_body}" ]; then
    local sanitized_body_full
    sanitized_body_full=$(sanitize_response_body "${context_response_body}")
    sanitized_body_full=$(truncate_text "${sanitized_body_full}" 2048)
    echo "SMOKE context response_body=<${sanitized_body_full}>" >> "${RAW_LOG}"
  fi
  
  # Log to console with appropriate level
  if [ "${is_client_error}" = "true" ]; then
    log_error "Context test attempt ${attempt} failed with HTTP ${context_http_code} (client error - no retry)"
    if [ -n "${sanitized_body}" ]; then
      log_error "Response: ${sanitized_body}"
    fi
  else
    if [ ${attempt} -lt 3 ]; then
      local backoff_seconds=$((2 ** (attempt - 1)))
      log_warn "Context test attempt ${attempt}/3 failed (HTTP ${context_http_code}), retrying in ${backoff_seconds}s..."
      if [ -n "${sanitized_body}" ]; then
        log_warn "Response: ${sanitized_body}"
      fi
    else
      log_error "Context test attempt ${attempt} failed with HTTP ${context_http_code}"
      if [ -n "${sanitized_body}" ]; then
        log_error "Response: ${sanitized_body}"
      fi
    fi
  fi
  
  return 1
}

smoke_tests() {
  log_info "=== Smoke Tests ==="

  # Try to load credentials from environment or file
  if ! load_smoke_credentials; then
    log_warn "Smoke tests SKIPPED: ${SMOKE_SKIP_REASON}"
    echo "SMOKE tests_skipped=true reason=\"${SMOKE_SKIP_REASON}\"" >> "${RAW_LOG}"
    SMOKE_TESTS_SKIPPED=true
    return 0
  fi

  # Credential guard: validate password is not placeholder/too short
  local password_len="${#STAGING_ADMIN_PASSWORD}"
  if [ "${password_len}" -lt 8 ] || [ "${STAGING_ADMIN_PASSWORD}" = "***" ] || [ "${STAGING_ADMIN_PASSWORD}" = "********" ]; then
    log_error "Credential seems placeholder/too short; aborting smoke test to avoid misleading retries."
    log_error "Password length: ${password_len} (minimum 8 required, and must not be placeholder)"
    echo "SMOKE credential_guard result=FAILED reason=password_too_short_or_placeholder" >> "${RAW_LOG}"
    exit 7
  fi

  # Credential guard: validate email format (basic check: contains @ and .)
  if ! echo "${STAGING_ADMIN_EMAIL}" | grep -qE '[^@]+@[^@]+\.[^@]+'; then
    log_error "Credential guard failed: email format invalid (must contain @ and .)"
    echo "SMOKE credential_guard result=FAILED reason=invalid_email_format" >> "${RAW_LOG}"
    exit 7
  fi

  log_info "Credential guard passed (password length: ${password_len}, email format: valid)"
  echo "SMOKE credential_guard result=OK" >> "${RAW_LOG}"

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
  if ! retry 3 2 _login_test "login"; then
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
  if ! retry 3 2 _context_test "context"; then
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
  # Check for JWT tokens (eyJ...), Bearer tokens, and accessToken/token fields with long values
  if grep -qE "eyJ[a-zA-Z0-9_-]{10,}\.|Bearer [A-Za-z0-9._-]{10,}|\"accessToken\"\s*:\s*\"[^\"]{20,}\"|\"token\"\s*:\s*\"[^\"]{20,}\"" "${RAW_LOG}" 2>/dev/null; then
    log_error "Evidence integrity check FAILED: Token-like patterns detected in raw.log"
    log_error "This indicates a security issue - tokens must never appear in logs"
    set -e
    exit 8
  fi
  set -e
  log_info "Evidence integrity check passed (no token patterns detected)"

  # Get container status as text (store as string - avoid forcing JSON parsing across compose versions)
  local container_status_text
  container_status_text=$(dc ps 2>&1 || echo "")

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
$(dc ps)
\`\`\`

## Docker Images

- **Backend:** ${backend_image}
- **Frontend:** ${frontend_image}

## Health Check Results

${health_results_section}

## Smoke Test Results

$(if [ "${SMOKE_TESTS_SKIPPED}" = "true" ]; then
  echo "⚠️ Smoke tests SKIPPED: ${SMOKE_SKIP_REASON}"
else
  echo "✅ Login: Success"
  echo "✅ Onboarding Context: Success"
fi)

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

  # Initialize compose args (determines HTTP vs HTTPS mode)
  # This MUST run before any other steps to avoid COMPOSE_FILE unbound errors
  init_compose_args

  # Handle VALIDATE_ONLY mode (for CI regression testing)
  if [ "${VALIDATE_ONLY}" = "1" ]; then
    log_info "=== VALIDATE_ONLY mode enabled ==="
    log_info "Skipping build/start steps, running pre-checks and compose arg validation only"
    log_info ""
    log_info "Compose configuration:"
    log_info "  HTTPS_MODE: ${HTTPS_MODE}"
    log_info "  BASE_COMPOSE: ${BASE_COMPOSE}"
    log_info "  OVERRIDE_COMPOSE: ${OVERRIDE_COMPOSE}"
    log_info "  COMPOSE_ARGS: ${COMPOSE_ARGS[*]:-<empty - using COMPOSE_FILE env var>}"
    log_info "  COMPOSE_FILE: ${COMPOSE_FILE:-<not set>}"
    log_info ""
    
    # Run minimal pre-checks (OS, git, docker availability)
    log_info "=== Pre-checks (validate-only mode) ==="
    
    # Check OS (must be Linux)
    if [[ "$(uname)" != "Linux" ]]; then
      log_error "This script must run on Linux (detected: $(uname))"
      exit 2
    fi
    log_info "OS check: Linux"
    
    # Check docker
    if ! command -v docker &> /dev/null; then
      log_error "docker command not found"
      exit 2
    fi
    log_info "Docker check: available"
    
    # Check docker compose
    if ! docker compose version &> /dev/null; then
      log_error "docker compose command not found"
      exit 2
    fi
    log_info "Docker Compose check: available"
    
    # Verify compose files exist (if not using COMPOSE_FILE env var)
    if [ -z "${COMPOSE_FILE:-}" ]; then
      if [ ! -f "${BASE_COMPOSE}" ]; then
        log_error "Base compose file not found: ${BASE_COMPOSE}"
        exit 2
      fi
      log_info "Base compose file: exists"
      
      if [ -f "${OVERRIDE_COMPOSE}" ]; then
        log_info "Override compose file: exists (HTTPS mode)"
      else
        log_info "Override compose file: not found (HTTP mode)"
      fi
    else
      log_info "Using COMPOSE_FILE env var (legacy mode)"
    fi
    
    log_info ""
    log_info "=== VALIDATE_ONLY completed successfully ==="
    log_info "Compose arg resolution works correctly."
    exit 0
  fi

  # Initialize evidence
  init_evidence

  # Execute steps
  pre_checks
  update_repo
  build_and_up
  preflight_check
  health_checks
  verify_uploads_directory
  verify_ssl_configuration
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


