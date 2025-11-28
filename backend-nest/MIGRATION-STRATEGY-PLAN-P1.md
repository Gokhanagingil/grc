# MIGRATION-STRATEGY-PLAN-P1: Migration-First Geçiş Planı

**Date:** 2025-01-25  
**Phase:** PHASE 2 - Migration-First Geçiş Planı  
**Purpose:** Design unified migration strategy for SQLite and Postgres

---

## 1. Current State Analysis

### 1.1 Postgres Migration Status

**Status:** ✅ **Migration-First**

**Configuration:**
- `synchronize: false` (always)
- Migrations located: `backend-nest/src/migrations/`
- Migration files: 15+ migration files
- Schema prefixes: `app.`, `auth.`, `tenant.`, `audit.`

**Key Migrations:**
1. `1700000000000_bootstrap_db.ts` - Initial schema (tenants, users, roles, policies)
2. `1730000005000_DataFoundations_Squashed.ts` - Risk, Standard, Compliance tables
3. `1730000005300_AddPolicyContent.ts` - Adds `content` column to policies
4. `1731000000000_AddRiskInstanceAndCatalogFields.ts` - Risk enhancements
5. `1732000000000_CreateEntityRegistry.ts` - Entity registry
6. `1733000000000_CreateAuditLifecycle.ts` - Audit lifecycle
7. `1734000000000_CreateBCMAndAuditRefinements.ts` - BCM and audit refinements
8. `1735000000000_FixAuditLogsSchema.ts` - Audit logs schema fix

**Migration Quality:**
- ✅ Well-structured
- ✅ Idempotent (uses `IF NOT EXISTS`, `IF EXISTS`)
- ✅ Uses schema prefixes (Postgres-specific)
- ✅ Includes indexes and constraints
- ✅ Has `up()` and `down()` methods

### 1.2 SQLite Migration Status

**Status:** ⚠️ **Synchronize-First**

