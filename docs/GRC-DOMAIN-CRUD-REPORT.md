# GRC Domain CRUD Implementation Report

**Date:** December 2024  
**Sprint:** GRC CRUD Operations  
**Status:** Complete

## Overview

This sprint implemented full CRUD operations (create, update, soft delete) for the core GRC entities: Risks, Policies, and Requirements. The implementation includes proper RBAC enforcement, multi-tenancy support, realistic demo data seeding, comprehensive e2e tests, and a smoke script for quick verification.

## Implemented Features

### 1. CRUD Endpoints

All three resources follow the same REST pattern with RBAC enforcement:

| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| GET | `/grc/risks` | List all risks for tenant | Any authenticated |
| GET | `/grc/risks/:id` | Get risk by ID | Any authenticated |
| POST | `/grc/risks` | Create new risk | MANAGER, ADMIN |
| PATCH | `/grc/risks/:id` | Update risk | MANAGER, ADMIN |
| DELETE | `/grc/risks/:id` | Soft delete risk | MANAGER, ADMIN |
| GET | `/grc/risks/statistics` | Get risk statistics | Any authenticated |

The same pattern applies to `/grc/policies` and `/grc/requirements`.

### 2. DTOs with Validation

Created DTOs with class-validator decorators for input validation:

- `CreateRiskDto` / `UpdateRiskDto` - Risk creation and update
- `CreatePolicyDto` / `UpdatePolicyDto` - Policy creation and update
- `CreateRequirementDto` / `UpdateRequirementDto` - Requirement creation and update

All DTOs include:
- `@IsString()`, `@IsEnum()`, `@IsOptional()` decorators
- `@Type(() => Date)` for date field transformation
- Swagger decorators for API documentation

### 3. Service Layer Extensions

Extended the multi-tenant services with CRUD methods:

```typescript
// Example from GrcRiskService
async createForTenant(tenantId: string, userId: string, dto: CreateRiskDto): Promise<GrcRisk>
async updateForTenant(tenantId: string, id: string, dto: UpdateRiskDto): Promise<GrcRisk>
async softDeleteForTenant(tenantId: string, id: string): Promise<void>
```

All methods:
- Enforce tenant isolation via `tenantId`
- Emit domain events on create/update/delete
- Filter out soft-deleted records from list queries

### 4. Soft Delete Pattern

Added `isDeleted` boolean field to entities:

```typescript
@Column({ default: false })
isDeleted: boolean;
```

Soft-deleted records:
- Are not returned in list queries
- Can still be retrieved by ID (for audit purposes)
- Emit `*DeletedEvent` domain events

### 5. Domain Events

Added new domain events for update and delete operations:

- `RiskUpdatedEvent`, `RiskDeletedEvent`
- `PolicyUpdatedEvent`, `PolicyDeletedEvent`
- `RequirementUpdatedEvent`, `RequirementDeletedEvent`

Events are emitted via the existing event bus infrastructure.

### 6. RBAC Enforcement

Write endpoints (POST, PATCH, DELETE) require:
- `JwtAuthGuard` - Valid JWT token
- `TenantGuard` - Valid `x-tenant-id` header matching user's tenant
- `RolesGuard` - User must have MANAGER or ADMIN role

```typescript
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Post()
async create(@Body() dto: CreateRiskDto, @Req() req: Request) { ... }
```

## Demo Data Seeding

### Seed Script

Location: `backend-nest/src/scripts/seed-grc.ts`

Run with: `npm run seed:grc`

The seed script creates:
- 1 demo tenant (ID: `00000000-0000-0000-0000-000000000001`)
- 1 admin user (email: `admin@grc-platform.local`, password: `TestPassword123!`)
- 8 controls across different categories
- 8 risks with varying severities and statuses
- 6 policies covering security, privacy, and operations
- 8 compliance requirements (ISO 27001, SOC 2, GDPR)
- Risk-Control mappings
- Policy-Control mappings
- Requirement-Control mappings

The seed is idempotent - running it multiple times won't create duplicates.

### Demo Data Summary

**Risks:**
- Ransomware Attack (Critical)
- Insider Threat - Data Exfiltration (High)
- Business Email Compromise (High)
- Cloud Misconfiguration (High)
- Third-Party Vendor Breach (Medium)
- Regulatory Non-Compliance (Medium)
- Physical Security Breach (Low)
- Legacy System Vulnerabilities (High)

**Policies:**
- Information Security Policy (Active)
- Acceptable Use Policy (Active)
- Data Classification Policy (Active)
- Incident Response Policy (Active)
- Access Control Policy (Under Review)
- Business Continuity Policy (Draft)

**Requirements:**
- ISO 27001: A.5.1.1, A.6.1.2, A.9.2.3, A.12.3.1
- SOC 2: CC6.1, CC7.2
- GDPR: Art.32, Art.33

## Testing

