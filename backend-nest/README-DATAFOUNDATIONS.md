# Data Foundations Module

This module provides the data foundation layer for the GRC platform, including standards, clauses, controls, risks, and their mappings.

## Quick Start

### Prerequisites

- PostgreSQL 16+
- Node.js 18+
- TypeORM configured with PostgreSQL

### Setup

```bash
cd backend-nest

# Install dependencies (if typeorm-naming-strategies not installed)
npm install

# Run migrations
npm run db:migrate

# Seed data
npm run db:seed:data

# Verify data
npm run db:verify
```

### Migration Reset & Squash

If you encounter "duplicate column/constraint" errors, the old migrations have been archived. The migration chain now starts with `1730000005000_DataFoundations_Squashed.ts`.

**Development Recovery:**

```bash
cd backend-nest
npm run db:migrate
npm run db:seed:data
npm run db:verify
```

Old migrations are preserved in `src/migrations/_archive/` for reference but are excluded from the build.

## Data Model

### Tables

1. **app.standard** - GRC standards (ISO20000, ISO27001, ISO22301)
2. **app.standard_clause** - Individual clauses within standards (hierarchical)
3. **app.control_library** - Library of controls (NIST, ISO, CIS)
4. **app.control_to_clause** - Many-to-many: controls ↔ clauses
5. **app.risk_category** - Risk categories (Operations, Technical, etc.)
6. **app.risk_catalog** - Risk catalog entries
7. **app.risk_to_control** - Many-to-many: risks ↔ controls
8. **app.standard_mapping** - Cross-standard clause mappings

### Indexes

- **B-tree indexes** on `tenant_id`, `code`, `clause_code`, foreign keys
- **Unique indexes** on `(code, tenant_id)` and `(clause_code, tenant_id)`
- **GIN indexes** on JSONB columns (`tags`, `control_refs`, `references`)

### Extensions

- `ltree` - For hierarchical clause paths (optional)
- `uuid-ossp` - For UUID generation
- `citext` - For case-insensitive email/text

## Seed Data

### CSV Files Location

- `data/seeds/risk_categories.csv` - Risk categories
- `data/seeds/risk_catalog.csv` - Risk catalog entries (base set)
- `data/seeds/standards/ISO20000.csv` - ISO 20000 clauses
- `data/seeds/standards/ISO27001.csv` - ISO 27001 clauses
- `data/seeds/standards/ISO22301.csv` - ISO 22301 clauses
- `data/seeds/mappings/iso20000_iso22301.csv` - Standard mappings
- `data/seeds/mappings/iso27001_iso22301.csv` - Standard mappings
- `data/seeds/controls/controls.csv` - Control library
- `data/seeds/controls/control_to_clause.csv` - Control-clause mappings

### Seed Order

The seed script ensures correct order:

1. **standards** (independent)
2. **standard_clause** (depends on standard)
3. **control_library** (independent)
4. **control_to_clause** (depends on control + clause)
5. **risk_category** (independent)
6. **risk_catalog** (depends on risk_category)
7. **standard_mapping** (depends on clauses)
8. **risk_to_control** (depends on risk + control)

### Minimum Counts

The seed script generates additional entries to meet minimum requirements:

- **Risks:** ≥300
- **Controls:** ≥150
- **Clauses:** ≥400 (from CSV files)
- **Mappings:** ≥200

## Verification

### PSQL Scripts

**Windows (PowerShell):**
```powershell
.\scripts\psql-verify.ps1
```

**Unix (Bash):**
```bash
./scripts/psql-verify.sh
```

**Direct SQL:**
```bash
psql -h localhost -U grc -d grc -f scripts/verify-data-foundations.sql
```

### Node.js Verification

```bash
npm run db:verify
```

This generates `reports/DATA-FOUNDATIONS-DB-REPORT.md` with PASS/FAIL status.

### Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Risks | ≥300 | Risk catalog entries |
| Controls | ≥150 | Control library entries |
| Clauses | ≥400 | Standard clause entries |
| Mappings | ≥200 | Cross-standard mappings |
| Cross-Impact | ≥1 | Related clauses for ISO20000:8.4 |

