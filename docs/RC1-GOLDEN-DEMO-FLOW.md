# RC1 Golden Demo Flow

**Version:** v0.9.0-rc1  
**Last Updated:** January 31, 2026  
**Duration:** 10-15 minutes

This document describes the "Golden Demo Flow" - a comprehensive end-to-end demonstration scenario that validates all critical platform functionality. Use this flow for release validation, stakeholder demos, and smoke testing.

## Prerequisites

Before running the demo, ensure the following are available:

| Requirement | Value |
|-------------|-------|
| Staging URL | http://46.224.99.150 |
| Demo Tenant ID | `00000000-0000-0000-0000-000000000001` |
| Admin Email | `admin@grc-platform.local` |
| Admin Password | `TestPassword123!` |

## Demo Scenario Overview

The Golden Demo Flow validates these core capabilities in sequence:

1. **Authentication** - Login with demo tenant credentials
2. **Controls Library** - View and search controls
3. **Risk Management** - Create a risk, view risk list
4. **Risk-Control Linking** - Link a control to a risk, verify the relationship
5. **BCM Module** - Create a Service, BIA, Plan, and Exercise
6. **Calendar Integration** - View calendar events
7. **Platform Builder** - Access admin tables (dynamic schema)

## Part 1: Authentication

### UI Steps

1. Navigate to http://46.224.99.150
2. Enter email: `admin@grc-platform.local`
3. Enter password: `TestPassword123!`
4. Click "Sign In"
5. Verify: Dashboard loads, user menu shows admin user

### API Verification

```bash
# Login and get token
curl -X POST http://46.224.99.150/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@grc-platform.local","password":"TestPassword123!"}' \
  | jq '.data.accessToken'
```

**Expected:** HTTP 200, response contains `accessToken`

## Part 2: Controls Library

### UI Steps

1. Navigate to GRC → Controls (sidebar)
2. Verify: Controls list page loads
3. Use search box to search for "access"
4. Verify: Search filters the list (or shows empty state if no matches)
5. Clear search, apply Status filter = "Implemented"
6. Verify: Filter chips appear, list updates

### API Verification

```bash
# List controls with pagination
curl -s "http://46.224.99.150/api/grc/controls?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  | jq '{total: .data.total, page: .data.page, itemCount: (.data.items | length)}'
```

**Expected:** HTTP 200, LIST-CONTRACT response with `{items, total, page, pageSize, totalPages}`

## Part 3: Risk Management

### UI Steps

1. Navigate to GRC → Risks (sidebar)
2. Verify: Risks list page loads
3. Click "New Risk" button
4. Fill in:
   - Title: "Demo Risk - Data Breach Scenario"
   - Severity: High
   - Likelihood: Possible
   - Status: Identified
5. Click Save
6. Verify: Risk appears in the list

### API Verification

```bash
# Create a risk
RISK_RESPONSE=$(curl -s -X POST "http://46.224.99.150/api/grc/risks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "RC1 Demo Risk - API Created",
    "severity": "high",
    "likelihood": "possible",
    "impact": "high",
    "status": "identified"
  }')

RISK_ID=$(echo $RISK_RESPONSE | jq -r '.data.id // .id')
echo "Created Risk ID: $RISK_ID"
```

**Expected:** HTTP 201, response contains risk with `id`

## Part 4: Risk-Control Linking

### UI Steps

1. From the Risks list, click on the newly created risk
2. Navigate to the "Controls" tab
3. Click "Link Control"
4. Select a control from the list
5. Verify: Control appears in the linked controls section
6. (Optional) Unlink the control to test unlinking

### API Verification

```bash
# Get a control ID first
CONTROL_ID=$(curl -s "http://46.224.99.150/api/grc/controls?page=1&pageSize=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  | jq -r '.data.items[0].id')

# Link control to risk
curl -s -X POST "http://46.224.99.150/api/grc/risks/${RISK_ID}/controls/${CONTROL_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"

# Verify linked controls
curl -s "http://46.224.99.150/api/grc/risks/${RISK_ID}/controls/list" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  | jq '.data | length'
```

**Expected:** Link returns HTTP 200, list shows at least 1 linked control

## Part 5: BCM Module

### UI Steps

1. Navigate to BCM → Services (sidebar)
2. Click "New Service"
3. Fill in:
   - Name: "Demo Critical Service"
   - Status: Active
   - Criticality: Tier 1
4. Save the service
5. Open the service detail
6. Create a BIA (Business Impact Analysis) for the service
7. Create a Plan (BCP or DRP) for the service
8. Create an Exercise for the service
9. Verify: All items appear in their respective tabs

### API Verification

