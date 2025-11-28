# DB Foundation – Stabilization Sprint

This sprint brings the entire platform back to a fully working, bootable, smoke-test-passing state **WITHOUT** making any destructive schema changes or unsafe migrations.

## 🎯 Goal

Bring the entire platform back to a fully working, bootable, smoke-test-passing state.

## ❌ What This Sprint MUST NOT Do

- ❌ New migrations
- ❌ Entity renames
- ❌ Table renames
- ❌ Constraint changes
- ❌ Refactor of existing models
- ❌ Breaking API/UI changes
- ❌ Experimental features

## ✅ What This Sprint Does

- ✅ Fix SQLite boot errors
- ✅ Fix policy/gov temp table NOT NULL issues
- ✅ Fix leftover schema drift (only via runtime-safe SQL patches)
- ✅ Ensure all `npm run start:dev` and `npm run smoke:all` pass
- ✅ Apply ONLY safe, idempotent "fix scripts" (in `/scripts`)
- ✅ Verify Admin / Schema Explorer still works
- ✅ Ensure system is READY for DB Foundation Sprint 2 (Baseline Migration)

## 📋 Phase-by-Phase Execution

### PHASE 0 — System & Schema Diagnosis (Read-Only)

**Purpose:** Perform comprehensive read-only analysis of entities, SQLite tables, and detect mismatches.

**Command:**
```bash
cd backend-nest
npm run phase0:snapshot
```

**Output:** `PHASE0-DB-SNAPSHOT.md`

**What it does:**
- Entity snapshot
- SQLite table snapshot
- Column-by-column comparison
- Detects mismatches (missing NOT NULL columns, missing DEFAULT values, unexpected columns, wrong nullability, tenant_id issues)

**Action:** Review the snapshot report. Do NOT modify code yet.

---

### PHASE 1 — Safe-Fixes for SQLite (Runtime Only, NO Migrations)

**Purpose:** Create/update safe, idempotent SQLite repair script.

**Command:**
```bash
cd backend-nest
npm run fix:sqlite
```

**What it does:**
- Detects bad temp tables (e.g. `temporary_policies`, `policies_tmp`)
- Detects missing columns
- Adds missing columns via `ALTER TABLE ... ADD COLUMN` (NULL allowed initially)
- Fixes NOT NULL violations by populating safe defaults
- Fixes "name/title/titleDb" mismatches
- Ensures `tenant_id` always exists and is populated

**CRITICAL:**
- Do NOT drop tables
- Do NOT rewrite schema
- Do NOT affect migrations folder
- Script is idempotent and safe to run multiple times

---

### PHASE 2 — Boot Validation

**Purpose:** Programmatically validate that NestJS starts cleanly.

**Command:**
```bash
cd backend-nest
npm run phase2:boot
```

**What it does:**
1. Runs `npm run fix:sqlite`
2. Runs `npm run build:once`
3. Runs `npm run start:dev` (with health check)
4. Confirms NestJS starts cleanly

**Output:** `PHASE2-BOOT-REPORT.md`

**If boot fails:** Automatically re-run safe repair logic.

---

### PHASE 3 — Smoke Test Validation

**Purpose:** Programmatically run all smoke tests and fix any failures.

**Command:**
```bash
cd backend-nest
npm run phase3:smoke
```

**What it does:**
- Runs `npm run smoke:policies`
- Runs `npm run smoke:governance`
- Runs `npm run smoke:all`

**Output:** `PHASE3-SMOKE-REPORT.md`

**If ANY fail:**
- Fix backend root cause (safe changes only)
- DO NOT touch migrations
- DO NOT touch schema explorer

---

### PHASE 4 — System Integrity Verification

**Purpose:** Confirm all critical UI components work.

**Command:**
```bash
cd backend-nest
npm run phase4:integrity
```

**What it verifies:**
- Admin → Role/Permission list works
- Admin → Schema Explorer loads
- Governance → Policy list loads
- Risk Catalog filters work (no regression)
- Calendar loads events

**Output:** `PHASE4-INTEGRITY-REPORT.md`

