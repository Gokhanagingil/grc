# TypeORM Migrations - Staging Runbook

## Overview

This document provides step-by-step instructions for running TypeORM migrations in the staging environment. The migration system uses **glob patterns** to load migrations directly from files.

## Architecture

### Migration Loading Strategy

- **Dev Environment**: Loads from `src/migrations/*.ts` (glob pattern)
- **Dist/Staging Environment**: Loads from `dist/migrations/*.js` (glob pattern)
- **No Index File**: We do NOT use `migrations/index.ts` or `migrations/index.js` to avoid duplicate migrations
- **Direct File Loading**: TypeORM loads migration classes directly from individual files

### Why This Approach?

1. **Simple**: Direct file loading, no intermediate barrel exports
2. **No Duplicates**: Each migration file is loaded exactly once
3. **No Index Confusion**: No index file means no risk of duplicates
4. **TypeORM Native**: Uses TypeORM's standard glob pattern approach

### Important: No Index File

- **DO NOT** create `src/migrations/index.ts`
- **DO NOT** create `dist/migrations/index.js`
- If an index file exists, it will cause duplicate migration errors

## Pre-Deployment Checklist

Before running migrations in staging, verify:

- [ ] Code is pulled from repository (`git pull`)
- [ ] Backend container is built with latest code (`docker compose -f docker-compose.staging.yml build backend`)
- [ ] Database backup is taken (if required by your policy)
- [ ] Staging environment variables are correctly set
- [ ] `dist/migrations/index.js` does NOT exist (verify after build)

## Staging Deployment Steps

### Step 1: Pull Latest Code

```bash
# On staging server
cd /path/to/grc-platform
git pull origin <branch-name>
```

### Step 2: Rebuild Backend Container

```bash
# Rebuild backend with latest code
docker compose -f docker-compose.staging.yml build backend

# Restart backend container (if already running)
docker compose -f docker-compose.staging.yml up -d --force-recreate backend
```

### Step 3: Verify Build Output

Check that migration files exist and `dist/migrations/index.js` does NOT exist:

```bash
# Inside backend container - list migration files
docker compose -f docker-compose.staging.yml exec backend sh -c "ls -la /app/dist/migrations/"

# Verify index.js does NOT exist (should show "File missing")
docker compose -f docker-compose.staging.yml exec backend sh -c "test -f /app/dist/migrations/index.js && echo 'ERROR: index.js exists!' || echo 'OK: index.js does not exist'"
```

Expected output:
```
OK: index.js does not exist
```

### Step 4: Check Migration Status

```bash
# Show pending migrations (does not modify database)
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:show -d dist/data-source.js"
```

Expected output shows:
- `[X]` for executed migrations
- `[ ]` for pending migrations

**Note**: `dist/data-source.js` exports `AppDataSource` (CommonJS), which TypeORM CLI uses directly.

### Step 5: Run Migrations

```bash
# Run pending migrations
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:run -d dist/data-source.js"
```

Expected output:
```
query: SELECT * FROM "migrations" ORDER BY "id" DESC
query: START TRANSACTION
query: CREATE TABLE ...
...
Migration CreateOnboardingTables1734112800000 has been executed successfully.
query: COMMIT
```

### Step 6: Verify Migration Execution

```bash
# Check migration status again (should show all as executed)
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:show -d dist/data-source.js"
```

### Step 7: Run Seed Scripts (if applicable)

```bash
# Seed standards data (if needed)
docker compose -f docker-compose.staging.yml exec backend sh -c "npm run seed:standards:prod"
```

## Complete Staging Deployment Command Chain

For convenience, here's the complete chain of commands:

```bash
# 1. Pull code
git pull origin <branch-name>

# 2. Rebuild and restart backend
docker compose -f docker-compose.staging.yml up -d --build --force-recreate backend

# 3. Wait for container to be healthy (optional, but recommended)
sleep 10

# 4. Verify no index.js exists
docker compose -f docker-compose.staging.yml exec backend sh -c "test -f /app/dist/migrations/index.js && echo 'ERROR: index.js exists!' || echo 'OK: index.js does not exist'"

# 5. Check migration status
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:show -d dist/data-source.js"

# 6. Run migrations
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:run -d dist/data-source.js"

# 7. Verify migrations
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:show -d dist/data-source.js"

# 8. Seed data (if needed)
docker compose -f docker-compose.staging.yml exec backend sh -c "npm run seed:standards:prod"
```

