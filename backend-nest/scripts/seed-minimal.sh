#!/bin/bash
# Minimal Seed Script - Creates demo data for list endpoints

set +e # Don't exit on first error

BASE_URL="${API_URL:-http://localhost:5002}"
TENANT_ID="${DEFAULT_TENANT_ID:-217492b2-f814-4ba0-ae50-4e4f8ecf6216}"
EMAIL="${LOGIN_EMAIL:-grc1@local}"
PASSWORD="${LOGIN_PASSWORD:-grc1}"

echo "🌱 Minimal Seed Script"
echo "====================="
echo "Tenant ID: $TENANT_ID"
echo "Base URL: $BASE_URL"

# Step 1: Login to get token
echo ""
echo "[1/6] Logging in..."
LOGIN_PAYLOAD="{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
LOGIN_RESPONSE=$(curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d "$LOGIN_PAYLOAD" \
  -m 10 \
  "$BASE_URL/api/v2/auth/login" 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Login failed"
  exit 1
fi

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -oE '"(access_token|accessToken)":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "❌ Login failed: No token received"
  exit 1
fi

echo "✅ Login successful"

# Step 2-6: Seed data (simplified - using curl)
echo ""
echo "[2/6] Seeding Governance Policies..."
POLICIES_CREATED=0
for code in "POL-001" "POL-002" "POL-003" "POL-004" "POL-005"; do
  POLICY_BODY="{\"code\":\"$code\",\"title\":\"Policy $code\",\"status\":\"active\"}"
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d "$POLICY_BODY" \
    -m 5 \
    "$BASE_URL/api/v2/governance/policies" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    POLICIES_CREATED=$((POLICIES_CREATED + 1))
  fi
done
echo "✅ Created $POLICIES_CREATED policies"

echo ""
echo "[3/6] Seeding Compliance Requirements..."
REQUIREMENTS_CREATED=0
for reg in "GDPR" "ISO 27001" "SOC 2" "HIPAA" "PCI DSS"; do
  REQ_BODY="{\"title\":\"$reg Compliance\",\"regulation\":\"$reg\",\"status\":\"pending\"}"
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d "$REQ_BODY" \
    -m 5 \
    "$BASE_URL/api/v2/compliance/requirements" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    REQUIREMENTS_CREATED=$((REQUIREMENTS_CREATED + 1))
  fi
done
echo "✅ Created $REQUIREMENTS_CREATED requirements"

echo ""
echo "[4/6] Seeding Risk Catalog..."
RISKS_CREATED=0
for i in {1..5}; do
  RISK_BODY="{\"code\":\"RISK-00$i\",\"name\":\"Risk $i\",\"default_likelihood\":3,\"default_impact\":4}"
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d "$RISK_BODY" \
    -m 5 \
    "$BASE_URL/api/v2/risk-catalog" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    RISKS_CREATED=$((RISKS_CREATED + 1))
  fi
done
echo "✅ Created $RISKS_CREATED risk catalog entries"

echo ""
echo "[5/6] Seeding Entity Types..."
ENTITY_TYPES_CREATED=0
for code in "APP" "SRV" "DB" "NET" "PRC"; do
  ET_BODY="{\"code\":\"$code\",\"name\":\"$code Entity\"}"
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d "$ET_BODY" \
    -m 5 \
    "$BASE_URL/api/v2/entity-registry/entity-types" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    ENTITY_TYPES_CREATED=$((ENTITY_TYPES_CREATED + 1))
  fi
done
echo "✅ Created $ENTITY_TYPES_CREATED entity types"

# Step 6: Summary
echo ""
echo "📊 Seed Summary:"
echo "  Policies: $POLICIES_CREATED"
echo "  Requirements: $REQUIREMENTS_CREATED"
echo "  Risk Catalog: $RISKS_CREATED"
echo "  Entity Types: $ENTITY_TYPES_CREATED"

echo ""
echo "✅ Minimal seed completed!"
exit 0

