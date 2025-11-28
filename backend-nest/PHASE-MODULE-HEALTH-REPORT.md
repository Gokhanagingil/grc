# PHASE MODULE HEALTH CHECK + POLICY/REQUIREMENT/BCM BUG FIX REPORT

**Date:** 2025-01-27  
**Status:** ✅ COMPLETED

## Executive Summary

This report documents the comprehensive health check and bug fixes for the GRC Platform backend modules, focusing on Policy, Requirement, and BCM (Business Continuity Management) modules. All critical issues have been resolved, and smoke tests have been implemented to ensure ongoing stability.

## PHASE 0 – Global Durum Tespiti

### Entities Identified

**Core Entities:**
- `UserEntity` (auth/users)
- `TenantEntity` (auth/tenants)
- `AuditLogEntity` (audit)

**Application Entities:**
- `PolicyEntity` (governance)
- `RequirementEntity` (compliance)
- `BIAProcessEntity` (bcm)
- `BCPPlanEntity` (bcm)
- `BCPExerciseEntity` (bcm)
- `RegulationEntity` (compliance reference)

### Modules Mapped

1. **Auth Module** (`src/modules/auth/`)
   - `AuthController` → `/api/v2/auth/login`, `/api/v2/auth/refresh`
   - `AuthService` → JWT token generation, password validation
   - `JwtStrategy` → JWT validation
   - `JwtAuthGuard` → Route protection

2. **Governance Module** (`src/modules/governance/`)
   - `GovernanceController` → `/api/v2/governance/policies`
   - `GovernanceService` → Policy CRUD operations
   - `PolicyEntity` → Database schema

3. **Compliance Module** (`src/modules/compliance/`)
   - `ComplianceController` → `/api/v2/compliance`, `/api/v2/compliance/requirements`
   - `ComplianceService` → Requirement CRUD operations
   - `RequirementEntity` → Database schema

4. **BCM Module** (`src/modules/bcm/`)
   - `BcmController` → `/api/v2/bcm/processes`, `/api/v2/bcm/plans`, `/api/v2/bcm/exercises`
   - `BcmService` → BIA/BCP CRUD operations
   - `BIAProcessEntity`, `BCPPlanEntity`, `BCPExerciseEntity` → Database schemas

### Database Configuration

- **Dev Environment:** SQLite
- **Database File:** `./data/grc.sqlite`
- **Connection:** `DB_DRIVER=sqlite`, `SQLITE_FILE=./data/grc.sqlite`
- **Synchronize:** `DB_SYNCHRONIZE=true` (dev only)

## PHASE 1 – DB & Entity Uyum Kontrolü

### Schema Check Script

Created `scripts/check-db-schema.ts` to compare TypeORM entity metadata with actual SQLite schema using `PRAGMA table_info`.

**Key Findings:**
- ✅ `PolicyEntity` schema matches database (minor "extra column" warnings for legacy fields, non-critical)
- ✅ `RequirementEntity` schema matches database
- ✅ `AuditLogEntity` schema matches database (UUID columns correctly defined as `varchar(36)` for SQLite)
- ⚠️ Some legacy columns in `policies` table (not blocking, informational only)

**Actions Taken:**
- No critical schema mismatches requiring immediate fixes
- Legacy columns documented for future cleanup

## PHASE 2 – Modül Bazlı Smoke Test ve Bug Fix

### PHASE 2.A – Governance / Policy

**Status:** ✅ FIXED (Previously resolved)

**Issues Found:**
- `status` field missing default value in DTO
- DTO/entity alignment verified

**Fixes Applied:**
1. `CreateGovernancePolicyDto.status` → Added `default: 'draft'` in `@ApiPropertyOptional`
2. `GovernanceService.create()` → Added `status: dto.status || 'draft'` fallback
3. DTO renamed to `CreateGovernancePolicyDto` to avoid conflict with `PolicyModule`

**Smoke Test:**
- Created `scripts/smoke-policies.ts`
- Tests: Create → List → Get-by-ID
- Command: `npm run smoke:policies`

### PHASE 2.B – Compliance / Requirement

**Status:** ✅ FIXED

