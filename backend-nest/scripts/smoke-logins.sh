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
TENANT="217492b2-f814-4ba0-ae50-4e4f8ecf6216"
BASE="http://localhost:$PORT/$PREFIX"

health_ok=false
for u in "$BASE/v1/health" "$BASE/health" "http://localhost:$PORT/api/v1/health" "http://localhost:$PORT/api/health"; do
  if resp=$(curl -sS "$u" 2>/dev/null); then
    echo -e "health\tPASS\t$(echo "$resp" | tr -d '\n' | tr -s ' ')"; health_ok=true; break
  fi
done
if [ "$health_ok" = false ]; then echo -e "health\tFAIL\t"; fi

mask(){ t="$1"; l=${#t}; if [ "$l" -le 10 ]; then echo '***'; else echo "${t:0:6}***${t:l-4:4}"; fi }

login(){ email="$1"; pass="$2"; 
  resp=$(curl -sS -H "x-tenant-id: $TENANT" -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"$pass\"}" "$BASE/v2/auth/login" 2>/dev/null || true)
  tok=$(echo "$resp" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
  if [ -n "$tok" ]; then echo -e "$3\tPASS\ttoken=$(mask "$tok")"; else echo -e "$3\tFAIL\terr"; fi }

login "grc1@local" "grc1" "login_grc1"
login "grc2@local" "grc2" "login_grc2"


