#!/usr/bin/env bash
# Quick health probe for backend health endpoints

set -euo pipefail

BASES=("http://127.0.0.1:5002" "http://localhost:5002")
PATHS=("/health" "/v2/health" "/api/v2/health")
TIMEOUT=5
FAILED=()

for base in "${BASES[@]}"; do
  for path in "${PATHS[@]}"; do
    url="${base}${path}"
    status=$(curl -sS -o /dev/null -w "%{http_code}" --max-time "${TIMEOUT}" "$url" || echo "000")
    if [ "$status" != "200" ]; then
      FAILED+=("$url -> $status")
    else
      printf 'OK %s\n' "$url"
    fi
  done
done

if [ ${#FAILED[@]} -gt 0 ]; then
  echo ""
  echo "Health probe FAILED:"
  for entry in "${FAILED[@]}"; do
    echo "  $entry"
  done
  exit 1
fi

echo ""
echo "All health endpoints returned 200."
exit 0

