# CI Health Check Runbook

Last updated: 2026-02-16

## Failure Taxonomy

### 1. RC1 Staging Smoke Tests - "No staging URL configured"

**Workflows affected:** `staging-smoke.yml` (api-smoke + playwright-smoke jobs)

**Symptom:** "Resolve Staging URL" step exits with `::error::No staging URL configured.` All downstream steps (Golden Flow, Playwright) are skipped. Artifact uploads report "no files found."

**Evidence:**
- [Run 22065027058](https://github.com/Gokhanagingil/grc/actions/runs/22065027058)
- [Run 22065560376](https://github.com/Gokhanagingil/grc/actions/runs/22065560376)

**Root cause:** None of the five staging URL sources were configured:
1. `github.event.inputs.staging_url` (empty - triggered by `workflow_run`, not `workflow_dispatch`)
2. `github.event.inputs.staging_base_url` (empty - same reason)
3. `vars.STAGING_BASE_URL` (not set in repo variables)
4. `secrets.STAGING_BASE_URL` (not set)
5. `secrets.STAGING_URL` (not set)

**Fix:**
- Set a **repository variable** (not secret) `STAGING_BASE_URL` = `http://46.224.99.150`
- Location: Settings > Secrets and variables > Actions > **Variables** tab
- The workflow now checks `vars.STAGING_BASE_URL` before secrets (preferred for non-secret public URLs)
- Added preflight health check (curl frontend root + `/health/live`)
- Added diagnostic artifact generation even when URL resolution fails

---

### 2. E2E Smoke Tests / Backend CI - npm ERESOLVE peer dependency conflict

**Workflows affected:** `e2e-smoke.yml`, `backend-nest-ci.yml` (all 7 jobs), `backend-ci.yml`

**Symptom:** `npm ci` fails with:
```
npm error ERESOLVE could not resolve
npm error While resolving: @swc/cli@0.8.0
npm error Found: @swc/cli@0.8.0
npm error   peer @swc/cli@"^0.1.62 || ^0.3.0 || ^0.4.0 || ^0.5.0 || ^0.6.0 || ^0.7.0" from @nestjs/cli@11.0.16
```

**Evidence:**
- [Run 22064748098](https://github.com/Gokhanagingil/grc/actions/runs/22064748098) (E2E Smoke)

**Root cause:** `@nestjs/cli@11.0.16` declares a `peerDependenciesMeta` optional range for `@swc/cli` that does not include `^0.8.0`. `npm ci` with strict peer resolution rejects the install.

**Fix:** Added `--legacy-peer-deps` to all `npm ci` commands in:
- `.github/workflows/e2e-smoke.yml`
- `.github/workflows/backend-nest-ci.yml` (7 occurrences)
- `.github/workflows/backend-ci.yml`

This is consistent with the frontend CI which already uses `--legacy-peer-deps`.

---

### 3. Platform Validate Dist - Docker build fails at npm ci

**Workflows affected:** `platform-validate-dist.yml` (via `backend-nest/Dockerfile`)

**Symptom:** Docker build step fails because `RUN npm ci` inside `Dockerfile` hits the same ERESOLVE error.

**Evidence:**
- [Run 22064748095](https://github.com/Gokhanagingil/grc/actions/runs/22064748095)

**Root cause:** Same as #2 above.

**Fix:** Changed `backend-nest/Dockerfile` line 29 from `RUN npm ci` to `RUN npm ci --legacy-peer-deps`.

---

## Required Repository Configuration

### Variables (Settings > Secrets and variables > Actions > Variables)

| Variable | Example Value | Purpose |
|----------|--------------|---------|
| `STAGING_BASE_URL` | `http://46.224.99.150` | Staging server URL for smoke tests |

### Secrets (Settings > Secrets and variables > Actions > Secrets)

| Secret | Purpose |
|--------|---------|
| `DEMO_ADMIN_EMAIL` | Admin email for staging login tests |
| `DEMO_ADMIN_PASSWORD` | Admin password for staging login tests |
| `DEMO_TENANT_ID` | Tenant ID for staging API tests (default: `00000000-0000-0000-0000-000000000001`) |
| `STAGING_SSH_HOST` | SSH host for deploy-staging |
| `STAGING_SSH_USER` | SSH user for deploy-staging |
| `STAGING_SSH_KEY_B64` | Base64-encoded SSH private key |

### How to set STAGING_BASE_URL

1. Go to https://github.com/Gokhanagingil/grc/settings/variables/actions
2. Click "New repository variable"
3. Name: `STAGING_BASE_URL`
4. Value: `http://46.224.99.150`
5. Click "Add variable"

---

## Verification Steps

After merging fixes, verify:

1. **Backend Nest CI** passes all jobs (lint, build, unit-tests, e2e-tests, docker-build)
2. **E2E Smoke** passes (npm ci succeeds, database bootstraps, smoke tests run)
3. **Platform Validate Dist** passes (Docker build completes)
4. **RC1 Staging Smoke Tests** - set `vars.STAGING_BASE_URL` first, then trigger manually or via deploy-staging

To manually trigger staging smoke tests:
```
Actions > RC1 Staging Smoke Tests > Run workflow
```

---

## Staging URL Resolution Priority

The `staging-smoke.yml` workflow resolves the staging URL in this order:

1. `github.event.inputs.staging_url` (workflow_dispatch only)
2. `github.event.inputs.staging_base_url` (workflow_dispatch only)
3. `vars.STAGING_BASE_URL` (preferred for public URLs)
4. `secrets.STAGING_BASE_URL`
5. `secrets.STAGING_URL` (legacy)

If none are set, the workflow fails with an actionable error message and writes a diagnostic artifact.
