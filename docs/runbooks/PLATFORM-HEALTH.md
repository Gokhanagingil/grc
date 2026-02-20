# Platform Health Smoke Tests

## Overview

The platform-health smoke suite verifies every registered API table (list, create, filter, sort) against both local and staging environments. Results are persisted in the Platform Health Dashboard (Admin > Platform Health).

---

## Running Locally

Prerequisites: backend-nest running on `http://localhost:3002` with Postgres.

```bash
# From repo root
npm ci
npx playwright test --project=smoke

# Override tier and table count
SMOKE_TIER=full MAX_TABLES_PER_RUN=20 npx playwright test --project=smoke
```

Environment variables (all optional for local):

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3002` | Backend API base URL |
| `SMOKE_TIER` | `tier1` | `tier1` (core tables) or `full` (all tiers) |
| `MAX_TABLES_PER_RUN` | `10` | Max tables tested in one run |
| `SMOKE_TEST_EMAIL` | `admin@grc-platform.local` | Login email |
| `SMOKE_TEST_PASSWORD` | `changeme` | Login password |

---

## Running Against Staging

Staging requires three GitHub secrets:

| Secret | Description |
|--------|-------------|
| `E2E_EMAIL` | Staging admin email |
| `E2E_PASSWORD` | Staging admin password |
| `E2E_TENANT_ID` | Staging tenant UUID |

### Via GitHub Actions (workflow_dispatch)

1. Go to **Actions > Platform Health Smoke (PR Gate)**
2. Click **Run workflow**
3. Set `base_url` to the staging URL (e.g. `https://niles-grc.com`)
4. Set `smoke_tier` to `tier1` or `full`
5. The `smoke-staging` job runs only when `base_url` is not `http://localhost:3002` and required secrets are present.

### Locally pointing at staging

```bash
BASE_URL=https://niles-grc.com \
E2E_EMAIL=<email> \
E2E_PASSWORD=<password> \
E2E_TENANT_ID=<uuid> \
npx playwright test --project=smoke
```

If login returns 403, the error message will indicate whether the `x-tenant-id` header or credentials are wrong.

---

## How to Add a New Table

Edit `tests/platform-health/table-registry.ts`:

```ts
{
  name: "my_table",                     // unique identifier
  listEndpoint: "/grc/my-table",        // GET path (no /api prefix)
  listDataKey: "items",                 // key in response body holding the array
  displayField: "name",                 // field used for smoke-record matching
  filters: [{ param: "status", value: "draft" }],
  tier: 1,                              // 1 = runs on every PR, 2 = full suite only

  // Optional create fields (omit or set canCreate:false to skip create tests)
  createEndpoint: "/grc/my-table",
  createPayload: { name: "test", status: "draft" },
  createdIdPath: "id",
  canCreate: true,

  // Mark read-only tables
  readOnly: true,
  canCreate: false,
  skipCreateReason: "No POST endpoint exists",
}
```

### Path rules

- Backend controllers use `@Controller('grc/...')` with **no** `/api` prefix.
- Nginx strips `/api` before proxying, so external calls use `/api/grc/...` but the test suite hits the backend directly at `/grc/...`.

### dataKey rules

| Endpoint type | dataKey |
|---------------|---------|
| LIST-CONTRACT endpoints (UniversalListService) | `"items"` |
| Custom list endpoints (e.g. audit-logs) | Check controller return shape (e.g. `"logs"`) |
| Endpoints returning a bare array | leave `listDataKey` as `""` |

The smoke suite includes a **contract assertion** test for each table that verifies the response actually contains the declared `listDataKey` as an array.

---

## Architecture

### Backend

- **Tables**: `platform_health_runs` and `platform_health_checks`
- **Controller**: `grc/platform-health` (admin-only, requires `ADMIN_SETTINGS_READ` / `ADMIN_SETTINGS_WRITE`)
- **Endpoints**:
  - `GET /grc/platform-health/runs` -- List recent runs (`?suite=TIER1&limit=20`)
  - `GET /grc/platform-health/runs/:id` -- Run detail with all checks
  - `GET /grc/platform-health/badge?suite=TIER1` -- Badge summary (GREEN/AMBER/RED/UNKNOWN)
  - `POST /grc/platform-health/ingest` -- Ingest run results from CI

### Frontend

- **Page**: Admin > Platform Health (`/admin/platform-health`)

### CI Integration

The `platform-health-smoke.yml` workflow:
- **smoke-tier1**: Runs on every PR against a CI-local backend + Postgres.
- **smoke-staging**: Runs via `workflow_dispatch` when `base_url` is set to a remote URL and `E2E_*` secrets exist.

---

## Health Badge Status Logic

| Status | Condition |
|--------|-----------|
| GREEN | All checks passed (0 failures) |
| AMBER | Some failures but pass rate >= 80% |
| RED | Pass rate < 80% |
| UNKNOWN | No runs recorded yet |

---

## Troubleshooting

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Auth failed: 403 Forbidden | Wrong tenant ID or credentials | Verify `x-tenant-id` header and email/password |
| create returns 404 | No POST endpoint for this table | Set `canCreate: false` in table-registry |
| contract_dataKey fails | Controller returns different key | Update `listDataKey` to match actual response shape |
| Badge shows UNKNOWN | No runs ingested yet | Trigger a smoke test or use ingest API |
| 403 on badge/runs | User lacks ADMIN_SETTINGS_READ | Ensure admin role |
| Migration not applied | Tables missing in DB | Run `npx typeorm migration:run -d dist/data-source.js` |

---

## Database Schema

### platform_health_runs

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Run identifier |
| suite | varchar(16) | TIER1, NIGHTLY, or MANUAL |
| status | varchar(16) | RUNNING, PASSED, FAILED, ERROR |
| triggered_by | varchar(64) | Who triggered (ci, manual, e2e-test) |
| total_checks | int | Total number of checks |
| passed_checks | int | Number of passed checks |
| failed_checks | int | Number of failed checks |
| skipped_checks | int | Number of skipped checks |
| duration_ms | int | Total run duration in milliseconds |
| git_sha | varchar(64) | Git commit SHA (nullable) |
| git_ref | varchar(128) | Git branch/tag ref (nullable) |
| started_at | timestamp | When the run started |
| finished_at | timestamp | When the run finished (nullable) |
| created_at | timestamp | Row creation timestamp |

### platform_health_checks

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Check identifier |
| run_id | uuid FK | Reference to platform_health_runs |
| module | varchar(64) | Module name (health, itsm, cmdb, etc.) |
| check_name | varchar(128) | Check name (api-liveness, incidents-list, etc.) |
| status | varchar(16) | PASSED, FAILED, SKIPPED |
| duration_ms | int | Check duration in milliseconds |
| http_status | int | HTTP response status (nullable) |
| error_message | text | Error message if failed (nullable) |
| request_url | text | Request URL (nullable) |
| response_snippet | jsonb | Response body snippet (nullable) |
