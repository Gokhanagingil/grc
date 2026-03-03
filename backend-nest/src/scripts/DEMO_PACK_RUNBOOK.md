# Demo Seed Pack — Runbook

## Overview

The Demo Seed Pack creates **idempotent**, **tenant-safe** demo data for STAGING/demo usage. It includes:

- **Core platform**: 1 demo tenant, 1 demo company (DEMO-CUST), 20 end users, 20 technicians, 5 assignment group names.
- **Two end-to-end demo scenarios** with narrative quality for live demos and UI walkthroughs.

### Scenario 1: "Database connection pool exhaustion during peak hours"

| Record type | Identifier | Notes |
|-------------|------------|--------|
| Change | `DEMO-SC1-CHG-001` | DB pool config; state REVIEW |
| Incidents | `DEMO-SC1-INC-001`, `-002`, `-003` | Same service, SRE - Core Platform |
| Major Incident | `DEMO-SC1-MI-001` | Timeline updates + comms draft |
| Problem | `DEMO-SC1-PRB-001` | RCA, 5-whys, root cause category |
| Known Error | (title: pool exhaustion workaround) | PUBLISHED, workaround |
| Risk | `DEMO-SC1-RISK-001` | Service instability – capacity guardrails |
| Issue | `DEMO-SC1-ISS-001` | Missing pool saturation alert |
| CAPA | (id in checklist) | 3 tasks; **one overdue** (Load test and update runbook) |
| Service | `DEMO-Core-Platform-API` | CmdbService for incidents |

### Scenario 2: "Emergency security patch during freeze window"

| Record type | Identifier | Notes |
|-------------|------------|--------|
| Change | `DEMO-SC2-CHG-001` | Emergency, HIGH risk, during freeze |
| Incident | `DEMO-SC2-INC-001` | Active exploitation attempt – motivated change |
| Audit | `DEMO-SC2-AUD-001` | Scope touches CTL-006 / requirement |
| Risk | `DEMO-SC2-RISK-001` | Unpatched critical vuln; follow-up review |
| Evidence | Draft (not linked to control) | CTL-006 evidence expected – missing for alerts |

## Prerequisites

Run these first (in order):

```bash
cd backend-nest

# 1. Tenant, admin, controls, requirements, policies, etc.
npm run seed:grc:dev

# 2. Standards (for SOA if you run full demo pack later)
npm run seed:standards:dev

# 3. Core companies (or ensure one exists; demo pack creates DEMO-CUST if missing)
npm run seed:core-companies:dev
```

## How to run

### Development (ts-node)

```bash
cd backend-nest
npm run seed:demo:pack:dev
```

### After build

```bash
cd backend-nest
npm run build
npm run seed:demo:pack
```

## What it creates (expected counts)

- **Tenant**: 1 (reused or created)
- **Company**: 1 (code `DEMO-CUST`)
- **Users**: 40 (20 end users + 20 technicians)
- **Scenario 1**: 1 template, 1 change, 3 incidents, 1 MI, MI updates + links, 1 problem, problem–incident links, problem–change link, 1 known error, 1 risk, risk–control link, 1 issue, 1 CAPA, 3 CAPA tasks, 1 service
- **Scenario 2**: 1 emergency change, 1 incident, 1 draft evidence (evidence gap), 1 audit, 1 audit requirement, 1 risk, risk–control link

## Idempotency

The seed uses **deterministic IDs** and **natural keys** (e.g. change number, incident number, risk code). Running it twice must **not** create duplicates; the second run reuses existing records.

## Validation output

At the end of the run, the script prints:

1. **Validation summary**: tenant ID, demo company code, created/reused stats.
2. **Scenario checklist**: IDs and codes for every record in Scenario 1 and Scenario 2 so you can open them in the UI and run the demo flow.

Example:

```
--- SCENARIO CHECKLIST (use these in UI for demos) ---

SCENARIO 1: "Database connection pool exhaustion during peak hours"
  Change:        number = DEMO-SC1-CHG-001  (id: d1000001-...)
  Incidents:     DEMO-SC1-INC-001, DEMO-SC1-INC-002, DEMO-SC1-INC-003
  ...
SCENARIO 2: "Emergency security patch during freeze window"
  Change:        number = DEMO-SC2-CHG-001  (id: d2000002-...)
  ...
```

## Tenant and safety

All records are created under a single demo tenant:

- **Tenant ID**: `00000000-0000-0000-0000-000000000001`
- **Admin**: `admin@grc-platform.local` (from seed:grc)
- **Demo company code**: `DEMO-CUST`

No real PII: user emails are `user01@demo.local`, `tech01@demo.local`, etc.
