#!/bin/bash
# =============================================================================
# Staging Main Sync and Validation Script
# =============================================================================
# Bu script staging ortamını main branch'ten build+deploy eder ve validate eder.
# Kullanım: ssh root@46.224.99.150 'bash -s' < STAGING_MAIN_SYNC_AND_VALIDATION.sh
# Veya staging sunucusunda: cd /opt/grc-platform && bash STAGING_MAIN_SYNC_AND_VALIDATION.sh
# =============================================================================

set -e  # Exit on error

HOST="http://46.224.99.150"
REPORT_FILE="/tmp/staging_main_sync_report_$(date +%Y%m%d_%H%M%S).txt"

echo "==========================================" | tee -a "$REPORT_FILE"
echo "STAGING MAIN SYNC AND VALIDATION REPORT" | tee -a "$REPORT_FILE"
echo "Started: $(date)" | tee -a "$REPORT_FILE"
echo "==========================================" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# =============================================================================
# A) GitHub tarafı doğrulama (yerel veya staging'den)
# =============================================================================
echo "=== A) GITHUB TARAFI DOĞRULAMA ===" | tee -a "$REPORT_FILE"
echo "Command: cd /opt/grc-platform && git fetch --all --prune" | tee -a "$REPORT_FILE"
cd /opt/grc-platform
git fetch --all --prune 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: git log --oneline origin/main -5" | tee -a "$REPORT_FILE"
git log --oneline origin/main -5 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: git branch -r | grep -E '(fix/staging|fix/audit|PR)'" | tee -a "$REPORT_FILE"
git branch -r | grep -E "(fix/staging|fix/audit|PR)" 2>&1 | tee -a "$REPORT_FILE" || echo "No matching branches found" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# =============================================================================
# B) Repo temizliği ve branch standardizasyonu
# =============================================================================
echo "=== B) REPO TEMİZLİĞİ VE BRANCH STANDARDİZASYONU ===" | tee -a "$REPORT_FILE"
echo "Command: git status" | tee -a "$REPORT_FILE"
git status 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: git branch --show-current" | tee -a "$REPORT_FILE"
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: git log -1 --oneline" | tee -a "$REPORT_FILE"
git log -1 --oneline 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Working tree temizliği
echo "Command: Cleaning untracked temporary files..." | tee -a "$REPORT_FILE"
find /opt/grc-platform -maxdepth 1 -type f \( -name "*.bak" -o -name "fix_file.py" -o -name "temp*.sh" \) -delete 2>&1 | tee -a "$REPORT_FILE" || true
echo "" | tee -a "$REPORT_FILE"

# Main'e hizala
echo "Command: git checkout main" | tee -a "$REPORT_FILE"
git checkout main 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: git pull --ff-only" | tee -a "$REPORT_FILE"
git pull --ff-only 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: git log -1 --oneline" | tee -a "$REPORT_FILE"
git log -1 --oneline 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# =============================================================================
# C) Disk / Docker safety check
# =============================================================================
echo "=== C) DISK / DOCKER SAFETY CHECK ===" | tee -a "$REPORT_FILE"
echo "Command: df -h /" | tee -a "$REPORT_FILE"
df -h / 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

DISK_FREE=$(df -h / | awk 'NR==2 {print $4}')
DISK_FREE_GB=$(df -h / | awk 'NR==2 {print $4}' | sed 's/G//' | sed 's/[^0-9.]//g')

echo "Command: docker system df" | tee -a "$REPORT_FILE"
docker system df 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Check if disk free < 5GB (simple numeric comparison)
DISK_FREE_NUM=$(echo "$DISK_FREE_GB" | awk '{print int($1)}')
if [ -n "$DISK_FREE_NUM" ] && [ "$DISK_FREE_NUM" -lt 5 ]; then
    echo "WARNING: Disk space < 5GB, cleaning Docker..." | tee -a "$REPORT_FILE"
    echo "Command: docker image prune -f" | tee -a "$REPORT_FILE"
    docker image prune -f 2>&1 | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    echo "Command: docker builder prune -af" | tee -a "$REPORT_FILE"
    docker builder prune -af 2>&1 | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
else
    echo "Disk space OK: ${DISK_FREE}GB free" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
fi

# =============================================================================
# D) Rebuild + Deploy (no-cache is build komutunda)
# =============================================================================
echo "=== D) REBUILD + DEPLOY ===" | tee -a "$REPORT_FILE"
echo "Command: docker compose -f docker-compose.staging.yml build --no-cache backend frontend" | tee -a "$REPORT_FILE"
docker compose -f docker-compose.staging.yml build --no-cache backend frontend 2>&1 | tee -a "$REPORT_FILE"
BUILD_EXIT=$?
if [ $BUILD_EXIT -ne 0 ]; then
    echo "FAIL: Build failed with exit code $BUILD_EXIT" | tee -a "$REPORT_FILE"
    exit 1
fi
echo "" | tee -a "$REPORT_FILE"

