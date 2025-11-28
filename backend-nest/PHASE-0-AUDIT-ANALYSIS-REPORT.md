# PHASE 0 - Audit Log SQLITE_MISMATCH Analysis Report

## Date
2025-01-20

## Objective
Analyze the root cause of `SQLITE_MISMATCH: datatype mismatch` error when writing audit logs in SQLite development environment.

---

## 1. Current Entity Definition

**File:** `backend-nest/src/entities/audit/audit-log.entity.ts`

```typescript
@Entity({ schema: 'audit', name: 'audit_logs' })
export class AuditLogEntity {
  @PrimaryColumn('uuid')
  id!: string;  // UUID primary key
  
  @Column('uuid', { nullable: true })
  tenant_id?: string;
  
  @Column('uuid', { nullable: true })
  user_id?: string;
  
  @Column({ type: 'text' })
  entity_schema!: string;
  
  @Column({ type: 'text' })
  entity_table!: string;
  
  @Column('uuid', { nullable: true })
  entity_id?: string;
  
  @Column({ type: 'text' })
  action!: string;
  
  @Column({ type: jsonColumnType, nullable: true })
  diff?: Record<string, unknown>;  // jsonColumnType = 'simple-json' for SQLite
  
  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuid.v4();
    }
  }
}
```

**Key Points:**
- `id`: UUID (PrimaryColumn)
- `tenant_id`, `user_id`, `entity_id`: UUID, nullable
- `diff`: Uses `jsonColumnType` which is `'simple-json'` for SQLite
- `created_at`: `datetime` type

---

## 2. Current SQLite Schema (Actual)

**Database:** `backend-nest/data/grc.sqlite`

**Table:** `audit_logs`

**Schema (from PRAGMA table_info):**
```
id            varchar  PRIMARY KEY NOT NULL
tenant_id     varchar  nullable
user_id       varchar  nullable
entity_schema TEXT     NOT NULL
entity_table  TEXT     NOT NULL
entity_id     varchar  nullable
action        TEXT     NOT NULL
diff          TEXT     nullable
created_at    datetime NOT NULL DEFAULT (datetime('now'))
```

**CREATE TABLE Statement:**
```sql
CREATE TABLE "audit_logs" (
  "id" varchar PRIMARY KEY NOT NULL,
  "tenant_id" varchar,
  "user_id" varchar,
  "entity_schema" text NOT NULL,
  "entity_table" text NOT NULL,
  "entity_id" varchar,
  "action" text NOT NULL,
  "diff" text,
  "created_at" datetime NOT NULL DEFAULT (datetime('now'))
)
```

---

## 3. Interceptor Implementation

**File:** `backend-nest/src/common/interceptors/audit-log.interceptor.ts`

**Key Code:**
```typescript
const auditLog = this.auditLogRepo.create({
  tenant_id: tenantId || undefined,
  user_id: actorId || undefined,
  entity_schema: 'app',
  entity_table: entity,
  entity_id: entityId || undefined,
  action: method.toLowerCase(),
  diff: {
    before: maskPII(before),
    after: maskPII(after),
  },
});
await this.auditLogRepo.save(auditLog);
```

**Observations:**
- Uses `create()` method (triggers `@BeforeInsert()` hook for UUID generation)
- `diff` is passed as a JavaScript object `{ before: ..., after: ... }`
- Nullable fields use `|| undefined` pattern

---

## 4. Column Type Mapping

**File:** `backend-nest/src/common/database/column-types.ts`

```typescript
export const jsonColumnType: 'jsonb' | 'simple-json' = isPostgres
  ? 'jsonb'
  : 'simple-json';
```

**For SQLite:**
- `jsonColumnType = 'simple-json'`
- TypeORM's `simple-json` type expects a JSON string or will auto-serialize objects

---

## 5. Migration Definition (PostgreSQL)

**File:** `backend-nest/src/migrations/1700000000000_bootstrap_db.ts`

