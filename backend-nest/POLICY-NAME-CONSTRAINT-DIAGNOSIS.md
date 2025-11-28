# Policy Name Constraint Diagnosis Report

## Problem Summary

**Error:** `SQLITE_CONSTRAINT: NOT NULL constraint failed: policies.name`

**Affected Tests:**
- ❌ `smoke:policies` - FAIL
- ❌ `smoke:governance` - FAIL (delegates to smoke:policies)

**Other Tests:** ✅ All passing (Login, Standards, Audit, BCM, Calendar, Admin)

## Root Cause Analysis

### 1. SQLite Table Schema

The `policies` table in SQLite has **both** `name` and `title` columns:

```
- name: varchar(160), NOT NULL
- title: TEXT, NOT NULL
```

### 2. Entity Definition

`PolicyEntity` (in `backend-nest/src/entities/app/policy.entity.ts`) only defines:
- `title` column (mapped to `title` in DB)
- **No `name` column mapping**

### 3. Service Logic

`GovernanceService.create()` method:
- Uses `dto.title` to set `policy.title`
- Does NOT set `policy.name` (because entity doesn't have it)

### 4. Smoke Test Payload

`smoke-policies.ts` sends:
```json
{
  "code": "POL-SMOKE-...",
  "title": "Smoke Test Policy",
  "status": "draft"
}
```
- No `name` field in payload (correct, as DTO doesn't have it)

### 5. The Issue

When TypeORM tries to insert:
- It sets `title` = "Smoke Test Policy" ✅
- It does NOT set `name` (because entity property doesn't exist) ❌
- SQLite constraint fails: `name` is NOT NULL but receives NULL

## Root Cause

**Schema Mismatch:**
- SQLite table has legacy `name` column (NOT NULL) from old schema
- Entity only maps `title` column
- TypeORM cannot set `name` because it's not in the entity definition

## Solution Strategy

**Option 1: Map `title` to `name` column (Recommended)**
- Change entity: `@Column({ name: 'name', type: 'text' }) title!: string;`
- This maps the `title` property to the `name` column in DB
- Keeps backward compatibility with existing data

**Option 2: Remove `name` column from SQLite table**
- Requires migration/fix script
- More complex, risk of data loss

**Option 3: Add `name` property to entity**
- Map both `name` and `title`
- Duplicate data, not ideal

**Selected Solution: Option 1** - Map `title` to `name` column

## Implementation Plan

1. Update `PolicyEntity` to map `title` property to `name` column
2. Test with `smoke:policies`
3. Verify `smoke:governance` passes
4. Run full `smoke:all` to ensure no regressions

## Files to Modify

1. `backend-nest/src/entities/app/policy.entity.ts`
   - Change: `@Column({ name: 'name', type: 'text' }) title!: string;`

## Expected Outcome

After fix:
- ✅ `smoke:policies` - PASS
- ✅ `smoke:governance` - PASS
- ✅ `smoke:all` - 8/8 PASS
- No regressions in other modules

