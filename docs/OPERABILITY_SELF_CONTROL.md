# Operability & Self-Control Guide

This document provides operational procedures for validating, monitoring, and troubleshooting the GRC Platform. All commands are designed to be run from the `backend-nest/` directory unless otherwise specified.

## Quick Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run platform:validate` | Full platform validation | After deploy, daily checks |
| `npm run validate:env` | Environment variables check | Before starting app |
| `npm run validate:db` | Database connectivity test | Connection issues |
| `npm run validate:migrations` | Migration status check | After deploy |
| `npm run smoke:auth-onboarding` | Auth & onboarding smoke test | After deploy |

## Daily Control Checklist

Run these checks daily to ensure platform health:

```bash
cd backend-nest

# 1. Quick health check (requires running server)
curl -s http://localhost:3002/health/live | jq .

# 2. Full platform validation
npm run platform:validate
```

Expected output for healthy platform:
```
========================================
Platform Validation Report
========================================
[OK] Environment Validation (XXms)
[OK] Database Validation (XXms)
[OK] Migration Validation (XXms)
[OK] Auth & Onboarding Smoke Tests (XXms)

--- Summary ---
Total: 4
Passed: 4
Failed: 0
Skipped: 0

[SUCCESS] Platform validation passed
========================================
```

## Post-Staging Deploy Control

After deploying to staging, run the following validation sequence:

### Step 1: Verify Container Health

```bash
# SSH to staging server
ssh root@46.224.99.150

# Check container status
cd /opt/grc-platform
docker compose ps

# Expected: All containers should be "Up" and "healthy"
```

### Step 2: Run Platform Validation

```bash
# From staging server
cd /opt/grc-platform/backend-nest
npm run platform:validate

# Or run individual checks
npm run validate:env
npm run validate:db
npm run validate:migrations
npm run smoke:auth-onboarding
```

### Step 3: Verify Health Endpoints

```bash
# Liveness check
curl -s http://46.224.99.150:3002/health/live | jq .

# Readiness check (includes DB)
curl -s http://46.224.99.150:3002/health/ready | jq .

# Full health check
curl -s http://46.224.99.150:3002/health | jq .
```

### Step 4: Smoke Test Authentication

```bash
# Test login with demo admin
curl -s -X POST http://46.224.99.150:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@grc-platform.local","password":"TestPassword123!"}' | jq .

# Expected: Response with accessToken and user object
```

## Incident Response Procedures

### Database Connection Issues

**Symptoms:**
- `/health/ready` returns unhealthy
- `npm run validate:db` fails
- Application logs show connection errors

**Diagnosis:**
```bash
# Check database container
docker compose ps postgres

# Check database logs
docker compose logs postgres --tail=50

# Test direct connection
docker compose exec postgres psql -U postgres -d grc_platform -c "SELECT 1"
```

**Resolution Steps:**
1. Check if PostgreSQL container is running
2. Verify environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
3. Check disk space on database volume
4. Restart database container if needed: `docker compose restart postgres`
5. Wait for health check to pass before restarting application

### Migration Issues

**Symptoms:**
- `npm run validate:migrations` shows pending migrations
- Application fails to start with schema errors

**Diagnosis:**
```bash
# Check migration status
npm run migration:show

# Check migrations table
docker compose exec postgres psql -U postgres -d grc_platform \
  -c "SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5"
```

**Resolution Steps:**
1. Run pending migrations: `npm run migration:run`
2. If migration fails, check migration file for errors
3. Revert last migration if needed: `npm run migration:revert`
4. Never use `DB_SYNC=true` in production

### Authentication Failures

**Symptoms:**
- Login returns 401 Unauthorized
- `npm run smoke:auth-onboarding` fails at login step

**Diagnosis:**
```bash
# Check auth health
curl -s http://localhost:3002/health/auth | jq .

# Verify JWT configuration
npm run validate:env | grep JWT
```

**Resolution Steps:**
1. Verify JWT_SECRET is set and at least 32 characters
2. Check if demo user exists: `npm run seed:grc`
3. Verify password hash algorithm compatibility
4. Check for rate limiting (too many failed attempts)

### Environment Variable Issues

**Symptoms:**
- Application fails to start
- `npm run validate:env` shows missing required variables

