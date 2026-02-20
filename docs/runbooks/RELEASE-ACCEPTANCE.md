# Release Acceptance — Platform Health Smoke

## Overview

The **Platform Health Smoke** suite is a metadata-driven API test that verifies
list, create, filter, and sort flows across every core GRC table. It runs at two
levels:

| Level | Scope | Trigger | Budget |
|-------|-------|---------|--------|
| **Tier-1 (PR gate)** | 3 core tables (policies, risks, compliance_requirements) | Every PR to `main` | < 3 min |
| **Full sweep (nightly)** | All 6 tables including organizations, audit_logs, users | Cron 03:00 UTC + manual | < 20 min |

## What It Tests

For each table the suite executes these steps (when supported):

1. **List** — `GET` the list endpoint, assert `200` and valid pagination shape.
2. **Create** — `POST` a minimal record prefixed `__smoke_`, assert `201`.
3. **Verify** — Re-query the list and confirm the new record is present.
4. **Filter** — Apply 1-2 safe filter params (e.g. `status=draft`), assert `200`.
5. **Sort / Paginate** — Request `page=1&limit=5`, validate pagination metadata.

Read-only tables (audit_logs, users) skip the create + verify steps.

## How to Run Locally

```bash
# 1. Start the backend
cd backend && npm start &

# 2. Run Tier-1 only (default)
npx playwright test --project=smoke

# 3. Run full sweep
SMOKE_TIER=full npx playwright test --project=smoke

# 4. Point at a remote environment
BASE_URL=http://staging:3001 npx playwright test --project=smoke
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3001` | API base URL |
| `SMOKE_TIER` | `tier1` | `tier1` or `full` |
| `MAX_TABLES_PER_RUN` | `10` | Cap on tables tested per execution |
| `SMOKE_TEST_USERNAME` | _(auto-register)_ | Pre-existing admin username |
| `SMOKE_TEST_PASSWORD` | _(auto-register)_ | Pre-existing admin password |
| `SMOKE_TEST_EMAIL` | _(auto-register)_ | Pre-existing admin email |

## Adding a Table to the Tier-1 Subset

Edit `tests/platform-health/table-registry.ts`:

1. Add a new entry to the `TIER1_TABLES` array:

```typescript
{
  name: "your_table",
  listEndpoint: "/api/your-module/your-table",
  listDataKey: "items",           // key in the JSON response that holds the array
  createEndpoint: "/api/your-module/your-table",
  createPayload: {
    title: `__smoke_your_table_${Date.now()}`,
    // include all required fields with safe defaults
  },
  createdIdPath: "item.id",       // dot-path to the created record's ID in the response
  displayField: "title",          // field used to identify the record in list
  filters: [
    { param: "status", value: "active" },
  ],
  tier: 1,
}
```

2. If the table is **read-only**, add `readOnly: true` and omit `createEndpoint`/`createPayload`.
3. If the table requires elevated permissions, add `requiresRole: ["admin"]`.
4. Move it from `TIER2_TABLES` to `TIER1_TABLES` (or add fresh).

## Moving a Table to the Denylist

Add the route prefix to the `DENYLIST` array in `table-registry.ts`:

```typescript
export const DENYLIST = ["dashboard", "auth", "your-module"];
```

## Test Report

Every run produces `test-results/platform-health-report.json`:

```json
{
  "timestamp": "2026-02-20T...",
  "summary": { "total": 3, "passed": 3, "failed": 0 },
  "tables": [
    {
      "table": "policies",
      "tier": 1,
      "pass": true,
      "durationMs": 450,
      "steps": [
        { "step": "list", "pass": true, "status": 200 },
        { "step": "create", "pass": true, "status": 201 },
        { "step": "verify_created", "pass": true },
        { "step": "filter_status", "pass": true, "status": 200 },
        { "step": "filter_category", "pass": true, "status": 200 },
        { "step": "sort_page1", "pass": true, "status": 200 }
      ]
    }
  ]
}
```

In CI, this artifact is uploaded and (for nightly runs) a human-readable
summary is written to the GitHub Actions step summary.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| All tests 401 | Auth failed — no admin user | Set `SMOKE_TEST_USERNAME`/`SMOKE_TEST_PASSWORD` or ensure `/api/auth/register` is open |
| Create returns 403 | Test user lacks role | Ensure test user has `admin` or `manager` role |
| Filter returns 500 | Bad filter param | Check the table's supported filter params in the route file |
| Timeout on list | Backend not running | Verify `BASE_URL` and that the backend health endpoint responds |
