# POLICY-GOVERNANCE-SCHEMA-CONSISTENCY Report

**Date:** 2025-01-25  
**Phase:** PHASE 1 - Policy/Governance Schema Consistency  
**Purpose:** Identify and fix (if safe) any schema inconsistencies

---

## 1. Entity Conflict Analysis

### 1.1 Two Policy Entities Mapping to Same Table

**Issue:** Two different entities map to the same table `policies`:

1. **Active Entity:** `backend-nest/src/entities/app/policy.entity.ts` → `PolicyEntity`
   - Used by: `GovernanceModule`, `AdminModule`, `DashboardModule`
   - Table: `policies`
   - Schema: `title`, `tenant_id`, `owner_first_name`, `owner_last_name`, snake_case

2. **Legacy Entity:** `backend-nest/src/modules/policy/policy.entity.ts` → `Policy`
   - Used by: `PolicyModule` (if `FEAT.POLICY=true`, default: true)
   - Table: `policies` ⚠️ **SAME TABLE**
   - Schema: `name`, no `tenant_id`, `owner` (single field), camelCase

**Conflict Status:** ⚠️ **CRITICAL CONFLICT**

**Impact:**
- If both modules are loaded (`FEAT.POLICY=true` and `FEAT.GOVERNANCE=true`), TypeORM will try to map both entities to `policies` table
- Different column names (`name` vs `title`, `owner` vs `owner_first_name`/`owner_last_name`)
- Different naming conventions (camelCase vs snake_case)
- This can cause:
  - Schema synchronization conflicts
  - Data corruption
  - Runtime errors

**Current State:**
- Both feature flags default to `true`
- Both modules are likely loaded in dev environment
- This is a **potential runtime issue** that may not be immediately visible if:
  - Only one module is actively used
  - Synchronize creates tables based on one entity, but the other tries to read/write with different column names

---

## 2. PolicyEntity Schema Analysis

### 2.1 Column Mapping

**PolicyEntity** (`backend-nest/src/entities/app/policy.entity.ts`):

```typescript
@Entity({ name: 'policies' })
@Index('idx_policies_tenant', ['tenant_id'])
export class PolicyEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;                    // ✅ NOT NULL
  @Column({ type: 'text' }) code!: string;                // ✅ NOT NULL
  @Column({ type: 'text' }) title!: string;               // ✅ NOT NULL (NOT 'name')
  @Column({ type: 'text' }) status!: string;              // ✅ NOT NULL
  @Column({ type: 'text', nullable: true }) owner_first_name?: string;
  @Column({ type: 'text', nullable: true }) owner_last_name?: string;
  @Column({ type: 'date', nullable: true }) effective_date?: string;
  @Column({ type: 'date', nullable: true }) review_date?: string;
  @Column({ type: 'text', nullable: true }) content?: string;
  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;                  // ✅ NOT NULL
  @UpdateDateColumn() updated_at!: Date;                  // ✅ NOT NULL
}
```

**Column Mapping Status:** ✅ **CORRECT**
- No explicit `@Column({ name: '...' })` needed - TypeORM uses property names as column names
- Property `title` → Column `title` ✅
- Property `tenant_id` → Column `tenant_id` ✅
- Property `effective_date` → Column `effective_date` ✅
- Property `created_at` → Column `created_at` ✅

**Conclusion:** PolicyEntity mapping is **correct and consistent** with Postgres migrations.

---

## 3. Legacy Policy Entity Analysis

### 3.1 Column Mapping

**Policy** (`backend-nest/src/modules/policy/policy.entity.ts`):

```typescript
@Entity({ name: 'policies' })
@Index(['code'], { unique: true })
export class Policy {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 160 }) name!: string;                // ⚠️ 'name' (NOT 'title')
  @Column({ length: 64 }) code!: string;                  // ✅
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ ... }) status!: PolicyStatus;                 // Enum
  @Column({ length: 80, nullable: true }) owner?: string; // ⚠️ Single field (NOT owner_first_name/last_name)
  @Column({ length: 32, nullable: true }) version?: string;
  @Column({ type: 'date', nullable: true }) effectiveDate?: string; // ⚠️ camelCase
  @Column({ type: 'date', nullable: true }) reviewDate?: string;   // ⚠️ camelCase
  @Column({ type: 'simple-array', nullable: true }) tags?: string[];
  @CreateDateColumn() createdAt!: Date;                   // ⚠️ camelCase
  @UpdateDateColumn() updatedAt!: Date;                   // ⚠️ camelCase
  @DeleteDateColumn() deletedAt?: Date;                   // ⚠️ Soft delete
}
```

**Column Mapping Status:** ⚠️ **INCONSISTENT**
- Property `name` → Column `name` (but PolicyEntity uses `title`)
- Property `effectiveDate` → Column `effectiveDate` (but PolicyEntity uses `effective_date`)
- Property `createdAt` → Column `createdAt` (but PolicyEntity uses `created_at`)
- No `tenant_id` (but PolicyEntity requires it)

**Conclusion:** Legacy Policy entity is **incompatible** with PolicyEntity and current schema.

---

## 4. Usage Analysis

### 4.1 PolicyModule Usage

**Module:** `PolicyModule`  
**Feature Flag:** `FEAT.POLICY` (default: `true`)  
**Controller:** `PolicyController` → `/api/v2/policies`  
**Service:** `PolicyService`