### E2E Tests

Location: `backend-nest/test/grc.e2e-spec.ts`

Tests cover:
- GET /grc/risks - List risks with authentication
- POST /grc/risks - Create risk with RBAC
- PATCH /grc/risks/:id - Update risk
- DELETE /grc/risks/:id - Soft delete risk
- Same coverage for policies and requirements
- Statistics endpoints
- RBAC enforcement (401 without token, 400 without tenant header)
- Soft delete verification (deleted items don't appear in list)

Run with: `npm run test:e2e`

### Smoke Script

Location: `backend-nest/src/scripts/smoke-grc.ts`

Run with: `npm run smoke:grc`

The smoke script:
1. Checks NestJS backend health
2. Authenticates as demo admin
3. Hits all GRC endpoints with proper headers
4. Reports pass/fail status for each endpoint
5. Provides troubleshooting guidance if tests fail

## Files Created/Modified

### New Files

| File | Description |
|------|-------------|
| `backend-nest/src/grc/dto/create-risk.dto.ts` | Risk creation DTO |
| `backend-nest/src/grc/dto/update-risk.dto.ts` | Risk update DTO |
| `backend-nest/src/grc/dto/create-policy.dto.ts` | Policy creation DTO |
| `backend-nest/src/grc/dto/update-policy.dto.ts` | Policy update DTO |
| `backend-nest/src/grc/dto/create-requirement.dto.ts` | Requirement creation DTO |
| `backend-nest/src/grc/dto/update-requirement.dto.ts` | Requirement update DTO |
| `backend-nest/src/grc/dto/index.ts` | DTO exports |
| `backend-nest/src/scripts/seed-grc.ts` | Demo data seed script |
| `backend-nest/src/scripts/smoke-grc.ts` | Smoke test script |
| `backend-nest/test/grc.e2e-spec.ts` | E2E tests for GRC CRUD |

### Modified Files

| File | Changes |
|------|---------|
| `backend-nest/src/grc/entities/grc-risk.entity.ts` | Added `isDeleted` field |
| `backend-nest/src/grc/entities/grc-policy.entity.ts` | Added `isDeleted` field |
| `backend-nest/src/grc/entities/grc-requirement.entity.ts` | Added `isDeleted` field |
| `backend-nest/src/grc/services/grc-risk.service.ts` | Added CRUD methods |
| `backend-nest/src/grc/services/grc-policy.service.ts` | Added CRUD methods |
| `backend-nest/src/grc/services/grc-requirement.service.ts` | Added CRUD methods |
| `backend-nest/src/grc/controllers/grc-risk.controller.ts` | Added POST/PATCH/DELETE endpoints |
| `backend-nest/src/grc/controllers/grc-policy.controller.ts` | Added POST/PATCH/DELETE endpoints |
| `backend-nest/src/grc/controllers/grc-requirement.controller.ts` | Added POST/PATCH/DELETE endpoints |
| `backend-nest/src/grc/events/grc-domain-events.ts` | Added update/delete events |
| `backend-nest/src/grc/events/index.ts` | Updated exports |
| `backend-nest/package.json` | Added seed:grc and smoke:grc scripts |

## Quick Start Guide

### 1. Start PostgreSQL

Ensure PostgreSQL is running with the `grc_platform` database.

### 2. Configure Environment

```bash
cd backend-nest
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

### 3. Seed Demo Data

```bash
npm run seed:grc
```

### 4. Start NestJS Backend

```bash
npm run start:dev
```

### 5. Run Smoke Test

```bash
npm run smoke:grc
```

### 6. Test API Manually

```bash
# Login
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@grc-platform.local","password":"TestPassword123!"}'

# List risks (use token from login response)
curl http://localhost:3002/grc/risks \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"

# Create a risk
curl -X POST http://localhost:3002/grc/risks \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Risk","description":"Test risk","category":"Operational","severity":"Medium","likelihood":"Possible","impact":"Medium"}'
```

## Next Steps

The following features are intentionally deferred to future sprints:

1. **Control CRUD** - Full CRUD for GrcControl entity
2. **Issue/CAPA Workflows** - Full lifecycle management for issues and corrective actions
3. **Evidence Management** - File upload and evidence linking
4. **Mapping Management** - UI for managing risk-control, policy-control mappings
5. **Reporting** - Dashboard and export functionality
6. **Frontend Integration** - React components for GRC module

## Verification Checklist

- [x] TypeScript build passes with 0 errors
- [x] NestJS unit tests pass
- [x] Express backend tests pass (no regressions)
- [x] E2E tests created for GRC CRUD
- [x] Seed script creates demo data
- [x] Smoke script verifies endpoints
- [x] RBAC enforced on write endpoints
- [x] Multi-tenancy enforced via TenantGuard
- [x] Soft delete implemented with isDeleted field
- [x] Domain events emitted on create/update/delete
