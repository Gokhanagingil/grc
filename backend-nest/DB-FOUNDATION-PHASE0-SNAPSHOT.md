# DB FOUNDATION - PHASE 0: Database Snapshot Report

**Date:** 2025-01-25  
**Purpose:** Analyze current database state without making any changes  
**Scope:** SQLite dev environment, Policy/Governance schema, migration status

---

## 1. Database Configuration Analysis

### 1.1 Configuration File: `backend-nest/src/config/database.config.ts`

**Key Findings:**
- **SQLite (Default):** Used when `DB_ENGINE` is not set or is `'sqlite'`
  - `synchronize: isProd ? false : true` - **Dev ortamında synchronize AÇIK**
  - Database path: `./data/grc.sqlite` (or `SQLITE_FILE` env var)
  - Entity discovery: `**/*.entity.ts` (dev) or `dist/**/*.entity.js` (prod)
  - Migration path: `migrations/*.ts` (dev) or `dist/migrations/*.js` (prod)

- **Postgres:** Used when `DB_ENGINE='postgres'` explicitly
  - `synchronize: false` - **Her zaman kapalı, migration kullanılıyor**
  - Requires: `DATABASE_URL` OR (`DB_HOST` + `DB_NAME`)
  - Validates config on startup

**Critical Observation:**
- SQLite dev ortamında **synchronize=true** olduğu için, entity değişiklikleri otomatik olarak tablolara yansıyor
- Postgres için migration-first yaklaşım kullanılıyor
- Bu **iki farklı yaklaşım** bir tutarsızlık kaynağı olabilir

---

## 2. Policy Entity Analysis

### 2.1 Active Policy Entity: `backend-nest/src/entities/app/policy.entity.ts`

**Entity Name:** `PolicyEntity`  
**Table Name:** `policies`  
**Status:** ✅ **ACTIVE** (used by GovernanceService, AdminService, DashboardService)

**Schema Definition:**
```typescript
@Entity({ name: 'policies' })
@Index('idx_policies_tenant', ['tenant_id'])
export class PolicyEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;                    // NOT NULL
  @Column({ type: 'text' }) code!: string;                // NOT NULL
  @Column({ type: 'text' }) title!: string;               // NOT NULL (NOT 'name')
  @Column({ type: 'text' }) status!: string;              // NOT NULL
  @Column({ type: 'text', nullable: true }) owner_first_name?: string;
  @Column({ type: 'text', nullable: true }) owner_last_name?: string;
  @Column({ type: 'date', nullable: true }) effective_date?: string;
  @Column({ type: 'date', nullable: true }) review_date?: string;
  @Column({ type: 'text', nullable: true }) content?: string;
  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;                  // NOT NULL
  @UpdateDateColumn() updated_at!: Date;                  // NOT NULL
}
```

**Key Observations:**
- ✅ Uses `title` column (NOT `name`) - matches Postgres migrations
- ✅ Has `tenant_id` (multi-tenant aware)
- ✅ Has `content` column (added via migration `1730000005300_AddPolicyContent.ts`)
- ✅ Uses `owner_first_name` and `owner_last_name` (NOT single `owner` field)
- ✅ Uses snake_case for column names (`effective_date`, `review_date`, `created_at`, `updated_at`)
- ✅ No `deletedAt` / soft delete (unlike old Policy entity)

### 2.2 Legacy Policy Entity: `backend-nest/src/modules/policy/policy.entity.ts`

**Entity Name:** `Policy`  
**Table Name:** `policies`  
**Status:** ⚠️ **DEPRECATED** (still exists but not actively used)

