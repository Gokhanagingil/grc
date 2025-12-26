#!/bin/bash
# =============================================================================
# Staging Audit Logs Diagnostic Script
# Purpose: Backend route validation and /audit-logs 404 root cause analysis
# Environment: staging host root@46.224.99.150, repo /opt/grc-platform
# =============================================================================

set -euo pipefail

REPORT_FILE="STAGING_AUDIT_LOGS_DIAGNOSTIC_REPORT.md"
HOST="46.224.99.150"
REPO_PATH="/opt/grc-platform"

echo "# Staging Audit Logs Diagnostic Report" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# =============================================================================
# 1) Hızlı durum fotoğrafı
# =============================================================================
echo "## 1) Hızlı Durum Fotoğrafı" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 1.1 Git Branch ve Commit" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "cd $REPO_PATH" >> "$REPORT_FILE"
echo "git rev-parse --abbrev-ref HEAD" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
cd "$REPO_PATH" && git rev-parse --abbrev-ref HEAD >> "$REPORT_FILE" 2>&1 || echo "ERROR: Could not get branch" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "\`\`\`bash" >> "$REPORT_FILE"
echo "git log -1 --oneline" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
cd "$REPO_PATH" && git log -1 --oneline >> "$REPORT_FILE" 2>&1 || echo "ERROR: Could not get commit" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 1.2 Docker Compose Services Status" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "docker compose -f docker-compose.staging.yml ps" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
cd "$REPO_PATH" && docker compose -f docker-compose.staging.yml ps >> "$REPORT_FILE" 2>&1 || echo "ERROR: Could not get docker compose status" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "\`\`\`bash" >> "$REPORT_FILE"
echo "docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' >> "$REPORT_FILE" 2>&1 || echo "ERROR: Could not get docker ps" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 1.3 Frontend Logs (last 80 lines)" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "docker compose -f docker-compose.staging.yml logs --tail=80 frontend" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
cd "$REPO_PATH" && docker compose -f docker-compose.staging.yml logs --tail=80 frontend >> "$REPORT_FILE" 2>&1 || echo "ERROR: Could not get frontend logs" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 1.4 Backend Logs (last 120 lines)" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "docker compose -f docker-compose.staging.yml logs --tail=120 backend" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
cd "$REPO_PATH" && docker compose -f docker-compose.staging.yml logs --tail=120 backend >> "$REPORT_FILE" 2>&1 || echo "ERROR: Could not get backend logs" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# =============================================================================
# 2) Frontend nginx config gerçekten proxy mi?
# =============================================================================
echo "## 2) Frontend Nginx Config Kontrolü" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "\`\`\`bash" >> "$REPORT_FILE"
cat >> "$REPORT_FILE" << 'EOF'
docker exec -it grc-staging-frontend sh -lc '
  echo "== default.conf ==";
  sed -n "1,260p" /etc/nginx/conf.d/default.conf;
  echo;
  echo "== proxy_pass lines ==";
  nginx -T 2>&1 | grep -n "proxy_pass" | head -80 || true;
  echo;
  echo "== location blocks (auth/grc/audit/health/frontend-health) ==";
  nginx -T 2>&1 | egrep -n "location (\^~ /auth/|\^~ /grc/|= /audit-logs|\^~ /audit-logs|= /health|= /frontend-health)" | head -120 || true;
'
EOF
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
docker exec grc-staging-frontend sh -lc '
  echo "== default.conf ==";
  sed -n "1,260p" /etc/nginx/conf.d/default.conf 2>/dev/null || cat /etc/nginx/conf.d/default.conf 2>/dev/null | head -260;
  echo;
  echo "== proxy_pass lines ==";
  nginx -T 2>&1 | grep -n "proxy_pass" | head -80 || true;
  echo;
  echo "== location blocks (auth/grc/audit/health/frontend-health) ==";
  nginx -T 2>&1 | egrep -n "location (\^~ /auth/|\^~ /grc/|= /audit-logs|\^~ /audit-logs|= /health|= /frontend-health)" | head -120 || true;
