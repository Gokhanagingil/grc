# GRC Platform - Staging Deployment Runbook

This document provides operational guidance for the "Deploy to Staging" GitHub Actions workflow and the "RC1 Staging Smoke Tests" workflow.

## Required GitHub Secrets

The following secrets must be configured in the repository settings (Settings > Secrets and variables > Actions):

### Deployment Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `STAGING_SSH_HOST` | IP address or hostname of the staging server (see format requirements below) | `staging.example.com` |
| `STAGING_SSH_USER` | SSH username for deployment | `root` or `grcdeploy` |
| `STAGING_SSH_KEY_B64` | Base64-encoded private SSH key (preferred) | See generation instructions below |
| `STAGING_SSH_KEY` | Plain text SSH key (legacy, deprecated) | N/A - use B64 version |

### Staging URL Secrets (for RC1 Smoke Tests and Playwright)

| Secret Name | Description | Example Value | Required |
|-------------|-------------|---------------|----------|
| `STAGING_BASE_URL` | Base URL for staging environment | `https://niles-grc.com` | Yes |
| `STAGING_URL` | Legacy alias for STAGING_BASE_URL | `https://niles-grc.com` | No (fallback) |

The staging URL is resolved with the following priority (highest to lowest):
1. Workflow dispatch input `staging_url` (manual trigger)
2. Workflow dispatch input `staging_base_url` (alias)
3. Repository secret `STAGING_BASE_URL`
4. Repository secret `STAGING_URL` (legacy)
5. Repository variable `STAGING_BASE_URL` (optional fallback)

The URL is automatically normalized: `https://` is added if missing, and trailing slashes are removed.

### Smoke Test Credentials

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `DEMO_ADMIN_EMAIL` | Admin email for smoke tests | `admin@example.com` |
| `DEMO_ADMIN_PASSWORD` | Admin password for smoke tests | (secure password) |
| `DEMO_TENANT_ID` | Tenant ID for smoke tests | (valid UUID) |

Note: Cloudflare or tunnel configurations do not change the requirement for these secrets. The URL simply points to wherever the staging environment is accessible.

### STAGING_SSH_HOST Format Requirements

The `STAGING_SSH_HOST` secret must be a **hostname or IP address only**. The workflow will sanitize the value but will fail if the format is invalid after sanitization.

**Valid formats:**
- `192.0.2.1` (IP address - use your actual staging IP)
- `staging.example.com` (hostname)
- `my-server.domain.org` (hostname with hyphens)

**Invalid formats (will cause errors):**
- `http://192.0.2.1` (has scheme - will be stripped but avoid)
- `https://staging.example.com` (has scheme)
- `192.0.2.1:22` (has port - will be stripped but avoid)
- `staging.example.com/path` (has path)
- `user@192.0.2.1` (has username - use STAGING_SSH_USER instead)

The workflow automatically sanitizes the host by:
1. Removing whitespace, carriage returns, tabs, and newlines
2. Stripping `http://` or `https://` scheme prefixes
3. Removing any path after the hostname
4. Removing any port suffix (`:22`, `:3002`, etc.)

After sanitization, the host must match the pattern `^[A-Za-z0-9.-]+$` (only letters, numbers, dots, and hyphens).

## Generating the Base64-Encoded SSH Key

The `STAGING_SSH_KEY_B64` secret should contain the private SSH key encoded in base64 format. This avoids issues with newlines and special characters that can cause libcrypto errors.

### Linux

```bash
base64 -w 0 ~/.ssh/grc_staging
```

The `-w 0` flag ensures no line wrapping in the output.

### macOS / Other Systems

```bash
base64 ~/.ssh/grc_staging | tr -d '\n'
```

The `tr -d '\n'` removes any newlines from the output.

### Verification

To verify your base64-encoded key is correct:

```bash
echo "YOUR_BASE64_STRING" | base64 -d | head -1
```

This should output `-----BEGIN OPENSSH PRIVATE KEY-----` or similar.

## Workflow Execution

### Manual Trigger

