# GRC Platform - Staging Deployment Runbook

This document provides operational guidance for the "Deploy to Staging" GitHub Actions workflow.

## Required GitHub Secrets

The following secrets must be configured in the repository settings (Settings > Secrets and variables > Actions):

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `STAGING_SSH_HOST` | IP address or hostname of the staging server | `46.224.99.150` |
| `STAGING_SSH_USER` | SSH username for deployment | `root` or `grcdeploy` |
| `STAGING_SSH_KEY_B64` | Base64-encoded private SSH key (preferred) | See generation instructions below |
| `STAGING_SSH_KEY` | Plain text SSH key (legacy, deprecated) | N/A - use B64 version |

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
3. **Setup SSH key** - Decodes the base64 key and sets up known_hosts
4. **SSH connectivity preflight** - Tests SSH connection before heavy deployment
5. **Deploy to staging server** - Executes the deployment script on the remote server

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
Frontend: http://46.224.99.150
Backend API: http://46.224.99.150:3002
Backend Health: http://46.224.99.150:3002/health/live
```

## Troubleshooting

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
   ssh -i ~/.ssh/grc_staging root@46.224.99.150 "echo OK"
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

## Security Smoke Tests

The workflow includes security smoke tests that verify tenant isolation:

1. **Missing x-tenant-id header** - Should return HTTP 400
2. **Spoofed tenant ID** - Should return HTTP 403
3. **Valid request** - Should return HTTP 200

These tests require `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` to be set in the staging server's `.env` file.

## Manual Deployment

If the GitHub Actions workflow is unavailable, you can deploy manually:

```bash
# SSH to the staging server
ssh root@46.224.99.150

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
