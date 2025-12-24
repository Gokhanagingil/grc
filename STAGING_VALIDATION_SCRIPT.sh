#!/bin/bash
# =============================================================================
# Staging Validation Script - Reverse Proxy + Audit Logs Fix Verification
# =============================================================================
# Run this script on staging server: ssh root@46.224.99.150
# Usage: bash STAGING_VALIDATION_SCRIPT.sh
# =============================================================================

set -e

echo "============================================================================="
echo "STAGING VALIDATION: Reverse Proxy + Audit Logs Fix"
echo "============================================================================="
echo ""

# === 0) Ortam bilgisi ve konteks ===
echo "=== 0) Ortam Bilgisi ve Konteks ==="
cd /opt/grc-platform || { echo "ERROR: /opt/grc-platform not found"; exit 1; }

echo ""
echo "--- Git Branch/Commit ---"
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git log -1 --oneline
git status --short

echo ""
echo "--- Docker Services Status ---"
docker compose -f docker-compose.staging.yml ps

echo ""
echo "============================================================================="
echo "=== 1) Reverse Proxy Doğrulama (Nginx Config) ==="
echo "============================================================================="

echo ""
echo "--- Frontend Container Nginx Config (first 220 lines) ---"
docker exec -it grc-staging-frontend sh -lc 'nginx -T 2>&1' | head -220

echo ""
echo "--- Critical Nginx Proxy Config (grep) ---"
docker exec -it grc-staging-frontend sh -lc 'nginx -T 2>&1' | grep -nE "upstream backend|proxy_pass|location \^~ /auth/|location \^~ /grc/|location = /audit-logs|frontend-health|location = /health" | head -200

echo ""
echo "--- External Content-Type Checks ---"
echo ""
echo "1. /frontend-health (should be text/plain, NOT HTML):"
curl -i http://127.0.0.1/frontend-health 2>&1 | head -30

echo ""
echo "2. /health (should be JSON from backend):"
curl -i http://127.0.0.1/health 2>&1 | head -60

echo ""
echo "3. /grc/risks (should be 401 JSON if no auth):"
curl -i http://127.0.0.1/grc/risks 2>&1 | head -40

echo ""
echo "4. /audit-logs (should be 401 JSON if no auth):"
curl -i http://127.0.0.1/audit-logs 2>&1 | head -40

echo ""
echo "============================================================================="
echo "=== 2) Backend Route Verification ==="
echo "============================================================================="

echo ""
echo "--- Backend Container Logs (last 300 lines, tail 200) ---"
docker logs --tail=300 grc-staging-backend 2>&1 | tail -200

echo ""
echo "--- NestJS Route Mapping (Mapped/routes/audit) ---"
docker logs --tail=500 grc-staging-backend 2>&1 | grep -iE "mapped|routes|audit" | tail -80 || echo "No route mapping logs found"

echo ""
echo "--- Direct Backend Test (port 3002) ---"
curl -i http://127.0.0.1:3002/audit-logs 2>&1 | head -40

echo ""
echo "============================================================================="
echo "=== 3) Auth + Tenant ile /audit-logs Test ==="
echo "============================================================================="

echo ""
echo "--- Finding Admin Credentials ---"
ADMIN_EMAIL=""
ADMIN_PASS=""

# Check docker-compose.staging.yml
if grep -q "DEMO_ADMIN_EMAIL\|admin@grc-staging.local" /opt/grc-platform/docker-compose.staging.yml 2>/dev/null; then
    ADMIN_EMAIL=$(grep -E "DEMO_ADMIN_EMAIL|admin@grc-staging.local" /opt/grc-platform/docker-compose.staging.yml | head -1 | sed -E 's/.*[:=][[:space:]]*([^[:space:]]+).*/\1/' | tr -d '"' | tr -d "'" || echo "admin@grc-staging.local")
    ADMIN_PASS=$(grep -E "DEMO_ADMIN_PASSWORD|StagingPassword" /opt/grc-platform/docker-compose.staging.yml | head -1 | sed -E 's/.*[:=][[:space:]]*([^[:space:]]+).*/\1/' | tr -d '"' | tr -d "'" || echo "StagingPassword123!")