**Issues Found:**
1. Frontend: Requirement rows not clickable (no detail view)
2. Backend: `GET /api/v2/compliance/:id` endpoint working correctly

**Fixes Applied:**
1. **Frontend:**
   - Added `getRequirement(id)` to `frontend/src/services/grc.ts`
   - Created `frontend/src/components/RequirementDetailDrawer.tsx` for detail view
   - Modified `frontend/src/pages/Compliance.tsx`:
     - Added `handleRowClick` to fetch full requirement and open drawer
     - Made `TableRow` clickable with hover styling
     - Added event propagation stop for action buttons

2. **Backend:**
   - Verified `GET /api/v2/compliance/:id` endpoint
   - No backend changes needed

**Smoke Test:**
- Created `scripts/smoke-requirements.ts`
- Tests: Create → List → Get-by-ID
- Command: `npm run smoke:requirements`

### PHASE 2.C – BCM (BIA / BCP / Exercise) – "Validation failed"

**Status:** ✅ FIXED (Previously resolved)

**Issues Found:**
- Optional UUID fields (`owner_user_id`, `process_id`, `scope_entity_id`, `plan_id`) sent as empty strings from frontend causing `@IsUUID()` validation errors

**Fixes Applied:**
1. `BcmService.createBIAProcess()` → Convert empty strings to `undefined` for `owner_user_id`
2. `BcmService.updateBIAProcess()` → Convert empty strings to `undefined` for `owner_user_id`
3. `BcmService.createBCPPlan()` → Convert empty strings to `undefined` for `process_id`, `scope_entity_id`
4. `BcmService.updateBCPPlan()` → Convert empty strings to `undefined` for `process_id`, `scope_entity_id`
5. `BcmService.createBCPExercise()` → Convert empty strings to `undefined` for `plan_id`

**Smoke Test:**
- Created `scripts/smoke-bcm.ts`
- Tests: Create BIA Process → Create BCP Plan → Create BCP Exercise → List BIA Processes
- Command: `npm run smoke:bcm`

## PHASE 3 – Smoke Scripts + `smoke:modules` Komutu

### Smoke Scripts Created

1. **`scripts/smoke-policies.ts`**
   - Tests Policy module CRUD operations
   - Command: `npm run smoke:policies`

2. **`scripts/smoke-requirements.ts`**
   - Tests Requirement module CRUD operations
   - Command: `npm run smoke:requirements`

3. **`scripts/smoke-bcm.ts`**
   - Tests BCM module CRUD operations (BIA Process, BCP Plan, BCP Exercise)
   - Command: `npm run smoke:bcm`

### Package.json Scripts Added

```json
{
  "smoke:policies": "ts-node -r tsconfig-paths/register scripts/smoke-policies.ts",
  "smoke:requirements": "ts-node -r tsconfig-paths/register scripts/smoke-requirements.ts",
  "smoke:bcm": "ts-node -r tsconfig-paths/register scripts/smoke-bcm.ts",
  "smoke:modules": "npm run smoke:login && npm run smoke:policies && npm run smoke:requirements && npm run smoke:bcm"
}
```

### Usage

```bash
# Run individual module smoke tests
npm run smoke:policies
npm run smoke:requirements
npm run smoke:bcm

# Run all module smoke tests (includes login)
npm run smoke:modules
```

## Test Results

### Acceptance Tests

✅ **`npm run build:once`** → PASS  
✅ **`npm run start:dev`** → PASS (backend starts successfully)  
✅ **`npm run health:probe`** → PASS (`/api/v2/health`, `/health`, `/v2/health` all return 200)  
✅ **`npm run smoke:login`** → PASS (LOGIN + PROTECTED 200)

### Module Smoke Tests

✅ **`npm run smoke:policies`** → PASS (Create, List, Get-by-ID)  
✅ **`npm run smoke:requirements`** → PASS (Create, List, Get-by-ID)  
✅ **`npm run smoke:bcm`** → PASS (Create BIA Process, Create BCP Plan, Create BCP Exercise, List BIA Processes)

## Changed Files

### Backend Files

