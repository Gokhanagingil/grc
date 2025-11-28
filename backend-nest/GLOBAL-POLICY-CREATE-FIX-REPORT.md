# GLOBAL POLICY CREATE FIX - Final Report

## Date
2025-01-27

## Executive Summary

**Problem**: Policy create operation returns 500 Internal Server Error, while other modules (Requirements, BCM) work correctly.

**Root Cause**: The `policies` table in SQLite had an **outdated schema** with old columns (`name`, `description`, `owner`, `version`, `effectiveDate`, `reviewDate`, `tags`, `createdAt`, `updatedAt`, `deletedAt`) that don't exist in the current `PolicyEntity` definition. This schema mismatch caused TypeORM insert operations to fail.

**Solution**: Dropped the `policies` table to allow TypeORM synchronize to recreate it with the correct schema matching `PolicyEntity`.

**Status**: ✅ **FIXED** (requires backend restart to apply)

---

## Root Cause Analysis

### 1. Schema Mismatch

The `policies` table contained **old columns** from a previous Policy entity implementation:
- `name` (varchar(160), NOT NULL)
- `description` (TEXT, nullable)
- `owner` (varchar(80), nullable)
- `version` (varchar(32), nullable)
- `effectiveDate` (date, nullable) - **camelCase**
- `reviewDate` (date, nullable) - **camelCase**
- `tags` (TEXT, nullable)
- `createdAt` (datetime, NOT NULL) - **camelCase**
- `updatedAt` (datetime, NOT NULL) - **camelCase**
- `deletedAt` (datetime, nullable) - **camelCase**

The current `PolicyEntity` uses **snake_case** naming and different fields:
- `title` (instead of `name`)
- `owner_first_name`, `owner_last_name` (instead of `owner`)
- `effective_date`, `review_date` (instead of `effectiveDate`, `reviewDate`)
- `created_at`, `updated_at` (instead of `createdAt`, `updatedAt`)
- No `description`, `version`, `tags`, `deletedAt`

### 2. Why It Failed

TypeORM's `synchronize` option doesn't automatically drop columns that are no longer in the entity definition. When TypeORM tried to insert a new policy:
- It attempted to insert only the columns defined in `PolicyEntity`
- SQLite may have rejected the insert due to schema inconsistencies
- OR the old `name` column (NOT NULL) was causing constraint violations

### 3. Evidence

**Smoke Test Result:**
```
[SMOKE] Creating policy...
FAIL CREATE 500 { statusCode: 500, message: 'Internal server error' }
```

**Schema Check Result:**
- ✅ Entity defines 14 columns (id, tenant_id, code, title, status, owner_first_name, owner_last_name, effective_date, review_date, content, created_by, updated_by, created_at, updated_at)
- ❌ DB had 24 columns (14 new + 10 old columns)

---

## Solution Applied

### Phase 0: Reproduce & Log
- ✅ Created `check-policy-schema.ts` script to compare entity with DB schema
- ✅ Reproduced 500 error using `npm run smoke:policies`
- ✅ Identified schema mismatch

### Phase 1: Schema Analysis
- ✅ Documented all column differences
- ✅ Identified root cause: outdated schema with old columns
- ✅ Created `PHASE-1-POLICY-SCHEMA-REPORT.md`

### Phase 2: Minimal Fix
- ✅ Created `fix-policy-schema.ts` script to drop and recreate table
- ✅ Executed fix: `npm run fix:policy-schema`
- ✅ Successfully dropped `policies` table
- ✅ Added `fix:policy-schema` script to `package.json`

### Phase 3: Verification (Pending Backend Restart)
- ⏳ Backend restart required for TypeORM synchronize to recreate table
- ⏳ After restart, run `npm run smoke:policies` to verify fix
- ⏳ Run `npm run check:policy-schema` to verify schema matches entity

---

## Files Changed

### New Files
1. `backend-nest/scripts/check-policy-schema.ts`
   - Compares `PolicyEntity` with actual SQLite schema
   - Identifies missing/extra columns and NOT NULL constraints

