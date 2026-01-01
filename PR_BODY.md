## Summary

- TYPEORM_MIGRATIONS_MODE support with production/staging default "dist"
- DB_SYNC kill switch in production/staging (fail-fast exit 1)
- New deterministic migration scripts (migration:status/run + prod variants)
- Docs update: QUALITY-GATE-CHECKLIST migration validation section

## Acceptance Criteria

- In backend container: `npm run migration:status:prod` prints pending count (0 pending explicitly) and never silent
- `npm run migration:run:prod` is idempotent
- With `DB_SYNC=true` on staging/prod, backend refuses to start with clear message
- Startup logs include: "[TypeORM] Migration mode: dist" and `synchronize=false`

## How to Validate on Staging

### 1. Check Migration Status

```bash
# SSH into staging backend container
docker exec -it <backend-container> bash

# Check migration status (should print pending count, never silent)
npm run migration:status:prod
```

Expected output:
- If no pending migrations: `✓ Migration Status: 0 pending migrations`
- If pending migrations: `⚠ Migration Status: N pending migration(s)` with list

### 2. Run Migrations (Idempotent)

```bash
# Run migrations (should be idempotent - safe to run multiple times)
npm run migration:run:prod
```

Expected output:
- If no pending: `✓ No pending migrations. Database is up to date.`
- If pending: List of executed migrations

### 3. Verify DB_SYNC Kill Switch

```bash
# Set DB_SYNC=true in staging environment
export DB_SYNC=true
export NODE_ENV=staging

# Try to start backend (should fail with clear error)
npm run start:prod
```

Expected behavior:
- Backend exits with code 1
- Error message: "FATAL: DB_SYNC=true is BANNED in production/staging!"
- Clear instructions on how to fix

### 4. Verify Startup Logs

```bash
# Start backend normally (DB_SYNC not set or false)
npm run start:prod

# Check logs for:
# - "[TypeORM] Migration mode: dist"
# - TypeORM connection shows synchronize=false
```

Expected in logs:
- `[TypeORM] Migration mode: dist` (or similar migration mode log)
- TypeORM connection configuration shows `synchronize: false`

