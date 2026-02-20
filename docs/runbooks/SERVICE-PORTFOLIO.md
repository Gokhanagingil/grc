# Service Portfolio Runbook (PR-B1)

## Overview

PR-B1 introduces the **Service Portfolio Core** for the CMDB module, enabling Business and Technical Services with Service Offerings. This is the foundation for CSDM-lite service mapping.

## What Changed

### Backend
- **Entities**: `cmdb_service` and `cmdb_service_offering` with multi-tenant support
- **Migration**: `1739800000000-CreateServicePortfolioTables` (idempotent, creates tables + indexes + sys_choice seeds)
- **Controllers**: CRUD endpoints under `/grc/cmdb/services` and `/grc/cmdb/service-offerings`
- **RBAC**: New permissions `CMDB_SERVICE_READ/WRITE` and `CMDB_SERVICE_OFFERING_READ/WRITE`
- **Choice validation**: All enumerated fields validated via ChoiceService (`type`, `status`, `tier`, `criticality`, offering `status`)
- **Seed script**: `seed-service-portfolio.ts` with 5 sample services and 8 offerings

### Frontend
- **Navigation**: "Services" item added to CMDB section in ITSM sidebar
- **ServiceList page**: Paginated list with search, type/status/tier/criticality columns
- **ServiceDetail page**: Full edit form + offerings table with inline add dialog
- **Routes**: `/cmdb/services`, `/cmdb/services/new`, `/cmdb/services/:id`

## API Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/grc/cmdb/services` | `CMDB_SERVICE_READ` | List services (paginated) |
| GET | `/grc/cmdb/services/:id` | `CMDB_SERVICE_READ` | Get service by ID |
| POST | `/grc/cmdb/services` | `CMDB_SERVICE_WRITE` | Create service |
| PATCH | `/grc/cmdb/services/:id` | `CMDB_SERVICE_WRITE` | Update service |
| DELETE | `/grc/cmdb/services/:id` | `CMDB_SERVICE_WRITE` | Soft-delete service |
| GET | `/grc/cmdb/service-offerings` | `CMDB_SERVICE_OFFERING_READ` | List offerings |
| GET | `/grc/cmdb/service-offerings/:id` | `CMDB_SERVICE_OFFERING_READ` | Get offering |
| POST | `/grc/cmdb/service-offerings` | `CMDB_SERVICE_OFFERING_WRITE` | Create offering |
| PATCH | `/grc/cmdb/service-offerings/:id` | `CMDB_SERVICE_OFFERING_WRITE` | Update offering |
| DELETE | `/grc/cmdb/service-offerings/:id` | `CMDB_SERVICE_OFFERING_WRITE` | Soft-delete offering |

## Choice Fields (sys_choice)

| Table | Field | Values |
|-------|-------|--------|
| `cmdb_service` | `type` | `business_service`, `technical_service` |
| `cmdb_service` | `status` | `planned`, `design`, `live`, `retired` |
| `cmdb_service` | `tier` | `tier_0`, `tier_1`, `tier_2`, `tier_3` |
| `cmdb_service` | `criticality` | `critical`, `high`, `medium`, `low` |
| `cmdb_service_offering` | `status` | `planned`, `live`, `retired` |

## Staging Verification

### 1. Run Migration
```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npx typeorm migration:run -d dist/data-source.js'
```

### 2. Verify Tables Exist
```bash
docker compose -f docker-compose.staging.yml exec -T db psql -U grc -d grc -c \
  "SELECT table_name FROM information_schema.tables WHERE table_name IN ('cmdb_service','cmdb_service_offering');"
```

### 3. Run Seed (Optional)
```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npx ts-node src/scripts/seed-service-portfolio.ts'
```

### 4. Verify API
```bash
# List services (requires valid JWT + tenant)
wget -qO- --header="Authorization: Bearer <TOKEN>" \
  --header="x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3002/grc/cmdb/services
```

### 5. Frontend Verification
1. Log in to the platform
2. Switch to ITSM domain
3. Open CMDB > Services in the sidebar
4. Verify the list loads (empty or with seed data)
5. Click "New Service" and create a service
6. Open the service detail
7. Add an offering via the "Add Offering" button
8. Verify the offering appears in the table

## Known Limitations