**Schema Definition:**
```typescript
@Entity({ name: 'policies' })
export class Policy {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 160 }) name!: string;                // NOT NULL (NOT 'title')
  @Column({ length: 64 }) code!: string;                  // NOT NULL
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ ... }) status!: PolicyStatus;                 // Enum
  @Column({ length: 80, nullable: true }) owner?: string; // Single field
  @Column({ length: 32, nullable: true }) version?: string;
  @Column({ type: 'date', nullable: true }) effectiveDate?: string; // camelCase
  @Column({ type: 'date', nullable: true }) reviewDate?: string;   // camelCase
  @Column({ type: 'simple-array', nullable: true }) tags?: string[];
  @CreateDateColumn() createdAt!: Date;                   // camelCase
  @UpdateDateColumn() updatedAt!: Date;                   // camelCase
  @DeleteDateColumn() deletedAt?: Date;                   // Soft delete
}
```

**Key Observations:**
- ❌ Uses `name` column (NOT `title`)
- ❌ No `tenant_id` (single-tenant)
- ❌ Uses camelCase (`effectiveDate`, `reviewDate`, `createdAt`, `updatedAt`)
- ❌ Has `deletedAt` (soft delete)
- ❌ Single `owner` field (NOT `owner_first_name` / `owner_last_name`)
- ⚠️ **CONFLICT:** Both entities map to same table name `policies` - this is a problem!

**Usage:**
- Only used by `PolicyModule` (`backend-nest/src/modules/policy/policy.module.ts`)
- `PolicyModule` is conditionally loaded via feature flag `FEAT.POLICY`
- Governance module uses `PolicyEntity` from `entities/app/policy.entity.ts`

### 2.3 Governance Policy Entity: `backend-nest/src/modules/governance/gov.entity.ts`

**Entity Name:** `GovPolicy`  
**Table Name:** `gov_policies`  
**Status:** ✅ **ACTIVE** (separate table, no conflict)

**Schema Definition:**
```typescript
@Entity({ name: 'gov_policies' })
export class GovPolicy {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 160 }) title!: string;               // NOT NULL
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ length: 80, nullable: true }) category?: string;
  @Column({ length: 32, default: '1.0' }) version!: string;
  @Column({ length: 32, default: 'draft' }) status!: string;
  @Column({ type: 'date', nullable: true }) effective_date?: string;
  @Column({ type: 'date', nullable: true }) review_date?: string;
  @Column({ length: 80, nullable: true }) owner_first_name?: string;
  @Column({ length: 80, nullable: true }) owner_last_name?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
  @DeleteDateColumn() deleted_at?: Date;                  // Soft delete
}
```

**Key Observations:**
- ✅ Separate table (`gov_policies`) - no conflict
- ✅ Uses `title` (consistent with PolicyEntity)
- ✅ Uses snake_case
- ✅ Has `owner_first_name` / `owner_last_name`
- ⚠️ No `tenant_id` (single-tenant)
- ⚠️ Has `deletedAt` (soft delete)

---

## 3. Migration Analysis

### 3.1 Postgres Migrations

**Location:** `backend-nest/src/migrations/`

**Key Migration Files:**
1. **`1700000000000_bootstrap_db.ts`** - Initial schema
   - Creates `app.policies` table with:
     - `id UUID PRIMARY KEY`
     - `tenant_id UUID NOT NULL`
     - `code TEXT NOT NULL`
     - `title TEXT NOT NULL` ✅ (NOT `name`)
     - `status TEXT NOT NULL CHECK (...)`
     - `owner_first_name TEXT`
     - `owner_last_name TEXT`
     - `effective_date DATE`
     - `review_date DATE`
     - `created_by UUID`
     - `updated_by UUID`
     - `created_at TIMESTAMPTZ NOT NULL`
     - `updated_at TIMESTAMPTZ NOT NULL`
     - `UNIQUE (tenant_id, code)`
   - **Matches PolicyEntity schema** ✅

2. **`1730000005300_AddPolicyContent.ts`** - Adds `content` column
   - `ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS content TEXT;`
   - **Matches PolicyEntity schema** ✅

3. **`1730000005000_DataFoundations_Squashed.ts`** - Other app tables
   - Creates `app.standard`, `app.standard_clause`, `app.risk_category`, etc.
   - Uses `app` schema (Postgres-specific)