1. Go to the repository on GitHub
2. Navigate to Actions > "Deploy to Staging"
3. Click "Run workflow"
4. Select the branch (usually `main`)
5. Click "Run workflow"

### Workflow Steps

The workflow executes the following steps:

1. **Checkout repository** - Clones the repository using `actions/checkout@v4`
2. **Validate required secrets** - Fails fast if any required secrets are missing
3. **Sanitize STAGING_SSH_HOST** - Cleans and validates the host value (removes scheme, port, path; validates format)
4. **Setup SSH key** - Decodes the base64 key and sets up known_hosts using the sanitized host
5. **SSH connectivity preflight** - Tests SSH connection before heavy deployment
6. **Deploy to staging server** - Executes the deployment script on the remote server

### Expected Output

On successful deployment, you should see:

```
PRECHECK_OK
...
Backend health check passed
Frontend health check passed
...
SECURITY_SMOKE_TESTS: PASSED - All tests executed and passed
=== Deployment Complete ===
Frontend: https://niles-grc.com (or your STAGING_BASE_URL)
Backend API: https://api.niles-grc.com (or STAGING_BASE_URL/api)
Backend Health: https://niles-grc.com/api/health/live
```

## Disk Space Management

The deployment workflow includes automatic disk space checks and safe cleanup to prevent "no space left on device" errors during docker build.

### How the Disk Preflight Works

Before running `docker compose up --build`, the workflow:

1. **Checks available disk space** on root (`/`) and docker data directory (`/var/lib/docker` or `/var`)
2. **Compares against threshold** (default: 6GB, configurable via `DISK_FREE_GB_MIN` env var)
3. **Runs safe cleanup** if below threshold (see commands below)
4. **Fails fast** with actionable error message if still insufficient after cleanup

### Detecting Disk Pressure Manually

SSH to the staging server and run:

```bash
# Check filesystem usage
df -h

# Check Docker-specific disk usage
docker system df

# Find largest directories
du -sh /* | sort -hr | head -20
du -sh /var/* | sort -hr | head -20
```

### Safe Cleanup Commands

These commands are safe to run and will NOT delete database volumes:

```bash
# 1. Remove stopped containers
docker container prune -f

# 2. Remove unused networks
docker network prune -f

# 3. Remove all build cache
docker builder prune -af

# 4. Remove all unused images (not just dangling)
docker image prune -af
```

**Run all four in sequence:**
```bash
docker container prune -f && \
docker network prune -f && \
docker builder prune -af && \
docker image prune -af
```

### WARNING: Do NOT Use Volume Prune

**NEVER run `docker volume prune`** on the staging server. This command will delete the PostgreSQL database volume and cause **permanent data loss**.

The database volume (`grc-platform_grc_staging_postgres_data`) contains all staging data and must be preserved.

### What To Do If Still Not Enough Space

If the automatic cleanup doesn't free enough space, you need to take manual action:

1. **Expand the disk** - Increase the staging server's disk size via your cloud provider console

2. **Clear old logs** - Remove old system and application logs:
   ```bash
   # Clear old journal logs (keep last 7 days)
   sudo journalctl --vacuum-time=7d
   
   # Remove compressed log archives
   sudo find /var/log -type f -name '*.gz' -delete
   
   # Truncate large log files (careful - loses log history)
   sudo truncate -s 0 /var/log/*.log
   ```

3. **Investigate large files** - Find and remove unnecessary large files:
   ```bash
   # Find files larger than 100MB
   sudo find / -type f -size +100M -exec ls -lh {} \; 2>/dev/null
   
   # Check for old backup files
   sudo find / -name "*.bak" -o -name "*.backup" -o -name "*.old" 2>/dev/null
   ```

4. **Contact infrastructure team** - If disk expansion is needed, coordinate with your infrastructure/DevOps team

### Configuring the Disk Threshold

The minimum free space threshold can be adjusted by modifying the `DISK_FREE_GB_MIN` environment variable in `.github/workflows/deploy-staging.yml`:

