# Staging Release Checklist

> **Security Notice:** Never commit secrets, credentials, or API keys to this repository. All sensitive values must be stored in the team password manager or environment variables. If you discover exposed credentials, report them immediately to the Release Captain.

This document provides a complete validation checklist for staging deployments. Use it alongside `scripts/deploy-staging.sh` to ensure safe, repeatable deployments.

## Quick Reference

**Deploy Command:**
```bash
cd /opt/grc-platform && ./scripts/deploy-staging.sh
```

**Expected Result:** `DEPLOY SUCCESS` with all steps passing.

---

## What the Script Checks Automatically

The `deploy-staging.sh` script performs these validations in order:

| Step | Validation | Pass Criteria |
|------|------------|---------------|
| 1 | Git Repository State | On `main` branch, inside git repo |
| 2 | Pull Latest Changes | Successfully fetched and merged from origin |
| 3 | Docker Build & Restart | Backend and frontend containers rebuilt and started |
| 4 | Health Check | Backend responds to `/health/ready` within 120s |
| 5 | Database Migrations | All migrations applied successfully |
| 6 | Platform Validation | `npm run platform:validate` passes (env, db, migrations, auth) |
| 7 | Smoke Tests | Health endpoints and API endpoints responding |

### Platform Validation Details (Step 6)

The FAZ4 self-control kit validates:

- **Environment Variables**: All required env vars are set (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET)
- **Database Connectivity**: Connection test, query execution, table count
- **Migration Status**: No pending migrations, migrations table exists
- **Auth & Onboarding**: Login works, onboarding context returns valid data

---

## Manual UI Validation (Required)

After the script completes successfully, verify these items manually in the browser.

### Access Staging

**URL:** Refer to the team password manager or ask the Release Captain for the current staging URL.

**Credentials:** Stored in the team password manager / vault. Ask the Release Captain if you don't have access.

### Checklist

Copy this checklist and mark items as you verify:

```
[ ] 1. LOGIN
    - Open staging URL (from password manager)
    - Enter credentials (from password manager)
    - Login succeeds, redirected to dashboard
    - No console errors (F12 > Console)

[ ] 2. DASHBOARD
    - Dashboard loads without errors
    - KPI cards display (may show zeros if no data)
    - Navigation menu is visible

[ ] 3. ADMIN > SYSTEM
    - Navigate to Admin > System
    - Backend health shows "Healthy" or green status
    - Database health shows "Connected"
    - API response times are reasonable (<500ms)

[ ] 4. ADMIN > DATA MODEL (Graph)
    - Navigate to Admin > Data Model
    - Graph visualization loads
    - Entity relationships are visible
    - No JavaScript errors

[ ] 5. MFA VISIBILITY (if enabled)
    - Check if MFA settings are visible in user profile
    - If MFA is not enabled for tenant, this may not appear

[ ] 6. GRC MODULE (Quick Check)
    - Navigate to Risks
    - List loads (may be empty)
    - Create button is visible
    - Navigate to Policies
    - List loads (may be empty)

[ ] 7. NETWORK TAB VERIFICATION
    - Open DevTools (F12) > Network tab
    - Verify API calls go to same origin (no port in URL)
    - Verify responses are JSON (not HTML)
    - No 500 errors
```

---

## GO / NO-GO Decision

### GO (Proceed with Release)

All of the following must be true:

1. `deploy-staging.sh` exits with `DEPLOY SUCCESS`
2. Login works with staging credentials
3. Dashboard loads without errors
4. Admin > System shows healthy backend and database
5. No 500 errors in browser Network tab
6. API responses are JSON (not HTML fallback)

### NO-GO (Do Not Proceed)

If any of these occur:

1. `deploy-staging.sh` exits with `DEPLOY FAILED`
2. Login fails or returns HTML instead of JSON
3. Dashboard shows blank page or JavaScript errors
4. Admin > System shows unhealthy services
5. Multiple 500 errors in API calls
6. API responses return HTML (index.html) instead of JSON

---

## Rollback Procedure

If deployment fails or NO-GO criteria are met:

### Option 1: Revert to Previous Commit