' >> "$REPORT_FILE" 2>&1 || echo "ERROR: Could not inspect nginx config" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# =============================================================================
# 3) Proxy üzerinden endpoint smoke test
# =============================================================================
echo "## 3) Proxy Üzerinden Endpoint Smoke Test" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 3.1 Frontend Health" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "curl -sS -D- http://$HOST/frontend-health -o /dev/null | sed -n '1,25p'" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
curl -sS -D- "http://$HOST/frontend-health" -o /dev/null 2>&1 | sed -n '1,25p' >> "$REPORT_FILE" || echo "ERROR: curl failed" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 3.2 Backend Health" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "curl -sS -D- http://$HOST/health -o /dev/null | sed -n '1,25p'" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
curl -sS -D- "http://$HOST/health" -o /dev/null 2>&1 | sed -n '1,25p' >> "$REPORT_FILE" || echo "ERROR: curl failed" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 3.3 Auth Login (POST)" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "curl -sS -D- -X POST http://$HOST/auth/login -H \"Content-Type: application/json\" -d '{\"email\":\"x\",\"password\":\"y\"}' -o /dev/null | sed -n '1,40p'" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
curl -sS -D- -X POST "http://$HOST/auth/login" -H "Content-Type: application/json" -d '{"email":"x","password":"y"}' -o /dev/null 2>&1 | sed -n '1,40p' >> "$REPORT_FILE" || echo "ERROR: curl failed" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 3.4 GRC Risks" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "curl -sS -D- http://$HOST/grc/risks -o /dev/null | sed -n '1,40p'" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
curl -sS -D- "http://$HOST/grc/risks" -o /dev/null 2>&1 | sed -n '1,40p' >> "$REPORT_FILE" || echo "ERROR: curl failed" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 3.5 Audit Logs (PROBLEM ENDPOINT)" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "curl -sS -D- http://$HOST/audit-logs -o /dev/null | sed -n '1,40p'" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
curl -sS -D- "http://$HOST/audit-logs" -o /dev/null 2>&1 | sed -n '1,40p' >> "$REPORT_FILE" || echo "ERROR: curl failed" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# =============================================================================
# 4) Kritik: /audit-logs neden 404?
# =============================================================================
echo "## 4) Kritik: /audit-logs 404 Root Cause Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 4.1 Backend Container İçinde Doğrudan Kontrol" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
cat >> "$REPORT_FILE" << 'EOF'
docker exec -it grc-staging-backend sh -lc '
  echo "== backend health direct ==";
  curl -sS -D- http://localhost:3002/health -o /dev/null | sed -n "1,25p";
  echo;
  echo "== audit-logs direct ==";
  curl -sS -D- http://localhost:3002/audit-logs -o /dev/null | sed -n "1,60p";
  echo;
  echo "== list likely docs endpoints ==";
  for p in /api-docs /docs /swagger /swagger-json /openapi.json /api-json; do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002$p || true);
    echo "$p -> $code";
  done
'
EOF
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
docker exec grc-staging-backend sh -lc '
  echo "== backend health direct ==";
  curl -sS -D- http://localhost:3002/health -o /dev/null 2>&1 | sed -n "1,25p";
  echo;
  echo "== audit-logs direct ==";
  curl -sS -D- http://localhost:3002/audit-logs -o /dev/null 2>&1 | sed -n "1,60p";
  echo;
  echo "== list likely docs endpoints ==";
  for p in /api-docs /docs /swagger /swagger-json /openapi.json /api-json; do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002$p 2>/dev/null || echo "000");
    echo "$p -> $code";
  done
' >> "$REPORT_FILE" 2>&1 || echo "ERROR: Could not execute backend checks" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 4.2 Backend Image ve Version Kontrolü" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "docker inspect grc-staging-backend --format '{{.Config.Image}}'" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
docker inspect grc-staging-backend --format '{{.Config.Image}}' >> "$REPORT_FILE" 2>&1 || echo "ERROR: Could not inspect backend image" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "\`\`\`bash" >> "$REPORT_FILE"
cat >> "$REPORT_FILE" << 'EOF'
docker exec -it grc-staging-backend sh -lc 'node -p "process.version" && ls -la dist 2>/dev/null | head'
EOF
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
docker exec grc-staging-backend sh -lc 'node -p "process.version" && ls -la dist 2>/dev/null | head' >> "$REPORT_FILE" 2>&1 || echo "ERROR: Could not get backend version info" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# =============================================================================
# 5) Gerçek "auth + tenant" ile audit-logs dene
# =============================================================================
echo "## 5) Gerçek Auth + Tenant ile Audit-Logs Testi" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### 5.1 Login Token Al" >> "$REPORT_FILE"
echo "\`\`\`bash" >> "$REPORT_FILE"
echo "curl -sS -X POST http://$HOST:3002/auth/login -H \"Content-Type: application/json\" -d '{\"email\":\"admin@grc-platform.local\",\"password\":\"TestPassword123!\"}' | head -c 4000" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
LOGIN_RESPONSE=$(curl -sS -X POST "http://$HOST:3002/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@grc-platform.local","password":"TestPassword123!"}' 2>&1 | head -c 4000)
echo "$LOGIN_RESPONSE" >> "$REPORT_FILE"
echo "\`\`\`" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Try to extract token (basic JSON parsing)
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4 || echo "")
TENANT_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"tenantId":"[^"]*' | cut -d'"' -f4 || echo "")

