#!/bin/bash
# Backend Health Check Smoke Test (Bash)

set -e

BASE_URL="${API_URL:-http://localhost:5002}"
TIMEOUT=10

echo "🔍 Backend Health Check Smoke Test"
echo "Base URL: $BASE_URL"

failed=0
total=0

test_endpoint() {
    local url="$1"
    local name="$2"
    local expected_status="${3:-200}"
    
    total=$((total + 1))
    echo -n "  Testing $name... "
    
    if response=$(curl -s -w "\n%{http_code}" -m "$TIMEOUT" "$url" 2>&1); then
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if [ "$http_code" -eq "$expected_status" ]; then
            echo "✅ PASS ($http_code)"
            return 0
        else
            echo "❌ FAIL (expected $expected_status, got $http_code)"
            failed=$((failed + 1))
            return 1
        fi
    else
        echo "❌ FAIL (curl error)"
        failed=$((failed + 1))
        return 1
    fi
}

# Test endpoints
test_endpoint "$BASE_URL/health" "/health"
test_endpoint "$BASE_URL/api/v2/health" "/api/v2/health"

echo ""
echo "📊 Summary: $((total - failed))/$total passed"

if [ $failed -eq 0 ]; then
    echo "✅ PASS"
    exit 0
else
    echo "❌ FAIL"
    exit 1
fi
