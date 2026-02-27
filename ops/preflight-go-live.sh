#!/usr/bin/env bash
# =============================================================================
# GRC Platform — Go-Live Preflight Check
# =============================================================================
# Run this script on the app host BEFORE cutting over DNS / LB to production.
# It validates that the environment is safe to receive live traffic.
#
# Usage:
#   bash ops/preflight-go-live.sh                     # default compose file
#   COMPOSE_FILE=docker-compose.staging.yml bash ops/preflight-go-live.sh
#
# The script checks health via nginx (port 80) by default.
# Override NGINX_URL or BACKEND_URL if your setup differs.
#
# Exit codes:
#   0 = all checks passed (GO)
#   1 = one or more checks failed (NO-GO)
#
# This script NEVER prints secrets. Safe to include in support bundles.
# =============================================================================
set -uo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-grc-staging-backend}"
BACKEND_URL="${BACKEND_URL:-http://localhost}"
PASS=0
FAIL=0
WARN=0

# ─── Helpers ──────────────────────────────────────────────────────────────────
pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }
section() { echo ""; echo "=== $1 ==="; }

# ─── 1. DB_SYNC must be false ────────────────────────────────────────────────
section "1. DB_SYNC Safety Check"
DB_SYNC_VAL=$(docker inspect "$BACKEND_CONTAINER" --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^DB_SYNC=' | cut -d= -f2)
if [ -z "$DB_SYNC_VAL" ]; then
  warn "Could not read DB_SYNC from container env (container may not be running)"
elif [ "$DB_SYNC_VAL" = "false" ]; then
  pass "DB_SYNC=false (migrations-only mode)"
else
  fail "DB_SYNC=${DB_SYNC_VAL} — MUST be 'false' in production!"
fi

# ─── 2. DB_HOST reachability ─────────────────────────────────────────────────
section "2. Database Host Reachability"
DB_HOST_VAL=$(docker inspect "$BACKEND_CONTAINER" --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^DB_HOST=' | cut -d= -f2)
if [ -z "$DB_HOST_VAL" ]; then
  warn "Could not read DB_HOST from container env"
else
  echo "  DB_HOST=${DB_HOST_VAL}"
  # Try to reach DB port from the host (or within the Docker network)
  if docker compose -f "$COMPOSE_FILE" exec -T backend sh -c "wget -q -O /dev/null --spider --timeout=5 http://${DB_HOST_VAL}:5432 2>&1 || nc -z -w5 ${DB_HOST_VAL} 5432 2>/dev/null" 2>/dev/null; then
    pass "DB host ${DB_HOST_VAL}:5432 is reachable from backend container"
  else
    # pg_isready is more reliable for postgres
    if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -h localhost -U postgres -q 2>/dev/null; then
      pass "DB service is healthy (via pg_isready)"
    else
      fail "Cannot reach DB host ${DB_HOST_VAL}:5432 from backend container"
    fi
  fi
fi

# ─── 3. Pending Migrations ───────────────────────────────────────────────────
section "3. Migration Status"
MIGRATION_OUTPUT=$(docker compose -f "$COMPOSE_FILE" exec -T backend sh -c 'npx typeorm migration:show -d dist/data-source.js 2>&1' 2>/dev/null || echo "ERROR")
if echo "$MIGRATION_OUTPUT" | grep -q "ERROR\|Cannot find"; then
  fail "Could not run migration:show — $MIGRATION_OUTPUT"
else
  PENDING_COUNT=$(echo "$MIGRATION_OUTPUT" | grep -c '\[ \]' || true)
  EXECUTED_COUNT=$(echo "$MIGRATION_OUTPUT" | grep -c '\[X\]' || true)
  echo "  Executed: ${EXECUTED_COUNT}, Pending: ${PENDING_COUNT}"
  if [ "$PENDING_COUNT" -gt 0 ]; then
    fail "There are ${PENDING_COUNT} pending migration(s) — run migration:run:prod first!"
    echo "$MIGRATION_OUTPUT" | grep '\[ \]' | head -5
  else
    pass "All migrations are applied (${EXECUTED_COUNT} total)"
  fi
fi

# ─── 4. Health Endpoints ─────────────────────────────────────────────────────
section "4. Health Endpoints"

check_health() {
  local name="$1"
  local url="$2"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "200" ]; then
    pass "${name} -> 200 OK"
  else
    fail "${name} -> ${status} (expected 200)"
  fi
}

# Check health via nginx (the only publicly exposed entry point)
NGINX_URL="${NGINX_URL:-${BACKEND_URL}}"
check_health "/health/live" "${NGINX_URL}/health/live"
check_health "/health/ready" "${NGINX_URL}/health/ready"
check_health "/health/db" "${NGINX_URL}/health/db"
check_health "/frontend-health" "${NGINX_URL}/frontend-health"

# ─── 5. Build / Version Info ─────────────────────────────────────────────────
section "5. Build & Version Info"
for VAR in GIT_COMMIT_SHA GIT_COMMIT_SHORT BUILD_TIMESTAMP NODE_ENV; do
  VAL=$(docker inspect "$BACKEND_CONTAINER" --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep "^${VAR}=" | cut -d= -f2)
  echo "  ${VAR}=${VAL:-<not set>}"
done

# ─── 6. Env Sanity (non-secret) ──────────────────────────────────────────────
section "6. Environment Sanity (non-secret values only)"
for VAR in NODE_ENV DB_SYNC DB_HOST DB_PORT DB_NAME CORS_ORIGINS ENABLE_DEMO_BOOTSTRAP; do
  VAL=$(docker inspect "$BACKEND_CONTAINER" --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep "^${VAR}=" | cut -d= -f2)
  echo "  ${VAR}=${VAL:-<not set>}"
done

# Check that secrets are SET (not their values)
for VAR in JWT_SECRET REFRESH_TOKEN_SECRET DB_PASSWORD; do
  VAL=$(docker inspect "$BACKEND_CONTAINER" --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep "^${VAR}=" | cut -d= -f2)
  if [ -z "$VAL" ]; then
    fail "${VAR} is NOT SET"
  elif [ ${#VAL} -lt 16 ]; then
    warn "${VAR} is set but looks short (${#VAL} chars) — ensure it's a strong secret"
  else
    pass "${VAR} is set (${#VAL} chars, value redacted)"
  fi
done

# ─── 7. Container Status ─────────────────────────────────────────────────────
section "7. Container Status"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || warn "Could not get container status"

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
echo "  PREFLIGHT SUMMARY"
echo "============================================="
echo "  Passed:   ${PASS}"
echo "  Failed:   ${FAIL}"
echo "  Warnings: ${WARN}"
echo "============================================="

if [ $FAIL -gt 0 ]; then
  echo "  VERDICT: ❌ NO-GO — Fix failures before go-live"
  echo "============================================="
  exit 1
else
  echo "  VERDICT: GO — All critical checks passed"
  if [ $WARN -gt 0 ]; then
    echo "  (${WARN} warning(s) — review before cutover)"
  fi
  echo "============================================="
  exit 0
fi
