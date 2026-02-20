# Platform Health Dashboard

## Overview

The Platform Health Dashboard provides visibility into automated smoke test results directly in the admin UI. It persists Tier-1 and nightly smoke test results from CI, and displays them with pass/fail badges, run history, and detailed check-level drill-down.

## Architecture

### Backend

- **Tables**: `platform_health_runs` and `platform_health_checks`
- **Controller**: `grc/platform-health` (admin-only, requires `ADMIN_SETTINGS_READ` / `ADMIN_SETTINGS_WRITE`)
- **Endpoints**:
  - `GET /grc/platform-health/runs` — List recent runs (supports `?suite=TIER1&limit=20`)
  - `GET /grc/platform-health/runs/:id` — Run detail with all checks
  - `GET /grc/platform-health/badge?suite=TIER1` — Health badge summary (GREEN/AMBER/RED/UNKNOWN)
  - `POST /grc/platform-health/ingest` — Ingest run results from CI

### Frontend

- **Page**: Admin > Platform Health (`/admin/platform-health`)
- **Components**:
  - Health badge banner (GREEN/AMBER/RED with pass rate)
  - Summary cards (total, passed, failed, pass rate)
  - Run history table with expandable rows
  - Check-level detail with filters (all/failed/passed)

### CI Integration

The `platform-health-smoke.yml` GitHub Actions workflow can be extended to POST results to the ingest endpoint after smoke tests complete.

## Health Badge Status Logic

| Status | Condition |
|--------|-----------|
| GREEN | All checks passed (0 failures) |
| AMBER | Some failures but pass rate >= 80% |
| RED | Pass rate < 80% |
| UNKNOWN | No runs recorded yet |

## How to Read Failures

1. Navigate to **Admin > Platform Health**
2. Look at the badge banner — GREEN means all checks pass
3. If AMBER or RED, scroll to the Run History table
4. Click a row to expand and see individual checks
5. Use the filter dropdown to show "Failed only"
6. Each failed check shows:
   - Module name (e.g., `itsm`, `cmdb`, `health`)
   - Check name (e.g., `incidents-list`, `db-connectivity`)
   - HTTP status code
   - Error message
   - Request URL

## How to Add Tier-1 Tables

To add a new table to Tier-1 smoke testing:

1. Add the table configuration to `backend-nest/src/scripts/platform-validate.ts`
2. Include the module name and check names in the validation script
3. CI will automatically pick up the new checks on next run
4. Results will appear in the Platform Health dashboard

## Ingest API

### Request

```bash
POST /api/grc/platform-health/ingest
Authorization: Bearer <admin-token>
x-tenant-id: 00000000-0000-0000-0000-000000000001
Content-Type: application/json

{
  "suite": "TIER1",
  "triggeredBy": "ci",
  "gitSha": "abc1234def5678",
  "gitRef": "refs/heads/main",
  "startedAt": "2025-01-15T10:00:00Z",
  "finishedAt": "2025-01-15T10:01:30Z",
  "durationMs": 90000,
  "checks": [
    {
      "module": "health",
      "checkName": "api-liveness",
      "status": "PASSED",
      "durationMs": 50,
      "httpStatus": 200,
      "requestUrl": "/health/live"
    },
    {
      "module": "itsm",
      "checkName": "incidents-list",
      "status": "FAILED",
      "durationMs": 3000,
      "httpStatus": 500,
      "errorMessage": "Internal server error",
      "requestUrl": "/grc/itsm/incidents"
    }
  ]
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "suite": "TIER1",
    "status": "FAILED",
    "totalChecks": 2,
    "passedChecks": 1,
    "failedChecks": 1,
    "durationMs": 90000
  }
}
```

## Staging Verification

```bash
# Check badge status
wget -qO- --header='Authorization: Bearer <TOKEN>' \
  --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  http://localhost:3002/grc/platform-health/badge?suite=TIER1

# List recent runs
wget -qO- --header='Authorization: Bearer <TOKEN>' \
  --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  http://localhost:3002/grc/platform-health/runs?limit=5

# Ingest a test run
wget -qO- --post-data='{"suite":"MANUAL","triggeredBy":"manual-test","startedAt":"2025-01-15T10:00:00Z","finishedAt":"2025-01-15T10:00:05Z","durationMs":5000,"checks":[{"module":"test","checkName":"ping","status":"PASSED","durationMs":100}]}' \
  --header='Authorization: Bearer <TOKEN>' \
  --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  --header='Content-Type: application/json' \
  http://localhost:3002/grc/platform-health/ingest
```

## Troubleshooting

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Badge shows UNKNOWN | No runs ingested yet | Trigger a Tier-1 smoke test in CI or use the ingest API manually |
| 403 on badge/runs endpoint | User lacks ADMIN_SETTINGS_READ permission | Ensure user has admin role |
| Ingest returns 400 | Missing required fields in payload | Check that `suite`, `startedAt`, `finishedAt`, `durationMs`, and `checks` array are present |
| Empty checks in detail view | Checks were not included in ingest payload | Ensure `checks` array has at least one entry |
| Migration not applied | New tables don't exist in database | Run `npx typeorm migration:run -d dist/data-source.js` in backend container |

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