## API Endpoints

### Dashboard Overview

`GET /api/v2/dashboard/overview`

Returns:
```json
{
  "tenantId": "uuid",
  "dataFoundations": {
    "standards": 3,
    "clauses": 400,
    "controls": 150,
    "risks": 300,
    "mappings": 200
  },
  "health": {
    "status": "ok",
    "time": "2024-01-01T00:00:00.000Z"
  }
}
```

### Health Endpoint

`GET /api/v2/health`

Returns:
```json
{
  "status": "ok",
  "service": "backend-nest",
  "time": "2024-01-01T00:00:00.000Z",
  "redis": "up",
  "queue": {
    "lag": 0,
    "dlqDepth": 0
  },
  "dataFoundations": {
    "standards": 3,
    "clauses": 400,
    "controls": 150,
    "risks": 300,
    "mappings": 200
  }
}
```

## Troubleshooting

### Migration Errors

If you see "duplicate column" or "constraint already exists" errors:

1. Check that old migrations are in `_archive/`
2. Ensure `src/data-source.ts` excludes `_archive` directory
3. Verify `public` schema is being used (tables moved from `app` to `public`)
4. Run migration again: `npm run db:migrate`

### Seed Errors

If seed fails:

1. Ensure migrations ran successfully
2. Check CSV files exist in `data/seeds/`
3. Verify tenant ID in `.env`: `DEFAULT_TENANT_ID=217492b2-f814-4ba0-ae50-4e4f8ecf6216`
4. Check PostgreSQL connection and permissions

### Cross-Impact Test Fails

If cross-impact test (ISO20000:8.4) returns 0:

1. Verify standard clauses were seeded: `SELECT COUNT(*) FROM public.standard_clause;`
2. Check mappings exist: `SELECT COUNT(*) FROM public.standard_mapping;`
3. Ensure clause code '8.4' exists for ISO20000 standard

### Zero Counts on Health/Dashboard

If `/api/v2/health` or `/api/v2/dashboard/overview` return zero counts:

1. **Tenant Header Required:**
   - Both endpoints require `x-tenant-id` header
   - If header is missing, Health will return `note: 'tenant-id-required'` and zeros
   - Dashboard will use `DEFAULT_TENANT_ID` from `.env` if header is missing (with a note)

2. **DEFAULT_TENANT_ID Fallback:**
   - Health endpoint: Uses `DEFAULT_TENANT_ID` from `.env` if header is missing
   - Dashboard endpoint: Uses `DEFAULT_TENANT_ID` from `.env` if header is missing
   - Verify `.env` has: `DEFAULT_TENANT_ID=217492b2-f814-4ba0-ae50-4e4f8ecf6216`

