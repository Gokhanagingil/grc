#!/usr/bin/env bash
# =============================================================================
# GRC Platform — Nginx /api Routing Regression Check
# =============================================================================
# Validates that nginx correctly proxies /api/* requests to the backend
# and that the backend returns proper auth errors (401), not 404.
#
# A 404 response means the route was not found, indicating:
#   - nginx is not proxying /api/* correctly, OR
#   - proxy_pass is missing the trailing slash, OR
#   - backend route does not exist
#
# Usage:
#   bash ops/tests/test-nginx-api-routing.sh [BASE_URL]
#   Default BASE_URL: http://localhost
#
# Expected results (unauthenticated):
#   /api/grc/controls   -> 401 (route exists, auth required)
#   /api/auth/login     -> 401 or 400 (route exists)
#   /api/health/live    -> 200 (public health endpoint)
#   /api/nonexistent    -> 404 (expected — route does not exist)
# =============================================================================
set -euo pipefail

BASE_URL="${1:-http://localhost}"
PASS=0
FAIL=0

check_status() {
  local path="$1"
  local expected="$2"
  local description="$3"

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE_URL}${path}" 2>/dev/null || echo "000")

  if [ "$status" = "$expected" ]; then
    echo "  PASS: ${path} -> ${status} (expected ${expected}) — ${description}"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: ${path} -> ${status} (expected ${expected}) — ${description}"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Nginx /api Routing Regression Check ==="
echo "Base URL: ${BASE_URL}"
echo ""

# Health endpoint (public, no auth required)
check_status "/api/health/live" "200" "Health endpoint should be public"

# Authenticated endpoints (should return 401, NOT 404)
check_status "/api/grc/controls" "401" "GRC route must exist (401=auth required, 404=routing broken)"
check_status "/api/grc/risks" "401" "GRC risks route must exist"
check_status "/api/auth/login" "401" "Auth login route must exist (POST-only, GET returns 401 or 404)"

# Direct backend routes via nginx (non-/api prefixed, if proxied)
check_status "/health/live" "200" "Direct health endpoint"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "FAILURE: Nginx /api routing regression detected!"
  echo "If /api/grc/* returns 404 instead of 401, check:"
  echo "  1. nginx location ^~ /api/ has proxy_pass http://backend/ (trailing slash!)"
  echo "  2. Backend controllers use @Controller('grc/...') without /api prefix"
  echo "  3. Backend container is healthy and reachable on Docker network"
  exit 1
fi

echo "SUCCESS: All routing checks passed."