echo "Command: docker compose -f docker-compose.staging.yml up -d --force-recreate backend frontend" | tee -a "$REPORT_FILE"
docker compose -f docker-compose.staging.yml up -d --force-recreate backend frontend 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Waiting 15 seconds for containers to start..." | tee -a "$REPORT_FILE"
sleep 15
echo "" | tee -a "$REPORT_FILE"

echo "Command: docker compose -f docker-compose.staging.yml ps" | tee -a "$REPORT_FILE"
docker compose -f docker-compose.staging.yml ps 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: docker logs --tail=80 grc-staging-backend" | tee -a "$REPORT_FILE"
docker logs --tail=80 grc-staging-backend 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: docker logs --tail=80 grc-staging-frontend" | tee -a "$REPORT_FILE"
docker logs --tail=80 grc-staging-frontend 2>&1 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# =============================================================================
# E) Endpoint validation (MUTLAKA)
# =============================================================================
echo "=== E) ENDPOINT VALIDATION ===" | tee -a "$REPORT_FILE"
echo "Command: curl -i $HOST/frontend-health | head -30" | tee -a "$REPORT_FILE"
curl -i "$HOST/frontend-health" 2>&1 | head -30 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: curl -i $HOST/health | head -80" | tee -a "$REPORT_FILE"
curl -i "$HOST/health" 2>&1 | head -80 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: curl -i $HOST/audit-logs | head -60" | tee -a "$REPORT_FILE"
curl -i "$HOST/audit-logs" 2>&1 | head -60 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "Command: curl -i $HOST/grc/risks | head -60" | tee -a "$REPORT_FILE"
curl -i "$HOST/grc/risks" 2>&1 | head -60 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# =============================================================================
# F) Authenticated audit-logs (MUTLAKA)
# =============================================================================
echo "=== F) AUTHENTICATED AUDIT-LOGS TEST ===" | tee -a "$REPORT_FILE"
echo "Command: Login to get token..." | tee -a "$REPORT_FILE"
LOGIN_RESPONSE=$(curl -s -X POST "$HOST/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@grc-platform.local","password":"TestPassword123!"}' 2>&1)

echo "Login response (first 200 chars):" | tee -a "$REPORT_FILE"
echo "$LOGIN_RESPONSE" | head -c 200 | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Python ile token ve tenantId parse et
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('accessToken', data.get('token', '')))" 2>/dev/null || echo "")
TENANT_ID=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); user=data.get('user', {}); print(user.get('tenantId', ''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
    echo "WARNING: Could not extract token from login response" | tee -a "$REPORT_FILE"
    echo "Full login response:" | tee -a "$REPORT_FILE"
    echo "$LOGIN_RESPONSE" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
else
    echo "Token extracted (first 20 chars): ${TOKEN:0:20}..." | tee -a "$REPORT_FILE"
    echo "Tenant ID: $TENANT_ID" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    echo "Command: curl -i $HOST/audit-logs?page=1&limit=10 -H 'authorization: Bearer $TOKEN' -H 'x-tenant-id: $TENANT_ID' | head -120" | tee -a "$REPORT_FILE"
    curl -i "$HOST/audit-logs?page=1&limit=10" \
      -H "authorization: Bearer $TOKEN" \
      -H "x-tenant-id: $TENANT_ID" 2>&1 | head -120 | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
fi

# =============================================================================
# G) Health degraded kontrolü
# =============================================================================
echo "=== G) HEALTH DEGRADED KONTROLÜ ===" | tee -a "$REPORT_FILE"
HEALTH_RESPONSE=$(curl -s "$HOST/health" 2>&1)
echo "Health response:" | tee -a "$REPORT_FILE"
echo "$HEALTH_RESPONSE" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Python ile health JSON parse et
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('status', 'unknown'))" 2>/dev/null || echo "unknown")
REFRESH_TOKEN_MISSING=$(echo "$HEALTH_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); config=data.get('details', {}).get('config', []); missing=[c for c in config if c.get('name')=='REFRESH_TOKEN_EXPIRES_IN' and not c.get('configured')]; print('missing' if missing else 'ok')" 2>/dev/null || echo "unknown")

echo "Health status: $HEALTH_STATUS" | tee -a "$REPORT_FILE"
echo "REFRESH_TOKEN_EXPIRES_IN configured: $REFRESH_TOKEN_MISSING" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

if [ "$REFRESH_TOKEN_MISSING" = "missing" ]; then
    echo "WARNING: REFRESH_TOKEN_EXPIRES_IN is not configured" | tee -a "$REPORT_FILE"
    echo "Recommendation: Add to docker-compose.staging.yml backend environment:" | tee -a "$REPORT_FILE"
    echo "  REFRESH_TOKEN_EXPIRES_IN: 7d" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo "==========================================" | tee -a "$REPORT_FILE"
echo "SUMMARY" | tee -a "$REPORT_FILE"
echo "Completed: $(date)" | tee -a "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE" | tee -a "$REPORT_FILE"
echo "==========================================" | tee -a "$REPORT_FILE"

# Report dosyasını göster
echo ""
echo "Full report saved to: $REPORT_FILE"
echo "To view: cat $REPORT_FILE"