```yaml
env:
  DEPLOY_PATH: /opt/grc-platform
  DISK_FREE_GB_MIN: 6  # Change this value (in GB)
```

## Troubleshooting

### Error: No staging URL configured (RC1 Smoke Tests / Playwright)

**Symptom:**
```
ERROR: No staging URL configured.

To fix this, do ONE of the following:
  1. Set Actions secret STAGING_BASE_URL (e.g., https://niles-grc.com)
  2. Pass workflow input staging_url when triggering manually

Configuration location: Settings > Secrets and variables > Actions
```

**Root Cause:**
The RC1 Staging Smoke Tests or Playwright UI Smoke Tests workflow could not find a staging URL from any of the supported sources (workflow input, secrets, or variables).

**Solution:**
1. Go to repository Settings > Secrets and variables > Actions
2. Add a new secret named `STAGING_BASE_URL` with the full URL of your staging environment (e.g., `https://niles-grc.com`)
3. Re-run the workflow

Alternatively, when triggering the workflow manually, you can provide the `staging_url` input parameter.

### Error: Missing required GitHub secrets

**Symptom:**
```
ERROR: Missing required GitHub secrets:
  - STAGING_SSH_HOST
  - STAGING_SSH_USER
  - STAGING_SSH_KEY_B64 (preferred) or STAGING_SSH_KEY (legacy)
```

**Solution:**
1. Go to repository Settings > Secrets and variables > Actions
2. Add the missing secrets listed in the error message
3. Re-run the workflow

### Error: Invalid STAGING_SSH_HOST format

**Symptom:**
```
ERROR: Invalid STAGING_SSH_HOST format
  Expected: hostname or IP address (e.g., 46.224.99.150 or staging.example.com)
  Must contain only: letters, numbers, dots, and hyphens
  Must NOT contain: scheme (http://), port (:22), path (/path), or special characters
```

**Root Cause:**
The `STAGING_SSH_HOST` secret contains invalid characters after sanitization. This can happen if the value contains characters other than letters, numbers, dots, and hyphens.

**Solution:**
1. Go to repository Settings > Secrets and variables > Actions
2. Update `STAGING_SSH_HOST` to contain only the hostname or IP address
3. Remove any scheme (`http://`, `https://`), port (`:22`), or path (`/path`)
4. Example valid values: `46.224.99.150`, `staging.example.com`
5. Re-run the workflow

### Error: Failed to decode STAGING_SSH_KEY_B64

**Symptom:**
```
ERROR: Failed to decode STAGING_SSH_KEY_B64. Ensure it is valid base64.
```

**Solution:**
1. Regenerate the base64-encoded key using the instructions above
2. Ensure no extra whitespace or newlines were added when copying
3. Update the `STAGING_SSH_KEY_B64` secret with the new value

### Error: SSH key file is empty after decoding

**Symptom:**
```
ERROR: SSH key file is empty after decoding
```

**Solution:**
1. Verify the secret value is not empty
2. Regenerate and re-upload the base64-encoded key

### Error: SSH connectivity preflight FAILED

**Symptom:**
```
ERROR: SSH connectivity preflight FAILED

Troubleshooting hints:
  1. Verify the SSH key is correct and has access to the server
  2. Check that STAGING_SSH_HOST is reachable
  3. Verify STAGING_SSH_USER is correct
  4. Ensure the public key is in ~/.ssh/authorized_keys on the server
  5. Check server firewall allows SSH from GitHub Actions IPs
```

**Solution:**
1. Test SSH access manually from your local machine:
   ```bash
   ssh -i ~/.ssh/grc_staging $STAGING_SSH_USER@$STAGING_SSH_HOST "echo OK"
   ```
2. If manual SSH works, verify the base64 encoding is correct
3. Check that the public key is in the server's `~/.ssh/authorized_keys`
4. Verify the server firewall allows SSH from GitHub Actions IP ranges

### Error: getKeyFile error: open ~/.ssh/staging_key: no such file or directory

**Symptom:**
```
getKeyFile error: open ~/.ssh/staging_key: no such file or directory
ssh: handshake failed: ssh: unable to authenticate
```

