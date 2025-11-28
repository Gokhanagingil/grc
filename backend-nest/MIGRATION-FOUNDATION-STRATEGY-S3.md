# Migration Foundation Strategy - Sprint 3

## Overview

This document describes the migration-first strategy for the GRC Platform backend, implemented in Sprint 3.

## Database Strategy Modes

### `legacy-sync` (Default)

**Purpose**: Maintains current development behavior for backward compatibility.

**Behavior**:
- **SQLite Dev**: `synchronize: true` (auto-creates/updates tables from entities)
- **SQLite Prod**: `synchronize: false` (migrations required)
- **Postgres**: Always `synchronize: false` (migrations required)
- **migrationsRun**: `false` (manual migration execution)

**Use Case**: 
- Current development workflow
- Quick prototyping
- When you want TypeORM to auto-sync schema changes

**Configuration**:
```bash
# Default (no env var needed)
npm run start:dev

# Or explicitly:
DB_STRATEGY=legacy-sync npm run start:dev
```

### `migration-dev`

**Purpose**: Enables migration-first approach in development environment.

**Behavior**:
- **SQLite Dev**: `synchronize: false` (migrations required)
- **SQLite Prod**: `synchronize: false` (migrations required)
- **Postgres**: Always `synchronize: false` (migrations required)
- **migrationsRun**: `false` (manual migration execution via scripts)

**Use Case**:
- Testing migration-first workflow
- Preparing for production-like database management
- Ensuring deterministic database setup

**Configuration**:
```bash
DB_STRATEGY=migration-dev npm run start:dev
```

**Important**: When using `migration-dev`, you must:
1. Run migrations manually: `npm run migration:run`
2. Or use the reset script: `npm run db:reset:dev`

### `migration-prod`

**Purpose**: Production-ready migration-first approach.

**Behavior**:
- **All environments**: `synchronize: false` (migrations required)
- **migrationsRun**: `false` (manual migration execution)

**Use Case**: Production deployments

**Configuration**:
```bash
DB_STRATEGY=migration-prod npm run start:prod
```

## Database Engine Selection

The `DB_ENGINE` environment variable controls which database engine to use:

- `DB_ENGINE=sqlite` (default): Uses SQLite database
- `DB_ENGINE=postgres`: Uses PostgreSQL database

**Note**: `SAFE_MODE=true` forces SQLite regardless of `DB_ENGINE`.

## Migration Strategy

### Baseline Migration

The baseline migration (`20250126000000-baseline-grc-schema.ts`) represents the current state of the GRC platform schema as of Sprint 2. It:

- Works with both SQLite and PostgreSQL
- Creates core tables (tenants, users, roles, policies, etc.)
- Handles database-specific differences (schemas, data types, etc.)

### Running Migrations

```bash
# Run all pending migrations
npm run migration:run

# Show migration status
npm run migration:show

# Revert last migration
npm run migration:revert
```

## Dev DB Reset Pipeline

The `db:reset:dev` script provides a complete reset of the development database:

1. **Backup**: Creates timestamped backup of existing dev DB
2. **Delete**: Removes old dev DB file
3. **Migrate**: Runs all migrations to create fresh schema
4. **Seed**: Runs seed scripts to populate initial data

**Usage**:
```bash
npm run db:reset:dev
```

**Important**: This script:
- Only works in development (`NODE_ENV !== 'production'`)
- Only works with SQLite (dev environment)
- Never runs automatically (manual execution only)

## Environment Recommendations

### Development

**Recommended**: Start with `legacy-sync` for rapid development, then switch to `migration-dev` when:
- You want to test migration-first workflow
- You're preparing for production deployment
- You need deterministic database setup

### Staging/Production

**Required**: Always use `migration-prod` or `migration-dev` (never `legacy-sync`)

## Migration Compatibility

All migrations are designed to work with both SQLite and PostgreSQL:

- **SQLite**: Schema prefixes ignored, TEXT for JSON, no UUID defaults
- **PostgreSQL**: Schema prefixes used, JSONB for JSON, UUID defaults with extensions

## Future Work

- [ ] Automatic migration generation from entity changes
- [ ] Migration rollback testing
- [ ] Multi-environment migration strategy
- [ ] Migration validation in CI/CD

