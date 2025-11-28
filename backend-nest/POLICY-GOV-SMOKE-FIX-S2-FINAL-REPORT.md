# Policy & Governance Smoke Test Fix - Sprint 2 Final Report

**Date:** 2025-11-26  
**Sprint Goal:** Fix Policies & Governance smoke test failures  
**Status:** ✅ **COMPLETE** - All smoke tests passing (8/8)

---

## Executive Summary

Successfully identified and fixed the root cause of Policies and Governance smoke test failures. The issue was **schema drift** between the SQLite `policies` table and the `PolicyEntity`. The table contained a legacy `name` column with a NOT NULL constraint that doesn't exist in the entity (which uses `title` instead).

**Solution:** Applied Strategy B - Controlled SQLite Policy Table Reset. The table was backed up, dropped, and recreated with the exact schema expected by `PolicyEntity`.

**Result:** All smoke tests now pass (8/8). No regressions introduced. Backend starts cleanly. TypeScript compilation successful.

---

## Root Cause

### The Problem

The SQLite `policies` table had **legacy columns** from an older schema that didn't match the current `PolicyEntity`:

**Critical Issue:**
- `name` column (varchar(160), NOT NULL) - **This caused the constraint failure**
- The entity uses `title` instead of `name`
- When inserting a policy, SQLite enforced the NOT NULL constraint on `name`, causing `SQLITE_CONSTRAINT: NOT NULL constraint failed: policies.name`

**Additional Legacy Columns:**
- `description` (TEXT, nullable)
- `owner` (varchar(80), nullable)
- `version` (varchar(32), nullable)
- `effectiveDate` (date, nullable) - camelCase legacy
- `reviewDate` (date, nullable) - camelCase legacy
- `tags` (TEXT, nullable)
- `createdAt` (datetime, NOT NULL) - camelCase legacy
- `updatedAt` (datetime, NOT NULL) - camelCase legacy
- `deletedAt` (datetime, nullable)

### Why This Happened

The SQLite database was created with an older schema (from `_archive/1700000000000_init.ts` migration) that used `name` instead of `title`. The current Postgres migrations (`1700000000000_bootstrap_db.ts`) correctly use `title`, but SQLite was never migrated to match.

### Error Details

**Exact Error:**
```
SQLITE_CONSTRAINT: NOT NULL constraint failed: policies.name
```

**HTTP Response:**
```json
{
  "message": "Failed to create policy: SQLITE_CONSTRAINT: NOT NULL constraint failed: policies.name",
  "error": "Internal Server Error",
  "statusCode": 500
}
```

**Location:** `GovernanceService.create()` → `policyRepo.save(policy)`  
**Endpoint:** `POST /api/v2/governance/policies`

---

## Fix Strategy

**Strategy B: Controlled SQLite Policy Table Reset**

This strategy was chosen because:
1. The schema drift was significant (10+ legacy columns)
2. The table structure fundamentally didn't match the entity
3. This is a dev/demo database where data loss is acceptable
4. A simple logic fix wouldn't work - the NOT NULL constraint on `name` would always fail

### Implementation

**File Modified:** `backend-nest/scripts/reset-policies-table.ts`

**Changes:**
1. Added backup step: Creates `policies_backup_<timestamp>` table before dropping
2. Enhanced table recreation: Creates table with exact schema from `PolicyEntity` (not relying on TypeORM synchronize)
3. Added index creation: Creates `idx_policies_tenant` index
4. Improved documentation: Clear warnings about data loss

**Table Schema Created:**
```sql
CREATE TABLE "policies" (
  "id" varchar PRIMARY KEY NOT NULL,
  "tenant_id" varchar NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "owner_first_name" TEXT,
  "owner_last_name" TEXT,
  "effective_date" date,
  "review_date" date,
  "content" TEXT,
  "created_by" varchar,
  "updated_by" varchar,
  "created_at" datetime NOT NULL DEFAULT (datetime('now')),
  "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX "idx_policies_tenant" ON "policies" ("tenant_id");
```

This exactly matches `PolicyEntity` columns and constraints.

---

## Files Changed

### Modified Files

1. **`backend-nest/scripts/reset-policies-table.ts`**
   - Enhanced to create backup before dropping table
   - Recreates table with exact schema from `PolicyEntity`
   - Creates index on `tenant_id`
   - Improved error handling and documentation

### Created Files

1. **`backend-nest/POLICY-GOV-SMOKE-FAIL-DIAGNOSIS.md`**
   - Phase 0 & Phase 1 analysis documentation
   - Error details, schema comparison, root cause analysis

2. **`backend-nest/POLICY-GOV-SMOKE-FIX-S2-FINAL-REPORT.md`** (this file)
   - Final sprint report

### No Changes To

- ✅ `database.config.ts` - Not touched (as per constraints)
- ✅ Redis / Queue / Metrics modules - Not touched
- ✅ Admin Schema Explorer logic - Not touched
- ✅ Migrations - No new migrations created
- ✅ `GovernanceService` - No logic changes needed
- ✅ `PolicyEntity` - Already correct
- ✅ DTOs - Already correct

---

## Commands & Results

### Reset Script Execution

```bash
npm run reset:policies
```

**Output:**
```
=== Reset Policies Table Script ===
⚠️  WARNING: This script will DELETE all policy data in SQLite.

SQLite file: C:\dev\grc-platform\backend-nest\data\grc.sqlite

✅ Database connected

📋 Step 1: Checking for temporary_policies table...
   ✅ No temporary tables found

📋 Step 2: Creating backup of policies table...
   ✅ Backup created: policies_backup_2025-11-26T13-54-04 (0 rows)

📋 Step 3: Dropping policies table...
   ✅ Dropped policies table

📋 Step 4: Creating policies table with correct schema...
   ✅ Policies table created with correct schema
   ✅ Index created on tenant_id

✅ Reset completed successfully!
   The policies table now matches PolicyEntity schema.
```

