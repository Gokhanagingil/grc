# GRC Platform - Staging Deploy Runbook

This runbook provides the canonical workflow for deploying and verifying the GRC Platform staging environment.

## Quick Start

For a fully automated, validated deployment, run:

```bash
cd /opt/grc-platform && ./scripts/staging-verify.sh
```

Expected result: `ALL CHECKS PASSED` with exit code 0.

## Prerequisites

Before running the deployment script, ensure:

1. SSH access to staging server (46.224.99.150)
2. Repository cloned at `/opt/grc-platform`
3. Docker and Docker Compose installed
4. `.env` file configured with required variables

### Required Environment Variables

The following must be set in `.env` or exported:

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | JWT signing secret | Yes |
| `REFRESH_TOKEN_SECRET` | Refresh token secret | Yes |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token expiry (e.g., `7d`) | Yes |
| `DEMO_ADMIN_EMAIL` | Demo admin email for smoke tests | Yes |
| `DEMO_ADMIN_PASSWORD` | Demo admin password for smoke tests | Yes |
| `DB_HOST` | Database host (default: `db`) | No |
| `DB_PORT` | Database port (default: `5432`) | No |
| `DB_USER` | Database user (default: `postgres`) | No |
| `DB_PASSWORD` | Database password | Yes |
| `DB_NAME` | Database name (default: `grc_platform`) | No |

## Canonical Migration Workflow

### Show Pending Migrations

To check migration status inside the backend container:

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npx typeorm migration:show -d dist/data-source.js'
```

Expected output format:
```
[X] 1734112800000-CreateOnboardingTables     # Executed
[X] 1735000000000-CreateAuditPhase2Tables    # Executed
[ ] 1736000000000-NewMigration               # Pending
```

### Run Pending Migrations

To execute pending migrations:

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npx typeorm migration:run -d dist/data-source.js'
```

### Migration Troubleshooting

If migrations fail silently or produce unexpected output:

1. Verify data-source exports correctly:
   ```bash
   docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
     'node -e "const ds=require(\"./dist/data-source.js\"); console.log(\"AppDataSource:\", !!ds.AppDataSource)"'
   ```
   Expected: `AppDataSource: true`

2. Check for duplicate migration index file (should NOT exist):
   ```bash
   docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
     'test -f /app/dist/migrations/index.js && echo "ERROR: index.js exists" || echo "OK"'
   ```

3. List migration files:
   ```bash
   docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
     'ls -la dist/migrations/'
   ```

## Verification Script Details

The `staging-verify.sh` script performs 8 verification steps:

| Step | Description | Failure Exit Code |
|------|-------------|-------------------|
| 1 | Verify repository state (on main branch) | 1 |
| 2 | Pull latest changes from origin | 1 |
| 3 | Docker build and start containers | 2 |
| 4 | Health check (wait for /health/ready) | 4 |
| 5 | Migration verification (show + run) | 5 |
| 6 | Seed scripts (standards) | 6 |
| 7 | Platform validation | 5 |
| 8 | Smoke tests (health, auth, GRC endpoints) | 7 |

### Script Options

```bash
./scripts/staging-verify.sh [--skip-build] [--skip-seed]
```

| Option | Description |
|--------|-------------|
| `--skip-build` | Skip Docker build, use existing containers |
| `--skip-seed` | Skip seed script execution |

## Health Endpoints

The backend exposes the following health endpoints:

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Overall health status | 200 with JSON |
| `/health/live` | Liveness probe | 200 with uptime |
| `/health/ready` | Readiness probe (checks DB) | 200 if DB connected |
| `/health/db` | Database health with migration status | 200 with details |
| `/health/auth` | Auth configuration check | 200 with config status |

### Health Check Commands

```bash
# Liveness
curl http://localhost:3002/health/live

# Readiness (used by Docker healthcheck)
curl http://localhost:3002/health/ready

# Database health with migration status
curl http://localhost:3002/health/db

# Auth configuration
curl http://localhost:3002/health/auth
```

## Manual Deployment Steps

If you need to run steps manually instead of using the script:

### 1. Pull Latest Code

```bash
cd /opt/grc-platform
git checkout main
git pull origin main
```

### 2. Build and Start Containers

```bash
docker compose -f docker-compose.staging.yml up -d --build backend frontend
```

### 3. Wait for Health

```bash
# Wait up to 2 minutes for backend to be ready
timeout 120 bash -c 'until curl -s http://localhost:3002/health/ready; do sleep 5; done'
```

### 4. Run Migrations

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npx typeorm migration:run -d dist/data-source.js'
```

### 5. Run Seed Scripts

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npm run seed:standards'
```

### 6. Validate Platform

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npm run platform:validate'
```

## Rollback Procedure

### Revert to Previous Commit

```bash
cd /opt/grc-platform
git log --oneline -10  # Find previous working commit
git checkout <COMMIT_HASH>
docker compose -f docker-compose.staging.yml up -d --build
```

### Revert Last Migration

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npx typeorm migration:revert -d dist/data-source.js'
```

### Restart Without Rebuild

```bash
./scripts/restart-staging.sh
```

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker compose -f docker-compose.staging.yml logs --tail=50 backend

# Check container status
docker compose -f docker-compose.staging.yml ps

# Check disk space
df -h
```

### Health Check Timeout

```bash
# Test health endpoint directly
curl -v http://localhost:3002/health/ready

# Check if port is listening
netstat -tlnp | grep 3002
```

### API Returns HTML Instead of JSON

This indicates nginx reverse proxy misconfiguration:

```bash
# Check nginx config
docker compose -f docker-compose.staging.yml exec frontend cat /etc/nginx/conf.d/default.conf

# Rebuild frontend
docker compose -f docker-compose.staging.yml up -d --build frontend
```

## Related Documentation

- `docs/STAGING-SMOKE-CHECKLIST.md` - Manual UI verification checklist
- `docs/STAGING_RELEASE_CHECKLIST.md` - Release go/no-go criteria
- `docs/STAGING_OPERATIONS_RUNBOOK.md` - Day-to-day operations
- `STAGING_DEPLOYMENT_RUNBOOK.md` (root) - Legacy deployment commands