**Configuration:**
- `synchronize: true` in dev (auto-creates tables from entities)
- `synchronize: false` in prod (but no migrations exist)
- Migration files: ❌ **NONE** (SQLite-specific migrations don't exist)

**Current Behavior:**
- Dev: TypeORM auto-creates/updates tables based on entities
- Prod: Would fail (no migrations, synchronize disabled)

**Problems:**
1. ❌ No SQLite migration files
2. ⚠️ Relies on `synchronize: true` for schema management
3. ⚠️ Schema changes are not versioned
4. ⚠️ Cannot rollback schema changes
5. ⚠️ Different approach than Postgres (inconsistency)

### 1.3 Schema Fix Scripts

**Scripts:**
- `fix-policy-schema.ts` - Migrates legacy `policies` table
- `fix-standard-clause-constraint.ts` - Fixes standard clause constraints

**Purpose:**
- One-time migration from legacy schema to current schema
- Handles edge cases (missing `tenant_id`, column name changes)
- **Not a replacement for migrations** - only for legacy data recovery

**Status:**
- ✅ Safe and idempotent
- ✅ Handles edge cases
- ⚠️ Should be replaced by proper migrations in future

---

## 2. Migration Strategy Goals

### 2.1 Short-term (DB FOUNDATION SPRINT 1-2)

**Goal:** Prepare for migration-first approach without breaking current system

**Actions:**
1. ✅ Document current state (PHASE 0)
2. ✅ Identify inconsistencies (PHASE 1)
3. 📋 Plan migration strategy (PHASE 2 - this document)
4. 📋 Create Postgres playbook (PHASE 3)
5. 📋 Validate current state (PHASE 4)

**Outcome:**
- Clear understanding of current state
- Migration strategy documented
- Postgres readiness verified
- **No breaking changes** to current system

### 2.2 Medium-term (DB FOUNDATION SPRINT 3-4)

**Goal:** Transition SQLite to migration-first approach

**Actions:**
1. Generate baseline migration from current SQLite schema
2. Create SQLite-compatible migration runner
3. Test migration path (create → migrate → seed → smoke)
4. Disable `synchronize: true` in dev (use migrations instead)
5. Remove or deprecate schema fix scripts

**Outcome:**
- SQLite uses migrations (same as Postgres)
- Unified approach for both databases
- Versioned schema changes
- Rollback capability

### 2.3 Long-term (DB FOUNDATION SPRINT 5+)

**Goal:** Unified migration system for SQLite and Postgres

**Actions:**
1. Create database-agnostic migration format
2. Auto-generate migrations from entity changes
3. Support both SQLite and Postgres in same migration files
4. Migration testing framework
5. CI/CD integration

**Outcome:**
- Single migration system for both databases
- Automated migration generation
- Comprehensive testing
- Production-ready migration pipeline

---

## 3. Migration Architecture Design

### 3.1 Unified Migration Format

**Current Problem:**
- Postgres migrations use schema prefixes (`app.policies`)
- SQLite doesn't support schemas
- Postgres migrations use Postgres-specific syntax (`gen_random_uuid()`, `TIMESTAMPTZ`)

**Solution: Database-Aware Migrations**

```typescript
export class CreatePoliciesTable1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const isSQLite = queryRunner.connection.options.type === 'sqlite';
    
    if (isPostgres) {
      // Postgres-specific SQL
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS app.policies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          ...
        );
      `);
    } else if (isSQLite) {
      // SQLite-specific SQL
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS policies (
          id VARCHAR(36) PRIMARY KEY,
          tenant_id VARCHAR(36) NOT NULL,
          ...
        );
      `);
    }
  }
  
  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback logic
  }
}
```

**Alternative: Separate Migration Files**

- `migrations/postgres/1700000000000_bootstrap_db.ts`
- `migrations/sqlite/1700000000000_bootstrap_db.ts`
- TypeORM loads appropriate migrations based on DB type

**Recommendation:** Start with database-aware migrations (simpler), migrate to separate files if needed.

### 3.2 Migration Generation Strategy

**Option A: Manual Migration Creation**
- Developer creates migration file manually
- Follows naming convention: `{timestamp}_{description}.ts`
- Includes both SQLite and Postgres SQL

**Option B: Auto-Generation from Entity Changes**
- Use TypeORM CLI: `typeorm migration:generate`
- Generates migration from entity changes
- Manual review and adjustment required

**Option C: Hybrid Approach**
- Auto-generate baseline migration from current schema
- Manual migrations for future changes
- Best of both worlds

**Recommendation:** Start with Option C (hybrid):
1. Generate baseline migration from current SQLite schema
2. Use manual migrations for future changes
3. Consider auto-generation in long-term

### 3.3 Baseline Migration Generation

**Strategy:**
1. **Capture Current SQLite Schema:**
   - Use `PRAGMA table_info(...)` to get table schemas
   - Export to migration file format
   - Include indexes and constraints

2. **Create Baseline Migration:**
   - `1700000000000_Baseline_SQLite.ts` (or similar)
   - Creates all current tables
   - Includes all indexes
   - Idempotent (uses `IF NOT EXISTS`)

3. **Test Baseline:**
   - Drop all tables
   - Run baseline migration
   - Verify schema matches current state
   - Run smoke tests

**Tools:**
- TypeORM CLI: `typeorm migration:generate`
- Custom script: `scripts/generate-baseline-migration.ts`
- Manual creation (for first baseline)

---

## 4. Migration Workflow

### 4.1 Development Workflow (Current → Target)

**Current (Synchronize-First):**
```
1. Modify entity
2. Restart backend
3. TypeORM auto-updates schema (synchronize: true)
4. Test
```

**Target (Migration-First):**
```
1. Modify entity
2. Generate migration: npm run migration:generate -- -n AddNewColumn
3. Review migration file
4. Run migration: npm run migration:run
5. Test
6. Commit entity + migration
```

### 4.2 Production Workflow

**Postgres (Current):**
```
1. Deploy code
2. Run migrations: npm run migration:run
3. Verify: npm run smoke:all
```

**SQLite (Target):**
```
1. Deploy code
2. Run migrations: npm run migration:run
3. Verify: npm run smoke:all
```

**Unified (Future):**
```
1. Deploy code
2. Run migrations: npm run migration:run (works for both SQLite and Postgres)
3. Verify: npm run smoke:all
```

### 4.3 Rollback Strategy

**Current:**
- ❌ No rollback (synchronize doesn't support rollback)
- ⚠️ Manual rollback (restore from backup)

**Target:**
- ✅ Migration rollback: `npm run migration:revert`
- ✅ Each migration has `down()` method
- ✅ Versioned schema changes

---

## 5. Migration File Structure

### 5.1 Current Structure

```
backend-nest/src/migrations/
├── 1700000000000_bootstrap_db.ts
├── 1730000005000_DataFoundations_Squashed.ts
├── 1730000005300_AddPolicyContent.ts
├── ...
└── _archive/
    └── (old migrations)
```

**Naming Convention:**
- `{timestamp}_{Description}.ts`
- Timestamp: Unix timestamp or sequential number
- Description: PascalCase, descriptive

### 5.2 Proposed Structure (Future)

**Option A: Database-Aware (Recommended for Start)**
```
backend-nest/src/migrations/
├── 1700000000000_bootstrap_db.ts (works for both SQLite and Postgres)
├── 1730000005300_AddPolicyContent.ts (works for both)
└── ...
```

**Option B: Separate Directories**
```
backend-nest/src/migrations/
├── common/ (shared migrations)
├── postgres/ (Postgres-specific)
└── sqlite/ (SQLite-specific)
```

**Option C: Unified with Database Checks**
```
backend-nest/src/migrations/
├── 1700000000000_bootstrap_db.ts (checks DB type, runs appropriate SQL)
└── ...
```

**Recommendation:** Start with Option A (database-aware), migrate to Option C if needed.

---

## 6. Migration Testing Strategy

### 6.1 Unit Testing

**Test Migration Up:**
```typescript
test('migration creates policies table', async () => {
  await migration.up(queryRunner);
  const table = await queryRunner.getTable('policies');
  expect(table).toBeDefined();
  expect(table.columns.find(c => c.name === 'title')).toBeDefined();
});
```

**Test Migration Down:**
```typescript
test('migration rollback drops policies table', async () => {
  await migration.up(queryRunner);
  await migration.down(queryRunner);
  const table = await queryRunner.getTable('policies');
  expect(table).toBeUndefined();
});
```

### 6.2 Integration Testing

**Test Migration Path:**
```
1. Start with empty database
2. Run all migrations
3. Verify schema matches entities
4. Run seed scripts
5. Run smoke tests
6. Verify data integrity
```

**Test Rollback Path:**
```
1. Start with migrated database
2. Rollback last migration
3. Verify schema changes reverted
4. Run smoke tests (should fail gracefully)
```

### 6.3 Smoke Test Integration

**Current:**
- Smoke tests verify API endpoints
- Don't verify schema directly

**Target:**
- Add schema verification to smoke tests
- Verify table structure matches entities
- Verify indexes exist
- Verify constraints are correct

---

## 7. Migration Scripts

### 7.1 Current Scripts

**package.json:**
```json
{
  "scripts": {
    "migration:generate": "typeorm migration:generate",
    "migration:run": "typeorm migration:run",
    "migration:revert": "typeorm migration:revert",
    "migration:show": "typeorm migration:show"
  }
}
```

**Status:** ⚠️ May not work for SQLite (TypeORM CLI may need Postgres connection)

### 7.2 Proposed Scripts

**package.json:**
```json
{
  "scripts": {
    "migration:generate": "ts-node -r tsconfig-paths/register scripts/migration-generate.ts",
    "migration:run": "ts-node -r tsconfig-paths/register scripts/migration-run.ts",
    "migration:revert": "ts-node -r tsconfig-paths/register scripts/migration-revert.ts",
    "migration:show": "ts-node -r tsconfig-paths/register scripts/migration-show.ts",
    "migration:baseline": "ts-node -r tsconfig-paths/register scripts/migration-baseline.ts"
  }
}
```

**Custom Scripts:**
- `scripts/migration-generate.ts` - Generate migration from entity changes
- `scripts/migration-run.ts` - Run pending migrations
- `scripts/migration-revert.ts` - Revert last migration
- `scripts/migration-show.ts` - Show migration status
- `scripts/migration-baseline.ts` - Generate baseline from current schema

---

## 8. Entity Conflict Resolution

### 8.1 Policy Entity Conflict

**Problem:** Two entities map to same table (`policies`)

**Migration Strategy:**
1. **Phase 1:** Document conflict (✅ Done in PHASE 1)
2. **Phase 2:** Plan resolution (this document)
3. **Phase 3:** Create migration to resolve conflict
4. **Phase 4:** Test and validate

**Migration Options:**

**Option A: Rename Legacy Table**
```typescript
// Migration: Rename policies_legacy
await queryRunner.query(`
  ALTER TABLE policies RENAME TO policies_legacy;
`);
// Create new policies table with PolicyEntity schema
// Migrate data from policies_legacy to policies
```

**Option B: Merge Tables**
```typescript
// Migration: Merge policies (legacy) into policies (new)
// Map: name → title, owner → owner_first_name/last_name
// Add tenant_id (use default)
```

**Option C: Remove Legacy Entity**
```typescript
// Migration: Ensure policies table matches PolicyEntity
// Drop legacy columns if they exist
// Add new columns if missing
```

**Recommendation:** Option C (simplest, if PolicyModule is not actively used)

---

## 9. Postgres Migration Compatibility

### 9.1 Current Postgres Migrations

**Status:** ✅ Well-structured, production-ready

**Features:**
- Schema prefixes (`app.`, `auth.`, `tenant.`)
- Postgres-specific functions (`gen_random_uuid()`, `TIMESTAMPTZ`)
- Row Level Security (RLS) policies
- Extensions (`pgcrypto`, `uuid-ossp`, `citext`)

### 9.2 SQLite Compatibility

**Challenges:**
1. ❌ No schema support (SQLite doesn't have schemas)
2. ❌ No `gen_random_uuid()` (use `lower(hex(randomblob(...)))`)
3. ❌ No `TIMESTAMPTZ` (use `DATETIME`)
4. ❌ No RLS (not needed for SQLite)
5. ❌ No extensions (not applicable)

**Solution:**
- Database-aware migrations (check DB type, use appropriate SQL)
- Or: Separate migration files for SQLite and Postgres

---

## 10. Implementation Roadmap

### 10.1 Sprint 1 (Current)

**Status:** ✅ In Progress

**Tasks:**
- ✅ PHASE 0: DB Snapshot
- ✅ PHASE 1: Schema Consistency Analysis
- ✅ PHASE 2: Migration Strategy Plan (this document)
- 📋 PHASE 3: Postgres Playbook
- 📋 PHASE 4: Validation

**Outcome:** Strategy documented, no code changes

### 10.2 Sprint 2 (Next)

**Tasks:**
1. Generate baseline migration from current SQLite schema
2. Create database-aware migration helper utilities
3. Test baseline migration (create → migrate → seed → smoke)
4. Document migration workflow

**Outcome:** Baseline migration created, tested

### 10.3 Sprint 3 (Future)

**Tasks:**
1. Disable `synchronize: true` in dev
2. Use migrations for all schema changes
3. Resolve entity conflicts via migrations
4. Update migration scripts

**Outcome:** SQLite uses migrations (same as Postgres)

### 10.4 Sprint 4+ (Future)

**Tasks:**
1. Unified migration system
2. Auto-generation from entity changes
3. Comprehensive testing
4. CI/CD integration

**Outcome:** Production-ready migration system

---

## 11. Risks and Mitigation

### 11.1 Risks

1. **Breaking Current System:**
   - Risk: Disabling synchronize breaks dev workflow
   - Mitigation: Keep synchronize enabled until migrations are ready

2. **Data Loss:**
   - Risk: Migration errors cause data loss
   - Mitigation: Always backup before migrations, test in dev first

3. **Entity Conflicts:**
   - Risk: Two entities map to same table
   - Mitigation: Resolve conflicts before disabling synchronize

4. **Migration Complexity:**
   - Risk: Database-aware migrations are complex
   - Mitigation: Start simple, iterate

### 11.2 Mitigation Strategies

1. **Incremental Approach:**
   - Don't disable synchronize until migrations are ready
   - Test migrations thoroughly before production use

2. **Backup Strategy:**
   - Always backup before migrations
   - Test rollback procedures

3. **Testing:**
   - Unit tests for migrations
   - Integration tests for migration path
   - Smoke tests after migrations

---

## 12. Success Criteria

### 12.1 Short-term (Sprint 1-2)

✅ **Documented:**
- Current state analyzed
- Migration strategy planned
- Postgres playbook created

### 12.2 Medium-term (Sprint 3-4)

✅ **Implemented:**
- Baseline migration created
- SQLite uses migrations
- Unified approach for both databases

### 12.3 Long-term (Sprint 5+)

✅ **Production-Ready:**
- Auto-generation from entity changes
- Comprehensive testing
- CI/CD integration

---

## 13. Next Steps

**Immediate (PHASE 3):**
- Create Postgres Dry-Run Playbook
- Document Postgres setup steps
- Test Postgres migration path

**Next Sprint:**
- Generate baseline migration
- Create migration helper utilities
- Test migration workflow

**Future Sprints:**
- Disable synchronize
- Resolve entity conflicts
- Unified migration system

---

**Report Status:** ✅ Complete  
**Changes Made:** None (planning document only)  
**Next Phase:** PHASE 3 - Postgres Dry-Run Playbook