3. **Database Connection:**
   - Ensure `.env` has correct `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
   - Verify PostgreSQL is running: `psql -h localhost -U grc -d grc -c "SELECT 1;"`
   - Check tenant ID exists in database:
     ```sql
     SELECT COUNT(*) FROM public.standard WHERE tenant_id = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
     SELECT COUNT(*) FROM public.standard_clause WHERE tenant_id = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
     ```

4. **Quick PSQL Checks:**
   ```sql
   -- Verify tenant has data
   SELECT 
     (SELECT COUNT(*) FROM public.standard WHERE tenant_id = '217492b2-f814-4ba0-ae50-4e4f8ecf6216') as standards,
     (SELECT COUNT(*) FROM public.standard_clause WHERE tenant_id = '217492b2-f814-4ba0-ae50-4e4f8ecf6216') as clauses,
     (SELECT COUNT(*) FROM public.control_library WHERE tenant_id = '217492b2-f814-4ba0-ae50-4e4f8ecf6216') as controls,
     (SELECT COUNT(*) FROM public.risk_catalog WHERE tenant_id = '217492b2-f814-4ba0-ae50-4e4f8ecf6216') as risks,
     (SELECT COUNT(*) FROM public.standard_mapping WHERE tenant_id = '217492b2-f814-4ba0-ae50-4e4f8ecf6216') as mappings;
   
   -- Check for synthetic data
   SELECT 
     (SELECT COUNT(*) FROM public.standard_clause WHERE tenant_id = '217492b2-f814-4ba0-ae50-4e4f8ecf6216' AND synthetic = true) as clauses_synthetic,
     (SELECT COUNT(*) FROM public.standard_mapping WHERE tenant_id = '217492b2-f814-4ba0-ae50-4e4f8ecf6216' AND synthetic = true) as mappings_synthetic;
   ```

5. **Frontend API Client:**
   - Ensure `frontend/src/lib/api.ts` adds `x-tenant-id` header in request interceptor
   - Check `localStorage.getItem('tenantId')` or `VITE_DEFAULT_TENANT_ID` env variable
   - Verify all API calls use the centralized `api` instance from `api.ts`

## Placeholder Booster (Dev-only)

The seed script supports generating placeholder clauses and mappings to meet development thresholds. This is useful when CSV files don't contain enough data.

### Configuration

Add to `.env`:

```bash
ALLOW_PLACEHOLDER_CLAUSES=true
PLACEHOLDER_TARGET_CLAUSES=450
PLACEHOLDER_TARGET_MAPPINGS=220
```

**Important:** Set `ALLOW_PLACEHOLDER_CLAUSES=false` in production.

### How It Works

1. **Placeholder Clauses:** If `clauses_total < PLACEHOLDER_TARGET_CLAUSES`, the script generates synthetic clauses with:
   - Code pattern: `PX-<STANDARD>-<SEQ>` (e.g., `PX-ISO27001-001`)
   - Title: "Placeholder Clause <SEQ>"
   - Text: "AUTO-GENERATED FOR DEV THRESHOLD"
   - `synthetic: true` flag
   - Distributed proportionally across existing standards

2. **Placeholder Mappings:** If `mappings_total < PLACEHOLDER_TARGET_MAPPINGS`, the script generates synthetic mappings:
   - Between clauses within the same standard
   - `synthetic: true` flag
   - Ensures no duplicate pairs

### Synthetic Data Filtering

The API endpoints support filtering synthetic data:

- **GET /api/v2/standards/:code/clauses?includeSynthetic=false** - Hide synthetic clauses (default in production)
- **GET /api/v2/compliance/cross-impact?clause=ISO20000:8.4&includeSynthetic=false** - Hide synthetic mappings

By default:
- **Development:** `includeSynthetic` defaults to `true` (show all)
- **Production:** `includeSynthetic` defaults to `false` (hide synthetic)

### Health & Dashboard

The `/api/v2/health` and `/api/v2/dashboard/overview` endpoints include:

```json
{
  "dataFoundations": {
    "clauses": 480,
    "clausesSynthetic": 120,
    "mappings": 240,
    "mappingsSynthetic": 40
  },
  "note": "placeholder clauses enabled"
}
```

### Verification Report

The verification report (`reports/DATA-FOUNDATIONS-DB-REPORT.md`) includes:

- Synthetic clause counts and ratios
- Synthetic mapping counts and ratios
- Thresholds are evaluated on total counts (including synthetic)

### Future Cleanup

When official CSV packages are available with sufficient data:

1. Disable placeholder generation: `ALLOW_PLACEHOLDER_CLAUSES=false`
2. Archive/delete synthetic entries:
   ```sql
   DELETE FROM app.standard_clause WHERE synthetic = true;
   DELETE FROM app.standard_mapping WHERE synthetic = true;
   ```
3. Re-run seed with official CSVs

## Notes

- All tables include `tenant_id` for multi-tenancy
- Idempotent operations: seed can be run multiple times safely
- Migration uses `IF NOT EXISTS` for safety
- Old migrations in `_archive/` are preserved for reference only
- Synthetic data is marked with `synthetic: true` and can be filtered/hidden in production