```bash
cd /opt/grc-platform

# Find the previous working commit
git log --oneline -10

# Revert to specific commit (replace COMMIT_HASH)
git checkout COMMIT_HASH

# Rebuild containers
docker compose -f docker-compose.staging.yml up -d --build

# Wait for health
sleep 30

# Verify health
curl http://localhost:3002/health/ready
```

### Option 2: Restart Without Rebuild

If the issue is transient (container crash, memory):

```bash
cd /opt/grc-platform
./scripts/restart-staging.sh
```

### Option 3: Database Rollback (Last Resort)

Only if migrations caused data issues:

```bash
cd /opt/grc-platform

# Revert last migration
docker compose -f docker-compose.staging.yml exec -T backend \
  npx typeorm migration:revert -d dist/data-source.js

# Restart backend
docker compose -f docker-compose.staging.yml restart backend
```

---

## Troubleshooting

### Script Fails at Step 1 (Git Verification)

**Symptom:** "Not on main branch" or "Not inside git repository"

**Fix:**
```bash
cd /opt/grc-platform
git checkout main
git pull origin main
```

### Script Fails at Step 3 (Docker Build)

**Symptom:** Docker build errors

**Check:**
```bash
# View build logs
docker compose -f docker-compose.staging.yml logs --tail=50 backend

# Check disk space
df -h

# Check Docker status
docker ps -a
```

### Script Fails at Step 4 (Health Check)

**Symptom:** Health check timeout after 120s

**Check:**
```bash
# View backend logs
docker compose -f docker-compose.staging.yml logs --tail=100 backend

# Check if container is running
docker compose -f docker-compose.staging.yml ps

# Test health endpoint directly
curl -v http://localhost:3002/health/ready
```

### Script Fails at Step 5 (Migrations)

**Symptom:** Migration errors

**Check:**
```bash
# View migration status
docker compose -f docker-compose.staging.yml exec -T backend \
  npx typeorm migration:show -d dist/data-source.js

# Check for duplicate migrations (index.js should NOT exist)
docker compose -f docker-compose.staging.yml exec -T backend \
  ls -la dist/migrations/
```

### Script Fails at Step 6 (Platform Validation)

**Symptom:** Platform validation failed

**Check:**
```bash
# Run validation with verbose output
docker compose -f docker-compose.staging.yml exec -T backend \
  npm run platform:validate

# Check individual validations
docker compose -f docker-compose.staging.yml exec -T backend \
  npm run validate:env

docker compose -f docker-compose.staging.yml exec -T backend \
  npm run validate:db

docker compose -f docker-compose.staging.yml exec -T backend \
  npm run validate:migrations
```

### API Returns HTML Instead of JSON

**Symptom:** Browser shows HTML content for API calls

**Fix:** This indicates nginx reverse proxy is not routing correctly.

```bash
# Check nginx config
docker compose -f docker-compose.staging.yml exec frontend \
  cat /etc/nginx/conf.d/default.conf

# Rebuild frontend (includes nginx config)
docker compose -f docker-compose.staging.yml up -d --build frontend
```

---

## Integration with FAZ4 Self-Control Philosophy

This release pack aligns with FAZ4 principles:

1. **Evidence-based assurance**: The script produces clear PASS/FAIL output, not memory-based confidence
2. **Single source of truth**: One script (`deploy-staging.sh`) for all deployments
3. **Fail-fast**: Script stops immediately on any failure with clear exit codes
4. **Idempotent**: Safe to run multiple times without side effects
5. **Reuses existing infrastructure**: Leverages `platform:validate` and existing validation scripts

### Related Documentation

- `docs/OPERABILITY_SELF_CONTROL.md` - Daily control procedures
- `docs/STAGING_OPERATIONS_RUNBOOK.md` - Detailed staging operations
- `STAGING_DEPLOYMENT_RUNBOOK.md` - Legacy deployment commands (superseded by this script)
- `FAZ4_EXIT_REPORT.md` - FAZ4 implementation details

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024-12-24 | 1.0 | Initial release pack (deploy-staging.sh + this checklist) |
