#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${API_BASE_URL:-}"
if [[ -z "$BASE_URL" ]]; then
  PORT="${PORT:-5002}"
  BASE_URL="http://localhost:${PORT}"
fi

HEALTH_URL="${BASE_URL%/}/api/v2/health"
echo "?? Health smoke against ${HEALTH_URL}" 

if curl -fsS "${HEALTH_URL}" > /tmp/health-smoke.json; then
  echo "PASS Health 200"
  rm -f /tmp/health-smoke.json
  exit 0
else
  status=$?
  echo "FAIL Health request failed (curl exit ${status})"
  rm -f /tmp/health-smoke.json 2>/dev/null || true
  exit 1
fi
