#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$DIR/../.env"
PORT=5002
PREFIX=api
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r k v; do
    [ "$k" = "PORT" ] && PORT="$v"
    [ "$k" = "API_PREFIX" ] && PREFIX="$v"
  done < "$ENV_FILE"
fi
TENANT_ID="217492b2-f814-4ba0-ae50-4e4f8ecf6216"
EMAIL="admin@local"
PASS="ChangeMe!123"
BASE="http://localhost:$PORT/$PREFIX"

echo "Health: $BASE/v1/health"
curl -sS "$BASE/v1/health" || true

echo "Login: $BASE/v2/auth/login"
resp=$(curl -sS -H "x-tenant-id: $TENANT_ID" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$BASE/v2/auth/login" || true)
tok=$(echo "$resp" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -n "$tok" ]; then
  len=${#tok}; start=${tok:0:4}; end=${tok:len-4:4}; echo "{\"ok\":true,\"token\":\"$start...$end\"}"
else
  echo "$resp"
fi


