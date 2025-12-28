# GRC Platform - Staging Maintenance Runbook

**Last Updated:** December 11, 2025  
**Staging Server:** 46.224.99.150  
**Deployment Path:** /opt/grc-platform

## Overview

This runbook documents maintenance procedures for the GRC Platform staging environment. Use these procedures for database resets, reseeding, troubleshooting, and routine maintenance.

## Access Information

| Resource | Value |
|----------|-------|
| Server IP | 46.224.99.150 |
| SSH User | root |
| Deployment Path | /opt/grc-platform |
| Frontend URL | http://46.224.99.150 |
| Backend API URL | http://46.224.99.150:3002 |
| Health Check | http://46.224.99.150:3002/health/live |

## Container Information

| Container | Name | Port |
|-----------|------|------|
| PostgreSQL | grc-staging-db | 5432 (internal) |
| NestJS Backend | grc-staging-backend | 3002 |
| React Frontend | grc-staging-frontend | 80 |

## Common Maintenance Tasks

### 1. Check Container Status

```bash
ssh root@46.224.99.150 "docker ps"
```

Expected output shows all three containers running and healthy.

### 2. View Container Logs

```bash
# Backend logs
ssh root@46.224.99.150 "docker logs grc-staging-backend --tail 100"

# Frontend logs
ssh root@46.224.99.150 "docker logs grc-staging-frontend --tail 100"

# Database logs
ssh root@46.224.99.150 "docker logs grc-staging-db --tail 100"
```

### 3. Restart Staging Stack

```bash
ssh root@46.224.99.150 "cd /opt/grc-platform && docker compose -f docker-compose.staging.yml restart"
```

### 4. Stop Staging Stack

```bash
ssh root@46.224.99.150 "cd /opt/grc-platform && docker compose -f docker-compose.staging.yml down"
```

### 5. Start Staging Stack

```bash
ssh root@46.224.99.150 "cd /opt/grc-platform && docker compose -f docker-compose.staging.yml up -d"
```

## Database Operations

### Check Database Tables

```bash
ssh root@46.224.99.150 "docker exec grc-staging-db psql -U grc_staging -d grc_staging -c '\dt'"
```

### Check GRC Data Counts

```bash
ssh root@46.224.99.150 "docker exec grc-staging-db psql -U grc_staging -d grc_staging -c \"SELECT COUNT(*) as count, 'risks' as entity FROM grc_risks UNION ALL SELECT COUNT(*), 'policies' FROM grc_policies UNION ALL SELECT COUNT(*), 'requirements' FROM grc_requirements UNION ALL SELECT COUNT(*), 'controls' FROM grc_controls;\""
```

### Check Users

```bash
ssh root@46.224.99.150 "docker exec grc-staging-db psql -U grc_staging -d grc_staging -c 'SELECT id, email, role, tenant_id FROM nest_users;'"
```

### Check Tenants

```bash
ssh root@46.224.99.150 "docker exec grc-staging-db psql -U grc_staging -d grc_staging -c 'SELECT id, name FROM nest_tenants;'"
```

## Database Reset Procedures

### Soft Reset (Truncate Tables)

Use this when you want to clear data but keep the schema:

```bash
ssh root@46.224.99.150 "docker exec grc-staging-db psql -U grc_staging -d grc_staging -c '
TRUNCATE TABLE grc_risks CASCADE;
TRUNCATE TABLE grc_policies CASCADE;
TRUNCATE TABLE grc_requirements CASCADE;
TRUNCATE TABLE grc_controls CASCADE;
TRUNCATE TABLE nest_users CASCADE;
TRUNCATE TABLE nest_tenants CASCADE;
'"
```

**WARNING:** This will delete all data but preserve the schema.

### Hard Reset (Delete Volume)

Use this when you need a completely fresh database:

```bash
# 1. Stop the stack
ssh root@46.224.99.150 "cd /opt/grc-platform && docker compose -f docker-compose.staging.yml down"

# 2. Remove the PostgreSQL volume
ssh root@46.224.99.150 "docker volume rm grc-platform_grc_staging_postgres_data"

# 3. Start the stack (will create fresh database)
ssh root@46.224.99.150 "cd /opt/grc-platform && docker compose -f docker-compose.staging.yml up -d"
```

