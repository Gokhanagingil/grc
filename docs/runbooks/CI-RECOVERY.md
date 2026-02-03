# CI Recovery Runbook

This runbook provides steps to recover from common CI issues, particularly runner acquisition failures and workflow pile-ups.

## Quick Reference

| Issue | Symptom | Recovery Time |
|-------|---------|---------------|
| Runner acquisition failure | "Job was not acquired by Runner" | 2-5 minutes |
| Workflow pile-up | Many queued/pending workflows | 5-10 minutes |
| Stuck workflow | Workflow running for hours | 2-5 minutes |

## Runner Acquisition Failures

### Symptoms

You may see errors like:
- "The job was not acquired by Runner of type hosted even after multiple attempts"
- "Internal server error. Correlation ID: ..."
- Jobs stuck in "Queued" state for extended periods

### Root Causes

1. **GitHub Actions service degradation** - Check [GitHub Status](https://www.githubstatus.com/)
2. **Workflow pile-up** - Too many workflows queued for the same branch
3. **Resource exhaustion** - Repository has hit concurrent job limits

### Recovery Steps

#### Step 1: Check GitHub Status (30 seconds)

Visit [https://www.githubstatus.com/](https://www.githubstatus.com/) to verify GitHub Actions is operational.

#### Step 2: Cancel Older Workflow Runs (2-3 minutes)

1. Go to the repository's **Actions** tab
2. Filter by the affected branch (e.g., `devin/...` or `main`)
3. For each **queued** or **in-progress** run that is older than the latest:
   - Click on the run
   - Click **Cancel workflow** (top right)
4. Keep only the **most recent** run active

#### Step 3: Re-run the Latest Workflow (1 minute)

1. Navigate to the most recent workflow run
2. If it failed or was cancelled, click **Re-run all jobs**
3. If it's still queued, wait 2-3 minutes after cancelling older runs

#### Step 4: Verify Recovery

1. Refresh the Actions page
2. Confirm the workflow has started (shows "In progress" not "Queued")
3. Check that the preflight job completes within 2 minutes

## Workflow Pile-up Prevention

### How Concurrency Controls Work

All workflows in this repository use concurrency controls:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

This means:
- Only one run per workflow per branch at a time
- New commits automatically cancel older pending runs
- No manual intervention needed for normal development

### When Pile-ups Still Occur

Pile-ups can still happen when:
1. Multiple PRs are opened simultaneously
2. Scheduled workflows overlap with push-triggered workflows
3. Manual workflow dispatches are triggered rapidly

### Manual Cleanup Procedure

If you see more than 3 queued workflows for the same branch:

1. **Identify the latest commit** - Note the SHA of the most recent commit
2. **Cancel all but the latest** - Keep only the run for the latest commit
3. **Wait for completion** - Let the remaining run finish before pushing new commits

## Staging Deployment Recovery

The staging deployment workflow has special concurrency settings:

```yaml
concurrency:
  group: deploy-staging
  cancel-in-progress: false  # Never cancel in-progress deploys
```

### If Staging Deploy is Stuck

1. **Do NOT cancel** an in-progress staging deploy - this can leave staging in a broken state
2. SSH to staging server and check container status:
   ```bash
   ssh $STAGING_USER@$STAGING_HOST
   cd /opt/grc-platform
   docker compose -f docker-compose.staging.yml ps
   ```
3. If containers are healthy, the deploy may have succeeded despite workflow timeout
4. If containers are unhealthy, manually restart:
   ```bash
   docker compose -f docker-compose.staging.yml up -d --build
   ```

## Preflight Job

The `backend-nest-ci.yml` workflow includes a preflight job that:
- Runs first with a 2-minute timeout
- Validates runner acquisition before spawning heavy jobs
- Provides clear messaging if runners are unavailable

If the preflight job times out repeatedly:
1. This indicates a GitHub Actions service issue
2. Wait 10-15 minutes and retry
3. If persistent, check GitHub Status for incidents

## Smoke Test Checklist (5 minutes)

After recovering CI, verify staging is healthy:

1. **Health endpoints**
   ```bash
   curl -s https://your-staging-url/api/health/live | jq .
   curl -s https://your-staging-url/api/health/ready | jq .
   ```

2. **Login flow**
   - Navigate to staging URL
   - Log in with demo credentials
   - Verify dashboard loads

3. **Risk module** (if testing PR #341 changes)
   - Navigate to Risk Management
   - Click on a heatmap cell - should filter risks
   - Open a risk, edit, and save - should succeed
   - Check Relations tab for Link Control/Policy buttons

## Contact

If issues persist after following this runbook:
- Check GitHub Status for ongoing incidents
- Review recent commits for potential CI configuration issues
- Escalate to platform team if blocking production deployments