**Diagnosis:**
```bash
# Check environment validation
npm run validate:env

# Check .env file exists
ls -la .env

# Check environment in container
docker compose exec backend env | grep -E "^(DB_|JWT_|NODE_)"
```

**Resolution Steps:**
1. Copy `.env.example` to `.env` if missing
2. Set all required variables (see Required Environment Variables below)
3. Restart application after changing environment

## Validation Commands Reference

### Environment Validation (`npm run validate:env`)

Checks all required and optional environment variables.

**Required Variables:**
- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_USER` - PostgreSQL username (default: postgres)
- `DB_PASSWORD` - PostgreSQL password (required, no default)
- `DB_NAME` - PostgreSQL database name (default: grc_platform)
- `JWT_SECRET` - JWT signing key (required, min 32 chars)

**Optional Variables:**
- `NODE_ENV` - Environment mode (default: development)
- `PORT` - Application port (default: 3002)
- `JWT_EXPIRES_IN` - Token expiration (default: 24h)
- `DEMO_ADMIN_EMAIL` - Demo admin email for seeding
- `DEMO_ADMIN_PASSWORD` - Demo admin password for seeding

**JSON Output (for CI):**
```bash
npm run validate:env -- --json
```

### Database Validation (`npm run validate:db`)

Tests database connectivity and basic query execution.

**Checks Performed:**
1. Connection establishment (with timeout)
2. Simple query execution (`SELECT 1`)
3. Table count in public schema

**JSON Output (for CI):**
```bash
npm run validate:db -- --json
```

### Migration Validation (`npm run validate:migrations`)

Checks migration status and identifies pending migrations.

**Checks Performed:**
1. Migrations table existence
2. Executed migrations count
3. Pending migrations detection
4. Sync mode warning (if DB_SYNC=true)

**JSON Output (for CI):**
```bash
npm run validate:migrations -- --json
```

### Auth & Onboarding Smoke Test (`npm run smoke:auth-onboarding`)

Performs minimum smoke validation for authentication and onboarding.

**Tests Performed:**
1. Health check (liveness)
2. Health check (readiness)
3. Login with demo admin
4. Fetch onboarding context
5. Fetch current user (auth/me)
6. Access GRC risks endpoint

**JSON Output (for CI):**
```bash
npm run smoke:auth-onboarding -- --json
```

### Full Platform Validation (`npm run platform:validate`)

Orchestrates all validation scripts in sequence.

**Options:**
- `--json` - JSON output for CI integration
- `--skip-smoke` - Skip smoke tests (faster, for env/db checks only)

**Example:**
```bash
# Full validation
npm run platform:validate

# Skip smoke tests (no running server needed)
npm run platform:validate -- --skip-smoke

# JSON output for CI
npm run platform:validate -- --json
```

## Troubleshooting Guide

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Database not running | Start PostgreSQL container |
| `relation "migrations" does not exist` | Fresh database | Run `npm run migration:run` |
| `JWT_SECRET not set` | Missing env var | Set JWT_SECRET in .env |
| `Invalid credentials` | Wrong password or user not seeded | Run `npm run seed:grc` |
| `Tenant not found` | Invalid x-tenant-id header | Use correct tenant ID |

### Log Locations

**Local Development:**
- Application logs: stdout/stderr
- Database logs: `docker compose logs postgres`

**Staging Server:**
- Application logs: `docker compose logs backend`
- Database logs: `docker compose logs postgres`
- System logs: `/var/log/syslog`

### Performance Baselines

Expected response times for healthy platform:

| Check | Expected Time | Warning Threshold |
|-------|---------------|-------------------|
| DB Connection | < 500ms | > 5000ms |
| Simple Query | < 100ms | > 1000ms |
| Health Check | < 200ms | > 2000ms |
| Login | < 500ms | > 3000ms |

## CI Integration

### GitHub Actions Example

```yaml
- name: Platform Validation
  run: |
    cd backend-nest
    npm run platform:validate -- --json > validation-report.json
    
- name: Upload Validation Report
  uses: actions/upload-artifact@v3
  with:
    name: validation-report
    path: backend-nest/validation-report.json
```

### Exit Codes

All validation scripts use standard exit codes:
- `0` - Success (all checks passed)
- `1` - Failure (one or more checks failed)

This enables integration with CI/CD pipelines and shell scripts.