### Smoke Test Results

#### Policies Smoke Test

```bash
npm run smoke:policies
```

**Result:** ✅ **PASS**

```
=== Policy Module Smoke Test ===
✅ PASS LOGIN
✅ PASS CREATE
  Policy ID: ad28a4c2-cb3a-4fce-b2ab-05828a11364d
  Code: POL-SMOKE-1764165251332
✅ PASS LIST
  Found 1 policies
✅ PASS GET
  Title: Smoke Test Policy
✅ PASS LIST STANDARDS
  Found 3 standards
✅ PASS UPDATE
  Updated title: Updated Smoke Test Policy

✅ All Policy smoke tests passed!
```

**Note:** Standard mapping feature returns 400 (expected - feature not implemented yet). This is a warning, not a failure.

#### Governance Smoke Test

```bash
npm run smoke:governance
```

**Result:** ✅ **PASS** (delegates to `smoke:policies`)

#### Full Smoke Suite

```bash
npm run smoke:all
```

**Result:** ✅ **8/8 PASS**

```
=== Smoke Test Summary ===

✅ Login
✅ Policies
✅ Standards
✅ Audit Flow
✅ BCM Processes
✅ Calendar
✅ Admin
✅ Governance

Total: 8, Passed: 8, Failed: 0

✅ All smoke tests passed!
```

### Build Verification

```bash
npm run build:once
```

**Result:** ✅ **PASS** - No TypeScript errors

---

## Impact & Safety

### Data Loss

**Yes, data loss occurred:**
- All existing policies in SQLite were deleted when the table was reset
- A backup table was created (`policies_backup_2025-11-26T13-54-04`) but it was empty (0 rows)
- This is acceptable for dev/demo databases as per sprint constraints

### Backend Startup

✅ **Backend starts cleanly** - Verified before and after fix
- `npm run start:dev` works without errors
- No temporary table issues
- No schema synchronization errors

### Postgres Migration Impact

**Positive Impact:**
- SQLite `policies` table now matches Postgres schema (from `1700000000000_bootstrap_db.ts`)
- `PolicyEntity` and SQLite schema are fully aligned
- Future Postgres migration will be smoother - no schema drift to reconcile

**No Negative Impact:**
- Postgres migrations were not modified
- Postgres schema was already correct
- This fix only affects SQLite dev database

### Regression Testing

✅ **No regressions introduced:**
- All other smoke tests still pass (Login, Standards, Audit Flow, BCM, Calendar, Admin)
- Backend functionality unchanged
- Only the `policies` table structure was modified

---

## Important Reminders

### Constraints Respected

✅ **Did NOT touch:**
- `database.config.ts` (DB config logic)
- Redis / Queue / Metrics / other infra modules
- Admin Schema Explorer logic
- Any migrations (no new migrations created)

✅ **Surgical & Focused:**
- Only modified `reset-policies-table.ts` script
- Only affected `policies` table in SQLite
- No global refactors
- Changes are reversible (backup table created)

### Safety

⚠️ **Reset Script Warning:**
- The `reset:policies` script is **DESTRUCTIVE** and **DEV/DEMO ONLY**
- It permanently deletes all policy data in SQLite
- Should never be run in production
- Script is idempotent (safe to re-run)

### Future Considerations

1. **Standard Mapping Feature:**
   - Currently returns 400 (feature not implemented)
   - Requires `policy_standards` table
   - Not blocking for this sprint

2. **Schema Alignment:**
   - SQLite and Postgres schemas are now aligned
   - Future migrations should maintain this alignment
   - Consider adding schema validation tests

3. **Data Seeding:**
   - Consider adding demo policy data after reset
   - Would improve UX for demos
   - Not required for this sprint

---

## Conclusion

✅ **Sprint Goal Achieved:**

- ✅ `npm run start:dev` → Backend starts cleanly (maintained)
- ✅ `npm run smoke:policies` → ✅ PASS
- ✅ `npm run smoke:governance` → ✅ PASS
- ✅ `npm run smoke:all` → Total: 8, Passed: 8, Failed: 0
- ✅ No new TypeScript or lint errors
- ✅ Changes clearly documented

**Root cause identified and fixed with minimal, focused changes. No regressions. Platform is stable and ready for DB Foundation & Postgres migration work.**

---

## Appendix: Schema Comparison

### Before (Legacy Schema)

```sql
-- Had 24 columns including:
- name (varchar(160), NOT NULL) ← Problem column
- description, owner, version
- effectiveDate, reviewDate (camelCase)
- createdAt, updatedAt, deletedAt (camelCase)
- title (TEXT, NOT NULL) ← Also present
```

### After (Current Schema)

```sql
-- Has 14 columns matching PolicyEntity:
- id (varchar, NOT NULL, PK)
- tenant_id (varchar, NOT NULL)
- code (TEXT, NOT NULL)
- title (TEXT, NOT NULL) ← Standardized
- status (TEXT, NOT NULL)
- owner_first_name (TEXT, nullable)
- owner_last_name (TEXT, nullable)
- effective_date (date, nullable) ← snake_case
- review_date (date, nullable) ← snake_case
- content (TEXT, nullable)
- created_by (varchar, nullable)
- updated_by (varchar, nullable)
- created_at (datetime, NOT NULL) ← snake_case
- updated_at (datetime, NOT NULL) ← snake_case
```

**Index:** `idx_policies_tenant` on `tenant_id`