**WARNING:** This will permanently delete all data. The database will be recreated with empty tables when the stack restarts.

## Seeding Procedures

### Run GRC Seed Script

After a database reset, run the seed script to populate demo data:

```bash
ssh root@46.224.99.150 "docker exec -e DEMO_ADMIN_EMAIL=admin@grc-platform.local -e DEMO_ADMIN_PASSWORD=\$DEMO_PASSWORD grc-staging-backend node dist/scripts/seed-grc.js"
```

Note: Replace `$DEMO_PASSWORD` with the actual password from the staging `.env` file or use the default from the seed script.

Expected output:
- 1 demo tenant created
- 1 demo admin user created
- 8 controls created
- 8 risks created
- 8 policies created
- 10 requirements created

### Fix Password Hash (If Needed)

If the seed script uses an old version with placeholder hash, manually update the password:

```bash
# Generate bcrypt hash locally (requires bcrypt installed)
node -e "const bcrypt = require('bcrypt'); bcrypt.hash(process.env.DEMO_PASSWORD, 10).then(h => console.log(h));"

# Update in staging database (replace HASH with the generated hash)
ssh root@46.224.99.150 'echo "UPDATE nest_users SET password_hash = '"'"'HASH'"'"' WHERE email = '"'"'admin@grc-platform.local'"'"';" > /tmp/update_password.sql && docker exec -i grc-staging-db psql -U grc_staging -d grc_staging < /tmp/update_password.sql'
```

Note: Get the `DEMO_PASSWORD` value from the staging `.env` file or the seed script defaults.

## Verification Procedures

### Test Login Endpoint

```bash
curl -s -X POST http://46.224.99.150:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@grc-platform.local","password":"$DEMO_PASSWORD"}'
```

Expected: JSON response with `success: true` and `accessToken`. Replace `$DEMO_PASSWORD` with the actual password.

### Test GRC Endpoints

```bash
# Get token (replace $DEMO_PASSWORD with actual password)
TOKEN=$(curl -s -X POST http://46.224.99.150:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@grc-platform.local","password":"$DEMO_PASSWORD"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# Test risks endpoint
curl -s http://46.224.99.150:3002/grc/risks \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"

# Test policies endpoint
curl -s http://46.224.99.150:3002/grc/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"

# Test dashboard endpoint
curl -s http://46.224.99.150:3002/dashboard/overview \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

### Run Smoke Tests Against Staging

From local development environment:

```bash
cd backend-nest
NEST_API_URL=http://46.224.99.150:3002 npm run smoke:grc
```

Expected: All tests pass (16/16).

## Rebuild and Redeploy

### Rebuild Containers

```bash
ssh root@46.224.99.150 "cd /opt/grc-platform && docker compose -f docker-compose.staging.yml up -d --build --force-recreate"
```

### Pull Latest Code and Rebuild

```bash
ssh root@46.224.99.150 "cd /opt/grc-platform && git pull origin main && docker compose -f docker-compose.staging.yml up -d --build --force-recreate"
```

### Redeploying Staging Frontend

Use this procedure when frontend code changes need to be deployed to staging (e.g., API path fixes, UI updates).

**Prerequisites:**
- The staging server's git remote is configured for SSH access (`git@github.com:Gokhanagingil/grc.git`)
- Changes have been merged to the `main` branch

**Step 1: Pull Latest Code**

```bash
ssh root@46.224.99.150 "cd /opt/grc-platform && git fetch origin && git checkout main && git pull origin main"
```

If you encounter local changes blocking the pull:
```bash
ssh root@46.224.99.150 "cd /opt/grc-platform && git checkout . && git clean -fd && git pull origin main"
```

**Step 2: Rebuild Frontend Container**

```bash
ssh root@46.224.99.150 "cd /opt/grc-platform && docker compose -f docker-compose.staging.yml up -d --build --force-recreate frontend"
```

Note: The frontend service is named `frontend` in docker-compose.staging.yml and creates a container named `grc-staging-frontend`.

**Step 3: Verify Deployment**

```bash
# Check container is running
ssh root@46.224.99.150 "docker ps --filter name=grc-staging-frontend"

