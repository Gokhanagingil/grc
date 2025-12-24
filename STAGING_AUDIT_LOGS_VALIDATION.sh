#!/bin/bash
# Staging /audit-logs Validation Script
# Run this on staging server via SSH

set -e
cd /opt/grc-platform

echo "=========================================="
echo "=== PUBLIC FRONTEND HEALTH ==="
echo "=========================================="
curl -i http://46.224.99.150/frontend-health | head -40 || true

echo
echo "=========================================="
echo "=== PUBLIC BACKEND HEALTH VIA PROXY (/health should be JSON) ==="
echo "=========================================="
curl -i http://46.224.99.150/health | head -80 || true

echo
echo "=========================================="
echo "=== PUBLIC AUDIT LOGS VIA PROXY (/audit-logs should be JSON, 401 expected) ==="
echo "=========================================="
curl -i http://46.224.99.150/audit-logs | head -80 || true

echo
echo "=========================================="
echo "=== PUBLIC AUDIT LOGS DIRECT BACKEND (:3002) ==="
echo "=========================================="
curl -i http://46.224.99.150:3002/audit-logs | head -80 || true

echo
echo "=========================================="
echo "=== AUTH'LU GERÇEK AUDIT-LOGS TESTI ==="
echo "=========================================="

HOST="http://46.224.99.150"
EMAIL="admin@grc-platform.local"
PASS="TestPassword123!"

LOGIN_JSON=$(curl -s -X POST "$HOST/auth/login" -H "content-type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" || true)

echo "=== LOGIN_JSON ==="
echo "$LOGIN_JSON"

TOKEN=$(echo "$LOGIN_JSON" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  TOKEN=$(echo "$LOGIN_JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
fi

echo "=== TOKEN_PRESENT? ==="
[ -n "$TOKEN" ] && echo "YES" || echo "NO"

if [ -n "$TOKEN" ]; then
  CTX=$(curl -s "$HOST/onboarding/context" -H "authorization: Bearer $TOKEN" || true)
  echo "=== ONBOARDING_CONTEXT ==="
  echo "$CTX"
  TENANT_ID=$(echo "$CTX" | sed -n 's/.*"tenantId":"\([^"]*\)".*/\1/p')
  echo "=== TENANT_ID ==="
  echo "$TENANT_ID"

  if [ -n "$TENANT_ID" ]; then
    echo "=== AUDIT LOGS AUTHED ==="
    curl -i "$HOST/audit-logs?page=1&limit=10" \
      -H "authorization: Bearer $TOKEN" \
      -H "x-tenant-id: $TENANT_ID" | head -120 || true
  else
    echo "=== TENANT_ID NOT FOUND, TRYING WITHOUT TENANT HEADER ==="
    curl -i "$HOST/audit-logs?page=1&limit=10" \
      -H "authorization: Bearer $TOKEN" | head -120 || true
  fi
else
  echo "=== TOKEN NOT FOUND, SKIPPING AUTH TEST ==="
fi

echo
echo "=========================================="
echo "=== REPO/BRANCH/COMMIT KANITI ==="
echo "=========================================="

echo "=== git status ==="
git status

echo
echo "=== current branch ==="
git rev-parse --abbrev-ref HEAD

echo
echo "=== last 15 commits ==="
git --no-pager log --oneline -15

echo
echo "=== show audit files existence ==="
ls -la backend-nest/src/audit || true
ls -la backend-nest/src/audit/dto || true

echo
echo "=== grep audit-logs controller decorator ==="
grep -RIn --line-number "@Controller('audit-logs')" backend-nest/src/audit 2>/dev/null || true

echo
echo "=== audit.module controllers ==="
grep -n "controllers" backend-nest/src/audit/audit.module.ts || true
sed -n '1,220p' backend-nest/src/audit/audit.module.ts || true

echo
echo "=========================================="
echo "=== VALIDATION COMPLETE ==="
echo "=========================================="

