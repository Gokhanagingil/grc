#!/usr/bin/env bash
# =============================================================================
# GRC Platform — Support Bundle Collector
# =============================================================================
# Collects diagnostic information for troubleshooting production issues.
# Output is SAFE — no secrets are included.
#
# Usage:
#   bash ops/support-bundle.sh
#   COMPOSE_FILE=docker-compose.staging.yml bash ops/support-bundle.sh
#
# Output: ./support-bundle-<timestamp>.txt
# =============================================================================
set -uo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-grc-staging-backend}"
BACKEND_URL="${BACKEND_URL:-http://localhost}"
NGINX_URL="${NGINX_URL:-http://localhost}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BUNDLE_FILE="./support-bundle-${TIMESTAMP}.txt"

# Secrets that must NEVER appear in the bundle
SECRET_VARS="JWT_SECRET|REFRESH_TOKEN_SECRET|DB_PASSWORD|DEMO_ADMIN_PASSWORD"

collect() {
  local title="$1"
  shift
  echo "" >> "$BUNDLE_FILE"
  echo "=== ${title} ===" >> "$BUNDLE_FILE"
  echo "  Command: $*" >> "$BUNDLE_FILE"
  echo "---" >> "$BUNDLE_FILE"
  eval "$@" 2>&1 | head -200 >> "$BUNDLE_FILE" || echo "  (command failed)" >> "$BUNDLE_FILE"
  echo "" >> "$BUNDLE_FILE"
}

# Initialize bundle
cat > "$BUNDLE_FILE" <<EOF
# =============================================================================
# GRC Platform — Support Bundle
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# Host: $(hostname)
# =============================================================================
# This file does NOT contain secrets. Safe to share with support.
# =============================================================================
EOF

# ─── 1. Container Status ─────────────────────────────────────────────────────
collect "Docker Compose Status" \
  "docker compose -f ${COMPOSE_FILE} ps"

# ─── 2. Container Logs (last 100 lines each) ─────────────────────────────────
for SVC in backend frontend db; do
  collect "Logs: ${SVC} (last 100 lines)" \
    "docker compose -f ${COMPOSE_FILE} logs --tail=100 ${SVC}"
done

# ─── 3. Migration Status ─────────────────────────────────────────────────────
collect "Migration Status" \
  "docker compose -f ${COMPOSE_FILE} exec -T backend sh -c 'npx typeorm migration:show -d dist/data-source.js 2>&1'"

# ─── 4. Health Endpoints ─────────────────────────────────────────────────────
for ENDPOINT in /health/live /health/ready /health/db; do
  collect "Health: ${ENDPOINT} (backend direct)" \
    "curl -s --max-time 10 ${BACKEND_URL}${ENDPOINT}"
done

collect "Health: /health/live (via nginx)" \
  "curl -s --max-time 10 ${NGINX_URL}/health/live"

collect "Health: /frontend-health (nginx)" \
  "curl -s --max-time 10 ${NGINX_URL}/frontend-health"

# ─── 5. Environment Sanity (non-secret values ONLY) ──────────────────────────
collect "Environment (non-secret)" \
  "docker inspect ${BACKEND_CONTAINER} --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -vE '(${SECRET_VARS})=' | sort"

# ─── 6. Docker & System Info ─────────────────────────────────────────────────
collect "Docker Version" "docker --version"
collect "Docker Compose Version" "docker compose version"
collect "Disk Usage" "df -h / /var/lib/docker 2>/dev/null || df -h /"
collect "Memory" "free -h 2>/dev/null || echo 'free not available'"
collect "Uptime" "uptime"

# ─── 7. Network Check ────────────────────────────────────────────────────────
collect "Listening Ports" \
  "ss -tlnp 2>/dev/null | grep -E ':(80|443|3002|5432)\s' || netstat -tlnp 2>/dev/null | grep -E ':(80|443|3002|5432)\s' || echo 'Could not list ports'"

# ─── 8. Build / Version Info ─────────────────────────────────────────────────
collect "Build Info" \
  "docker inspect ${BACKEND_CONTAINER} --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -E '^(GIT_COMMIT|BUILD_TIMESTAMP|NODE_ENV)=' | sort"

# ─── Final safety check: strip any leaked secrets ────────────────────────────
# Belt-and-suspenders: redact anything that looks like a secret value
sed -i -E "s/(JWT_SECRET|REFRESH_TOKEN_SECRET|DB_PASSWORD|DEMO_ADMIN_PASSWORD)=.*/\1=<REDACTED>/g" "$BUNDLE_FILE"

echo "Support bundle saved to: ${BUNDLE_FILE}"
echo "File size: $(wc -c < "$BUNDLE_FILE") bytes"
echo ""
echo "This file does NOT contain secrets. Safe to share with support."
