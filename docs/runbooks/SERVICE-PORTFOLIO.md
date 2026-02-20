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
- Service-to-CI mapping is not yet implemented (planned for PR-B2)
- Incident/Change binding to services is not yet implemented (planned for PR-B3)

## RBAC Matrix

| Role | CMDB_SERVICE_READ | CMDB_SERVICE_WRITE | CMDB_SERVICE_OFFERING_READ | CMDB_SERVICE_OFFERING_WRITE |
|------|-------------------|--------------------|----------------------------|-----------------------------|
| ADMIN | Yes | Yes | Yes | Yes |
| MANAGER | Yes | Yes | Yes | Yes |
| USER | Yes | No | Yes | No |