## Troubleshooting

### Issue: "Duplicate migrations" error

**Symptoms**: TypeORM reports duplicate migration classes (e.g., "Duplicate migrations: CreateAuditPhase2Tables..., CreateOnboardingTables...")

**Root Cause**: `dist/migrations/index.js` exists and glob pattern `dist/migrations/*.js` matches both:
- Individual migration files (e.g., `1734112800000-CreateOnboardingTables.js`)
- The index file that re-exports them (`index.js`)

This causes each migration to be loaded twice.

**Solution**:
```bash
# 1. Verify index.js exists (it shouldn't)
docker compose -f docker-compose.staging.yml exec backend sh -c "test -f /app/dist/migrations/index.js && echo 'ERROR: index.js exists!' || echo 'OK'"

# 2. If index.js exists, check source - ensure src/migrations/index.ts is deleted
# 3. Rebuild backend
docker compose -f docker-compose.staging.yml build backend
docker compose -f docker-compose.staging.yml up -d --force-recreate backend

# 4. Verify index.js is gone
docker compose -f docker-compose.staging.yml exec backend sh -c "test -f /app/dist/migrations/index.js && echo 'ERROR: index.js still exists!' || echo 'OK: index.js removed'"

# 5. Try migration:show again
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:show -d dist/data-source.js"
```

### Issue: "No migrations found"

**Symptoms**: Migration show/run reports no migrations found

**Possible Causes**:
1. Migration files don't exist in `dist/migrations/`
2. Build failed
3. Glob pattern incorrect

**Solution**:
```bash
# Check if migration files exist
docker compose -f docker-compose.staging.yml exec backend sh -c "ls -la /app/dist/migrations/*.js"

# Check data-source.js location
docker compose -f docker-compose.staging.yml exec backend sh -c "ls -la /app/dist/data-source.js"

# Rebuild if needed
docker compose -f docker-compose.staging.yml build backend
docker compose -f docker-compose.staging.yml up -d --force-recreate backend
```

### Issue: "Migration already executed"

**Symptoms**: Migration shows as executed but you expect it to be pending

**Solution**: This is normal if the migration was already run. Check the database:

```bash
# Connect to database and check migrations table
docker compose -f docker-compose.staging.yml exec db psql -U postgres -d grc_platform -c "SELECT * FROM migrations ORDER BY timestamp DESC;"
```

### Issue: "Cannot find module" or DataSource load error

**Symptoms**: Data source fails to load with module not found error

**Possible Causes**:
1. `dist/data-source.js` doesn't exist
2. Path resolution issue in dist environment

**Solution**:
```bash
# Verify file exists
docker compose -f docker-compose.staging.yml exec backend sh -c "test -f /app/dist/data-source.js && echo 'File exists' || echo 'File missing'"

# Check data-source.js exports
docker compose -f docker-compose.staging.yml exec backend sh -c "node -e \"const ds=require('./dist/data-source.js'); console.log('exports:', Object.keys(ds)); console.log('AppDataSource:', !!ds.AppDataSource);\""

# Rebuild if file is missing
docker compose -f docker-compose.staging.yml build backend
```

## Rollback (Emergency)

If a migration causes issues and you need to rollback:

```bash
# Revert last migration
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:revert -d dist/data-source.js"
```

**Warning**: Only revert if the migration is reversible. Check migration `down()` method before reverting.

## Adding New Migrations

When adding a new migration:

1. **Generate migration**:
   ```bash
   npm run migration:generate src/migrations/YourMigrationName
   ```

2. **Verify migration file created**:
   ```bash
   ls -la src/migrations/
   ```

3. **Test locally**:
   ```bash
   npm run migration:show
   npm run migration:run
   ```

4. **Commit and deploy** following the staging runbook above.

**Note**: No need to update any index file - migrations are loaded automatically via glob pattern.

## Validation Scripts

### Quick Validation (Local)

```bash
# Build
cd backend-nest
npm ci
npm run build

# Verify dist/migrations/index.js does NOT exist
test -f dist/migrations/index.js && echo "ERROR: index.js exists!" || echo "OK: index.js does not exist"

# Test data source load
node -e "const ds=require('./dist/data-source.js'); console.log('Data source loaded:', !!ds.AppDataSource);"

# Check migration files
ls -la dist/migrations/*.js
```

