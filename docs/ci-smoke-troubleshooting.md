# CI Smoke Troubleshooting — Seed & Scenario Pack Reliability

> Runbook for interpreting and troubleshooting `Scenario Pack Smoke @real @smoke`
> workflow results, cancellations, and seed script behavior.

## Quick Reference

| Signal | Meaning | Action |
|--------|---------|--------|
| Job status: **success** | All seeds ran, all tests passed | None |
| Job status: **failure** | A seed or test step failed | Check step logs for the failing step |
| Job status: **cancelled** | Run was canceled externally or timed out | See classification below |
| Step exit code **2** | Seed script's internal safety timeout fired | Investigate hung DB query or slow bootstrap |

---

## 1. How to Interpret Canceled Smoke Runs

### Classification Matrix

| Symptom | Evidence | Root Cause | Operator Action |
|---------|----------|------------|-----------------|
| Job canceled, newer run exists on same branch | GitHub shows "superseded" or another run in progress | **Expected concurrency cancellation** — `cancel-in-progress: true` canceled the older run when a new commit was pushed | **Ignore.** This is by design. Check the newer run. |
| Job canceled at exactly 15 min | Job duration = timeout-minutes | **Job timeout** — seed chain + tests exceeded the 15-minute budget | Investigate which seed step was slow (check timing summary). Consider running full smoke as nightly/manual. |
| Seed step canceled at exactly 3 min | Seed step duration ~= 3 min | **Step timeout** — individual seed step hung or ran too slowly | Check seed script logs for slow bootstrap or N+1 queries. Check DB connection health. |
| Seed logs show "FATAL: Safety timeout" | Script-level log with exit code 2 | **Safety timeout** — the seed script's internal 2-min guard fired because `app.close()` didn't complete | Likely open handles in NestJS. Check if new modules added timers/intervals without `.unref()`. |
| Seed logs show "Shutting down jobs service" then cancellation | JobsService shutdown log appears | **Normal shutdown** — this is expected behavior when `app.close()` is called. Not an error. | **Ignore.** The "Shutting down" message is informational. |
| Job fails before seeds start | Migration or build step fails | **Infrastructure/build failure** — not related to seeds | Fix the build/migration issue. |

### How Concurrency Cancellation Works

The workflow uses:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

This means:
- **Same PR branch**: A new push cancels any in-progress run for that branch
- **Different PR branches**: Runs are independent (different groups)
- **Main branch**: Pushes to main cancel previous main runs

This is **intentional** to save CI minutes and always run against the latest code.

---

## 2. Seed Command Timing Expectations

All seed scripts log timing in the format `[SEED-xxx] Duration: NNNms (N.Ns)`.

| Seed Script | Expected Duration (CI) | Notes |
|-------------|----------------------|-------|
| `seed-grc.js` | 15-45s | Bootstraps NestJS + seeds tenant, admin, GRC data. First run is slower (creates records). |
| `seed-cmdb-baseline.js` | 10-30s | CI classes, choices, sample CIs, relationships. Small dataset. |
| `seed-itsm-baseline.js` | 15-40s | Workflows, business rules, SLAs, UI policies. Medium dataset. |
| `seed-scenario-pack.js` | 15-45s | Scenario CIs, incidents, changes, problems. Depends on previous seeds. |
| **Total seed chain** | **60-160s** | Depends on CI runner speed and whether data already exists (idempotent). |

Each script bootstraps a full NestJS `ApplicationContext`. Bootstrap itself takes 5-15s depending on CI runner.

---

## 3. How to Run Smoke Tests Locally

```bash
# 1. Start PostgreSQL (docker example)
docker run -d --name grc-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=grc_platform \
  postgres:15-alpine

# 2. Build and migrate
cd backend-nest
npm ci && npm run build
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=grc_platform \
  npx typeorm migration:run -d dist/data-source.js

# 3. Run seed chain
export DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=grc_platform
export JOBS_ENABLED=false
export DEMO_ADMIN_EMAIL=admin@grc-platform.local
export DEMO_ADMIN_PASSWORD=TestPassword123!
export JWT_SECRET=$(openssl rand -hex 32)
export REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)
export REFRESH_TOKEN_EXPIRES_IN=7d

node dist/scripts/seed-grc.js
node dist/scripts/seed-cmdb-baseline.js
node dist/scripts/seed-itsm-baseline.js
node dist/scripts/seed-scenario-pack.js

# 4. Start backend
PORT=3002 npm run start:dev &
sleep 15

# 5. Run Playwright smoke
cd ..
npx playwright test --project=scenario-pack
```

---