if [ -z "$TOKEN" ]; then
  # Try staging credentials
  echo "### 5.1.1 Staging Credentials Denemesi" >> "$REPORT_FILE"
  echo "\`\`\`bash" >> "$REPORT_FILE"
  echo "curl -sS -X POST http://$HOST:3002/auth/login -H \"Content-Type: application/json\" -d '{\"email\":\"admin@grc-staging.local\",\"password\":\"StagingPassword123!\"}' | head -c 4000" >> "$REPORT_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
  LOGIN_RESPONSE=$(curl -sS -X POST "http://$HOST:3002/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@grc-staging.local","password":"StagingPassword123!"}' 2>&1 | head -c 4000)
  echo "$LOGIN_RESPONSE" >> "$REPORT_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4 || echo "")
  TENANT_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"tenantId":"[^"]*' | cut -d'"' -f4 || echo "")
fi

if [ -n "$TOKEN" ]; then
  echo "### 5.2 Token ile Direct Backend Test" >> "$REPORT_FILE"
  echo "\`\`\`bash" >> "$REPORT_FILE"
  echo "curl -sS -D- http://$HOST:3002/audit-logs -H \"Authorization: Bearer <TOKEN>\" -H \"x-tenant-id: <TENANT>\" -o /dev/null | sed -n '1,60p'" >> "$REPORT_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
  if [ -n "$TENANT_ID" ]; then
    curl -sS -D- "http://$HOST:3002/audit-logs" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT_ID" -o /dev/null 2>&1 | sed -n '1,60p' >> "$REPORT_FILE" || echo "ERROR: curl failed" >> "$REPORT_FILE"
  else
    curl -sS -D- "http://$HOST:3002/audit-logs" -H "Authorization: Bearer $TOKEN" -o /dev/null 2>&1 | sed -n '1,60p' >> "$REPORT_FILE" || echo "ERROR: curl failed" >> "$REPORT_FILE"
  fi
  echo "\`\`\`" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"

  echo "### 5.3 Token ile Proxy Üzerinden Test" >> "$REPORT_FILE"
  echo "\`\`\`bash" >> "$REPORT_FILE"
  echo "curl -sS -D- http://$HOST/audit-logs -H \"Authorization: Bearer <TOKEN>\" -H \"x-tenant-id: <TENANT>\" -o /dev/null | sed -n '1,60p'" >> "$REPORT_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
  if [ -n "$TENANT_ID" ]; then
    curl -sS -D- "http://$HOST/audit-logs" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT_ID" -o /dev/null 2>&1 | sed -n '1,60p' >> "$REPORT_FILE" || echo "ERROR: curl failed" >> "$REPORT_FILE"
  else
    curl -sS -D- "http://$HOST/audit-logs" -H "Authorization: Bearer $TOKEN" -o /dev/null 2>&1 | sed -n '1,60p' >> "$REPORT_FILE" || echo "ERROR: curl failed" >> "$REPORT_FILE"
  fi
  echo "\`\`\`" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
else
  echo "**WARNING: Could not extract token from login response. Skipping authenticated tests.**" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
fi

# =============================================================================
# 6) Sonuç Raporu
# =============================================================================
echo "## 6) Sonuç Raporu ve PASS/FAIL Tablosu" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Endpoint Test Sonuçları" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| Endpoint | Expected | Status | Notes |" >> "$REPORT_FILE"
echo "|----------|----------|--------|-------|" >> "$REPORT_FILE"

# Check each endpoint and add to table
# Frontend health
if curl -sS -o /dev/null -w "%{http_code}" "http://$HOST/frontend-health" 2>/dev/null | grep -q "200"; then
  CONTENT_TYPE=$(curl -sS -I "http://$HOST/frontend-health" 2>/dev/null | grep -i "content-type" | head -1 || echo "")
  if echo "$CONTENT_TYPE" | grep -qi "text/plain"; then
    echo "| /frontend-health | 200 text/plain | ✅ PASS | $CONTENT_TYPE |" >> "$REPORT_FILE"
  else
    echo "| /frontend-health | 200 text/plain | ⚠️ PARTIAL | Got 200 but wrong content-type: $CONTENT_TYPE |" >> "$REPORT_FILE"
  fi
else
  echo "| /frontend-health | 200 text/plain | ❌ FAIL | Non-200 response |" >> "$REPORT_FILE"
fi