### Full Validation (Staging)

```bash
# Inside backend container
docker compose -f docker-compose.staging.yml exec backend sh -c "
  echo '=== Migration Validation ===' && \
  echo '1. Checking for index.js (should NOT exist)...' && \
  test -f /app/dist/migrations/index.js && echo 'ERROR: index.js exists!' || echo 'OK: index.js does not exist' && \
  echo '2. Checking migration files...' && \
  ls -la /app/dist/migrations/*.js && \
  echo '3. Checking data-source.js...' && \
  node -e \"const ds=require('./dist/data-source.js'); console.log('Data source loaded:', !!ds.AppDataSource);\" && \
  echo '4. Running migration:show...' && \
  npx typeorm migration:show -d dist/data-source.js && \
  echo '=== Validation Complete ==='
"
```

## Platform Builder Validation

After running migrations, verify that the Platform Builder feature is working correctly:

### Step 1: Check Platform Builder Tables Exist

```bash
# Verify Platform Builder tables exist in database
docker compose -f docker-compose.staging.yml exec backend sh -c "
  node -e \"
    const { AppDataSource } = require('./dist/data-source.js');
    AppDataSource.initialize().then(async (ds) => {
      const result = await ds.manager.query(\\\`
        SELECT
          to_regclass('public.sys_db_object') IS NOT NULL as sys_db_object,
          to_regclass('public.sys_dictionary') IS NOT NULL as sys_dictionary,
          to_regclass('public.dynamic_records') IS NOT NULL as dynamic_records
      \\\`);
      console.log('Platform Builder Tables:');
      console.log('  sys_db_object:', result[0].sys_db_object ? 'EXISTS' : 'MISSING');
      console.log('  sys_dictionary:', result[0].sys_dictionary ? 'EXISTS' : 'MISSING');
      console.log('  dynamic_records:', result[0].dynamic_records ? 'EXISTS' : 'MISSING');
      if (!result[0].sys_db_object || !result[0].sys_dictionary || !result[0].dynamic_records) {
        console.log('ERROR: Platform Builder tables missing! Run migrations.');
        process.exit(1);
      }
      console.log('OK: All Platform Builder tables exist');
      await ds.destroy();
    }).catch(e => { console.error(e); process.exit(1); });
  \"
"
```

### Step 2: Test Platform Builder Endpoint

```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@grc-platform.local","password":"YOUR_PASSWORD"}' \
  | jq -r '.accessToken // .data.accessToken')

# Test GET /grc/admin/tables endpoint
curl -s -X GET "http://localhost:3002/grc/admin/tables?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  | jq .

# Expected: {"success":true,"data":{"items":[],"total":0,...}}
# If you get 500 error, migrations haven't been run!
```

### Step 3: Acceptance Criteria

After deployment, verify:

1. Admin login works
2. Navigate to Admin → Platform Builder
3. Tables list loads (empty state OK, NO "Failed to fetch tables" error)
4. Create table `u_demo_assets` (label "Demo Assets") - should succeed
5. Refresh page → table still listed
6. (Bonus) Add 1 field to the new table and see it in fields list

### Troubleshooting: 500 Error on /grc/admin/tables

**Symptoms**: GET /grc/admin/tables returns 500 Internal Server Error

**Root Cause**: Platform Builder migration (1737300000000-CreatePlatformBuilderTables) was not run

**Solution**:
```bash
# 1. Check migration status
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:show -d dist/data-source.js"

# 2. Look for [ ] 1737300000000-CreatePlatformBuilderTables (pending)

# 3. Run migrations
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:run -d dist/data-source.js"

# 4. Verify tables exist (see Step 1 above)

# 5. Test endpoint (see Step 2 above)
```

## Security Notes

- Migrations run with the same database credentials as the application
- Ensure database credentials are properly secured in staging environment
- Consider using read-only database user for `migration:show` if possible
- Never commit database credentials to repository

## References

- [TypeORM Migrations Documentation](https://typeorm.io/migrations)
- [NestJS Deployment Guide](https://docs.nestjs.com/deployment)
- Project: `backend-nest/src/data-source.ts` - Data source configuration
- Project: `backend-nest/docs/MIGRATIONS-STABLE-IMPLEMENTATION.md` - Implementation details
