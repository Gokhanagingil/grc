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
       node -e \"const http=require('http');const r=http.get('http://localhost:${BACKEND_PORT}/health/ready',{timeout:5000},(res)=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1));r.on('timeout',()=>{r.destroy();process.exit(1)});\" 2>/dev/null"; then
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

    local response_body response_code health_status
    # Use consistent timeout: connect timeout 5s, max time 10s
    response_code=$(docker exec "${BACKEND_CONTAINER}" sh -c \
      "if command -v curl >/dev/null 2>&1; then \
         curl -sf -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 10 http://localhost:${BACKEND_PORT}${endpoint} 2>/dev/null || echo '000'; \
       elif command -v wget >/dev/null 2>&1; then \
         wget -q --spider --timeout=10 --tries=1 http://localhost:${BACKEND_PORT}${endpoint} 2>/dev/null && echo '200' || echo '000'; \
       else \
         node - <<'NODE'
           const http = require('http');
           const options = {
             hostname: 'localhost',
             port: ${BACKEND_PORT},
             path: '${endpoint}',
             method: 'GET',
             timeout: 10000
           };
           const req = http.request(options, (res) => {
             process.exit(res.statusCode === 200 ? 0 : 1);
           });
           req.on('error', () => { process.exit(1); });
           req.on('timeout', () => { req.destroy(); process.exit(1); });
           req.setTimeout(10000);
           req.end();
         NODE
         [ \$? -eq 0 ] && echo '200' || echo '000'
       fi" 2>&1 || echo "000")

    # Get response body only if status code is 200
    if [ "${response_code}" = "200" ]; then
      response_body=$(docker exec "${BACKEND_CONTAINER}" sh -c \
        "if command -v curl >/dev/null 2>&1; then \
           curl -sf --connect-timeout 5 --max-time 10 http://localhost:${BACKEND_PORT}${endpoint} 2>/dev/null || echo ''; \
         elif command -v wget >/dev/null 2>&1; then \
           wget -qO- --timeout=10 http://localhost:${BACKEND_PORT}${endpoint} 2>/dev/null || echo ''; \
         else \
           node - <<'NODE'
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
                 if (res.statusCode === 200) {
                   console.log(body);
                   process.exit(0);
                 } else {
                   process.exit(1);
                 }
               });
             });
             req.on('error', () => { process.exit(1); });
             req.on('timeout', () => { req.destroy(); process.exit(1); });
             req.setTimeout(10000);
             req.end();
           NODE
         fi" 2>&1 || echo "")
    else
      response_body=""
    fi

    # Determine health status: HTTP 200 is primary success criterion
    if [ "${response_code}" = "200" ]; then
      # If body is parseable, check status field (optional additional validation)
      if [ -n "${response_body}" ]; then
        local status_field
        status_field=$(echo "${response_body}" | grep -ioE '"status":\s*"(ok|healthy)"' || echo "")
        # HTTP 200 + valid body = OK (status field check is just extra info)
        health_status="OK"
        HEALTH_RESULTS+=("${endpoint}: OK")
        log_info "${endpoint}: OK (HTTP 200)"
      else
        # HTTP 200 but empty body - still OK for health check
        health_status="OK"
        HEALTH_RESULTS+=("${endpoint}: OK")
        log_info "${endpoint}: OK (HTTP 200, empty body)"
      fi
    else
      # Non-200 or error = FAILED
      health_status="FAILED"
      all_healthy=false
      HEALTH_RESULTS+=("${endpoint}: FAILED (HTTP ${response_code})")
      log_error "Health check failed for ${endpoint} (HTTP ${response_code})"
    fi

    # Store response to raw.log (truncated if needed, but not on failure)
    if [ "${response_code}" = "200" ] && [ -n "${response_body}" ]; then
      local truncated_body
      truncated_body=$(truncate_text "${response_body}" 2048)
      echo "=== ${endpoint} (HTTP ${response_code}) ===" >> "${RAW_LOG}"
      echo "${truncated_body}" >> "${RAW_LOG}"
      echo "" >> "${RAW_LOG}"
    else
      echo "=== ${endpoint} (HTTP ${response_code}) ===" >> "${RAW_LOG}"
      echo "[No response body or error]" >> "${RAW_LOG}"
      echo "" >> "${RAW_LOG}"
    fi
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
smoke_tests() {
  log_info "=== Smoke Tests ==="

  # Check environment variables
  if [ -z "${STAGING_ADMIN_EMAIL:-}" ] || [ -z "${STAGING_ADMIN_PASSWORD:-}" ]; then
    log_error "STAGING_ADMIN_EMAIL and STAGING_ADMIN_PASSWORD must be set"
    exit 7
  fi

  # Login test
  log_info "Testing login..."
  local login_response login_token
  login_response=$(docker exec -e ADMIN_EMAIL="${STAGING_ADMIN_EMAIL}" \
    -e ADMIN_PASSWORD="${STAGING_ADMIN_PASSWORD}" \
    "${BACKEND_CONTAINER}" sh -c \
    'node - <<NODE
      const http = require("http");
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
              if (json.accessToken || (json.data && json.data.accessToken)) {
                const token = json.accessToken || json.data.accessToken;
                console.log("TOKEN_OK:" + token);
                process.exit(0);
              } else {
                console.error("ERROR: No accessToken in response");
                process.exit(1);
              }
            } catch (e) {
              console.error("ERROR: Invalid JSON response");
              process.exit(1);
            }
          } else {
            console.error("ERROR: Login failed with status " + res.statusCode);
            process.exit(1);
          }
        });
      });
      req.on("error", (e) => {
        console.error("ERROR: Request error");
        process.exit(1);
      });
      req.on("timeout", () => {
        req.destroy();
        console.error("ERROR: Request timeout");
        process.exit(1);
      });
      req.write(data);
      req.end();
