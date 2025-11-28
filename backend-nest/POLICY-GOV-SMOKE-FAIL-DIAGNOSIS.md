# Policy & Governance Smoke Test Failure Diagnosis

**Date:** 2025-01-XX  
**Phase:** 0 - Reproduce & Capture

## Summary

Both `smoke:policies` and `smoke:governance` are failing with the same root cause: a SQLite schema constraint violation.

## Exact Error Messages

### Smoke Test Output

```
=== Policy Module Smoke Test ===
Base URL: http://localhost:5002
Tenant ID: 217492b2-f814-4ba0-ae50-4e4f8ecf6216

[SMOKE] Logging in...
✅ PASS LOGIN

[SMOKE] Creating policy...
FAIL CREATE 500 {
  message: 'Failed to create policy: SQLITE_CONSTRAINT: NOT NULL constraint failed: policies.name',
  error: 'Internal Server Error',
  statusCode: 500
}
```

### Error Details

- **Error Type:** `SQLITE_CONSTRAINT`
- **Constraint:** `NOT NULL constraint failed: policies.name`
- **HTTP Status:** 500 (Internal Server Error)
- **Endpoint:** `POST /api/v2/governance/policies`

## Stack Trace

The error occurs in `GovernanceService.create()` when calling `policyRepo.save(policy)`. The service logs show:

```
Error creating policy: SQLITE_CONSTRAINT: NOT NULL constraint failed: policies.name
Error name: SqliteError
Error code: SQLITE_CONSTRAINT
```

## SQL Statement & Parameters

The service attempts to insert a policy with:
- `id`: UUID (generated)
- `tenant_id`: UUID (from request)
- `code`: string (from DTO)
- `title`: string (from DTO)
- `status`: string (from DTO, default 'draft')
- Other optional fields

**Missing:** The `name` column is NOT NULL in the database but is not provided in the insert.

## Endpoints Called by Smoke Scripts

### smoke:policies.ts
1. `POST /api/v2/auth/login` - ✅ PASS
2. `POST /api/v2/governance/policies` - ❌ FAIL (500)
3. `GET /api/v2/governance/policies?page=1&pageSize=10` - Not reached
4. `GET /api/v2/governance/policies/:id` - Not reached
5. `GET /api/v2/standards` - Not reached
6. `PUT /api/v2/governance/policies/:id` - Not reached

### smoke:governance
- Delegates to `smoke:policies` (see package.json line 55)
- Same failure point

## Schema Analysis

### Actual SQLite Schema (policies table)

The table has **legacy columns** that don't match the entity:

**Legacy NOT NULL columns:**
- `name` (varchar(160), NOT NULL) ← **This is the problem**
- `createdAt` (datetime, NOT NULL)
- `updatedAt` (datetime, NOT NULL)

**Legacy nullable columns:**
- `description` (TEXT)
- `owner` (varchar(80))
- `version` (varchar(32))
- `effectiveDate` (date) - note: camelCase
- `reviewDate` (date) - note: camelCase
- `tags` (TEXT)
- `deletedAt` (datetime)

**Current columns (matching entity):**
- `id` (varchar, NOT NULL, PK)
- `tenant_id` (varchar, NOT NULL)
- `code` (TEXT, NOT NULL)
- `title` (TEXT, NOT NULL) ← Entity uses this, not `name`
- `status` (TEXT, NOT NULL)
- `owner_first_name` (TEXT, nullable)
- `owner_last_name` (TEXT, nullable)
- `effective_date` (date, nullable) - note: snake_case
- `review_date` (date, nullable) - note: snake_case
- `content` (TEXT, nullable)
- `created_by` (varchar, nullable)
- `updated_by` (varchar, nullable)
- `created_at` (datetime, NOT NULL)
- `updated_at` (datetime, NOT NULL)

### PolicyEntity Expected Schema

The entity expects:
- `id` (uuid, NOT NULL, PK)
- `tenant_id` (uuid, NOT NULL)
- `code` (text, NOT NULL)
- `title` (text, NOT NULL) ← **No `name` column**
- `status` (text, NOT NULL)
- `owner_first_name` (text, nullable)
- `owner_last_name` (text, nullable)
- `effective_date` (date, nullable)
- `review_date` (date, nullable)
- `content` (text, nullable)
- `created_by` (uuid, nullable)
- `updated_by` (uuid, nullable)
- `created_at` (datetime, NOT NULL)
- `updated_at` (datetime, NOT NULL)

## Root Cause

**Schema Drift:** The SQLite `policies` table contains a legacy `name` column with a NOT NULL constraint. The `PolicyEntity` uses `title` instead of `name`. When `GovernanceService.create()` attempts to insert a new policy, it doesn't provide a value for `name`, causing SQLite to reject the insert due to the NOT NULL constraint.

**Additional Issues:**
- Multiple legacy columns exist (`description`, `owner`, `version`, `effectiveDate`, `reviewDate`, `tags`, `createdAt`, `updatedAt`, `deletedAt`)
- These legacy columns are not mapped in the entity
- The table has both old camelCase (`effectiveDate`) and new snake_case (`effective_date`) columns

## Impact

- **Policies smoke test:** ❌ FAIL (cannot create policies)
- **Governance smoke test:** ❌ FAIL (delegates to policies)
- **Full smoke suite:** 6/8 PASS (Policies and Governance failing)

## Phase 1 - Schema & Entity Consistency Check

### Entity vs Database Comparison

**Columns in Entity but NOT in DB:**
- None (all entity columns exist in DB)

**Columns in DB but NOT in Entity (Legacy):**
- `name` (varchar(160), NOT NULL) ← **CRITICAL: Causes constraint failure**
- `description` (TEXT, nullable)
- `owner` (varchar(80), nullable)
- `version` (varchar(32), nullable)
- `effectiveDate` (date, nullable) - camelCase legacy
- `reviewDate` (date, nullable) - camelCase legacy
- `tags` (TEXT, nullable)
- `createdAt` (datetime, NOT NULL) - camelCase legacy
- `updatedAt` (datetime, NOT NULL) - camelCase legacy
- `deletedAt` (datetime, nullable)

**NOT NULL Constraints:**
- Entity expects: `id`, `tenant_id`, `code`, `title`, `status`, `created_at`, `updated_at`
- DB has: All of the above PLUS `name`, `createdAt`, `updatedAt` (legacy)

### Tenant ID Analysis

✅ `tenant_id` is:
- Present in table (column 13)
- NOT NULL in both entity and DB
- Mapped correctly in `GovernanceService.create()` (line 173)

### Conclusion

The failure is **100% due to schema drift**. The `policies` table has a legacy `name` column with a NOT NULL constraint that doesn't exist in `PolicyEntity`. When inserting, SQLite enforces the NOT NULL constraint and rejects the insert.

**Fix Strategy:** Strategy B - Controlled SQLite Policy Table Reset

## Next Steps

**Strategy B** is required: Controlled SQLite Policy Table Reset

The table needs to be:
1. Backed up (for safety)
2. Dropped and recreated with only the columns expected by `PolicyEntity`
3. Optionally seeded with demo data

This is a dev/demo database, so data loss is acceptable. The reset script should be idempotent and clearly documented as dev-only.