1. **`backend-nest/scripts/smoke-policies.ts`** (NEW)
   - Policy module smoke test script

2. **`backend-nest/scripts/smoke-requirements.ts`** (NEW)
   - Requirement module smoke test script

3. **`backend-nest/scripts/smoke-bcm.ts`** (NEW)
   - BCM module smoke test script

4. **`backend-nest/package.json`**
   - Added `smoke:policies`, `smoke:requirements`, `smoke:bcm`, `smoke:modules` scripts

5. **`backend-nest/scripts/check-db-schema.ts`** (Previously created)
   - Database schema validation script

### Frontend Files

1. **`frontend/src/services/grc.ts`**
   - Added `getRequirement(id)` function

2. **`frontend/src/components/RequirementDetailDrawer.tsx`** (NEW)
   - Requirement detail drawer component

3. **`frontend/src/pages/Compliance.tsx`**
   - Added row click handler and detail drawer integration

## TODOs for Future Features

### Status Dictionary/Enum Generator

- **Location:** Policy, Requirement, BCM modules
- **Issue:** Status values (`draft`, `approved`, `retired`, `pending`, `in-progress`, `completed`, `overdue`) are hardcoded across multiple modules
- **Solution:** Create centralized status dictionary/enum generator to avoid duplication
- **Files with TODOs:**
  - `backend-nest/src/modules/governance/dto/create-policy.dto.ts`
  - `backend-nest/src/modules/governance/governance.service.ts`
  - `backend-nest/src/modules/compliance/comp.dto.ts`
  - `backend-nest/src/modules/compliance/comp.service.ts`
  - `backend-nest/src/modules/bcm/bcm.service.ts`

### UI Policy Engine for Status Transitions

- **Location:** Policy, Requirement, BCM modules
- **Issue:** Status transitions (e.g., `draft` → `approved`) should be validated via UI policy engine
- **Solution:** Implement status transition validation rules
- **Files with TODOs:**
  - `backend-nest/src/modules/governance/governance.service.ts`
  - `backend-nest/src/modules/compliance/comp.service.ts`
  - `backend-nest/src/modules/bcm/bcm.service.ts`

### Filter Out / Show Matching Features

- **Location:** Frontend Requirement detail drawer
- **Issue:** "Show Matching" and "Filter Out" buttons are placeholders
- **Solution:** Implement requirement matching and filtering logic
- **Files with TODOs:**
  - `frontend/src/components/RequirementDetailDrawer.tsx`

### Regulation Migration

- **Location:** Compliance module
- **Issue:** `RequirementEntity` has both `regulation_id` (UUID) and `regulation` (string) fields for backward compatibility
- **Solution:** Migrate all requirements to use `regulation_id` reference, remove `regulation` string field
- **Files with TODOs:**
  - `backend-nest/src/entities/app/requirement.entity.ts`
  - `backend-nest/src/modules/compliance/comp.dto.ts`
  - `backend-nest/src/modules/compliance/comp.service.ts`

### Category Migration

- **Location:** Compliance module
- **Issue:** `RequirementEntity` has both `categories` (JSON array) and `category` (string) fields for backward compatibility
- **Solution:** Migrate all requirements to use `categories` array, remove `category` string field
- **Files with TODOs:**
  - `backend-nest/src/entities/app/requirement.entity.ts`
  - `backend-nest/src/modules/compliance/comp.dto.ts`
  - `backend-nest/src/modules/compliance/comp.service.ts`

## Conclusion

All critical module health checks and bug fixes have been completed successfully. The Policy, Requirement, and BCM modules are now stable and fully functional. Smoke tests have been implemented to ensure ongoing stability. The frontend Requirement detail view is now working correctly.

**Next Steps:**
1. Run `npm run smoke:modules` regularly to verify module health
2. Implement centralized status dictionary/enum generator
3. Implement UI policy engine for status transitions
4. Plan migration from legacy `regulation`/`category` string fields to UUID/array references

---

**Report Generated:** 2025-01-27  
**Backend Version:** NestJS + TypeORM (SQLite dev, PostgreSQL prod)  
**Frontend Version:** React (CRA) + Material-UI

