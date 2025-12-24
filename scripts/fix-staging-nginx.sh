#!/bin/bash
# =============================================================================
# GRC Platform - Staging Nginx Fix Script
# =============================================================================
# This script:
# 1. Proves the mismatch between repo and running container
# 2. Forces a clean rebuild of the frontend container
# 3. Verifies the fix inside the running container
# 4. Tests with curl to validate functionality
# =============================================================================

set -euo pipefail

cd /opt/grc-platform || { echo "ERROR: Cannot cd to /opt/grc-platform"; exit 1; }

echo "=============================================================================="
echo "STEP 1 — HARD PROOF OF MISMATCH"
echo "=============================================================================="

echo ""
echo "=== CURRENT FRONTEND IMAGE ==="
docker inspect grc-staging-frontend --format '{{.Image}}' || echo "Container not found"

echo ""
echo "=== CURRENT default.conf (running container) ==="
docker exec grc-staging-frontend sh -lc 'sed -n "1,200p" /etc/nginx/conf.d/default.conf' || echo "Cannot read container config"

echo ""
echo "=== MD5 of running default.conf ==="
CONTAINER_MD5=$(docker exec grc-staging-frontend sh -lc 'md5sum /etc/nginx/conf.d/default.conf' 2>/dev/null | awk '{print $1}' || echo "ERROR")
echo "Container MD5: $CONTAINER_MD5"

echo ""
echo "=== MD5 of repo nginx.conf ==="
REPO_MD5=$(md5sum frontend/nginx.conf | awk '{print $1}' || echo "ERROR")
echo "Repo MD5: $REPO_MD5"

if [ "$CONTAINER_MD5" != "$REPO_MD5" ] && [ "$CONTAINER_MD5" != "ERROR" ] && [ "$REPO_MD5" != "ERROR" ]; then
    echo ""
    echo "⚠️  MISMATCH CONFIRMED: Container and repo MD5 differ!"
else
    echo ""
    echo "ℹ️  MD5 comparison: $CONTAINER_MD5 vs $REPO_MD5"
fi

echo ""
echo "=============================================================================="
echo "STEP 2 — FORCE CLEAN REBUILD (NO CACHE)"
echo "=============================================================================="

echo "Stopping frontend container..."
docker compose -f docker-compose.staging.yml stop frontend || true

echo "Removing frontend container..."
docker compose -f docker-compose.staging.yml rm -f frontend || true

echo "Building frontend with --no-cache..."
docker compose -f docker-compose.staging.yml build --no-cache frontend

echo "Starting frontend with --force-recreate..."
docker compose -f docker-compose.staging.yml up -d --force-recreate frontend

echo "Waiting 10 seconds for container to start..."
sleep 10

echo "Checking container status..."
docker ps | grep grc-staging-frontend || echo "WARNING: Container not running!"

echo ""
echo "=============================================================================="
echo "STEP 3 — VERIFY INSIDE CONTAINER (MANDATORY)"
echo "=============================================================================="

echo ""
echo "=== nginx -T proxy_pass ==="
docker exec grc-staging-frontend sh -lc 'nginx -T 2>&1 | grep -n "proxy_pass" | head -80' || echo "ERROR: Cannot get nginx config or no proxy_pass found"

echo ""
echo "=== nginx -T frontend-health ==="
docker exec grc-staging-frontend sh -lc 'nginx -T 2>&1 | grep -n "frontend-health" | head -40' || echo "ERROR: Cannot get nginx config or no frontend-health found"

echo ""
echo "=== nginx -T health ==="
docker exec grc-staging-frontend sh -lc 'nginx -T 2>&1 | grep -n "location = /health" | head -40' || echo "ERROR: Cannot get nginx config or no /health found"

echo ""
echo "=== NEW MD5 of running default.conf ==="
NEW_CONTAINER_MD5=$(docker exec grc-staging-frontend sh -lc 'md5sum /etc/nginx/conf.d/default.conf' 2>/dev/null | awk '{print $1}' || echo "ERROR")
echo "New Container MD5: $NEW_CONTAINER_MD5"
echo "Repo MD5: $REPO_MD5"

if [ "$NEW_CONTAINER_MD5" = "$REPO_MD5" ] && [ "$NEW_CONTAINER_MD5" != "ERROR" ]; then
    echo "✅ MD5 MATCH: Container now matches repo!"
else
    echo "❌ MD5 MISMATCH: Container still differs from repo!"
fi

echo ""
echo "=============================================================================="
echo "STEP 4 — FUNCTIONAL CURL VALIDATION (MANDATORY)"
echo "=============================================================================="

echo ""
echo "=== Testing /frontend-health ==="
curl -i http://46.224.99.150/frontend-health 2>&1 | head -20

echo ""
echo "=== Testing /health ==="
curl -i http://46.224.99.150/health 2>&1 | head -40

echo ""
echo "=== Testing /audit-logs ==="
curl -i http://46.224.99.150/audit-logs 2>&1 | head -40

echo ""
echo "=== Testing /grc/risks ==="
curl -i http://46.224.99.150/grc/risks 2>&1 | head -40

echo ""
echo "=== Testing POST /auth/login ==="
curl -i -X POST http://46.224.99.150/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"x","password":"y"}' 2>&1 | head -40

echo ""
echo "=============================================================================="
echo "STEP 5 — SUMMARY REPORT"
echo "=============================================================================="

# Check if proxy_pass exists in nginx config
PROXY_PASS_COUNT=$(docker exec grc-staging-frontend sh -lc 'nginx -T 2>&1 | grep -c "proxy_pass" || echo "0"')
FRONTEND_HEALTH_COUNT=$(docker exec grc-staging-frontend sh -lc 'nginx -T 2>&1 | grep -c "frontend-health" || echo "0"')

echo ""
echo "Root cause:"
if [ "$CONTAINER_MD5" != "$REPO_MD5" ] && [ "$CONTAINER_MD5" != "ERROR" ]; then
    echo "  - Container was using stale/cached nginx.conf that did not match repo"
    echo "  - Docker build cache prevented new nginx.conf from being copied into image"
else
    echo "  - Investigation needed: MD5 comparison inconclusive"
fi

echo ""
echo "MD5 comparison:"
echo "  - Repo: $REPO_MD5"
echo "  - Container (before): $CONTAINER_MD5"
echo "  - Container (after): $NEW_CONTAINER_MD5"

echo ""
echo "nginx -T proof:"
echo "  - proxy_pass directives found: $PROXY_PASS_COUNT"
echo "  - frontend-health found: $FRONTEND_HEALTH_COUNT"

echo ""
echo "curl validation summary:"
echo "  (See detailed output above)"

echo ""
echo "Conclusion:"
if [ "$PROXY_PASS_COUNT" -gt 0 ] && [ "$FRONTEND_HEALTH_COUNT" -gt 0 ] && [ "$NEW_CONTAINER_MD5" = "$REPO_MD5" ]; then
    echo "  ✅ Reverse proxy fixed"
else
    echo "  ❌ Still broken:"
    [ "$PROXY_PASS_COUNT" -eq 0 ] && echo "    - No proxy_pass directives found"
    [ "$FRONTEND_HEALTH_COUNT" -eq 0 ] && echo "    - No frontend-health endpoint found"
    [ "$NEW_CONTAINER_MD5" != "$REPO_MD5" ] && echo "    - MD5 still mismatched"
fi

echo ""
echo "=============================================================================="
echo "Script completed."
echo "=============================================================================="