NODE
' 2>&1 || echo "ERROR")

  if [[ ! "${login_response}" =~ ^TOKEN_OK: ]]; then
    local error_msg
    if [[ "${login_response}" =~ ^ERROR: ]]; then
      error_msg="${login_response#ERROR: }"
    else
      error_msg="Login request failed"
    fi
    log_error "Login test failed: ${error_msg}"
    exit 7
  fi

  # Extract token by removing TOKEN_OK: prefix (never log the token itself)
  login_token="${login_response#TOKEN_OK:}"
  log_info "Login successful (token obtained, not logged)"

  # Test onboarding/context endpoint (requires x-tenant-id header)
  log_info "Testing /onboarding/context with tenant ID: ${STAGING_TENANT_ID}..."
  local context_response context_status
  context_status=$(docker exec "${BACKEND_CONTAINER}" sh -c \
    "node - <<NODE
      const http = require('http');
      const token = '${login_token}';
      const tenantId = '${STAGING_TENANT_ID}';
      const options = {
        hostname: 'localhost',
        port: ${BACKEND_PORT},
        path: '/onboarding/context',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'x-tenant-id': tenantId
        },
        timeout: 10000
      };
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(body);
              // Check if response has context (with or without data envelope)
              const context = json.context || (json.data && json.data.context);
              if (context) {
                console.log('OK');
                process.exit(0);
              } else {
                console.error('ERROR: No context in response (HTTP 200)');
                process.exit(1);
              }
            } catch (e) {
              console.error('ERROR: Invalid JSON (HTTP 200)');
              process.exit(1);
            }
          } else {
            console.error('ERROR: HTTP ' + res.statusCode);
            process.exit(1);
          }
        });
      });
      req.on('error', (e) => {
        console.error('ERROR: Request error');
        process.exit(1);
      });
      req.on('timeout', () => {
        req.destroy();
        console.error('ERROR: Request timeout');
        process.exit(1);
      });
      req.end();
NODE
" 2>&1 || echo "ERROR")

  if [ "${context_status}" != "OK" ]; then
    local error_msg
    if [[ "${context_status}" =~ ^ERROR: ]]; then
      error_msg="${context_status#ERROR: }"
    else
      error_msg="Context request failed"
    fi
    log_error "Onboarding context test failed: ${error_msg}"
    exit 7
  fi

  log_info "All smoke tests passed"
}

