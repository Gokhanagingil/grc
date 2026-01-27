# Statement of Applicability (SOA) Module

## Overview

The Statement of Applicability (SOA) is a key document in information security management that maps standard clauses (such as ISO 27001 or NIST controls) to an organization's specific implementation status. This module enables organizations to create, manage, and export SOA profiles for compliance and audit purposes.

## Key Concepts

### SOA Profile

An SOA Profile represents a complete Statement of Applicability document for a specific standard. Each profile contains:

- **Name**: A descriptive name for the SOA (e.g., "ISO 27001:2022 - Production Environment")
- **Standard**: The compliance standard being mapped (e.g., ISO 27001, NIST CSF)
- **Scope Statement**: A description of what systems, processes, or organizational units are covered
- **Status**: The lifecycle state of the profile (Draft, Published, Archived)
- **Version**: Incremented each time the profile is published

### SOA Items

Each SOA Profile contains items that correspond to individual clauses from the selected standard. For each clause, you can specify:

- **Applicability**: Whether the clause applies to your organization
  - `APPLICABLE`: The clause is relevant and must be addressed
  - `NOT_APPLICABLE`: The clause does not apply (with justification)
  - `UNDECIDED`: Not yet determined

- **Implementation Status**: Current state of implementation
  - `IMPLEMENTED`: Fully implemented and operational
  - `PARTIALLY_IMPLEMENTED`: Some aspects implemented
  - `PLANNED`: Implementation is scheduled
  - `NOT_IMPLEMENTED`: Not yet started

- **Justification**: Explanation for applicability decisions (especially important for NOT_APPLICABLE items)
- **Target Date**: When implementation is expected to be complete
- **Notes**: Additional context or comments

### Linking Controls and Evidence

SOA Items can be linked to:

- **Controls**: Security controls from your control library that address the clause
- **Evidence**: Documentation or artifacts that demonstrate compliance

## Workflow

### 1. Create a Profile

1. Navigate to GRC > SOA
2. Click "New SOA Profile"
3. Select the standard you want to map
4. Provide a name, description, and scope statement
5. Save the profile

### 2. Initialize Items

After creating a profile, click "Initialize Items" to automatically create SOA items for every clause in the selected standard. This is idempotent - running it multiple times won't create duplicates.

### 3. Assess Each Item

For each SOA item:

1. Determine if the clause is applicable to your organization
2. If not applicable, provide a justification
3. Set the implementation status
4. Link relevant controls and evidence
5. Add notes as needed

### 4. Publish the Profile

When your assessment is complete:

1. Review all items for completeness
2. Click "Publish" to finalize the profile
3. The version number will increment
4. Published profiles can still be edited (creates a new draft version)

### 5. Export for Auditors

Click "Export CSV" to generate a spreadsheet containing:

- Clause code and title
- Applicability status and justification
- Implementation status
- Target dates
- Control and evidence counts

This CSV can be shared with auditors or used for reporting.

## Roles and Permissions

The SOA module uses existing GRC permissions:

- **GRC_REQUIREMENT_READ**: View SOA profiles and items
- **GRC_REQUIREMENT_WRITE**: Create, edit, and manage SOA profiles and items

## Best Practices

1. **Complete Justifications**: Always provide clear justifications for NOT_APPLICABLE items - auditors will ask about these

2. **Link Evidence**: Connect SOA items to evidence artifacts to demonstrate compliance during audits

3. **Regular Reviews**: Periodically review and update your SOA as your organization and controls evolve

4. **Version Control**: Use the publish feature to create snapshots before major changes

5. **Scope Clarity**: Write clear scope statements that define exactly what is covered by the SOA

## Multi-Tenant Support

SOA profiles are fully tenant-isolated. Each tenant can have their own SOA profiles without visibility into other tenants' data. The `x-tenant-id` header is required for all API operations.

## Seeding SOA Data

The SOA module includes a seed script that creates demo SOA profiles and items for testing and demonstration purposes.

### Prerequisites

Before running the SOA seed, ensure you have:
1. Run the GRC seed to create the demo tenant and admin user: `npm run seed:grc` (dev) or `npm run seed:grc` (prod)
2. Run the standards seed to populate standards and clauses: `npm run seed:standards:dev` (dev) or `npm run seed:standards` (prod)

### Running the Seed

**Local Development (TypeScript mode):**
```bash
cd backend-nest
npm run seed:soa:dev
```

**Staging/Production (Compiled JavaScript mode):**
```bash
# Inside the backend container
npm run seed:soa:prod
# Or equivalently:
npm run seed:soa
```

### What the Seed Creates

The SOA seed script creates:
- 1 SOA profile (status: DRAFT) for the demo tenant, linked to an existing standard (ISO 27001 if available)
- SOA items for each clause in the selected standard, with various applicability and implementation statuses:
  - 10 items as IMPLEMENTED
  - 10 items as PLANNED
  - 5 items as NOT_APPLICABLE
  - 5 items as PARTIALLY_IMPLEMENTED
  - Remaining items as UNDECIDED/NOT_IMPLEMENTED

### Idempotency