**Root Cause:**
This error occurs when using `key_path` with a path that doesn't exist inside the appleboy/ssh-action container. The `~/.ssh/` directory in the GitHub runner is not accessible from within the containerized action.

**Solution:**
The workflow has been updated to use the `key` input with `key_format: base64` instead of `key_path`. Ensure you're using the latest version of the workflow.

### Error: Backend/Frontend health check failed

**Symptom:**
```
Backend health check failed after 30 attempts
```
or
```
Frontend health check failed after 30 attempts
```

**Solution:**
1. Check the container logs in the workflow output
2. SSH to the staging server and check container status:
   ```bash
   cd /opt/grc-platform
   docker compose -f docker-compose.staging.yml ps
   docker compose -f docker-compose.staging.yml logs backend
   docker compose -f docker-compose.staging.yml logs frontend
   ```
3. Verify the health endpoints:
   - Backend: `http://localhost:3002/health/live`
   - Frontend: `http://localhost/health`

### Error: Docker Compose deployment failed

**Symptom:**
```
ERROR: Docker Compose deployment failed
```

**Solution:**
1. Check the container status and logs in the workflow output
2. SSH to the staging server and investigate:
   ```bash
   cd /opt/grc-platform
   docker compose -f docker-compose.staging.yml ps
   docker compose -f docker-compose.staging.yml logs --tail=200
   ```
3. Check for disk space issues: `df -h`
4. Check for memory issues: `free -m`

## Health Check Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Backend (liveness) | `http://localhost:3002/health/live` | HTTP 200 |
| Backend (database) | `http://localhost:3002/health/db` | HTTP 200 |
| Backend (auth) | `http://localhost:3002/health/auth` | HTTP 200 |
| Frontend | `http://localhost/health` | HTTP 200 |

## DB Migration Health Check (in container)

After deployment, verify that all migrations have been applied and the database schema is up to date.

### Check Migration Status

Run inside the backend container to see which migrations have been executed:

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npm run migration:show'
```

**Expected output**: All migrations should show `[X]` (executed). Example:
```
[X] CreateTenantsTable1730000000000
[X] AddUserRoles1730000000001
...
[X] LatestMigration1738000000000
```

### Run Pending Migrations

If there are pending migrations (shown without `[X]`), run them:

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npm run migration:run'
```

**Expected output** (when no pending migrations):
```
No migrations are pending
```

### Alternative Direct Commands

If the npm scripts don't work, you can use the TypeORM CLI directly with the dist data source:

```bash
# Show migrations
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npx typeorm migration:show -d dist/data-source.js'

# Run migrations
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npx typeorm migration:run -d dist/data-source.js'
```

### Seeding Standards Data

The standards seed is idempotent and can be run safely multiple times:

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npm run seed:standards'
```

This seeds the demo tenant with standard frameworks (ISO 27001, SOC 2, etc.) and their clauses.

## Security Smoke Tests

The workflow includes security smoke tests that verify tenant isolation:

1. **Missing x-tenant-id header** - Should return HTTP 400
2. **Spoofed tenant ID** - Should return HTTP 403
3. **Valid request** - Should return HTTP 200

These tests require `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` to be set in the staging server's `.env` file.

## Manual Deployment

If the GitHub Actions workflow is unavailable, you can deploy manually:

```bash
# SSH to the staging server (use your configured credentials)
ssh $STAGING_SSH_USER@$STAGING_SSH_HOST

# Navigate to the deployment directory
cd /opt/grc-platform

# Pull latest changes
git fetch --all
git checkout main
git pull origin main

# Deploy with Docker Compose
docker compose -f docker-compose.staging.yml up -d --build --force-recreate

# Verify health
curl -sf http://localhost:3002/health/live && echo "Backend OK"
curl -sf http://localhost/health && echo "Frontend OK"
```

## Related Documentation

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development setup and guidelines
- [staging-deploy-validate.sh](./staging-deploy-validate.sh) - 7-phase deployment script for manual validation