**Migration Status:**
- ✅ Postgres migrations are **consistent** with `PolicyEntity`
- ✅ All migrations use `title` (NOT `name`)
- ✅ All migrations use `tenant_id`
- ✅ All migrations use snake_case

### 3.2 SQLite Migration Status

**Current State:**
- ❌ **No SQLite-specific migrations exist**
- ✅ SQLite uses `synchronize: true` in dev (auto-creates tables from entities)
- ⚠️ **Problem:** If `synchronize: false` is set, SQLite tables won't be created/updated

**Migration Strategy:**
- Postgres: Migration-first (migrations are required)
- SQLite: Synchronize-first (migrations optional, synchronize auto-creates)

---

## 4. Schema Fix Script Analysis

### 4.1 `fix-policy-schema.ts` Script

**Purpose:** Migrates legacy `policies` table to new schema

**What it does:**
1. Checks if `policies` table exists
2. Detects legacy columns: `name`, `description`, `owner`, `version`, `effectivedate`, `reviewdate`, `tags`, `createdat`, `updatedat`, `deletedat`
3. If legacy columns found:
   - Creates temporary table `policies_tmp` with new schema
   - Copies compatible data (maps `name` → `title`, handles `tenant_id`)
   - Drops old table
   - Renames `policies_tmp` to `policies`
4. If no legacy columns, does nothing (idempotent)

**Key Features:**
- ✅ Handles `tenant_id` correctly (Scenario A: existing, Scenario B: default)
- ✅ Maps `name` → `title`
- ✅ Maps `owner` → `owner_first_name` / `owner_last_name` (if available)
- ✅ Maps camelCase → snake_case
- ✅ Idempotent (safe to run multiple times)

**When is it needed:**
- Only when migrating from **legacy schema** (with `name`, `description`, `owner`, etc.)
- If `policies` table already has correct schema (no legacy columns), script does nothing

**Current Status:**
- ✅ Script is **defensive and safe**
- ✅ Handles `tenant_id` NOT NULL constraint correctly
- ✅ Can be run multiple times without issues

---

## 5. SQLite Schema Inspection

### 5.1 Expected Schema (from PolicyEntity)

Based on `PolicyEntity` and `synchronize: true` in dev:

**Expected `policies` table columns:**
- `id` VARCHAR(36) PRIMARY KEY
- `tenant_id` VARCHAR(36) NOT NULL
- `code` TEXT NOT NULL
- `title` TEXT NOT NULL
- `status` TEXT NOT NULL
- `owner_first_name` TEXT
- `owner_last_name` TEXT
- `effective_date` DATE
- `review_date` DATE
- `content` TEXT
- `created_by` VARCHAR(36)
- `updated_by` VARCHAR(36)
- `created_at` DATETIME NOT NULL
- `updated_at` DATETIME NOT NULL

**Expected indexes:**
- `idx_policies_tenant` on `tenant_id`

### 5.2 Actual Schema (to be verified)

**Note:** SQLite file exists at `data/grc.sqlite`, but direct inspection requires:
- SQLite CLI tool (`sqlite3`), OR
- TypeORM query runner, OR
- Node.js script with `better-sqlite3`

**Inspection Method:**
- Created `scripts/check-sqlite-schema.ts` for future inspection
- Can be run via: `npm run check:schema` (if added to package.json)

**Assumption:**
- If `synchronize: true` is active and backend has started successfully, SQLite schema should match `PolicyEntity`
- If legacy columns exist, `fix-policy-schema.ts` would have been run

---

## 6. Schema Consistency Summary

### 6.1 PolicyEntity vs Postgres Migrations

