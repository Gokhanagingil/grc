# BCM and Risk Management Verification Runbook

This runbook provides verification commands for BCM (Business Continuity Management) and Risk Management modules after deployment.

## Prerequisites

- Access to staging server or local development environment
- Valid JWT token for authentication
- Demo tenant ID: `00000000-0000-0000-0000-000000000001`

## BCM Verification Commands

### 1. Verify BCM Service CRUD

```bash
# Get auth token (replace with actual credentials)
TOKEN=$(curl -s -X POST http://46.224.99.150:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"your-password"}' | jq -r '.accessToken')

# List BCM Services
curl -s http://46.224.99.150:3002/grc/bcm/services \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .

# Expected: { success: true, data: { items: [...], total, page, pageSize, totalPages } }
```

### 2. Verify BCM Nested Endpoints (LIST-CONTRACT Format)

These endpoints were fixed in PR #315 to return the correct LIST-CONTRACT format.

```bash
# Get BIAs by Service (replace SERVICE_ID with actual ID)
curl -s "http://46.224.99.150:3002/grc/bcm/services/{SERVICE_ID}/bias" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .

# Expected response format:
# {
#   "success": true,
#   "data": {
#     "items": [...],
#     "total": N,
#     "page": 1,
#     "pageSize": N,
#     "totalPages": 1
#   }
# }

# Get Plans by Service
curl -s "http://46.224.99.150:3002/grc/bcm/services/{SERVICE_ID}/plans" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .

# Get Exercises by Service
curl -s "http://46.224.99.150:3002/grc/bcm/services/{SERVICE_ID}/exercises" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .

# Get Steps by Plan (replace PLAN_ID with actual ID)
curl -s "http://46.224.99.150:3002/grc/bcm/plans/{PLAN_ID}/steps" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .
```

### 3. Verify BIA Create and List Visibility

```bash
# Create a BIA
curl -s -X POST http://46.224.99.150:3002/grc/bcm/bias \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "{SERVICE_ID}",
    "rtoMinutes": 240,
    "rpoMinutes": 60,
    "mtpdMinutes": 1440,
    "notes": "Test BIA for verification"
  }' | jq .

# Verify it appears in the nested list
curl -s "http://46.224.99.150:3002/grc/bcm/services/{SERVICE_ID}/bias" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq '.data.items | length'

# Expected: Should show the newly created BIA in the items array
```

## Risk Management v1 Verification Commands

### 1. Verify Risk CRUD

```bash
# List Risks
curl -s http://46.224.99.150:3002/grc/risks \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .

# Create a Risk
curl -s -X POST http://46.224.99.150:3002/grc/risks \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Risk for Verification",
    "description": "Risk created for smoke testing",
    "inherentImpact": "HIGH",
    "inherentLikelihood": "POSSIBLE",
    "status": "IDENTIFIED"
  }' | jq .

# Get Risk by ID
curl -s http://46.224.99.150:3002/grc/risks/{RISK_ID} \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .
```

### 2. Verify Risk-Control Link/Unlink (Added in PR #315)

```bash
# Link a Control to a Risk
curl -s -X POST "http://46.224.99.150:3002/grc/risks/{RISK_ID}/controls/{CONTROL_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .

# Expected: { success: true, message: "Control linked successfully" }

# Get Linked Controls for a Risk
curl -s "http://46.224.99.150:3002/grc/risks/{RISK_ID}/controls/list" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .

# Expected: { success: true, data: [...controls...] }

# Unlink a Control from a Risk
curl -s -X DELETE "http://46.224.99.150:3002/grc/risks/{RISK_ID}/controls/{CONTROL_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"

# Expected: HTTP 204 No Content
```

### 3. Verify Risk Score Calculation

Risk scores are calculated server-side as `inherentImpact * inherentLikelihood`.

```bash
# Create a risk and verify score is calculated
curl -s -X POST http://46.224.99.150:3002/grc/risks \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Score Test Risk",
    "inherentImpact": "HIGH",
    "inherentLikelihood": "LIKELY",
    "status": "IDENTIFIED"
  }' | jq '.data.inherentScore'

# Expected: Score should be calculated (e.g., 4 * 4 = 16 for HIGH * LIKELY)
```

## Staging Docker Commands

For verification inside the staging Docker environment:

```bash
# SSH to staging server first
ssh user@46.224.99.150

# Verify uploads permission (from PR #314)
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'ls -ld /app/data/uploads; echo ok > /app/data/uploads/.t; cat /app/data/uploads/.t; rm /app/data/uploads/.t'

# Run migrations
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'node dist/scripts/migration-run.js'

# Seed risk demo data (with JOBS_ENABLED=false to prevent CI hang)
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'JOBS_ENABLED=false node dist/scripts/seed-grc.js'
```

## Expected Healthy Signals

After running verification commands, confirm:

- [ ] BCM Services list returns LIST-CONTRACT format with `items` array
- [ ] BCM nested endpoints (bias, plans, exercises, steps) return LIST-CONTRACT format
- [ ] Created BIA/Plan/Exercise appears in nested list immediately
- [ ] Risk CRUD operations work (create, read, update, delete)
- [ ] Risk-Control link/unlink endpoints return expected responses
- [ ] Risk scores are calculated server-side
- [ ] Seed scripts complete without hanging (JOBS_ENABLED=false)

## Troubleshooting

### BCM Items Not Appearing in List

1. Check tenant ID matches in create and list requests
2. Verify serviceId is correct for nested endpoints
3. Check backend logs for any errors: `docker logs grc-staging-backend --tail 100`

### Risk-Control Link Returns 404

1. Verify both Risk ID and Control ID exist
2. Check tenant isolation - both entities must belong to same tenant
3. Ensure control is not soft-deleted (`isDeleted: false`)

### Seed Script Hangs

1. Ensure `JOBS_ENABLED=false` is set
2. Check for any scheduled jobs that might be running
3. Verify database connection is healthy

## Related Documentation

- `docs/GRC-DOMAIN-MODEL.md` - Entity relationships
- `docs/LIST-CONTRACT.md` - Response format specification
- `docs/RISK-MODULE-V1.md` - Risk module design
- `docs/BCM-MODULE.md` - BCM module design (if exists)