# Backend health
if curl -sS -o /dev/null -w "%{http_code}" "http://$HOST/health" 2>/dev/null | grep -q "200"; then
  CONTENT_TYPE=$(curl -sS -I "http://$HOST/health" 2>/dev/null | grep -i "content-type" | head -1 || echo "")
  if echo "$CONTENT_TYPE" | grep -qi "application/json"; then
    echo "| /health | 200 application/json | ✅ PASS | $CONTENT_TYPE |" >> "$REPORT_FILE"
  else
    echo "| /health | 200 application/json | ⚠️ PARTIAL | Got 200 but wrong content-type: $CONTENT_TYPE |" >> "$REPORT_FILE"
  fi
else
  echo "| /health | 200 application/json | ❌ FAIL | Non-200 response |" >> "$REPORT_FILE"
fi

# Auth login
AUTH_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "http://$HOST/auth/login" -H "Content-Type: application/json" -d '{"email":"x","password":"y"}' 2>/dev/null || echo "000")
AUTH_CONTENT_TYPE=$(curl -sS -I -X POST "http://$HOST/auth/login" -H "Content-Type: application/json" -d '{"email":"x","password":"y"}' 2>/dev/null | grep -i "content-type" | head -1 || echo "")
if echo "$AUTH_CONTENT_TYPE" | grep -qi "application/json"; then
  echo "| /auth/login POST | JSON (not HTML) | ✅ PASS | Returns JSON (even on error) |" >> "$REPORT_FILE"
else
  if echo "$AUTH_CONTENT_TYPE" | grep -qi "text/html"; then
    echo "| /auth/login POST | JSON (not HTML) | ❌ FAIL | Returns HTML instead of JSON |" >> "$REPORT_FILE"
  else
    echo "| /auth/login POST | JSON (not HTML) | ⚠️ UNKNOWN | Content-Type: $AUTH_CONTENT_TYPE |" >> "$REPORT_FILE"
  fi
fi

# GRC risks
GRC_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "http://$HOST/grc/risks" 2>/dev/null || echo "000")
GRC_CONTENT_TYPE=$(curl -sS -I "http://$HOST/grc/risks" 2>/dev/null | grep -i "content-type" | head -1 || echo "")
if [ "$GRC_CODE" = "401" ] || [ "$GRC_CODE" = "403" ]; then
  if echo "$GRC_CONTENT_TYPE" | grep -qi "application/json"; then
    echo "| /grc/risks | 401/403 json | ✅ PASS | Returns $GRC_CODE with JSON |" >> "$REPORT_FILE"
  else
    echo "| /grc/risks | 401/403 json | ⚠️ PARTIAL | Returns $GRC_CODE but wrong content-type: $GRC_CONTENT_TYPE |" >> "$REPORT_FILE"
  fi
else
  echo "| /grc/risks | 401/403 json | ❌ FAIL | Returns $GRC_CODE instead of 401/403 |" >> "$REPORT_FILE"
fi

# Audit logs - CRITICAL
AUDIT_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "http://$HOST/audit-logs" 2>/dev/null || echo "000")
AUDIT_CONTENT_TYPE=$(curl -sS -I "http://$HOST/audit-logs" 2>/dev/null | grep -i "content-type" | head -1 || echo "")
if [ "$AUDIT_CODE" = "404" ]; then
  echo "| /audit-logs | 401/403 json (NOT 404) | ❌ FAIL | Returns 404 - Route not found |" >> "$REPORT_FILE"
elif [ "$AUDIT_CODE" = "401" ] || [ "$AUDIT_CODE" = "403" ]; then
  if echo "$AUDIT_CONTENT_TYPE" | grep -qi "application/json"; then
    echo "| /audit-logs | 401/403 json | ✅ PASS | Returns $AUDIT_CODE with JSON |" >> "$REPORT_FILE"
  else
    echo "| /audit-logs | 401/403 json | ⚠️ PARTIAL | Returns $AUDIT_CODE but wrong content-type: $AUDIT_CONTENT_TYPE |" >> "$REPORT_FILE"
  fi
else
  echo "| /audit-logs | 401/403 json | ⚠️ UNEXPECTED | Returns $AUDIT_CODE |" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "### Root Cause Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**TODO: Analiz edilecek:**" >> "$REPORT_FILE"
echo "- Backend container içinde /audit-logs endpoint'i var mı?" >> "$REPORT_FILE"
echo "- AuditController export edilmiş mi?" >> "$REPORT_FILE"
echo "- AuditModule doğru import edilmiş mi?" >> "$REPORT_FILE"
echo "- Backend image doğru commit'ten mi build edilmiş?" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Fix Plan" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**TODO: Root cause bulunduktan sonra doldurulacak**" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Report generated successfully. Review: $REPORT_FILE**" >> "$REPORT_FILE"

cat "$REPORT_FILE"