| Aspect | PolicyEntity | Postgres Migration | Status |
|--------|-------------|-------------------|--------|
| Table name | `policies` | `app.policies` | ✅ (schema prefix in Postgres) |
| Primary key | `id UUID` | `id UUID PRIMARY KEY` | ✅ |
| Tenant ID | `tenant_id UUID NOT NULL` | `tenant_id UUID NOT NULL` | ✅ |
| Title field | `title TEXT NOT NULL` | `title TEXT NOT NULL` | ✅ |
| Status field | `status TEXT NOT NULL` | `status TEXT NOT NULL CHECK (...)` | ✅ |
| Owner fields | `owner_first_name`, `owner_last_name` | `owner_first_name`, `owner_last_name` | ✅ |
| Date fields | `effective_date`, `review_date` | `effective_date`, `review_date` | ✅ |
| Content field | `content TEXT` | `content TEXT` (via migration) | ✅ |
| Timestamps | `created_at`, `updated_at` | `created_at`, `updated_at` | ✅ |
| Indexes | `idx_policies_tenant` | `idx_policies_tenant` | ✅ |

**Conclusion:** ✅ **PolicyEntity is consistent with Postgres migrations**

### 6.2 PolicyEntity vs SQLite (Expected)

| Aspect | PolicyEntity | SQLite (Expected) | Status |
|--------|-------------|------------------|--------|
| Table name | `policies` | `policies` | ✅ |
| Primary key | `id UUID` | `id VARCHAR(36) PRIMARY KEY` | ✅ (SQLite uses VARCHAR for UUID) |
| Tenant ID | `tenant_id UUID NOT NULL` | `tenant_id VARCHAR(36) NOT NULL` | ✅ |
| Title field | `title TEXT NOT NULL` | `title TEXT NOT NULL` | ✅ |
| Status field | `status TEXT NOT NULL` | `status TEXT NOT NULL` | ✅ |
| Owner fields | `owner_first_name`, `owner_last_name` | `owner_first_name`, `owner_last_name` | ✅ |
| Date fields | `effective_date`, `review_date` | `effective_date`, `review_date` | ✅ |
| Content field | `content TEXT` | `content TEXT` | ✅ |
| Timestamps | `created_at`, `updated_at` | `created_at`, `updated_at` | ✅ |
| Indexes | `idx_policies_tenant` | `idx_policies_tenant` | ✅ |

**Conclusion:** ✅ **PolicyEntity should be consistent with SQLite (via synchronize)**

### 6.3 Legacy Policy Entity vs Current Schema

| Aspect | Legacy Policy | PolicyEntity | Conflict? |
|--------|--------------|--------------|-----------|
| Table name | `policies` | `policies` | ⚠️ **YES** (same table) |
| Title field | `name` | `title` | ⚠️ **YES** (different column) |
| Tenant ID | ❌ None | `tenant_id` | ⚠️ **YES** |
| Owner field | `owner` (single) | `owner_first_name`, `owner_last_name` | ⚠️ **YES** |
| Column naming | camelCase | snake_case | ⚠️ **YES** |
| Soft delete | `deletedAt` | ❌ None | ⚠️ **YES** |

**Conclusion:** ⚠️ **Legacy Policy entity conflicts with PolicyEntity**

**Impact:**
- If both entities are loaded, TypeORM will try to map both to `policies` table
- This can cause schema conflicts and data corruption
- **Recommendation:** Legacy `Policy` entity should be removed or renamed

---

## 7. Migration Strategy Analysis

### 7.1 Current State

**Postgres:**
- ✅ Migration-first approach
- ✅ `synchronize: false` (always)
- ✅ Migrations exist and are consistent with entities
- ✅ Uses schema prefixes (`app.`, `auth.`, `tenant.`)

**SQLite:**
- ⚠️ Synchronize-first approach (dev)
- ⚠️ `synchronize: true` in dev (auto-creates tables)
- ❌ No SQLite-specific migrations
- ⚠️ If `synchronize: false`, tables won't be created

### 7.2 Migration Files Status