## 4. CI Environment Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `JOBS_ENABLED=false` | `true` | Disables background job scheduling in NestJS. Set by seed scripts automatically and in the workflow env. |
| `SEED_TIMEOUT_MS=120000` | `120000` | Safety timeout (ms) inside each seed script. If the script hasn't completed by this time, it force-exits with code 2. |
| `NODE_ENV=development` | - | Used for seed steps so TypeORM resolves entities correctly. |
| `NODE_ENV=test` | - | Used for the running backend to suppress verbose logs. |

---

## 5. Troubleshooting Matrix

### Seed Hangs (never exits)

**Symptoms**: Seed step runs until step timeout (3 min) or job timeout (15 min).

**Diagnosis**:
1. Check if safety timeout fired (exit code 2, "FATAL: Safety timeout" in logs)
2. Look for the last log line — which phase was it stuck in?
3. Check if a new NestJS module introduces timers/intervals without `.unref()`

**Fix**:
- Ensure all timers/intervals in modules use `.unref()` or are cleaned up in `onModuleDestroy`
- The `JOBS_ENABLED=false` flag prevents job scheduler from running
- The safety timeout (`SEED_TIMEOUT_MS`) provides a hard limit

### Job Canceled After Seed

**Symptoms**: Seeds complete (logs show "Seed Complete"), but job shows canceled.

**Diagnosis**:
1. Check if a newer run exists on the same branch — this is concurrency cancellation
2. Check total job duration — if near 15 min, it's a job timeout
3. If seed logged "complete" but process didn't exit, check for open handles

**Fix**:
- All seed scripts now call `process.exit()` explicitly after `app.close()`
- Safety timeout provides backstop for hanging `app.close()`

### Open Handles

**Symptoms**: Node.js process doesn't exit after `app.close()`. May see Jest-style "open handle" warnings.

**Diagnosis**: Something in the NestJS module tree created a timer, interval, or connection that wasn't cleaned up.

**Fix**:
- `JOBS_ENABLED=false` disables job scheduler
- `interval.unref()` is used in `JobsService.scheduleJob` so intervals don't keep the loop alive
- Seed scripts have explicit `process.exit()` as final backstop

### DB Readiness Issues

**Symptoms**: Seed fails with connection errors or migration failures.

**Diagnosis**:
1. Check the PostgreSQL service container health checks
2. Check if migrations ran successfully
3. Check if a previous seed left DB in a bad state

**Fix**:
- The workflow uses health checks on the Postgres service container
- Migrations run before seeds
- Seeds are idempotent — re-running is safe

### Long Baseline Seed

**Symptoms**: `seed-cmdb-baseline.js` takes >30s.

**Diagnosis**: Check bootstrap time vs query time in logs.

**Fix**:
- NestJS bootstrap is the main cost (~5-15s). This is unavoidable with full `AppModule`.
- DB operations are small (16 choices, 10 classes, 10 CIs, 8 rels).
- If bootstrap is consistently slow, consider whether new modules are adding unnecessary initialization.

### Runner Resource Starvation

**Symptoms**: All steps are slow, not just seeds. Build takes >3 min.

**Diagnosis**: CI runner may be underpowered or shared.

**Fix**:
- Monitor via timing summary in job summary
- Consider using larger runners for smoke workflows if consistently slow
- The 15-minute timeout provides enough headroom for normal variance

---

## 6. Architecture Notes

### Why Each Seed Script Bootstraps NestJS

Each seed script calls `NestFactory.createApplicationContext(AppModule)` to:
- Get TypeORM DataSource with all entity metadata
- Ensure module initialization (subscribers, listeners) are properly set up
- Use the same DI container as the running application

This is a conscious tradeoff: ~10s bootstrap cost per script vs maintaining a separate lightweight DB-only path that could drift from the real app.

### Why Concurrency Cancellation is Kept

`cancel-in-progress: true` is deliberately enabled because:
1. Smoke runs are expensive (~10-15 min)
2. Running against stale code wastes CI minutes
3. The latest push is always the one that matters for PR validation

The key improvement is **making this visible** — the job summary now explains cancellation categories.

---

## 7. Recommended Operator Actions

| Scenario | Action |
|----------|--------|
| Smoke canceled, newer run passed | Ignore — working as designed |
| Smoke canceled, no newer run | Re-run manually — likely a transient issue or timeout |
| Smoke failed on seed step | Check seed logs, fix the seed issue, push fix |
| Smoke failed on test step | Check test report artifact, fix test or backend issue |
| Smoke consistently slow (>12 min) | Review timing summary, consider splitting into PR-light and nightly-full |
| Safety timeout fired (exit 2) | New module likely introduced open handles — investigate and fix |