**If regressions exist:** Patch ONLY the minimal code required.

---

### PHASE 5 — Final "All Green" Certification

**Purpose:** Generate final certification report.

**Command:**
```bash
cd backend-nest
npm run phase5:certify
```

**Output:** `DB-FOUNDATION-STABILIZATION-FINAL.md`

**Includes:**
- Boot PASS/FAIL
- Smoke PASS/FAIL
- No TypeScript errors
- No lint errors
- No unintentional schema drift
- No broken UI

**System is stable and ready for:**
- ➡️ DB FOUNDATION – SPRINT 2 (Baseline Migration Generation)
- ➡️ DB Foundation SPRINT 3 (Postgres Dry Run)
- ➡️ Environment separation (DEV → PREPROD → PROD)

---

## 🚀 Quick Start

Run all phases in sequence:

```bash
cd backend-nest

# Phase 0: Diagnosis (read-only)
npm run phase0:snapshot

# Phase 1: SQLite Repair
npm run fix:sqlite

# Phase 2: Boot Validation
npm run phase2:boot

# Phase 3: Smoke Tests
npm run phase3:smoke

# Phase 4: Integrity Check
npm run phase4:integrity

# Phase 5: Final Certification
npm run phase5:certify
```

---

## 📁 Generated Reports

All reports are generated in the project root:

- `PHASE0-DB-SNAPSHOT.md` - Entity and schema analysis
- `PHASE2-BOOT-REPORT.md` - Boot validation results
- `PHASE3-SMOKE-REPORT.md` - Smoke test results
- `PHASE4-INTEGRITY-REPORT.md` - System integrity verification
- `DB-FOUNDATION-STABILIZATION-FINAL.md` - Final certification

---

## 🔧 Scripts Created

All scripts are in `backend-nest/scripts/`:

- `phase0-db-snapshot.ts` - System & schema diagnosis
- `sqlite-repair.ts` - Safe SQLite repair (idempotent)
- `phase2-boot-validation.ts` - Boot validation
- `phase3-smoke-validation.ts` - Smoke test validation
- `phase4-integrity-verification.ts` - System integrity check
- `phase5-final-certification.ts` - Final certification

---

## ⚠️ Important Notes

1. **All scripts are idempotent** - Safe to run multiple times
2. **No migrations created** - Only runtime-safe SQL patches
3. **No schema changes** - Only additive changes (ADD COLUMN)
4. **No data loss** - All operations preserve existing data
5. **Safe defaults** - NULL values populated with safe defaults before adding NOT NULL constraints

---

## 🐛 Troubleshooting

### SQLite Repair Fails

If `npm run fix:sqlite` fails:
1. Check SQLite file path in `.env` (`SQLITE_FILE`)
2. Ensure SQLite file is not locked by another process
3. Review error message in console output

### Boot Validation Fails

If `npm run phase2:boot` fails:
1. Check Phase 1 (SQLite repair) completed successfully
2. Review `PHASE2-BOOT-REPORT.md` for specific errors
3. Manually run `npm run start:dev` to see detailed error messages

### Smoke Tests Fail

If `npm run phase3:smoke` fails:
1. Ensure backend server is running
2. Check database is accessible
3. Review `PHASE3-SMOKE-REPORT.md` for specific test failures
4. Fix backend root cause (safe changes only)

---

## ✅ Success Criteria

The sprint is complete when:

- ✅ `npm run phase0:snapshot` - No critical errors
- ✅ `npm run fix:sqlite` - All repairs applied successfully
- ✅ `npm run phase2:boot` - NestJS starts cleanly
- ✅ `npm run phase3:smoke` - All smoke tests pass
- ✅ `npm run phase4:integrity` - All components verified
- ✅ `npm run phase5:certify` - Final certification PASSED

---

## 📚 Next Steps After Stabilization

Once all phases pass:

1. **DB Foundation Sprint 2:** Generate baseline migration
2. **DB Foundation Sprint 3:** Postgres dry run
3. **Environment Setup:** Configure DEV → PREPROD → PROD separation

---

*This README documents the DB Foundation Stabilization Sprint process.*

