#!/bin/bash
# Smoke Routes Test - Checks critical routes return 200 (not 404)

set +e # Don't exit on first error

BASE_URL="${API_URL:-http://localhost:5002}"
TENANT_ID="${DEFAULT_TENANT_ID:-217492b2-f814-4ba0-ae50-4e4f8ecf6216}"
DIAG_DIR=".diag"
SMOKE_FILE="$DIAG_DIR/smoke.json"

# Create .diag directory
mkdir -p "$DIAG_DIR"

echo "🔍 Route Smoke Test"
echo "=================="

declare -a routes=(
  "GET:/api/v2/dashboard/overview:Dashboard Overview:"
  "GET:/api/v2/governance/policies:Governance Policies:?page=1&limit=20"
  "GET:/api/v2/compliance/requirements:Compliance Requirements:?page=1&limit=20"
  "GET:/api/v2/risk-catalog:Risk Catalog:?page=1&pageSize=20"
  "GET:/api/v2/risk-instances:Risk Instances:?page=1&pageSize=20"
  "GET:/api/v2/entity-registry/entity-types:Entity Registry Types:?page=1&pageSize=20"
)

total=${#routes[@]}
failed=0
results="["

for i in "${!routes[@]}"; do
  IFS=':' read -r method path name query <<< "${routes[$i]}"
  full_path="$path$query"
  url="$BASE_URL$full_path"
  num=$((i + 1))
  
  echo -n "[$num/$total] Testing $method $name..."
  
  response=$(curl -sS -w "\n%{http_code}" -X "$method" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -m 5 \
    "$url" 2>&1)
  
  http_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
    echo " ✅ PASS ($http_code)"
    results+="{\"route\":\"$name\",\"method\":\"$method\",\"path\":\"$full_path\",\"status\":$http_code,\"success\":true},"
  elif [ "$http_code" -eq 404 ]; then
    echo " ❌ FAIL (404 - Route Missing)"
    results+="{\"route\":\"$name\",\"method\":\"$method\",\"path\":\"$full_path\",\"status\":404,\"success\":false,\"error\":\"Route Missing\"},"
    failed=$((failed + 1))
  else
    echo " ❌ FAIL ($http_code)"
    results+="{\"route\":\"$name\",\"method\":\"$method\",\"path\":\"$full_path\",\"status\":$http_code,\"success\":false},"
    failed=$((failed + 1))
  fi
done

# Remove trailing comma and close array
results="${results%,}]"

# Create summary JSON
timestamp=$(date +"%Y-%m-%d %H:%M:%S")
summary="{\"timestamp\":\"$timestamp\",\"total\":$total,\"passed\":$((total - failed)),\"failed\":$failed,\"results\":$results}"

echo "$summary" | jq '.' > "$SMOKE_FILE" 2>/dev/null || echo "$summary" > "$SMOKE_FILE"
echo ""
echo "✅ Results saved to $SMOKE_FILE"

# Summary
echo ""
echo "📊 Summary:"
echo "  Total routes: $total"
echo "  Passed: $((total - failed))"
echo "  Failed: $failed"

if [ $failed -gt 0 ]; then
  echo ""
  echo "⚠️  Some routes returned 404 or failed!"
  exit 12 # RouteMissing exit code
else
  echo ""
  echo "✅ All routes are accessible"
  exit 0
fi