# =============================================================================
# G) Evidence Pack
# =============================================================================
generate_evidence() {
  log_info "=== Generating Evidence Pack ==="

  # Get container status with JSON validation
  local container_status container_json_valid container_text_output
  container_text_output=""
  container_status=$(docker compose -f "${COMPOSE_FILE}" ps --format json 2>&1 || echo "")
  
  # Validate JSON format
  container_json_valid=false
  if [ -n "${container_status}" ]; then
    # Try to validate with jq if available
    if command -v jq &> /dev/null; then
      if echo "${container_status}" | jq empty 2>/dev/null; then
        container_json_valid=true
      fi
    else
      # Basic validation: check if it looks like JSON array (starts with [)
      if [[ "${container_status}" =~ ^\[ ]]; then
        # Additional check: ends with ] and passes basic syntax check
        if [[ "${container_status}" =~ \]$ ]]; then
          container_json_valid=true
        fi
      fi
    fi
  fi
  
  # If invalid JSON, get text output as fallback and set containers to empty array
  if [ "${container_json_valid}" = "false" ]; then
    container_text_output=$(docker compose -f "${COMPOSE_FILE}" ps 2>&1 || echo "")
    container_status="[]"
  fi

  # Get docker image IDs
  local backend_image frontend_image
  backend_image=$(docker inspect "${BACKEND_CONTAINER}" --format '{{.Image}}' 2>/dev/null || echo "unknown")
  frontend_image=$(docker inspect "${FRONTEND_CONTAINER}" --format '{{.Image}}' 2>/dev/null || echo "unknown")

  # Read metadata (with fallback if jq not available)
  local git_commit git_branch timestamp git_dirty
  if command -v jq &> /dev/null; then
    git_commit=$(jq -r '.git_commit' "${META_JSON}" 2>/dev/null || echo "unknown")
    git_branch=$(jq -r '.git_branch' "${META_JSON}" 2>/dev/null || echo "unknown")
    timestamp=$(jq -r '.timestamp' "${META_JSON}" 2>/dev/null || echo "unknown")
    git_dirty=$(jq -r '.git_dirty' "${META_JSON}" 2>/dev/null || echo "false")
    
    # Parse container_status as JSON array using --argjson
    local containers_json
    if [ "${container_json_valid}" = "true" ]; then
      # Use --argjson to properly parse JSON array
      jq --arg backend_img "${backend_image}" \
         --arg frontend_img "${frontend_image}" \
         --argjson containers "${container_status}" \
         '. + {
           backend_image: $backend_img,
           frontend_image: $frontend_img,
           containers: $containers
         }' "${META_JSON}" > "${META_JSON}.tmp" && mv "${META_JSON}.tmp" "${META_JSON}"
      
      # If text fallback exists, add it as containers_text
      if [ -n "${container_text_output}" ]; then
        jq --arg containers_text "${container_text_output}" \
           '. + {containers_text: $containers_text}' "${META_JSON}" > "${META_JSON}.tmp" && mv "${META_JSON}.tmp" "${META_JSON}"
      fi
    else
      # Invalid JSON, use empty array
      jq --arg backend_img "${backend_image}" \
         --arg frontend_img "${frontend_image}" \
         --argjson containers "[]" \
         '. + {
           backend_image: $backend_img,
           frontend_image: $frontend_img,
           containers: $containers
         }' "${META_JSON}" > "${META_JSON}.tmp" && mv "${META_JSON}.tmp" "${META_JSON}"
      
      # Add text output as containers_text if available
      if [ -n "${container_text_output}" ]; then
        jq --arg containers_text "${container_text_output}" \
           '. + {containers_text: $containers_text}' "${META_JSON}" > "${META_JSON}.tmp" && mv "${META_JSON}.tmp" "${META_JSON}"
      fi
    fi
  else
    # Fallback: parse JSON manually (basic)
    git_commit=$(grep -o '"git_commit":\s*"[^"]*"' "${META_JSON}" | cut -d'"' -f4 || echo "unknown")
    git_branch=$(grep -o '"git_branch":\s*"[^"]*"' "${META_JSON}" | cut -d'"' -f4 || echo "unknown")
    timestamp=$(grep -o '"timestamp":\s*"[^"]*"' "${META_JSON}" | cut -d'"' -f4 || echo "unknown")
    git_dirty=$(grep -o '"git_dirty":\s*\(true\|false\)' "${META_JSON}" | grep -o 'true\|false' || echo "false")
    
    # Update meta.json with additional info (remove closing brace, add new fields)
    # Use safe JSON: if container_status is invalid, use []
    local safe_containers_json
    if [ "${container_json_valid}" = "true" ]; then
      safe_containers_json="${container_status}"
    else
      safe_containers_json="[]"
    fi
    
    # If docker compose ps --format json failed, add containers_text field
    local container_text_field
    container_text_field=""
    if [ -n "${container_text_output}" ]; then
      # Escape JSON special characters in text output (escape backslashes first, then quotes, newlines)
      local escaped_text
      escaped_text=$(echo "${container_text_output}" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n')
      # Remove trailing \n
      escaped_text="${escaped_text%\\n}"
      container_text_field=",\n  \"containers_text\": \"${escaped_text}\""
    fi
    
    sed -i 's/}$//' "${META_JSON}" 2>/dev/null || sed -i '' 's/}$//' "${META_JSON}"
    cat >> "${META_JSON}" <<EOF
,
  "backend_image": "${backend_image}",
  "frontend_image": "${frontend_image}",
  "containers": ${safe_containers_json}${container_text_field}
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

