#!/bin/bash
# Health Check Script - Tests /health and /api/v2/health endpoints

BASE_URL="${1:-http://localhost:5002}"

echo "🔍 Health Check"
echo "Base URL: $BASE_URL"

total=0
failed=0

# Test 1: Root health
total=$((total + 1))
echo -n "[1/2] Testing GET /health... "
if response=$(curl -sS -f -m 5 -w "\n%{http_code}" "$BASE_URL/health" 2>&1); then
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" = "200" ]; then
    db_status=$(echo "$body" | grep -o '"db":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    if echo "$db_status" | grep -qE '^(ok|down)$'; then
      echo "✅ PASS (status: $http_code, db: $db_status)"
    else
      echo "⚠️  WARN (db status: $db_status)"
    fi
  else
    echo "❌ FAIL (status: $http_code)"
    failed=$((failed + 1))
  fi
else
  echo "❌ FAIL ($response)"
  failed=$((failed + 1))
fi

# Test 2: API health
total=$((total + 1))
echo -n "[2/2] Testing GET /api/v2/health... "
if response=$(curl -sS -f -m 5 -w "\n%{http_code}" "$BASE_URL/api/v2/health" 2>&1); then
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" = "200" ]; then
    status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    if [ "$status" = "ok" ]; then
      echo "✅ PASS (status: $http_code, status: $status)"
    else
      echo "⚠️  WARN (status field: $status)"
    fi
  else
    echo "❌ FAIL (status: $http_code)"
    failed=$((failed + 1))
  fi
else
  echo "❌ FAIL ($response)"
  failed=$((failed + 1))
fi

summary="📊 Summary: $((total - failed))/$total passed"
echo ""
echo "$summary"

if [ $failed -eq 0 ]; then
  exit 0
else
  exit 1
fi

