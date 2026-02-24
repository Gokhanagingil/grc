# Runbook: Activation Stabilization Pack v5

## Overview
This runbook provides validation commands and troubleshooting steps for the v5 stabilization fixes.

## Prerequisites
```bash
# Set variables
export BASE_URL="http://46.224.99.150"
export TENANT_ID="00000000-0000-0000-0000-000000000001"

# Get auth token
TOKEN=$(curl -s -X POST "$BASE_URL/api/grc/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{"email":"admin@grc-platform.local","password":"TestPassword123!"}' \
  | jq -r '.data.accessToken // .accessToken // .token')

echo "Token: ${TOKEN:0:20}..."
```

## A) CAB Meeting List/Detail Validation

### List (should return items array, no validation error)
```bash
curl -s "$BASE_URL/api/grc/itsm/cab-meetings?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq '.success, .data.items | length, .data.total'
```
Expected: `true`, item count, total count

### Detail (requires a valid meeting ID)
```bash
CAB_ID=$(curl -s "$BASE_URL/api/grc/itsm/cab-meetings?page=1&pageSize=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq -r '.data.items[0].id')

curl -s "$BASE_URL/api/grc/itsm/cab-meetings/$CAB_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq '.success, .data.id, .data.title, .data.status'
```

## B) Incident Edit/Save Validation

### Get an existing incident
```bash
INC_ID=$(curl -s "$BASE_URL/api/grc/itsm/incidents?page=1&pageSize=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq -r '.data.items[0].id')

echo "Incident ID: $INC_ID"
```

### Update with minimal valid payload (should succeed, not "Validation failed")
```bash
curl -s -X PATCH "$BASE_URL/api/grc/itsm/incidents/$INC_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"shortDescription":"Updated via runbook test","status":"open"}' | jq '.'
```
Expected: `{ "success": true, "data": { ... } }`

## C) Change Detail — Link Risk / Link Control

### Get a change ID
```bash
CHANGE_ID=$(curl -s "$BASE_URL/api/grc/itsm/changes?page=1&pageSize=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq -r '.data.items[0].id')

echo "Change ID: $CHANGE_ID"
```

### Get available risks
```bash
RISK_ID=$(curl -s "$BASE_URL/api/grc/risks?page=1&pageSize=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq -r '.data.items[0].id')

echo "Risk ID: $RISK_ID"
```

### Link a risk to a change
```bash
curl -s -X POST "$BASE_URL/api/grc/itsm/changes/$CHANGE_ID/risks/$RISK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'
```

### Get linked risks
```bash
curl -s "$BASE_URL/api/grc/itsm/changes/$CHANGE_ID/risks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq '.'
```

### Unlink a risk
```bash
curl -s -X DELETE "$BASE_URL/api/grc/itsm/changes/$CHANGE_ID/risks/$RISK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq '.'
```

### Link/unlink controls (same pattern)
```bash
CONTROL_ID=$(curl -s "$BASE_URL/api/grc/controls?page=1&pageSize=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq -r '.data.items[0].id')

# Link
curl -s -X POST "$BASE_URL/api/grc/itsm/changes/$CHANGE_ID/controls/$CONTROL_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'

# Get linked
curl -s "$BASE_URL/api/grc/itsm/changes/$CHANGE_ID/controls" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq '.'

# Unlink
curl -s -X DELETE "$BASE_URL/api/grc/itsm/changes/$CHANGE_ID/controls/$CONTROL_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq '.'
```

## D) Major Incident List Validation

```bash
curl -s "$BASE_URL/api/grc/itsm/major-incidents?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq '.success, .data.items | length, .data.total'
```
Expected: `true`, item count, total count

## E) E2E Status

E2E tests on PRs #480-#483 all passed (green). The E2E failure mentioned was transient and not reproducible on the latest CI runs. No product regression was identified.

Evidence:
- PR #480: e2e-tests passed, E2E Tests (Full Suite) passed
- PR #481: e2e-tests passed, E2E Tests (Full Suite) passed
- PR #482: e2e-tests passed
- PR #483: e2e-tests passed, MOCK_UI E2E Tests passed

## Troubleshooting Matrix

| HTTP Status | Meaning | Action |
|---|---|---|
| 400 | Validation failed (DTO) | Check payload fields against DTO allowlist. Look for forbidden fields or wrong types. |
| 401 | Unauthorized | Token expired or missing. Re-authenticate. |
| 403 | Forbidden | Missing RBAC permission. Check guard stack: JwtAuthGuard + TenantGuard + PermissionsGuard. |
| 404 | Not Found | Wrong endpoint path or resource ID. Verify route matches @Controller('grc/...') pattern. |
| 409 | Conflict | Duplicate link or concurrent modification. Check idempotency. |
| 422 | Unprocessable Entity | Business logic validation failure. Check service-level validation. |
| 500 | Internal Server Error | Check backend logs: `docker compose -f docker-compose.staging.yml logs --tail=50 backend` |

## UI Smoke Checklist

- [ ] Navigate to `/itsm/change-management/cab` — list loads without "Validation failed"
- [ ] Click a CAB meeting — detail page loads, fields populate
- [ ] Edit and save a CAB meeting — saves without error
- [ ] Navigate to `/itsm/incidents` — list loads
- [ ] Open an existing incident — detail loads
- [ ] Edit description and click Save — saves without "Validation failed"
- [ ] Navigate to a Change detail page — page loads
- [ ] Click "Link Risk" — dialog opens with searchable risk list
- [ ] Select a risk — link created, appears in linked risks section
- [ ] Click unlink on the risk — risk removed from list
- [ ] Click "Link Control" — dialog opens, select and link works
- [ ] Navigate to `/itsm/major-incidents` — list loads without "Failed to load"
- [ ] Verify error messages are actionable (not just "Validation failed")

## E2E Pre-Merge Verification Checklist

- [ ] All CI checks pass (lint, build, tests, security scans)
- [ ] e2e-tests job: PASS
- [ ] MOCK_UI E2E Tests job: PASS
- [ ] No new CodeQL alerts introduced
- [ ] TruffleHog secret scan: PASS