```bash
# Create BCM Service
SERVICE_RESPONSE=$(curl -s -X POST "http://46.224.99.150/api/grc/bcm/services" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RC1 Demo Service",
    "status": "ACTIVE",
    "criticalityTier": "TIER_1"
  }')

SERVICE_ID=$(echo $SERVICE_RESPONSE | jq -r '.data.id // .id')
echo "Created Service ID: $SERVICE_ID"

# Create BIA
curl -s -X POST "http://46.224.99.150/api/grc/bcm/bias" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d "{
    \"serviceId\": \"$SERVICE_ID\",
    \"name\": \"RC1 Demo BIA\",
    \"status\": \"DRAFT\",
    \"financialImpact\": 3,
    \"operationalImpact\": 3,
    \"reputationalImpact\": 2
  }"

# Create Plan
curl -s -X POST "http://46.224.99.150/api/grc/bcm/plans" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d "{
    \"serviceId\": \"$SERVICE_ID\",
    \"name\": \"RC1 Demo BCP\",
    \"planType\": \"BCP\",
    \"status\": \"DRAFT\"
  }"

# Create Exercise
curl -s -X POST "http://46.224.99.150/api/grc/bcm/exercises" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d "{
    \"serviceId\": \"$SERVICE_ID\",
    \"name\": \"RC1 Demo Tabletop Exercise\",
    \"exerciseType\": \"TABLETOP\",
    \"status\": \"PLANNED\",
    \"scheduledAt\": \"2026-03-01T10:00:00Z\"
  }"

# List exercises to verify
curl -s "http://46.224.99.150/api/grc/bcm/exercises?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  | jq '{total: .total, itemCount: (.items | length)}'
```

**Expected:** All create operations return HTTP 201, list shows created items

## Part 6: Calendar Integration

### UI Steps

1. Navigate to Calendar (sidebar)
2. Verify: Calendar view loads
3. Navigate to a month with scheduled exercises or audits
4. Verify: Events appear on the calendar

### API Verification

```bash
# Get calendar events for current quarter
START_DATE=$(date -u +"%Y-%m-01T00:00:00Z")
END_DATE=$(date -u -d "+3 months" +"%Y-%m-01T00:00:00Z")

curl -s "http://46.224.99.150/api/grc/calendar/events?start=${START_DATE}&end=${END_DATE}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  | jq '{success: .success, eventCount: (.data | length)}'
```

**Expected:** HTTP 200, response contains `{success: true, data: [...]}`

## Part 7: Platform Builder (Admin Tables)

### UI Steps

1. Navigate to Admin → Platform Builder → Tables (sidebar)
2. Verify: Tables list loads
3. Look for `u_vendor` or other demo tables
4. Click on a table to view its schema/records

### API Verification

```bash
# List admin tables
curl -s "http://46.224.99.150/api/grc/admin/tables?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  | jq '{total: .data.total, tables: [.data.items[].name]}'
```

**Expected:** HTTP 200, LIST-CONTRACT response with table definitions

## Automated Verification Script

For automated verification, use the script at `ops/rc1-golden-flow-verify.sh`:

```bash
# Run from repository root
bash ops/rc1-golden-flow-verify.sh
```

The script will:
1. Authenticate and obtain a token
2. Verify all critical endpoints
3. Create test entities (risk, BCM service, etc.)
4. Verify relationships
5. Output PASS/FAIL for each step
6. Clean up test data (optional)

## Success Criteria

The Golden Demo Flow is considered successful when:

| Step | Criterion |
|------|-----------|
| Authentication | Login returns valid token |
| Controls | List returns HTTP 200 with LIST-CONTRACT format |
| Risks | Create returns HTTP 201, list shows new risk |
| Risk-Control Link | Link succeeds, linked controls list shows control |
| BCM Service | Create returns HTTP 201 |
| BCM BIA | Create returns HTTP 201 |
| BCM Plan | Create returns HTTP 201 |
| BCM Exercise | Create returns HTTP 201, list shows exercise |
| Calendar | Events endpoint returns HTTP 200 |
| Platform Builder | Tables endpoint returns HTTP 200 |

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Token expired - re-authenticate
- Missing `Authorization` header

**400 Bad Request - Missing x-tenant-id**
- Add `x-tenant-id: 00000000-0000-0000-0000-000000000001` header

**404 Not Found**
- Check endpoint path (should include `/api/` prefix for external calls)
- Verify the entity ID exists

**500 Internal Server Error**
- Check backend logs: `docker logs grc-staging-backend`
- Verify database connectivity: `curl http://46.224.99.150:3002/health/db`

### Health Check Endpoints

```bash
# Liveness
curl http://46.224.99.150:3002/health/live

# Readiness (includes DB check)
curl http://46.224.99.150:3002/health/ready

# Database status
curl http://46.224.99.150:3002/health/db

# Auth configuration
curl http://46.224.99.150:3002/health/auth
```

## Related Documentation

- [STAGING-MAINTENANCE-RUNBOOK.md](./STAGING-MAINTENANCE-RUNBOOK.md) - Staging environment operations
- [LIST-CONTRACT.md](./LIST-CONTRACT.md) - API response format specification
- [EVIDENCE-GOLDEN-FLOW-RUNBOOK.md](./EVIDENCE-GOLDEN-FLOW-RUNBOOK.md) - Evidence lifecycle flow
