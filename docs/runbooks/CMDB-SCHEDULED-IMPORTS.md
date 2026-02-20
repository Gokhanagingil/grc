# CMDB Scheduled Imports + Connector Framework + Health Rules

## Overview

This runbook covers the three-phase CMDB quality infrastructure:

- **Phase A**: Scheduler + Job Orchestration (PR #401)
- **Phase B**: Connector Framework with safe transforms (PR #402)
- **Phase C**: Health Rules + Quality Score (this PR)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Import Source    │────▶│ Import Mapping    │────▶│ Connector           │
│ (schedule, cron) │     │ (fieldMap, keys)  │     │ (JSON/CSV/HTTP)     │
└────────┬────────┘     └──────────────────┘     └─────────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Scheduler       │────▶│ Import Job        │────▶│ Reconcile Engine    │
│ (every 60s tick) │     │ (dryRun, status)  │     │ (match, diff, apply)│
└─────────────────┘     └──────────────────┘     └─────────────────────┘

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Health Rule     │────▶│ Health Finding    │────▶│ Quality Snapshot    │
│ (condition JSON) │     │ (open/waived)     │     │ (score, breakdown)  │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

## Phase A: Scheduler + Job Orchestration

### Tables Modified
- `cmdb_import_source`: Added `schedule_enabled`, `cron_expr`, `timezone`, `max_runs_per_day`, `dry_run_by_default`, `last_run_at`, `next_run_at`, `run_count_today`, `run_count_reset_date`

### Key Endpoints
| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/grc/cmdb/import-sources/:id/runs` | CMDB_IMPORT_READ | Run history |
| POST | `/grc/cmdb/import-sources/:id/run-now` | CMDB_IMPORT_WRITE | Trigger manual run |

### Scheduler Behavior
- Ticks every 60 seconds
- Scans for sources where `schedule_enabled = true` and `next_run_at <= now()`
- Creates import job with tenant-level locking (no concurrent runs per source)
- Respects `max_runs_per_day` limit
- Emits events: `import.job.started`, `import.job.finished`, `import.job.failed`

## Phase B: Connector Framework

### New Tables
- `cmdb_import_mapping`: Maps source fields to target CI fields with transforms

### Connector Types
| Type | Description |
|------|-------------|
| JSON_ROWS | Inline JSON array (pass-through) |
| CSV | CSV parsing with headers, delimiters, quoted fields |
| HTTP_PULL | Fetch from external URL (SSRF-hardened) |

### Safe Transforms (Allowlist)
`trim`, `lower`, `upper`, `parseInt`, `parseFloat`, `date`, `boolean`, `toString`, `default`

No `eval`, no arbitrary code execution.

### Key Endpoints
| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/grc/cmdb/import-mappings` | CMDB_IMPORT_READ | List mappings |
| POST | `/grc/cmdb/import-mappings` | CMDB_IMPORT_WRITE | Create mapping |
| PATCH | `/grc/cmdb/import-mappings/:id` | CMDB_IMPORT_WRITE | Update mapping |
| DELETE | `/grc/cmdb/import-mappings/:id` | CMDB_IMPORT_WRITE | Soft-delete |

## Phase C: Health Rules + Quality Score

### New Tables
- `cmdb_health_rule`: Rule definitions with severity and condition JSON
- `cmdb_health_finding`: Per-CI findings (open/waived/resolved)
- `cmdb_quality_snapshot`: Point-in-time quality score with breakdown

### Built-in Rule Types
| Type | Description |
|------|-------------|
| MISSING_OWNER | CI has no owner or manager assigned |
| STALE_CI | CI not updated in N days (configurable) |
| NO_RELATIONSHIPS | CI has zero relationships |
| MISSING_DESCRIPTION | CI has no description |
| MISSING_CLASS | CI has no class assigned |
| SERVICE_NO_OFFERING | Service CI has no service offerings |
| CUSTOM | Placeholder for future custom rules |

### Key Endpoints
| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/grc/cmdb/health-rules` | CMDB_HEALTH_READ | List rules |
| POST | `/grc/cmdb/health-rules` | CMDB_HEALTH_WRITE | Create rule |
| PATCH | `/grc/cmdb/health-rules/:id` | CMDB_HEALTH_WRITE | Update rule |
| DELETE | `/grc/cmdb/health-rules/:id` | CMDB_HEALTH_WRITE | Soft-delete |
| GET | `/grc/cmdb/health-findings` | CMDB_HEALTH_READ | List findings |
| POST | `/grc/cmdb/health-findings/:id/waive` | CMDB_HEALTH_WRITE | Waive finding |
| GET | `/grc/cmdb/quality` | CMDB_HEALTH_READ | Latest snapshot |
| GET | `/grc/cmdb/quality/history` | CMDB_HEALTH_READ | Snapshot history |
| POST | `/grc/cmdb/quality/evaluate` | CMDB_HEALTH_WRITE | Trigger evaluation |

### Evaluation Flow
1. Load all enabled health rules for the tenant
2. Load all active (non-deleted) CIs
3. For each rule, evaluate condition against all CIs
4. Create new findings or update existing ones (respects waived status)
5. Resolve findings where the condition no longer applies
6. Calculate quality score: `max(0, (1 - openFindings/totalCIs) * 100)`
7. Create quality snapshot with severity and per-rule breakdown
8. Emit events: `health.evaluation.started`, `health.evaluation.finished`

### Waiver Flow
- Admin calls `POST /grc/cmdb/health-findings/:id/waive` with `{ reason: "..." }`
- Finding status changes to WAIVED, records waiver metadata (who, when, reason)
- Waived findings are NOT re-opened during subsequent evaluations
- Waived findings still count in breakdown but not in open count

## Operations

### Running Migrations
```bash
# Dev
npm run migration:run

# Staging/Production
npx typeorm migration:run -d dist/data-source.js
```

### Verifying Migration Status
```bash
npx typeorm migration:show -d dist/data-source.js
```

### Triggering Health Evaluation
```bash
curl -X POST http://localhost:3002/grc/cmdb/quality/evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
```

### Checking Quality Score
```bash
curl http://localhost:3002/grc/cmdb/quality \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
```

## Troubleshooting

### Scheduler Not Running
1. Check if `DISABLE_SCHEDULERS=true` is set (disables in test env)
2. Check import source has `schedule_enabled = true`
3. Check `cron_expr` is valid
4. Check `max_runs_per_day` hasn't been exceeded
5. Check logs for locking errors

### Health Evaluation Returns No Findings
1. Ensure health rules exist and are enabled for the tenant
2. Ensure CIs exist (non-deleted) for the tenant
3. Check rule conditions match CI data (e.g., STALE_CI needs old updatedAt)

### SSRF Errors in HTTP_PULL
The HTTP_PULL connector blocks private/internal networks:
- localhost, 127.0.0.1, ::1, 0.0.0.0
- 10.x.x.x, 172.16-31.x.x, 192.168.x.x
- 169.254.x.x (cloud metadata)
- .local, .internal domains

---

## Acceptance Checklist

### Phase A: Scheduler
- [ ] Migration adds schedule fields to cmdb_import_source (idempotent)
- [ ] Cron parser validates standard cron expressions
- [ ] Scheduler ticks every 60 seconds
- [ ] Scheduler creates import job for due sources
- [ ] Per-tenant+source locking prevents concurrent runs
- [ ] maxRunsPerDay limit is enforced
- [ ] nextRunAt is recalculated after each run
- [ ] Event bus emits import.job.started/finished/failed
- [ ] GET /runs endpoint returns paginated history
- [ ] POST /run-now triggers manual run
- [ ] Scheduler disabled when DISABLE_SCHEDULERS=true

### Phase B: Connector Framework
- [ ] Migration creates cmdb_import_mapping table (idempotent)
- [ ] JSON_ROWS connector passes through inline data
- [ ] CSV connector parses with headers and custom delimiters
- [ ] CSV connector handles quoted fields and escaped quotes
- [ ] HTTP_PULL connector fetches from external URL
- [ ] HTTP_PULL blocks SSRF (private IPs, localhost, metadata)
- [ ] HTTP_PULL validates protocol (http/https only) and method (GET/POST)
- [ ] Safe transforms: trim, lower, upper, parseInt, parseFloat, date, boolean, toString, default
- [ ] Unknown transforms are rejected
- [ ] Field mapping applies source-to-target with transforms
- [ ] CRUD endpoints for import mappings work
- [ ] Transform validation on create and update

### Phase C: Health Rules + Quality Score
- [ ] Migration creates health_rule, health_finding, quality_snapshot tables (idempotent)
- [ ] MISSING_OWNER rule flags CIs without owner or manager
- [ ] STALE_CI rule flags CIs not updated in N days (configurable)
- [ ] NO_RELATIONSHIPS rule flags CIs with zero relationships
- [ ] MISSING_DESCRIPTION rule flags CIs without description
- [ ] MISSING_CLASS rule flags CIs without class
- [ ] SERVICE_NO_OFFERING rule flags services without offerings
- [ ] Evaluation creates/updates findings correctly
- [ ] Waived findings are not re-opened
- [ ] Resolved findings are created when condition no longer applies
- [ ] Quality score calculated correctly (0-100)
- [ ] Quality snapshot includes severity and per-rule breakdown
- [ ] Waive action records user, timestamp, and reason
- [ ] CRUD endpoints for health rules work
- [ ] Findings list with filters (status, rule, CI, severity)
- [ ] Quality endpoint returns latest snapshot
- [ ] History endpoint returns chronological snapshots
- [ ] Evaluate endpoint triggers on-demand evaluation
- [ ] Event bus emits health.evaluation.started/finished

### Cross-cutting
- [ ] All endpoints require x-tenant-id header
- [ ] All endpoints use JwtAuthGuard + TenantGuard + PermissionsGuard
- [ ] Admin-only for write operations (CMDB_HEALTH_WRITE)
- [ ] Readers can view rules, findings, and quality (CMDB_HEALTH_READ)
- [ ] All migrations are idempotent (safe to re-run)
- [ ] No eval() or arbitrary code execution
- [ ] Unit tests pass (scheduler, transforms, evaluator)
- [ ] CI checks green

## Demo Script (1 minute)

1. **Create a health rule**: POST to `/grc/cmdb/health-rules` with `{ name: "Missing Owner", condition: { type: "MISSING_OWNER" }, severity: "HIGH" }`
2. **Trigger evaluation**: POST to `/grc/cmdb/quality/evaluate`
3. **Check quality score**: GET `/grc/cmdb/quality` - shows score and breakdown
4. **View findings**: GET `/grc/cmdb/health-findings?status=OPEN` - shows affected CIs
5. **Waive a finding**: POST `/grc/cmdb/health-findings/:id/waive` with `{ reason: "Known exception" }`
6. **Re-check score**: GET `/grc/cmdb/quality` - score improved (waived finding removed from open count)