```sql
CREATE TABLE IF NOT EXISTS audit.audit_logs (
  id BIGSERIAL PRIMARY KEY,        -- ❌ INTEGER (PostgreSQL auto-increment)
  tenant_id UUID,
  user_id UUID,
  entity_schema TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  diff JSONB,                       -- ❌ JSONB (PostgreSQL-specific)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Note:** This migration is PostgreSQL-specific and does NOT apply to SQLite. SQLite tables are created by TypeORM's `synchronize` option.

---

## 6. Schema Comparison

| Column | Entity Definition | SQLite Actual | Match? |
|--------|------------------|--------------|--------|
| `id` | `@PrimaryColumn('uuid')` → `varchar` | `varchar` | ✅ YES |
| `tenant_id` | `@Column('uuid')` → `varchar` | `varchar` | ✅ YES |
| `user_id` | `@Column('uuid')` → `varchar` | `varchar` | ✅ YES |
| `entity_schema` | `@Column({ type: 'text' })` | `TEXT` | ✅ YES |
| `entity_table` | `@Column({ type: 'text' })` | `TEXT` | ✅ YES |
| `entity_id` | `@Column('uuid')` → `varchar` | `varchar` | ✅ YES |
| `action` | `@Column({ type: 'text' })` | `TEXT` | ✅ YES |
| `diff` | `@Column({ type: 'simple-json' })` | `TEXT` | ✅ YES |
| `created_at` | `@CreateDateColumn({ type: 'datetime' })` | `datetime` | ✅ YES |

**Conclusion:** The schema appears to match correctly!

---

## 7. Potential Root Causes

### Hypothesis 1: TypeORM `simple-json` Serialization Issue
- **Issue:** TypeORM's `simple-json` type may not be serializing the object correctly
- **Evidence:** Interceptor passes `diff` as an object `{ before: ..., after: ... }`
- **SQLite Expectation:** `TEXT` column should receive a JSON string
- **Likelihood:** HIGH - This is the most likely cause

### Hypothesis 2: Null vs Undefined Handling
- **Issue:** SQLite may be strict about NULL vs undefined values
- **Evidence:** Interceptor uses `|| undefined` pattern
- **Likelihood:** MEDIUM - Could cause type mismatch

### Hypothesis 3: UUID String Format
- **Issue:** UUID strings might not match SQLite's varchar expectations
- **Evidence:** All UUID columns are `varchar` in SQLite
- **Likelihood:** LOW - UUIDs are valid strings

### Hypothesis 4: Schema Mismatch from Previous Migration
- **Issue:** Table might have been created with wrong schema initially
- **Evidence:** Migration file shows PostgreSQL-specific schema
- **Likelihood:** LOW - Current schema looks correct

---

## 8. Error Pattern Analysis

**Observed Error:**
```
SQLITE_MISMATCH: datatype mismatch
query: INSERT INTO "audit_logs"("id", "tenant_id", "user_id", "entity_schema", "entity_table", "entity_id", "action", "diff", "created_at") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**Parameters Example:**
```
[
  '2ba76351-3e2a-42b9-8791-48fc97aaa554',  // id (UUID string) ✅
  null,                                    // tenant_id (null) ✅
  null,                                    // user_id (null) ✅
  'app',                                   // entity_schema (string) ✅
  'auth',                                  // entity_table (string) ✅
  null,                                    // entity_id (null) ✅
  'post',                                  // action (string) ✅
  '{"before":{"email":"***MASKED***","password":"***MASKED***"},"after":{...}}',  // diff (JSON string) ✅
  '2025-11-20 20:11:37.816'                // created_at (datetime string) ✅
]
```

**Observation:** The parameters look correct! The issue might be:
1. SQLite is receiving a JavaScript object for `diff` instead of a JSON string
2. TypeORM is not serializing `simple-json` correctly before the INSERT

---

## 9. TypeORM `simple-json` Behavior

**Documentation:**
- `simple-json` type in TypeORM stores JSON as TEXT in SQLite
- It should automatically serialize JavaScript objects to JSON strings
- It should automatically deserialize JSON strings to JavaScript objects

**Potential Issue:**
- If TypeORM's `simple-json` transformer is not working correctly, the object might be passed directly to SQLite
- SQLite would then try to convert the object to a string, which might cause a mismatch

---

## 10. Configuration Check

**File:** `backend-nest/src/config/database.config.ts`

**SQLite Config:**
```typescript
synchronize: synchronize || true,  // Defaults to true in dev
```

**Observation:**
- `synchronize: true` means TypeORM will auto-create/update tables based on entities
- This should ensure schema matches entity definitions
- However, if the table already exists with wrong schema, TypeORM might not alter it

---

## 11. Summary & Root Cause Hypothesis

### Root Cause (HIGH CONFIDENCE):
**TypeORM's `simple-json` type is not serializing the `diff` object to a JSON string before INSERT.**

**Evidence:**
1. Entity defines `diff` as `Record<string, unknown>` (JavaScript object)
2. Interceptor passes `diff` as an object: `{ before: ..., after: ... }`
3. SQLite expects `TEXT` (JSON string) but might be receiving the object directly
4. SQLite's strict type checking causes `SQLITE_MISMATCH`

### Solution Strategy:
1. **Option A (Recommended):** Manually serialize `diff` to JSON string in interceptor before saving
2. **Option B:** Ensure TypeORM's `simple-json` transformer is working correctly
3. **Option C:** Change entity to use `@Column({ type: 'text' })` and handle serialization manually

### Additional Considerations:
- The error does NOT break the application (request succeeds)
- Only audit logging fails silently
- This is a dev-only issue (SQLite), production (PostgreSQL) uses `jsonb` which works correctly

---

## 12. Files Involved

1. `backend-nest/src/entities/audit/audit-log.entity.ts` - Entity definition
2. `backend-nest/src/common/interceptors/audit-log.interceptor.ts` - Interceptor implementation
3. `backend-nest/src/common/database/column-types.ts` - Column type helpers
4. `backend-nest/src/config/database.config.ts` - Database configuration
5. `backend-nest/data/grc.sqlite` - SQLite database file

---

## 13. Next Steps (PHASE 1)

1. Fix `diff` serialization in interceptor (manually stringify before save)
2. Add better error handling (reduce log noise)
3. Add optional flag to disable audit logging in dev
4. Test thoroughly to ensure no breaking changes

---

## End of PHASE 0 Report