# Check the deployed JS contains correct API paths
ssh root@46.224.99.150 "docker exec grc-staging-frontend grep -o '/grc/policies\|/grc/risks' /usr/share/nginx/html/static/js/main.*.js | sort | uniq -c"
```

Expected output should show `/grc/policies` and `/grc/risks` paths.

**Step 4: Browser Verification**

1. Navigate to http://46.224.99.150
2. Login with `admin@grc-platform.local` / `TestPassword123!`
3. Verify Dashboard shows correct counts (8 risks, 8 policies, 10 requirements)
4. Navigate to Governance → Policies should load without errors
5. Navigate to Risk Management → Risks should load without errors

**Environment Variables for Frontend Build:**

The frontend build uses these environment variables (defined in docker-compose.staging.yml):
- `REACT_APP_API_URL`: Backend API URL (default: `http://46.224.99.150:3002`)

**Troubleshooting:**

If the frontend still shows old behavior after rebuild:
1. Clear browser cache or use incognito mode
2. Check if Docker used cached layers: `docker compose -f docker-compose.staging.yml build --no-cache frontend`
3. Verify the source file has correct paths: `grep -n 'LIST:' frontend/src/services/grcClient.ts | head -5`

## Troubleshooting

### Container Won't Start

1. Check logs: `docker logs grc-staging-backend`
2. Check disk space: `df -h`
3. Check memory: `free -m`
4. Restart Docker: `systemctl restart docker`

### Database Connection Issues

1. Check if database container is running: `docker ps | grep grc-staging-db`
2. Check database logs: `docker logs grc-staging-db`
3. Test database connection: `docker exec grc-staging-db pg_isready -U grc_staging`

### Authentication Failures

1. Check if user exists: `docker exec grc-staging-db psql -U grc_staging -d grc_staging -c "SELECT email FROM nest_users;"`
2. Verify password hash is valid (should start with `$2b$10$` and be 60 characters)
3. Re-run seed script if needed

### GRC Endpoints Return Empty Data

1. Check tenant ID in request header matches seeded tenant
2. Verify data exists: Run GRC data counts query
3. Check if data is in correct tenant: `SELECT tenant_id FROM grc_risks LIMIT 1;`

## Environment Variables

The staging environment uses these key variables (defined in `/opt/grc-platform/.env`):

| Variable | Description |
|----------|-------------|
| DB_USER | PostgreSQL username |
| DB_PASSWORD | PostgreSQL password |
| DB_NAME | PostgreSQL database name |
| JWT_SECRET | Secret for JWT signing |
| DEMO_ADMIN_EMAIL | Demo admin email address |
| DEMO_ADMIN_PASSWORD | Demo admin password |
| DB_SYNC | TypeORM schema sync (true for staging) |

## Expected State After Fresh Setup

After a hard reset and seed:

| Entity | Count |
|--------|-------|
| Tenants | 1 (Demo Organization) |
| Users | 1 (admin@grc-platform.local) |
| Controls | 8 |
| Risks | 8 |
| Policies | 8 |
| Requirements | 10 |

## Staging Deployment & Health Checklist (December 2025 - Devin Sprint)

This section documents the complete staging deployment and validation procedure verified in December 2025.

### Quick Redeploy Commands

To redeploy staging from the latest main branch:

```bash
# 1. SSH to staging server
ssh root@46.224.99.150

# 2. Navigate to project directory
cd /opt/grc-platform

# 3. Fetch and reset to latest main
git fetch --all
git reset --hard origin/main

# 4. Rebuild and restart containers
docker compose -f docker-compose.staging.yml up -d --build backend frontend

# 5. Wait for containers to be healthy (check status)
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Expected output should show all three containers as "healthy":
- `grc-staging-frontend` - Up (healthy) - 0.0.0.0:80->80/tcp
- `grc-staging-backend` - Up (healthy) - 0.0.0.0:3002->3002/tcp
- `grc-staging-db` - Up (healthy) - 5432/tcp

### Health Endpoint Verification

After deployment, verify the backend health endpoints:

```bash
# Liveness check (should return 200)
curl -s -o /dev/null -w "%{http_code}" http://46.224.99.150:3002/health/live