The seed script is idempotent - running it multiple times will not create duplicate data. It checks for existing profiles and items before creating new ones.

### Data Source

SOA items are initialized from the `standards` and `standard_clauses` tables (legacy tables, NOT grc_standards/grc_standard_clauses). The seed script:
1. Finds an existing standard (preferring ISO 27001)
2. Creates an SOA profile linked to that standard
3. Creates SOA items for each clause in the standard

If no standards/clauses exist in the database, the seed will log a warning and exit without creating data.

### Verifying the Seed

After running the seed, you can verify the data was created correctly:

**Local Development:**
```bash
npm run smoke:soa
```

**Staging/Production:**
```bash
npm run smoke:soa:prod
```

The smoke test will:
1. Log in with admin credentials
2. Call `GET /grc/soa/profiles?page=1&pageSize=10`
3. Verify at least 1 profile exists
4. Test profile detail, items, and statistics endpoints

## Staging Verification Checklist

This is the canonical checklist for verifying SOA functionality on staging. Follow these steps in order after any deployment or database changes.

### Step 1: Run Migrations

Ensure all database migrations are applied:

```bash
# Inside backend container
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npx typeorm migration:show -d dist/data-source.js'
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npx typeorm migration:run -d dist/data-source.js'
```

### Step 2: Run Platform Validation

Verify the platform scripts work correctly:

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npm run platform:validate:prod'
```

### Step 3: Seed SOA Data (Idempotent)

Seed the SOA demo data:

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npm run seed:soa:prod'
```

### Step 4: Run SOA Smoke Test

Run the smoke test and verify it reports total >= 1:

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npm run smoke:soa:prod'
```

Expected output should show:
- `[OK] At least 1 SOA profile exists (total: X, seed verified)`
- `[SUCCESS] All SOA endpoints are accessible and conform to contract.`

### Step 5: Verify /api Prefix Parity

The frontend calls endpoints via `/api/*` which nginx strips before forwarding to the backend. Verify both paths return identical results.

**From inside the backend container (direct backend call):**
```bash
# Get a token first
TOKEN=$(docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'curl -s -X POST http://localhost:3002/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@grc-platform.local\",\"password\":\"TestPassword123!\"}" | grep -o "\"accessToken\":\"[^\"]*\"" | cut -d"\"" -f4')

# Direct backend call
docker compose -f docker-compose.staging.yml exec -T backend sh -lc "curl -s -H 'Authorization: Bearer $TOKEN' -H 'x-tenant-id: 00000000-0000-0000-0000-000000000001' 'http://localhost:3002/grc/soa/profiles?page=1&pageSize=10'"
```

**From the host (via nginx /api prefix):**
```bash
# Via nginx (from host)
curl -s -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     "http://localhost/api/grc/soa/profiles?page=1&pageSize=10"
```

Both calls should return the same JSON response with `items` array and `total` count.

### Step 6: Database Verification (Pure SQL)

If the smoke test reports 0 profiles, verify the database directly using pure SQL (no psql meta-commands):

```bash
# Check table schema
docker compose -f docker-compose.staging.yml exec -T db psql -U grc_staging -d grc_staging -c \
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='grc_soa_profiles';"

# Check existing profiles
docker compose -f docker-compose.staging.yml exec -T db psql -U grc_staging -d grc_staging -c \
  "SELECT id, tenant_id, status, is_deleted FROM grc_soa_profiles ORDER BY created_at DESC LIMIT 5;"

# Count profiles by tenant
docker compose -f docker-compose.staging.yml exec -T db psql -U grc_staging -d grc_staging -c \
  "SELECT tenant_id, COUNT(*) as count FROM grc_soa_profiles WHERE is_deleted = false GROUP BY tenant_id;"

# Check demo tenant profiles specifically
docker compose -f docker-compose.staging.yml exec -T db psql -U grc_staging -d grc_staging -c \
  "SELECT id, name, status, is_deleted FROM grc_soa_profiles WHERE tenant_id = '00000000-0000-0000-0000-000000000001';"
```

### Step 7: UI Quick Check

Open the frontend in a browser and verify:

1. Navigate to GRC > SOA
2. The profiles list should show at least 1 profile (the demo profile)
3. Click on the demo profile to open the detail view
4. The items table should show ~150 items (depending on the standard used)
5. Statistics should display counts by applicability and implementation status

### Troubleshooting

If the smoke test reports 0 profiles but the database has data:

1. **Check tenant ID**: Ensure the `x-tenant-id` header matches the tenant in the database
2. **Check is_deleted flag**: Profiles with `is_deleted = true` are filtered out
3. **Check API_BASE_URL**: The smoke script uses `API_BASE_URL` or `NEST_API_URL` env vars (default: `http://localhost:3002`)
4. **Check nginx routing**: Verify `/api/*` prefix stripping is working (see Step 5)

If the endpoint returns 404:

1. Verify the backend container is running: `docker ps | grep backend`
2. Check backend logs: `docker logs grc-staging-backend --tail 100`
3. Verify the SOA controller is registered: check for `/grc/soa` routes in startup logs