**Endpoints:**
- `POST /api/v2/policies` - Create policy
- `GET /api/v2/policies` - List policies
- `GET /api/v2/policies/:id` - Get policy
- `PATCH /api/v2/policies/:id` - Update policy
- `DELETE /api/v2/policies/:id` - Delete policy (soft delete)

**Entity Used:** `Policy` (legacy entity with `name`, `owner`, camelCase)

### 4.2 GovernanceModule Usage

**Module:** `GovernanceModule`  
**Feature Flag:** `FEAT.GOVERNANCE` (default: `true`)  
**Controller:** `GovernanceController` → `/api/v2/governance/policies`  
**Service:** `GovernanceService`

**Endpoints:**
- `GET /api/v2/governance/policies` - List policies
- `GET /api/v2/governance/policies/:id` - Get policy
- `POST /api/v2/governance/policies` - Create policy
- `PATCH /api/v2/governance/policies/:id` - Update policy
- `DELETE /api/v2/governance/policies/:id` - Delete policy

**Entity Used:** `PolicyEntity` (active entity with `title`, `tenant_id`, snake_case)

### 4.3 Conflict Scenario

**If both modules are loaded:**
1. TypeORM tries to register both entities for `policies` table
2. Last registered entity "wins" (or causes conflict)
3. If `synchronize: true`:
   - TypeORM creates/updates table based on one entity
   - The other entity tries to read/write with wrong column names
   - **Result:** Runtime errors or data corruption

**Current Risk:**
- ⚠️ **HIGH** - Both modules are likely loaded in dev
- ⚠️ **MEDIUM** - May not be immediately visible if only one endpoint is used
- ⚠️ **CRITICAL** - If both endpoints are used, data corruption is likely

---

## 5. Recommendations

### 5.1 Immediate Actions (PHASE 1 - Minimal Touch)

**Option A: Disable PolicyModule (Safest)**
- Set `ENABLE_POLICY=false` in `.env`
- This prevents the conflict without code changes
- **Risk:** Low (if PolicyModule is not actively used)

**Option B: Rename Legacy Entity Table (If PolicyModule is needed)**
- Change `@Entity({ name: 'policies' })` to `@Entity({ name: 'policies_legacy' })`
- This creates a separate table for legacy entity
- **Risk:** Medium (requires migration, may break existing data)

**Option C: Remove Legacy Entity (If PolicyModule is not needed)**
- Remove `PolicyModule` from `app.module.ts`
- Remove `backend-nest/src/modules/policy/` directory
- **Risk:** High (if PolicyModule is actively used)

### 5.2 Long-term Actions (Future Phases)

1. **Unify Policy Entities:**
   - Migrate `PolicyModule` to use `PolicyEntity`
   - Update `PolicyService` to use `PolicyEntity`
   - Remove legacy `Policy` entity

2. **Migration Strategy:**
   - Create migration to rename/merge tables if needed
   - Ensure data consistency

---

## 6. PHASE 1 Actions Taken

### 6.1 Analysis Completed

✅ **Identified Entity Conflict:**
- Two entities map to same table
- Different schemas (name vs title, owner vs owner_first_name/last_name)
- Both modules are likely loaded

✅ **Verified PolicyEntity Mapping:**
- PolicyEntity mapping is correct
- Consistent with Postgres migrations
- No mapping bugs found

✅ **Documented Usage:**
- PolicyModule uses legacy entity
- GovernanceModule uses PolicyEntity
- Both are active by default

### 6.2 Minimal Fix Applied

**Decision:** **NO CODE CHANGES** in PHASE 1

**Reasoning:**
- User requirement: "ÇALIŞAN ŞEYİ BOZMA"
- Both modules may be actively used
- Removing/renaming entities could break existing functionality
- Conflict may not be immediately visible (if only one endpoint is used)

**Action Taken:**
- ✅ Documented the conflict
- ✅ Identified the risk
- ✅ Provided recommendations for future phases
- ⚠️ **No code changes** (to avoid breaking working system)

---

## 7. Smoke Test Results

**Status:** Not run in PHASE 1 (read-only analysis)

**Next Steps:**
- Run smoke tests in PHASE 4 to verify current state
- If conflicts are detected, address them in future phases

---

## 8. Summary

### 8.1 Findings

1. **✅ PolicyEntity is Consistent:**
   - Correct column mapping
   - Matches Postgres migrations
   - No mapping bugs

2. **⚠️ Legacy Policy Entity Conflict:**
   - Maps to same table as PolicyEntity
   - Different schema (name vs title, owner vs owner_first_name/last_name)
   - Both modules are active by default

3. **⚠️ No Immediate Fix:**
   - Conflict documented but not fixed (to avoid breaking working system)
   - Recommendations provided for future phases

### 8.2 Next Steps

**PHASE 2:** Migration-First Geçiş Planı
- Plan unified migration strategy
- Address entity conflict in migration plan

**PHASE 3:** Postgres Dry-Run Playbook
- Document Postgres setup
- Test migration path

**PHASE 4:** Final Validation
- Run smoke tests
- Verify no regressions
- Address entity conflict if safe

---

**Report Status:** ✅ Complete  
**Changes Made:** None (read-only analysis + documentation)  
**Risk Level:** ⚠️ Medium (conflict exists but may not be immediately visible)  
**Next Phase:** PHASE 2 - Migration-First Geçiş Planı

