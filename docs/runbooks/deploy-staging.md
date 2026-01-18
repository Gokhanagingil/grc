# Deploy to Staging - GitHub Actions Runbook

This runbook covers triggering and monitoring the GitHub Actions staging deployment workflow.

## How to Trigger "Deploy to Staging" from GitHub UI

1. Navigate to the repository on GitHub: `https://github.com/Gokhanagingil/grc`
2. Click the **Actions** tab
3. In the left sidebar, select **Deploy to Staging**
4. Click the **Run workflow** button (top right of the workflow runs list)
5. Select the branch (typically `main`)
6. Click **Run workflow** (green button)

The workflow will start within a few seconds. Click on the running workflow to monitor progress.

## What Log Sections to Look For

When viewing the workflow run, expand the **Deploy to staging server** step. Key sections to monitor:

### Git Operations
Look for these lines confirming code sync:
```
=== Fetching latest changes ===
=== Pulling latest changes ===
=== Current Commit ===
abc1234 Latest commit message here
```

### Docker Deployment
```
=== Deploying with Docker Compose ===
```
Should complete without errors. If it fails, logs from the containers will be shown.

### Health Checks
```
=== Health Checks ===
Checking backend health...
✓ Backend health check passed
Checking frontend health...
✓ Frontend health check passed
```

### Security Smoke Tests Status
This is the critical section for verifying tenant isolation:
```
=== Security Smoke Tests ===
```

**Healthy output (tests ran):**
```
Authentication successful. Running security tests...
Test 1: /platform/modules/menu/nested without x-tenant-id...
  PASS: Missing tenant header returns 400
Test 2: /platform/modules/menu/nested with spoof tenant ID...
  PASS: Spoof tenant ID returns 403
Test 3: /onboarding/context with valid headers...
  PASS: Valid request returns 200
All security smoke tests passed!

=== Security Smoke Tests Status ===
SECURITY_SMOKE_TESTS: RUNNING - All tests executed and passed
```

**Skipped output (acceptable in some cases):**
```
=== Security Smoke Tests Status ===
SECURITY_SMOKE_TESTS: SKIPPED - Reason: jq not available
```
or
```
SECURITY_SMOKE_TESTS: SKIPPED - Reason: DEMO_ADMIN_PASSWORD not set
```

### Deployment Complete
```
=== Deployment Complete ===
Frontend: http://46.224.99.150
Backend API: http://46.224.99.150:3002
Backend Health: http://46.224.99.150:3002/health/live
```

## Expected Healthy Signals Checklist

Before considering a deployment successful, verify:

- [ ] Workflow shows green checkmark (completed successfully)
- [ ] Git pull completed without conflicts
- [ ] Docker Compose deployment succeeded
- [ ] Backend health check passed (HTTP 200 on /health/live)
- [ ] Frontend health check passed (HTTP 200 on /health)
- [ ] Security smoke tests show `SECURITY_SMOKE_TESTS: RUNNING` (preferred) or have valid skip reason
- [ ] All 3 security tests passed (if running):
  - Missing tenant header returns 400
  - Spoof tenant ID returns 403
  - Valid request returns 200
- [ ] No ERROR messages in the deployment logs

## If It Fails - Top 5 Causes and Next Actions

### 1. SSH Connection Failed
**Symptom:** Workflow fails immediately with SSH timeout or authentication error.

**Likely Causes:**
- SSH key secret expired or misconfigured
- Staging server unreachable (network/firewall)
- Server IP changed

**Next Actions:**
1. Verify `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY` secrets in GitHub
2. Test SSH access manually: `ssh -i <key> <user>@<host>`
3. Check if staging server is running and accessible

### 2. Git Pull Failed
**Symptom:** Error during `git pull origin main` step.

**Likely Causes:**
- Local modifications on staging server
- Merge conflicts
- Git authentication issues

**Next Actions:**
1. SSH to staging server
2. Check `git status` in `/opt/grc-platform`
3. If dirty: `git checkout . && git clean -fd` (WARNING: discards local changes)
4. Retry deployment

### 3. Docker Compose Build Failed
**Symptom:** Error during `docker compose up -d --build` step.

**Likely Causes:**
- Disk space full
- Docker daemon issues
- Build errors in Dockerfile

**Next Actions:**
1. SSH to staging server
2. Check disk space: `df -h`
3. Clean Docker: `docker system prune -f`
4. Check Docker logs: `docker compose -f docker-compose.staging.yml logs`
5. Retry deployment

### 4. Health Check Timeout
**Symptom:** Backend or frontend health check fails after 30 attempts.

**Likely Causes:**
- Container crashed during startup
- Database connection issues
- Missing environment variables
- Port conflicts

**Next Actions:**
1. SSH to staging server
2. Check container status: `docker ps -a`
3. View backend logs: `docker logs grc-staging-backend --tail 100`
4. Check database: `docker logs grc-staging-db --tail 50`
5. Verify `.env` file has all required variables

### 5. Security Smoke Tests Failed
**Symptom:** One of the security tests returns unexpected HTTP code.

**Likely Causes:**
- Tenant guard not working correctly
- Authentication middleware issue
- Demo admin user not seeded

**Next Actions:**
1. Check which test failed (400/403/200 expected)
2. SSH to staging and check backend logs for the specific endpoint
3. Verify demo admin exists: `docker exec grc-staging-db psql -U grc_staging -d grc_staging -c "SELECT email FROM nest_users;"`
4. Re-run seed script if needed: `docker exec grc-staging-backend node dist/scripts/seed-grc.js`

## Manual Verification After Deployment

After a successful deployment, optionally verify manually:

```bash
# Health check
curl -s http://46.224.99.150:3002/health/live | jq .

# Database health
curl -s http://46.224.99.150:3002/health/db | jq .

# Frontend loads
curl -s -o /dev/null -w "%{http_code}" http://46.224.99.150/
```

## Related Documentation

- `docs/STAGING-DEPLOY-RUNBOOK.md` - Manual deployment steps
- `docs/STAGING-MAINTENANCE-RUNBOOK.md` - Maintenance procedures
- `docs/STAGING-SMOKE-CHECKLIST.md` - Manual UI verification
- `ops/staging-deploy-validate.sh` - Automated validation script (for local use)
