#!/bin/bash
# Route Diagnosis Script - Dumps feature flags and mapped routes

set -e

BASE_URL="${API_URL:-http://localhost:5002}"
DIAG_DIR=".diag"
ROUTES_FILE="$DIAG_DIR/routes.json"
FEAT_FILE="$DIAG_DIR/feat.json"

# Create .diag directory
mkdir -p "$DIAG_DIR"

echo "🔍 Route Diagnosis"
echo "=================="

# Collect feature flags
echo ""
echo "📋 Feature Flags:"
declare -A feat_flags=(
  ["SAFE_MODE"]="${SAFE_MODE:-false}"
  ["ENABLE_POLICY"]="${ENABLE_POLICY:-true}"
  ["ENABLE_RISK"]="${ENABLE_RISK:-true}"
  ["ENABLE_COMPLIANCE"]="${ENABLE_COMPLIANCE:-true}"
  ["ENABLE_AUDIT"]="${ENABLE_AUDIT:-true}"
  ["ENABLE_ISSUE"]="${ENABLE_ISSUE:-true}"
  ["ENABLE_QUEUE"]="${ENABLE_QUEUE:-true}"
  ["ENABLE_RULES"]="${ENABLE_RULES:-true}"
  ["ENABLE_DATA_FOUNDATION"]="${ENABLE_DATA_FOUNDATION:-true}"
  ["ENABLE_DASHBOARD"]="${ENABLE_DASHBOARD:-true}"
  ["ENABLE_GOVERNANCE"]="${ENABLE_GOVERNANCE:-true}"
  ["ENABLE_RISK_INSTANCE"]="${ENABLE_RISK_INSTANCE:-true}"
  ["ENABLE_RISK_SCORING"]="${ENABLE_RISK_SCORING:-true}"
  ["ENABLE_SEARCH"]="${ENABLE_SEARCH:-true}"
  ["ENABLE_ENTITY_REGISTRY"]="${ENABLE_ENTITY_REGISTRY:-true}"
  ["ENABLE_METRICS"]="${ENABLE_METRICS:-true}"
  ["ENABLE_BCM"]="${ENABLE_BCM:-true}"
)

for key in $(printf '%s\n' "${!feat_flags[@]}" | sort); do
  value="${feat_flags[$key]}"
  if [ "$value" = "true" ]; then
    printf "  %-25s = %s\n" "$key" "$value"
  else
    printf "  %-25s = %s\n" "$key" "$value"
  fi
done

# Save to JSON (simplified)
echo "{\"SAFE_MODE\":\"${SAFE_MODE:-false}\",\"ENABLE_DASHBOARD\":\"${ENABLE_DASHBOARD:-true}\",\"ENABLE_GOVERNANCE\":\"${ENABLE_GOVERNANCE:-true}\",\"ENABLE_COMPLIANCE\":\"${ENABLE_COMPLIANCE:-true}\",\"ENABLE_RISK_INSTANCE\":\"${ENABLE_RISK_INSTANCE:-true}\",\"ENABLE_ENTITY_REGISTRY\":\"${ENABLE_ENTITY_REGISTRY:-true}\"}" > "$FEAT_FILE"
echo ""
echo "✅ Feature flags saved to $FEAT_FILE"

# Check if backend is running
echo ""
echo "🔌 Checking backend..."
if curl -sS -f -m 3 "$BASE_URL/health" > /dev/null 2>&1; then
  echo "✅ Backend is running"
else
  echo "❌ Backend is not running. Start it first."
  echo "   Run: npm run start:full:sh"
  exit 1
fi

# Get routes from /_routes endpoint (if available)
echo ""
echo "📡 Fetching routes..."
routes_json="[]"
if response=$(curl -sS -f -m 5 "$BASE_URL/api/v2/_routes" 2>&1); then
  routes_json="$response"
  route_count=$(echo "$routes_json" | jq '. | length' 2>/dev/null || echo "0")
  echo "✅ Found $route_count routes via /_routes endpoint"
else
  echo "⚠️  /_routes endpoint not available, will try Swagger"
  # Try Swagger
  if swagger=$(curl -sS -f -m 5 "$BASE_URL/api-docs" 2>&1); then
    # Extract paths (simplified)
    echo "✅ Found routes via Swagger"
    routes_json="$swagger"
  else
    echo "❌ Could not fetch routes"
    routes_json="[]"
  fi
fi

# Expected routes
expected_routes=(
  "GET:/api/v2/dashboard/overview"
  "GET:/api/v2/governance/policies"
  "GET:/api/v2/compliance/requirements"
  "GET:/api/v2/risk-catalog"
  "GET:/api/v2/risk-instances"
  "GET:/api/v2/entity-registry/entity-types"
)

# Check expected routes (simplified check)
echo ""
echo "🎯 Expected Routes Check:"
missing_count=0
for route in "${expected_routes[@]}"; do
  method="${route%%:*}"
  path="${route#*:}"
  # Simple check - if routes_json contains the path
  if echo "$routes_json" | grep -q "$path" 2>/dev/null; then
    echo "  ✅ $method $path"
  else
    echo "  ❌ $method $path - MISSING"
    missing_count=$((missing_count + 1))
  fi
done

# Save routes
echo "{\"timestamp\":\"$(date '+%Y-%m-%d %H:%M:%S')\",\"routes\":$routes_json}" > "$ROUTES_FILE"
echo ""
echo "✅ Routes saved to $ROUTES_FILE"

# Summary
echo ""
echo "📊 Summary:"
echo "  Missing routes: $missing_count"

if [ $missing_count -gt 0 ]; then
  echo ""
  echo "⚠️  Missing routes detected!"
  exit 1
else
  echo ""
  echo "✅ All expected routes are mapped"
  exit 0
fi

