#!/usr/bin/env bash
# Status matrix probe - SAFE friendly bash script

set -euo pipefail

HOSTS=("http://127.0.0.1:5002" "http://localhost:5002")
ENDPOINTS=("health_root /health" "health_v2 /v2/health" "health_api_v2 /api/v2/health")

declare -A RESULTS

for entry in "${ENDPOINTS[@]}"; do
  name=${entry%% *}
  path=${entry#* }
  status=0
  for host in "${HOSTS[@]}"; do
    url="${host}${path}"
    status=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 1.5 "$url" || echo "000")
    if [ "$status" != "200" ]; then
      status=$(curl -sS -o /dev/null -w "%{http_code}" --head --max-time 1.5 "$url" || echo "000")
    fi
    if [ "$status" = "200" ]; then
      break
    fi
  done
  RESULTS[$name]=$status
  printf '%s=%s\n' "$name" "$status"
done

exit_code=4
for value in "${RESULTS[@]}"; do
  if [ "$value" = "200" ]; then
    exit_code=0
    break
  fi
done

printf 'exit=%s\n' "$exit_code"
exit "$exit_code"