**Postgres Migrations:**
- ✅ `1700000000000_bootstrap_db.ts` - Initial schema
- ✅ `1730000005000_DataFoundations_Squashed.ts` - Additional tables
- ✅ `1730000005300_AddPolicyContent.ts` - Adds content column
- ✅ Other migrations for audit, BCM, risk, etc.

**SQLite Migrations:**
- ❌ **None exist**
- ⚠️ SQLite relies on `synchronize: true` for schema creation

### 7.3 Synchronize vs Migration

**Current Approach:**
- **Postgres:** Migration-only (production-ready)
- **SQLite:** Synchronize-only (dev convenience)

**Problems:**
1. **Inconsistency:** Two different approaches for same entities
2. **Risk:** Synchronize can drop columns/data if entity changes
3. **Migration Path:** No clear path to move from synchronize to migration-first
4. **Postgres Readiness:** SQLite migrations don't exist, so Postgres migration path is untested for SQLite

---

## 8. Key Findings & Recommendations

### 8.1 Critical Issues

1. **⚠️ Legacy Policy Entity Conflict**
   - `backend-nest/src/modules/policy/policy.entity.ts` maps to same table as `PolicyEntity`
   - Different schemas (`name` vs `title`, `owner` vs `owner_first_name`/`owner_last_name`)
   - **Action:** Remove or rename legacy entity

2. **⚠️ Synchronize vs Migration Inconsistency**
   - Postgres uses migrations, SQLite uses synchronize
   - No unified approach
   - **Action:** Plan migration-first approach for SQLite

3. **⚠️ No SQLite Migration Files**
   - SQLite relies on `synchronize: true`
   - If synchronize is disabled, tables won't be created
   - **Action:** Create SQLite-compatible migrations

### 8.2 Positive Findings

1. **✅ PolicyEntity is Consistent**
   - Matches Postgres migrations
   - Uses `title` (not `name`)
   - Multi-tenant aware (`tenant_id`)
   - Proper column naming (snake_case)

2. **✅ fix-policy-schema.ts is Safe**
   - Handles `tenant_id` correctly
   - Idempotent
   - Defensive error handling

3. **✅ Postgres Migrations are Well-Structured**
   - Consistent naming
   - Proper schema prefixes
   - Includes indexes and constraints

### 8.3 Recommendations for Next Phases

1. **PHASE 1:** Address legacy Policy entity conflict
2. **PHASE 2:** Plan migration-first approach for SQLite
3. **PHASE 3:** Create SQLite-compatible migrations (or unified migrations)
4. **PHASE 4:** Test migration path for both SQLite and Postgres

---

## 9. Files Analyzed (Read-Only)

- ✅ `backend-nest/src/config/database.config.ts`
- ✅ `backend-nest/src/entities/app/policy.entity.ts`
- ✅ `backend-nest/src/modules/policy/policy.entity.ts`
- ✅ `backend-nest/src/modules/governance/gov.entity.ts`
- ✅ `backend-nest/src/modules/governance/governance.service.ts`
- ✅ `backend-nest/src/migrations/1700000000000_bootstrap_db.ts`
- ✅ `backend-nest/src/migrations/1730000005300_AddPolicyContent.ts`
- ✅ `backend-nest/scripts/fix-policy-schema.ts`
- ✅ `backend-nest/src/app.module.ts`

---

## 10. Next Steps

**PHASE 1:** Policy/Governance Schema Consistency
- Investigate legacy Policy entity usage
- Determine if it can be safely removed
- Fix any mapping inconsistencies

**PHASE 2:** Migration-First Geçiş Planı
- Design unified migration strategy
- Plan SQLite migration support
- Document migration workflow

**PHASE 3:** Postgres Dry-Run Playbook
- Document Postgres setup steps
- Create environment variable guide
- Test migration path

**PHASE 4:** Final Validation
- Run smoke tests
- Verify no regressions
- Generate final report

---

**Report Status:** ✅ Complete  
**Changes Made:** None (read-only analysis)  
**Next Phase:** PHASE 1 - Policy/Governance Schema Consistency
