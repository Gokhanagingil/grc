# Audit Phase 2 Database Migrations

This document describes the database migrations for Audit Phase 2 (Standards Library + Audit Scope).

## Overview

The migration `1735000000000-CreateAuditPhase2Tables` creates 5 new tables:

1. **standards** - Compliance standards (e.g., ISO/IEC 27001:2022)
2. **standard_clauses** - Hierarchical clauses within standards
3. **audit_scope_standards** - Mapping audits to standards
4. **audit_scope_clauses** - Mapping audits to specific clauses
5. **grc_issue_clauses** - Mapping findings/issues to clauses

## Running Migrations Locally

### Prerequisites

- PostgreSQL database running
- Environment variables configured (see `.env.example`)
- Node.js and npm installed

### Steps

1. **Navigate to backend directory:**
   ```bash
   cd backend-nest
   ```

2. **Install dependencies (if not already done):**
   ```bash
   npm install
   ```

3. **Run migrations:**
   ```bash
   npm run migration:run
   ```

   This will execute all pending migrations, including the Audit Phase 2 migration.

4. **Verify migration:**
   ```bash
   # Check migration status
   npm run migration:show
   ```

   Or connect to PostgreSQL and verify tables exist:
   ```sql
   \dt standards
   \dt standard_clauses
   \dt audit_scope_standards
   \dt audit_scope_clauses
   \dt grc_issue_clauses
   ```

### Reverting Migrations

If you need to revert the migration:

```bash
npm run migration:revert
```

**Warning:** This will drop all 5 tables and their data. Use with caution.

## Running Migrations in Staging Docker

### Prerequisites

- Docker and docker-compose installed
- Access to staging environment

### Steps

1. **SSH into staging server** (or use your deployment method)

2. **Navigate to project directory:**
   ```bash
   cd /path/to/grc-platform
   ```

3. **Run migrations inside the backend container:**
   ```bash
   docker-compose exec backend-nest npm run migration:run
   ```

   Or if using a different container name:
   ```bash
   docker exec -it <container-name> npm run migration:run
   ```

4. **Verify migration:**
   ```bash
   docker-compose exec backend-nest npm run migration:show
   ```

   Or connect to the database container:
   ```bash
   docker-compose exec postgres psql -U postgres -d grc_platform
   ```

   Then in psql:
   ```sql
   \dt standards
   \dt standard_clauses
   \dt audit_scope_standards
   \dt audit_scope_clauses
   \dt grc_issue_clauses
   ```

## Migration Details

### Table: standards

- **Primary Key:** `id` (UUID)
- **Unique Constraints:**
  - `(tenant_id, code)` - unique per tenant
  - `(tenant_id, code, version)` - unique per tenant and version
- **Indexes:**
  - `tenant_id`
  - `code`
  - `(tenant_id, domain)`
  - Standard audit indexes (created_at, updated_at, is_deleted)

### Table: standard_clauses

- **Primary Key:** `id` (UUID)
- **Foreign Keys:**
  - `standard_id` → `standards.id` (CASCADE)
  - `parent_id` → `standard_clauses.id` (SET NULL) - for hierarchy
- **Unique Constraints:**
  - `(tenant_id, standard_id, code)` - unique per standard
- **Indexes:**
  - `tenant_id`
  - `standard_id`
  - `(tenant_id, parent_id)` - for hierarchy queries
  - `(tenant_id, code)` - for clause lookups
  - Standard audit indexes

### Table: audit_scope_standards

- **Primary Key:** `id` (UUID)
- **Foreign Keys:**
  - `audit_id` → `grc_audits.id` (CASCADE)
  - `standard_id` → `standards.id` (CASCADE)
- **Unique Constraints:**
  - `(tenant_id, audit_id, standard_id)` - one mapping per audit-standard pair
- **Indexes:**
  - `tenant_id`
  - `audit_id`
  - `(tenant_id, standard_id)` - for reverse lookups

### Table: audit_scope_clauses

- **Primary Key:** `id` (UUID)
- **Foreign Keys:**
  - `audit_id` → `grc_audits.id` (CASCADE)
  - `clause_id` → `standard_clauses.id` (CASCADE)
- **Unique Constraints:**
  - `(tenant_id, audit_id, clause_id)` - one mapping per audit-clause pair
- **Indexes:**
  - `tenant_id`
  - `audit_id`
  - `(tenant_id, clause_id)` - for reverse lookups

### Table: grc_issue_clauses

- **Primary Key:** `id` (UUID)
- **Foreign Keys:**
  - `issue_id` → `grc_issues.id` (CASCADE)
  - `clause_id` → `standard_clauses.id` (CASCADE)
- **Unique Constraints:**
  - `(tenant_id, issue_id, clause_id)` - one mapping per issue-clause pair
- **Indexes:**
  - `tenant_id`
  - `issue_id`
  - `(tenant_id, clause_id)` - for reverse lookups

## Multi-Tenant Strategy

All tables follow the existing multi-tenant pattern:

- Every table has a `tenant_id` column (UUID, NOT NULL)
- Foreign key to `tenants` table with `ON DELETE CASCADE`
- All queries must filter by `tenant_id` for data isolation
- Unique constraints include `tenant_id` to allow same codes across tenants

## Production Safety

**Important:** The application is configured with `synchronize: false` by default:

- `data-source.ts` has `synchronize: false` (hardcoded)
- `app.module.ts` uses `db.synchronize` from config (defaults to `false`)
- `configuration.ts` only enables sync if `DB_SYNC=true` is explicitly set
- Production environments should **never** set `DB_SYNC=true`

Always use migrations in production, never rely on `synchronize: true`.

## Troubleshooting

### Migration fails with "relation already exists"

This means the tables already exist. Options:

1. **Skip migration** (if tables are correct):
   ```bash
   # Mark migration as executed without running it
   npm run migration:run -- --fake
   ```

2. **Drop and recreate** (⚠️ **WILL DELETE DATA**):
   ```bash
   # Revert migration first
   npm run migration:revert
   # Then run again
   npm run migration:run
   ```

### Foreign key constraint errors

Ensure referenced tables exist:
- `tenants` table must exist
- `grc_audits` table must exist (for audit_scope_* tables)
- `grc_issues` table must exist (for grc_issue_clauses)

### Permission errors

Ensure the database user has:
- `CREATE TABLE` permission
- `CREATE INDEX` permission
- `ALTER TABLE` permission (for foreign keys)

## Related Documentation

- [TypeORM Migrations Guide](https://typeorm.io/migrations)
- Multi-Tenant Architecture — `docs/MULTI-TENANT.md` (planned)
- Database Schema — `docs/DATABASE-SCHEMA.md` (planned)