# Readiness check (should return 200)
curl -s -o /dev/null -w "%{http_code}" http://46.224.99.150:3002/health/ready

# Full health response
curl -s http://46.224.99.150:3002/health/live
```

Expected response:
```json
{"success":true,"data":{"status":"ok","timestamp":"...","uptime":...,"service":"grc-platform-nest"}}
```

### Running Tests on Staging

To run the full test suite inside the backend container:

```bash
# 1. Run seed script (creates demo data)
ssh root@46.224.99.150 "docker exec grc-staging-backend node dist/scripts/seed-grc.js"

# Expected output:
# - 1 demo tenant (00000000-0000-0000-0000-000000000001)
# - 1 demo admin user (admin@grc-platform.local)
# - 8 controls, 8 risks, 8 policies, 10 requirements
# - 4 processes, 7 process controls

# 2. Run smoke tests (16 checks)
ssh root@46.224.99.150 "docker exec grc-staging-backend node dist/scripts/smoke-grc.js"

# Expected: Passed: 16/16 (100%)

# 3. Run acceptance tests (5 scenarios, 29 checks)
ssh root@46.224.99.150 "docker exec grc-staging-backend node dist/scripts/acceptance-runner.js"

# Expected: Scenarios: 5 passed, 0 failed
#           Total checks: 29 passed, 0 failed
```

### Interpreting Test Results

**Seed Script Success Indicators:**
- "GRC Demo Data Seed Complete!" message
- Summary shows: Controls: 8, Risks: 8, Policies: 8, Requirements: 10, Processes: 4, Process Controls: 7

**Smoke Test Success Indicators:**
- All endpoints return HTTP 200
- "Passed: 16/16 (100%)" at the end
- "[SUCCESS] All smoke tests passed!" message

**Acceptance Test Success Indicators:**
- All 5 scenarios show [PASS] for each check
- "Scenarios: 5 passed, 0 failed"
- "Total checks: 29 passed, 0 failed"
- "[SUCCESS] All acceptance scenarios passed!" message

### Frontend Verification Checklist

After deployment, verify the frontend manually:

1. **Login**: Navigate to http://46.224.99.150 and login with:
   - Email: `admin@grc-platform.local`
   - Password: `TestPassword123!`

2. **Dashboard**: Verify the dashboard shows:
   - Total Risks: 8
   - Compliance Items: 10
   - Policies: 8
   - Risk Trends chart displays correctly
   - Compliance by Regulation chart shows data

3. **Governance (Policies)**: Navigate to Governance menu
   - Page loads without errors
   - Shows 8 policies in the table

4. **Risk Management**: Navigate to Risk Management menu
   - Page loads without errors
   - Shows 8 risks with severity indicators

5. **Compliance**: Navigate to Compliance menu
   - Page loads without errors
   - Shows 10 requirements

6. **Processes**: Navigate to Processes menu
   - Page loads without errors
   - Shows 4-5 processes
   - "View Violations" button is visible for each row

7. **Violations**: Click "View Violations" on any process
   - Navigates to `/violations?processId=<uuid>`
   - Page loads without crashing (may show "No violations found")

### Known Limitations (December 2025)

The following features are not available in the staging Docker environment because they depend on the Express backend which is not included in the staging Docker Compose setup:

1. **Audits Page**: The Audits page (`/audits`) shows a white screen because it depends on `/platform/modules/*` endpoints that are only available in the Express backend.

2. **Platform Module Features**: ACL, Form Layouts, UI Policies, and Module licensing features require the Express backend.

These limitations do not affect the core GRC functionality (Dashboard, Governance, Risk Management, Compliance, Processes, Violations).

### Minimal Endpoint Smoke List

| Endpoint | Method | Expected Status | Description |
|----------|--------|-----------------|-------------|
| `/health/live` | GET | 200 | Backend liveness |
| `/health/ready` | GET | 200 | Backend readiness |
| `/auth/login` | POST | 200 | Authentication |
| `/grc/risks` | GET | 200 | Risk list (requires auth) |
| `/grc/policies` | GET | 200 | Policy list (requires auth) |
| `/grc/requirements` | GET | 200 | Requirement list (requires auth) |
| `/dashboard/overview` | GET | 200 | Dashboard KPIs (requires auth) |
| `/itsm/incidents` | GET | 200 | Incident list (requires auth) |

## Swap Configuration for Frontend Builds

The staging server uses a 2GB swap file to prevent out-of-memory (OOM) errors during React frontend builds. Docker builds, especially for the frontend, can consume significant memory during webpack bundling and TypeScript compilation.

### Why Swap Exists

The React frontend build process can spike memory usage beyond the server's 4GB RAM, particularly during:
- Webpack bundling with source maps
- TypeScript type checking
- Node.js garbage collection pressure

Without swap, the Linux OOM killer may terminate the build process, causing deployment failures.

### Verify Swap Status

Use these commands to verify swap configuration:

```bash
# Check if swap is active
ssh root@46.224.99.150 "swapon --show"

# Expected output:
# NAME      TYPE SIZE  USED PRIO
# /swapfile file   2G    0B   -2

# Check memory and swap usage
ssh root@46.224.99.150 "free -h"

# Verify swap persistence in fstab
ssh root@46.224.99.150 "grep -n '/swapfile' /etc/fstab"

# Expected output:
# /swapfile none swap sw 0 0

# Check swapfile permissions (should be 0600, root:root)
ssh root@46.224.99.150 "ls -la /swapfile"
```

### Remove Swap (If No Longer Needed)

If the server is upgraded with more RAM and swap is no longer required:

**Important:** Follow these steps in order to safely remove swap:

```bash
# 1. Disable swap (must be done first)
ssh root@46.224.99.150 "swapoff /swapfile"

# 2. Remove fstab entry (prevents swap from being re-enabled on reboot)
ssh root@46.224.99.150 "sed -i '/swapfile/d' /etc/fstab"

# 3. Delete the swapfile (safe to do after swapoff)
ssh root@46.224.99.150 "rm /swapfile"

# 4. Verify removal
ssh root@46.224.99.150 "swapon --show && grep swapfile /etc/fstab"
# Should return empty output
```

### Resize Swap (Safe Procedure)

To increase or decrease swap size:

```bash
# 1. Disable current swap
ssh root@46.224.99.150 "swapoff /swapfile"

# 2. Resize the swapfile (e.g., 4GB)
ssh root@46.224.99.150 "fallocate -l 4G /swapfile"
# Or use dd for more reliable allocation:
# ssh root@46.224.99.150 "dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress"

# 3. Set correct permissions
ssh root@46.224.99.150 "chmod 600 /swapfile"

# 4. Format as swap
ssh root@46.224.99.150 "mkswap /swapfile"

# 5. Enable swap
ssh root@46.224.99.150 "swapon /swapfile"

# 6. Verify new size
ssh root@46.224.99.150 "swapon --show"
```

**Note:** The fstab entry does not need to be modified when resizing since it references the file path, not the size.

### Pre-Build Memory Check

Before running resource-intensive builds, verify available memory:

```bash
ssh root@46.224.99.150 "free -h && swapon --show"
```

Recommended minimums for frontend build:
- Available RAM: 1GB+
- Swap: 2GB configured and active

If swap is not active, enable it before building:
```bash
ssh root@46.224.99.150 "swapon /swapfile"
```

### Using check-memory Script

The `check-memory` script can be run inside containers to verify memory and swap status before builds.

**Important:** The script verifies swap exists and memory is adequate, but **swap persistence cannot be reliably validated inside containers** because container `/etc/fstab` files are typically stub files (cdrom/usbdisk entries) that don't reflect the host's actual fstab configuration.

#### (A) Container Check (Memory & Swap Status)

Run the script inside the backend container to verify swap is active and memory is adequate:

```bash
ssh root@46.224.99.150 "cd /opt/grc-platform && docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'node dist/scripts/check-memory.js || true'"
```

**Expected Output (Container):**
- Memory: Total/Free/Available values
- Swap: Total/Used/Free values (correct)
- Persistent: **Unknown (container fstab)** ← Expected in containers, NOT a warning
- No false warnings about swap persistence

**What the Container Check Validates:**
- ✅ Swap is active (Total > 0)
- ✅ Swap size meets minimum (2GB recommended)
- ✅ Available RAM meets minimum (1GB recommended)
- ⚠️ Swap persistence: Shows "Unknown" (cannot validate in container)

#### (B) Host Persistence Check (fstab Validation)

To verify swap persistence on the **host** (where it actually matters), use host-level commands:

```bash
# Verify swap is active on host
ssh root@46.224.99.150 "swapon --show"

# Check fstab entry on host (where persistence is configured)
ssh root@46.224.99.150 "grep -n '/swapfile' /etc/fstab"
```

**Expected Output:**
- `swapon --show`: Shows `/swapfile` as active swap
- `grep`: Shows `/swapfile none swap sw 0 0` entry in fstab

**What the Host Check Validates:**
- ✅ Swap is active (`swapon --show`)
- ✅ Swap persistence configured (`/etc/fstab` entry exists)

## Deploy & Validate (One Command)

The `ops/staging-deploy-validate.sh` script provides a single-command deployment and validation workflow for staging. It automates the entire process from code pull to evidence generation.

### Quick Start

```bash
# On staging host
cd /opt/grc-platform

# Set required environment variables
export STAGING_ADMIN_EMAIL="admin@grc-platform.local"
export STAGING_ADMIN_PASSWORD="your-password-here"

# Run deployment and validation
bash ops/staging-deploy-validate.sh
```

### What the Script Does

The script executes the following steps in sequence:

1. **Pre-checks**: Validates Linux OS, docker, docker compose, git repository, and working directory
2. **Update**: Fetches and pulls latest code from origin (fast-forward only)
3. **Build/Up**: Builds and starts backend and frontend containers (not db)
4. **Preflight**: Runs memory check script inside backend container
5. **Health Checks**: Validates all health endpoints (`/health/live`, `/health/db`, `/health/auth`, `/health/ready`)
6. **Smoke Tests**: Performs login and onboarding context tests
7. **Evidence Pack**: Generates timestamped evidence directory with summary, logs, and metadata

### Required Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `STAGING_ADMIN_EMAIL` | Admin email for smoke tests | `admin@grc-platform.local` | Yes |
| `STAGING_ADMIN_PASSWORD` | Admin password for smoke tests | `TestPassword123!` | Yes |
| `STAGING_TENANT_ID` | Tenant ID for smoke tests (defaults to DEMO_TENANT_ID if not set) | `00000000-0000-0000-0000-000000000001` | No |

**Security Note:** The script never logs passwords or tokens. Credentials are only used in-memory for API calls.

### Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | All checks passed, deployment successful |
| 2 | Pre-check failure | Docker/git/repo issues - fix environment |
| 3 | Git update failure | Fast-forward pull failed - resolve conflicts |
| 4 | Deploy/build failure | Container build or startup failed |
| 5 | Preflight failure | Memory check failed - check swap/memory |
| 6 | Health check failure | Backend health endpoints unhealthy |
| 7 | Smoke test failure | Login or API tests failed |
| 8 | Evidence generation failure | Evidence pack creation failed |

### Evidence Pack Structure

After successful execution, the script creates an evidence directory:

```
evidence/staging-YYYYMMDD-HHMMSS/
├── summary.md      # Human-readable summary report
├── raw.log         # Complete command output
└── meta.json       # Metadata (commit, branch, docker images, etc.)
```

**Evidence Directory Location:** `evidence/` (root of repository)  
**Git Ignore:** Evidence directories are excluded from git (see `.gitignore`)

### Example Usage

#### Standard Deployment

```bash
# SSH to staging
ssh root@46.224.99.150

# Navigate to repo
cd /opt/grc-platform

# Set credentials (from secure storage - avoid using .env in production)
export STAGING_ADMIN_EMAIL="admin@grc-platform.local"
export STAGING_ADMIN_PASSWORD="your-secure-password"

# Optional: Set tenant ID (defaults to DEMO_TENANT_ID if not set)
export STAGING_TENANT_ID="00000000-0000-0000-0000-000000000001"

# Run deployment
bash ops/staging-deploy-validate.sh
```

#### Checking Evidence After Deployment

```bash
# List latest evidence
ls -lt evidence/ | head -5

# View latest summary
cat "$(ls -td evidence/staging-* | head -1)/summary.md"

# Check exit code from last run
echo $?
```

### Container vs Host Execution

**Important:** The script is designed to run on the **staging host** (not inside containers). It uses `docker exec` to run commands inside containers when needed (e.g., health checks, memory checks).

- **Host-level operations:** Git pull, docker compose commands, evidence generation
- **Container-level operations:** Health checks, memory checks, smoke tests (via `docker exec`)

### Troubleshooting

#### Script Fails at Preflight (Exit 5)

Memory check detected errors. Check swap configuration:

```bash
# On host
swapon --show
free -h

# Check memory check output in evidence
cat "$(ls -td evidence/staging-* | head -1)/raw.log" | grep -A 20 "Preflight"
```

#### Script Fails at Health Checks (Exit 6)

Backend health endpoints are not responding correctly:

**Note:** Health checks now run via Node inside backend container; curl/wget not required.

```bash
# Check backend logs
docker logs grc-staging-backend --tail 50

# Manually test health endpoint (Node-based, same as script)
docker exec grc-staging-backend node -e "const http=require('http');const r=http.get('http://localhost:3002/health/ready',{timeout:10000},(res)=>{console.log('Status:',res.statusCode);process.exit(res.statusCode===200?0:1)});r.on('error',()=>{console.log('Error');process.exit(1)});r.on('timeout',()=>{r.destroy();console.log('Timeout');process.exit(1)});"

# Check evidence for specific endpoint failure
cat "$(ls -td evidence/staging-* | head -1)/raw.log" | grep -B 5 -A 10 "FAILED"
```

#### Script Fails at Smoke Tests (Exit 7)

Login or API tests failed:

```bash
# Verify credentials
echo "Email: ${STAGING_ADMIN_EMAIL}"
# (Don't echo password)

# Test login manually
docker exec grc-staging-backend node -e "
  const http = require('http');
  const data = JSON.stringify({
    email: '${STAGING_ADMIN_EMAIL}',
    password: 'your-password'
  });
  const req = http.request({
    hostname: 'localhost',
    port: 3002,
    path: '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, (res) => {
    console.log('Status:', res.statusCode);
    res.on('data', (d) => process.stdout.write(d));
  });
  req.write(data);
  req.end();
"
```

#### Git Pull Fails (Fast-Forward Only)

If local changes prevent fast-forward pull:

```bash
# Option 1: Allow dirty working tree (not recommended)
export ALLOW_DIRTY=1
bash ops/staging-deploy-validate.sh

# Option 2: Stash changes
git stash
bash ops/staging-deploy-validate.sh
git stash pop

# Option 3: Reset to origin (destructive)
git fetch origin
git reset --hard origin/main
bash ops/staging-deploy-validate.sh
```

### Integration with CI/CD

The script is designed for manual execution on the staging host. For CI/CD integration:

1. **SSH to staging host** from CI runner
2. **Set environment variables** (from CI secrets)
3. **Run script** and capture exit code
4. **Upload evidence** to CI artifacts (optional)

Example CI step:

```yaml
# Example GitHub Actions step
- name: Deploy and Validate Staging
  run: |
    ssh root@46.224.99.150 << 'EOF'
      cd /opt/grc-platform
      export STAGING_ADMIN_EMAIL="${{ secrets.STAGING_ADMIN_EMAIL }}"
      export STAGING_ADMIN_PASSWORD="${{ secrets.STAGING_ADMIN_PASSWORD }}"
      bash ops/staging-deploy-validate.sh
    EOF
```

### Script Idempotency

The script is **idempotent** - it can be run multiple times safely:

- Git pull uses `--ff-only` (fails gracefully if conflicts)
- Docker compose `up -d --build` is idempotent
- Evidence directories are timestamped (no overwrites)
- Containers are restarted if needed

### Best Practices

1. **Always check exit code** after running the script
2. **Review evidence summary** after each deployment
3. **Keep evidence directories** for audit trail (they're git-ignored)
4. **Use environment variables** for credentials (never hardcode)
5. **Run script from repo root** or ensure correct working directory

## Contact

For issues with staging environment, contact the platform team or refer to the main repository documentation.
