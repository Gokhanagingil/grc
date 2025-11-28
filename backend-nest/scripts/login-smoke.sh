#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${API_BASE_URL:-}"
EMAIL="${SMOKE_EMAIL:-grc1@local}"
PASSWORD="${SMOKE_PASSWORD:-grc1}"
TENANT_ID="${SMOKE_TENANT_ID:-${DEFAULT_TENANT_ID:-}}"

if [[ -z "$BASE_URL" ]]; then
  PORT="${PORT:-5002}"
  BASE_URL="http://localhost:${PORT}"
fi

LOGIN_URL="${BASE_URL%/}/api/v2/auth/login"

function login_request() {
  local include_header="$1"
  local tmp
  tmp=$(mktemp)
  local headers=(-H "Content-Type: application/json")
  if [[ "$include_header" == "true" && -n "$TENANT_ID" ]]; then
    headers+=(-H "x-tenant-id: $TENANT_ID")
  fi

  local payload
  payload=$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")

  local status
  if ! status=$(curl -sS -o "$tmp" -w "%{http_code}" -X POST "$LOGIN_URL" "${headers[@]}" -d "$payload"); then
    echo "000" "$tmp"
    return
  fi

  echo "$status" "$tmp"
}

with_tenant_status_and_tmp=$(login_request true)
with_tenant_status=${with_tenant_status_and_tmp%% *}
with_tenant_tmp=${with_tenant_status_and_tmp##* }

without_tenant_status_and_tmp=$(login_request false)
without_tenant_status=${without_tenant_status_and_tmp%% *}
without_tenant_tmp=${without_tenant_status_and_tmp##* }

pass_with_tenant=false
pass_without_tenant=false

if [[ "$with_tenant_status" == "200" ]] && grep -q '"accessToken"' "$with_tenant_tmp"; then
  pass_with_tenant=true
fi

if [[ "$without_tenant_status" == "200" ]] && grep -q '"accessToken"' "$without_tenant_tmp"; then
  pass_without_tenant=true
elif [[ "$without_tenant_status" == "400" ]] && grep -q 'Tenant context required' "$without_tenant_tmp"; then
  pass_without_tenant=true
fi

default_color="\033[0m"
green="\033[0;32m"
red="\033[0;31m"

if [[ "$pass_with_tenant" == "true" ]]; then
  printf "%b%-25s%b\n" "$green" "With tenant header: PASS" "$default_color"
else
  printf "%b%-25s%b\n" "$red" "With tenant header: FAIL" "$default_color"
  printf "  status: %s\n" "$with_tenant_status"
  cat "$with_tenant_tmp"
fi

if [[ "$pass_without_tenant" == "true" ]]; then
  printf "%b%-25s%b\n" "$green" "Without tenant header: PASS" "$default_color"
else
  printf "%b%-25s%b\n" "$red" "Without tenant header: FAIL" "$default_color"
  printf "  status: %s\n" "$without_tenant_status"
  cat "$without_tenant_tmp"
fi

rm -f "$with_tenant_tmp" "$without_tenant_tmp"

if [[ "$pass_with_tenant" == "true" && "$pass_without_tenant" == "true" ]]; then
  exit 0
else
  exit 1
fi