- `ownerUserId` is a nullable UUID field; no FK constraint to users table (users may be in Express backend)
- `defaultSlaProfileId` on offerings is a placeholder UUID; will be wired to SLA profiles in PR-B3/B4
- Incident/Change binding to services is not yet implemented (planned for PR-B3)

## RBAC Matrix

| Role | CMDB_SERVICE_READ | CMDB_SERVICE_WRITE | CMDB_SERVICE_OFFERING_READ | CMDB_SERVICE_OFFERING_WRITE |
|------|-------------------|--------------------|----------------------------|-----------------------------|
| ADMIN | Yes | Yes | Yes | Yes |
| MANAGER | Yes | Yes | Yes | Yes |
| USER | Yes | No | Yes | No |

---

# Service-CI Mapping (PR-B2)

## Overview

PR-B2 introduces **CSDM-lite Service-to-CI Mapping** via a many-to-many `cmdb_service_ci` table. This enables linking services to configuration items with typed relationships (depends_on, hosted_on, consumed_by, supports, managed_by, monitored_by).

## What Changed

### Backend
- **Entity**: `CmdbServiceCi` M2M entity with `serviceId`, `ciId`, `relationshipType`, `isPrimary`
- **Migration**: `1739900000000-CreateServiceCiMappingTable` (idempotent, creates table + indexes + unique constraint)
- **Controller**: Endpoints under `/grc/cmdb/services/:serviceId/cis/:ciId` and `/grc/cmdb/cis/:ciId/services`
- **RBAC**: Reuses `CMDB_SERVICE_READ` for listing, `CMDB_SERVICE_WRITE` for link/unlink
- **Choice validation**: `relationshipType` validated via ChoiceService (`cmdb_service_ci.relationship_type`)
- **Seed script**: `seed-service-ci-mapping.ts` with 6 relationship type choices and sample mappings

### Frontend
- **CI Detail page**: "Related Services" section with link/unlink modal
- **Service Detail page**: "Related CIs" section with link/unlink modal
- **API client**: New `cmdbApi.serviceCi` methods for link, unlink, cisForService, servicesForCi

## Service-CI API Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/grc/cmdb/services/:serviceId/cis/:ciId` | `CMDB_SERVICE_WRITE` | Link CI to service |
| DELETE | `/grc/cmdb/services/:serviceId/cis/:ciId?relationshipType=...` | `CMDB_SERVICE_WRITE` | Unlink CI from service |
| GET | `/grc/cmdb/services/:serviceId/cis` | `CMDB_SERVICE_READ` | List CIs for a service |
| GET | `/grc/cmdb/cis/:ciId/services` | `CMDB_SERVICE_READ` | List services for a CI |

## Service-CI Choice Fields (sys_choice)

| Table | Field | Values |
|-------|-------|--------|
| `cmdb_service_ci` | `relationship_type` | `depends_on`, `hosted_on`, `consumed_by`, `supports`, `managed_by`, `monitored_by` |

## Staging Verification (PR-B2)

### 1. Run Migration
```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npx typeorm migration:run -d dist/data-source.js'
```

### 2. Verify Table Exists
```bash
docker compose -f docker-compose.staging.yml exec -T db psql -U grc -d grc -c \
  "SELECT table_name FROM information_schema.tables WHERE table_name = 'cmdb_service_ci';"
```

### 3. Run Seed (Optional)
```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'node dist/scripts/seed-service-ci-mapping.js'
```

### 4. Verify API
```bash
# List CIs for a service
wget -qO- --header="Authorization: Bearer <TOKEN>" \
  --header="x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3002/grc/cmdb/services/<SERVICE_ID>/cis

# List services for a CI
wget -qO- --header="Authorization: Bearer <TOKEN>" \
  --header="x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3002/grc/cmdb/cis/<CI_ID>/services
```

### 5. Frontend Verification
1. Log in to the platform
2. Navigate to CMDB > CIs and open a CI detail
3. Verify "Related Services" section appears with "Link Service" button
4. Click "Link Service", select a service and relationship type, click Link
5. Verify the linked service appears in the table
6. Navigate to CMDB > Services and open a service detail
7. Verify "Related CIs" section appears with "Link CI" button
8. Click "Link CI", select a CI and relationship type, click Link
9. Verify the linked CI appears in the table
10. Unlink a relationship and verify it disappears
