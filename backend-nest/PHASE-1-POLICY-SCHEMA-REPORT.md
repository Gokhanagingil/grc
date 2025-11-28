# PHASE 1 - Policy Schema vs Entity Compatibility Analysis

## Date
2025-01-27

## Summary
The `policies` table in SQLite has an **outdated schema** that doesn't match the current `PolicyEntity` definition. This mismatch is causing the 500 Internal Server Error when creating policies.

## Root Cause

### 1. Schema Mismatch

**Actual SQLite Schema (`policies` table):**
- Contains **old columns** from a previous Policy entity:
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

- Contains **new columns** from current PolicyEntity:
  - `title` (TEXT, NOT NULL)
  - `owner_first_name` (TEXT, nullable)
  - `owner_last_name` (TEXT, nullable)
  - `effective_date` (date, nullable) - **snake_case**
  - `review_date` (date, nullable) - **snake_case**
  - `content` (TEXT, nullable)
  - `created_at` (datetime, NOT NULL) - **snake_case**
  - `updated_at` (datetime, NOT NULL) - **snake_case**

**Current PolicyEntity Definition:**
- Only defines the **new columns** (snake_case naming)
- Does NOT include old columns (name, description, owner, version, effectiveDate, reviewDate, tags, createdAt, updatedAt, deletedAt)

### 2. NOT NULL Constraints

**NOT NULL columns without defaults:**
- `id` (varchar, PK)
- `tenant_id` (varchar, NOT NULL)
- `code` (TEXT, NOT NULL)
- `title` (TEXT, NOT NULL)
- `status` (TEXT, NOT NULL)

All of these are correctly handled in the service:
- `id`: Generated via `randomUUID()`
- `tenant_id`: Passed from request
- `code`: From DTO (required)
- `title`: From DTO (required)
- `status`: From DTO with fallback `'draft'` (line 159: `status: dto.status || 'draft'`)

### 3. Potential Issue

The most likely cause of the 500 error is:
- **SQLite constraint violation**: The old `name` column is NOT NULL, but TypeORM doesn't insert it (because it's not in the entity). However, TypeORM should handle this gracefully.

**OR**

- **TypeORM synchronize issue**: When TypeORM tries to synchronize, it may be attempting to insert into columns that don't match the entity definition, causing a constraint violation.

**OR**

- **Missing column error**: TypeORM may be trying to insert into a column that doesn't exist in the entity, or SQLite is rejecting the insert due to schema inconsistencies.

## Comparison Table

| Column | Entity | DB | Status |
|--------|--------|----|--------|
| `id` | ✅ uuid, NOT NULL | ✅ varchar, NOT NULL | ✅ Match |
| `tenant_id` | ✅ uuid, NOT NULL | ✅ varchar, NOT NULL | ✅ Match |
| `code` | ✅ text, NOT NULL | ✅ TEXT, NOT NULL | ✅ Match |
| `title` | ✅ text, NOT NULL | ✅ TEXT, NOT NULL | ✅ Match |
| `status` | ✅ text, NOT NULL | ✅ TEXT, NOT NULL | ✅ Match |
| `owner_first_name` | ✅ text, nullable | ✅ TEXT, nullable | ✅ Match |
| `owner_last_name` | ✅ text, nullable | ✅ TEXT, nullable | ✅ Match |
| `effective_date` | ✅ date, nullable | ✅ date, nullable | ✅ Match |
| `review_date` | ✅ date, nullable | ✅ date, nullable | ✅ Match |
| `content` | ✅ text, nullable | ✅ TEXT, nullable | ✅ Match |
| `created_by` | ✅ uuid, nullable | ✅ varchar, nullable | ✅ Match |
| `updated_by` | ✅ uuid, nullable | ✅ varchar, nullable | ✅ Match |
| `created_at` | ✅ datetime, NOT NULL | ✅ datetime, NOT NULL | ✅ Match |
| `updated_at` | ✅ datetime, NOT NULL | ✅ datetime, NOT NULL | ✅ Match |
| `name` | ❌ Not in entity | ⚠️ varchar(160), NOT NULL | ❌ **EXTRA IN DB** |
| `description` | ❌ Not in entity | ⚠️ TEXT, nullable | ❌ **EXTRA IN DB** |
| `owner` | ❌ Not in entity | ⚠️ varchar(80), nullable | ❌ **EXTRA IN DB** |
| `version` | ❌ Not in entity | ⚠️ varchar(32), nullable | ❌ **EXTRA IN DB** |
| `effectiveDate` | ❌ Not in entity | ⚠️ date, nullable | ❌ **EXTRA IN DB** |
| `reviewDate` | ❌ Not in entity | ⚠️ date, nullable | ❌ **EXTRA IN DB** |
| `tags` | ❌ Not in entity | ⚠️ TEXT, nullable | ❌ **EXTRA IN DB** |
| `createdAt` | ❌ Not in entity | ⚠️ datetime, NOT NULL | ❌ **EXTRA IN DB** |
| `updatedAt` | ❌ Not in entity | ⚠️ datetime, NOT NULL | ❌ **EXTRA IN DB** |
| `deletedAt` | ❌ Not in entity | ⚠️ datetime, nullable | ❌ **EXTRA IN DB** |

## Conclusion

The schema mismatch is the root cause. The `policies` table needs to be **recreated** or **migrated** to match the current `PolicyEntity` definition.

**Recommended Fix:**
1. Drop the old columns that are not in the entity (if no critical data exists)
2. OR create a migration to clean up the schema
3. OR recreate the table using TypeORM synchronize (dev-only, data loss)

Since this is a development environment with SQLite, the safest approach is to:
- **Option 1 (Recommended)**: Drop and recreate the `policies` table using TypeORM synchronize
- **Option 2**: Create a migration to drop old columns and ensure schema matches entity