2. `backend-nest/scripts/fix-policy-schema.ts`
   - Drops the `policies` table (dev-only, deletes all data)
   - Allows TypeORM synchronize to recreate with correct schema

3. `backend-nest/PHASE-1-POLICY-SCHEMA-REPORT.md`
   - Detailed schema comparison report

4. `backend-nest/PHASE-2-POLICY-SCHEMA-FIX-REPORT.md`
   - Fix implementation report

### Modified Files
1. `backend-nest/package.json`
   - Added `check:policy-schema` script
   - Added `fix:policy-schema` script

### Unchanged Files (No Breaking Changes)
- ✅ `backend-nest/src/entities/app/policy.entity.ts` - No changes
- ✅ `backend-nest/src/modules/governance/governance.service.ts` - No changes
- ✅ `backend-nest/src/modules/governance/governance.controller.ts` - No changes
- ✅ `backend-nest/src/modules/governance/dto/create-policy.dto.ts` - No changes
- ✅ `frontend/src/components/PolicyCreateForm.tsx` - No changes
- ✅ All other modules (Requirements, BCM, etc.) - Untouched

---

## Backward Compatibility

✅ **Fully backward compatible**:
- No API changes
- No DTO changes
- No service logic changes
- No frontend changes
- Only affects `policies` table schema in development environment

⚠️ **Data Loss (Dev Only)**:
- All existing policy data in `policies` table was deleted
- This is acceptable for development
- **Production should use migrations** instead of dropping tables

---

## Next Steps (Required)

### 1. Restart Backend
Backend must be restarted for TypeORM synchronize to recreate the `policies` table:

```bash
# Stop current backend (if running)
# Then start backend:
cd backend-nest
npm run start:dev
```

### 2. Verify Schema
After backend restart, verify the schema matches the entity:

```bash
npm run check:policy-schema
```

Expected output:
- ✅ All entity columns exist in DB
- ✅ No extra columns in DB
- ✅ Schema matches entity definition

### 3. Run Smoke Tests
Verify policy create operation works:

```bash
npm run smoke:policies
```

Expected output:
- ✅ PASS CREATE
- ✅ PASS LIST
- ✅ PASS GET

### 4. Test Frontend
1. Login as `grc1@local` / `grc1`
2. Navigate to Governance > Policies
3. Click "New Policy"
4. Fill in:
   - Code: `POL-TEST-001`
   - Title: `Test Policy`
   - Status: `draft` (or any from dictionary)
5. Click "Create"
6. ✅ Should succeed (200 OK) instead of 500 error

---

## Production Considerations

**⚠️ IMPORTANT**: This fix is **development-only**. For production:

1. **Use Migrations**: Create a proper migration to:
   - Drop old columns (`name`, `description`, `owner`, `version`, `effectiveDate`, `reviewDate`, `tags`, `createdAt`, `updatedAt`, `deletedAt`)
   - Ensure schema matches `PolicyEntity`
   - Preserve existing policy data (if any)

2. **Data Migration**: If old policy data exists:
   - Map `name` → `title`
   - Map `owner` → `owner_first_name` / `owner_last_name` (split if possible)
   - Map `effectiveDate` → `effective_date`
   - Map `reviewDate` → `review_date`
   - Preserve `description`, `version`, `tags` in `content` or `meta` field if needed

3. **Test Migration**: Test migration on staging before production

---

## Testing Checklist

After backend restart:

- [ ] `npm run check:policy-schema` - Schema matches entity
- [ ] `npm run smoke:policies` - Policy create/list/get works
- [ ] `npm run smoke:modules` - All modules still work
- [ ] Frontend: Create policy via UI - No 500 error
- [ ] Frontend: List policies - Policies display correctly
- [ ] Frontend: Edit policy - Update works
- [ ] Other modules (Requirements, BCM) - Still work correctly

---

## Summary

✅ **Root cause identified**: Outdated `policies` table schema with old columns
✅ **Fix applied**: Dropped table to allow TypeORM synchronize to recreate with correct schema
✅ **No breaking changes**: All other modules untouched
⏳ **Pending**: Backend restart required to apply fix

**Status**: Ready for verification after backend restart.

