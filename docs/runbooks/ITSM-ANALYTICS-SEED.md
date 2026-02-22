# ITSM Analytics Demo Seed Runbook

## Overview

The `seed-itsm-analytics-demo` script creates a deterministic dataset for the ITSM Closed-Loop Analytics Dashboard. It populates the demo tenant with problems, known errors, major incidents, PIRs, PIR actions, and knowledge candidates so all 7 dashboard tabs show non-zero KPIs.

## Seed Dependency Chain

Run seeds in this order:

```
1. seed:grc           — creates demo tenant + admin user
2. seed:itsm-baseline — creates ITSM base entities (optional, for full ITSM)
3. seed:itsm-analytics-demo — creates analytics demo data (this script)
```

## What Gets Created

| Entity              | Count | States/Statuses                                    |
|---------------------|-------|---------------------------------------------------|
| Problems            | 5     | NEW, UNDER_INVESTIGATION, KNOWN_ERROR, RESOLVED, CLOSED |
| Known Errors        | 2     | PUBLISHED, DRAFT                                   |
| Major Incidents     | 2     | CLOSED (SEV1), RESOLVED (SEV2)                    |
| PIRs                | 1     | APPROVED                                           |
| PIR Actions         | 3     | COMPLETED, IN_PROGRESS, OVERDUE                   |
| Knowledge Candidates| 2     | PUBLISHED, DRAFT                                   |

All entities use **deterministic UUIDs** — the script is idempotent and safe to run repeatedly (no duplicates).

## Running Locally (dev)

```bash
cd backend-nest
npm run seed:itsm-analytics-demo:dev
```

## Running in Staging (Docker)

```bash
# SSH into staging server
ssh staging

# Build and run
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-itsm-analytics-demo.js
```

## Running in Production (compiled)

```bash
cd backend-nest
npm run build
npm run seed:itsm-analytics-demo
```

## Verification Checklist

After running the seed, verify the dashboard shows data:

1. **Executive Summary tab** — Open Problems > 0, Major Incidents > 0, KPIs populated
2. **Problem Trends tab** — State distribution donut shows 5 states, aging buckets populated
3. **Major Incidents tab** — Total = 2, MTTR and bridge duration show values
4. **PIR Effectiveness tab** — Total PIRs = 1, action completion rate > 0%
5. **Known Errors tab** — Total KEs = 2, publication rate = 50%
6. **Closure tab** — Reopen rate > 0%, closure trend has data points
7. **Backlog tab** — Open problems by priority shows entries, overdue actions > 0

## Tenant Scoping

- **Tenant ID**: `00000000-0000-0000-0000-000000000001`
- **Admin ID**: `00000000-0000-0000-0000-000000000002`

All entities are scoped to the demo tenant. Other tenants see no data from this seed.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Demo tenant not found" | Missing prerequisite seed | Run `npm run seed:grc:dev` first |
| Dashboard shows zeros | Seed didn't run or wrong tenant | Check x-tenant-id header matches demo tenant |
| Duplicate key errors | UUID collision (unlikely) | Script uses deterministic IDs — safe to re-run |
