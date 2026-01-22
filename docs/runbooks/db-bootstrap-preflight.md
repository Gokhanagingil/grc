# DB Bootstrap Preflight - Runbook

This runbook covers the DB Bootstrap Preflight CI workflow that validates migrations and seeds run cleanly before deployment.

## What It Does

The DB Bootstrap Preflight workflow catches schema regressions and "relation does not exist" errors BEFORE they reach staging. It runs automatically on PRs that modify database-related files.

**Validations performed:**
1. Migrations run cleanly on a fresh PostgreSQL database
2. Seeds run cleanly (seed:grc, seed:onboarding)
3. API boots successfully and health endpoints respond
4. Login and authenticated endpoints work
5. No "relation does not exist" errors in any logs

## When It Runs

The workflow triggers on pull requests to `main` that modify:
- `backend-nest/src/migrations/**`
- `backend-nest/src/scripts/seed*.ts`
- `backend-nest/src/data-source.ts`
- `backend-nest/src/config/database-config.ts`
- `backend-nest/src/**/*.entity.ts`

Also runs on pushes to `hardening/**` branches.

## How to Run Locally

You can replicate the preflight checks locally using Docker:

```bash
# 1. Start a fresh PostgreSQL container
docker run -d --name preflight-db \
  -e POSTGRES_USER=preflight_user \
  -e POSTGRES_PASSWORD=preflight_pass \
  -e POSTGRES_DB=preflight_db \
  -p 5432:5432 \
  postgres:15-alpine

# 2. Wait for PostgreSQL to be ready
until pg_isready -h localhost -p 5432 -U preflight_user; do sleep 1; done

# 3. Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=preflight_user
export DB_PASSWORD=preflight_pass
export DB_NAME=preflight_db
export NODE_ENV=staging
export DB_SYNC=false
export JWT_SECRET=local-test-jwt-secret-64chars-minimum-length-for-testing
export REFRESH_TOKEN_SECRET=local-test-refresh-secret-64chars-minimum
export DEMO_ADMIN_EMAIL=admin@preflight.local
export DEMO_ADMIN_PASSWORD=PreflightTest123!

# 4. Build and run migrations
cd backend-nest
npm ci
npm run build
npm run migration:run:prod

# 5. Run seeds
npm run seed:grc
npm run seed:onboarding

# 6. Start API and test
npm run start:prod &
sleep 10
curl http://localhost:3002/health/live
curl http://localhost:3002/health/ready

# 7. Cleanup
docker stop preflight-db && docker rm preflight-db
```

## Common Failure Reasons and Fixes

### 1. "relation does not exist"

**Cause:** A migration references a table that doesn't exist yet, or migrations are running out of order.

**Fix:**
- Check migration timestamps - they must be in chronological order
- Ensure the migration that creates the table runs before migrations that reference it
- Verify entity files match the migration schema

### 2. Migration fails with syntax error

**Cause:** Invalid SQL in migration file.

**Fix:**
- Review the migration SQL in `src/migrations/`
- Test the migration locally against a fresh database
- Check for PostgreSQL version compatibility

### 3. Seed fails - "Demo tenant not found"

**Cause:** `seed:onboarding` requires `seed:grc` to run first (creates the demo tenant).

**Fix:**
- Ensure `seed:grc` runs before `seed:onboarding`
- Check that `seed:grc` completed successfully

### 4. API fails to start

**Cause:** Missing environment variables or database connection issues.

**Fix:**
- Verify all required environment variables are set
- Check database connectivity
- Review API startup logs for specific errors

### 5. Health endpoint returns non-200

**Cause:** Database not fully initialized or migrations pending.

**Fix:**
- Check `/health/ready` response for migration status
- Verify all migrations executed successfully
- Check for pending migrations

## What Remains to Validate During Real Staging Deploy

The preflight workflow validates schema correctness in isolation. The following are validated during actual staging deployment:

1. **Production seed data** - `seed:standards` runs in staging
2. **Docker container builds** - Full Dockerfile build and runtime
3. **Network connectivity** - Real database connections and service discovery
4. **Environment secrets** - Real JWT secrets, database credentials
5. **Data migration** - Existing data compatibility with new schema
6. **Performance** - Real-world query performance with production-like data

## Related Documentation

- `docs/STAGING-DEPLOY-RUNBOOK.md` - Manual deployment steps
- `docs/STAGING-MAINTENANCE-RUNBOOK.md` - Maintenance procedures
- `.github/workflows/backend-nest-ci.yml` - Full backend CI pipeline
- `.github/workflows/deploy-preflight.yml` - Deploy script validation