fi

# Defaults from docker-compose.staging.yml comments
if [ -z "$ADMIN_EMAIL" ]; then
    ADMIN_EMAIL="admin@grc-staging.local"
fi
if [ -z "$ADMIN_PASS" ]; then
    ADMIN_PASS="StagingPassword123!"
fi

echo "Using credentials: $ADMIN_EMAIL / [REDACTED]"

HOST="http://127.0.0.1"

echo ""
echo "--- Step 1: Login ---"
LOGIN_JSON=$(curl -s -X POST "$HOST/auth/login" \
  -H "content-type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")

echo "Login response (first 4000 chars):"
echo "$LOGIN_JSON" | head -c 4000
echo ""

# Extract token using node
TOKEN=$(echo "$LOGIN_JSON" | node -e '
const fs = require("fs");
const s = fs.readFileSync(0, "utf8");
let j = {};
try { j = JSON.parse(s); } catch(e) {}
const t = j?.data?.accessToken || j?.data?.token || j?.accessToken || j?.token || "";
process.stdout.write(t);
' 2>/dev/null || echo "")

TOKEN_LEN=${#TOKEN}
echo "TOKEN_LEN=$TOKEN_LEN"

if [ "$TOKEN_LEN" -eq 0 ]; then
    echo "ERROR: Login failed - no token received"
    echo "Full login response:"
    echo "$LOGIN_JSON"
    exit 1
fi

echo ""
echo "--- Step 2: Get Tenant Context ---"
CTX=$(curl -s "$HOST/onboarding/context" \
  -H "authorization: Bearer $TOKEN")

echo "Context response (first 4000 chars):"
echo "$CTX" | head -c 4000
echo ""

TENANT_ID=$(echo "$CTX" | node -e '
const fs = require("fs");
const s = fs.readFileSync(0, "utf8");
let j = {};
try { j = JSON.parse(s); } catch(e) {}
const t = j?.data?.tenantId || j?.tenantId || "";
process.stdout.write(t);
' 2>/dev/null || echo "")

echo "TENANT_ID=$TENANT_ID"

if [ -z "$TENANT_ID" ]; then
    echo "ERROR: Tenant ID not found in context"
    echo "Full context response:"
    echo "$CTX"
    exit 1
fi

echo ""
echo "--- Step 3: Call /audit-logs with Auth + Tenant ---"
AUDIT_RESPONSE=$(curl -i "$HOST/audit-logs?page=1&limit=10" \
  -H "authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" 2>&1)

echo "Audit logs response (first 120 lines):"
echo "$AUDIT_RESPONSE" | head -120

# Check if 200 OK
if echo "$AUDIT_RESPONSE" | grep -q "HTTP/1.1 200\|HTTP/2 200"; then
    echo ""
    echo "✓ SUCCESS: /audit-logs returned 200 OK"
else
    echo ""
    echo "✗ FAILED: /audit-logs did not return 200 OK"
    echo "Full response:"
    echo "$AUDIT_RESPONSE"
fi

echo ""
echo "============================================================================="
echo "=== 4) Code Verification (if needed) ==="
echo "============================================================================="

echo ""
echo "--- Audit Controller File ---"
ls -la /opt/grc-platform/backend-nest/src/audit/audit.controller.ts 2>/dev/null || echo "File not found"

echo ""
echo "--- Audit Module (first 220 lines) ---"
sed -n '1,220p' /opt/grc-platform/backend-nest/src/audit/audit.module.ts 2>/dev/null || echo "File not found"

echo ""
echo "--- Audit Controller (first 260 lines) ---"
sed -n '1,260p' /opt/grc-platform/backend-nest/src/audit/audit.controller.ts 2>/dev/null || echo "File not found"

echo ""
echo "--- AuditModule Import Check ---"
grep -RIn "AuditModule" /opt/grc-platform/backend-nest/src/app.module.ts /opt/grc-platform/backend-nest/src/**/*.module.ts 2>/dev/null | head -80 || echo "Not found"

echo ""
echo "============================================================================="
echo "VALIDATION COMPLETE"
echo "============================================================================="

