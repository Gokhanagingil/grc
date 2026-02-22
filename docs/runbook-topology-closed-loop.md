# Topology Intelligence Phase-C: Closed-Loop Orchestration — Runbook

> **Version:** 1.0  
> **Last updated:** 2026-02-22  
> **Covers PRs:** #441 (Phase 1), #442 (Phase 2), #443 (Phase 3), #444 (Phase 4)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Deploy Steps](#deploy-steps)
4. [Migrations & Seeds](#migrations--seeds)
5. [Staging Verification Checklist](#staging-verification-checklist)
6. [Rollback Guidance](#rollback-guidance)
7. [1-Minute Demo Script](#1-minute-demo-script)
8. [Troubleshooting](#troubleshooting)
9. [Permissions & RBAC](#permissions--rbac)
10. [Endpoint Reference](#endpoint-reference)

---

## Overview

Topology Intelligence Phase-C turns topology intelligence from passive insight panels into operational decisions, actions, and audit trails. It delivers four capabilities:

| Phase | Capability | PR |
|-------|-----------|-----|
| 1 | Change Governance Auto-Enforcement (topology-aware) | #441 |
| 2 | MI RCA → Problem / Known Error / PIR Action orchestration | #442 |
| 3 | Topology-aware Operational Tasking + Closed-Loop Traceability | #443 |
| 4 | Tests, Platform Health, Seeds, Runbook | #444 |

**Key design principles:**
- **Fail-open:** Optional topology enrichments never block core record load/save
- **Deterministic:** All decisions are rule-based with explainability (no eval/opaque logic)
- **Tenant-isolated:** All queries scoped by `tenantId`
- **RBAC-enforced:** Standard guard stack (JwtAuthGuard + TenantGuard + PermissionsGuard)

---

## Architecture Summary

```
                  ┌─────────────────────────────────────┐
                  │         Frontend (React)             │
                  │                                      │
                  │  ChangeDetail ──► TopologyGovernance  │
                  │                   DecisionPanel       │
                  │                   SuggestedTaskPack   │
                  │                   TraceabilityChain   │
                  │                                      │
                  │  MIDetail ──► RcaHypothesesTable     │
                  │               OrchestrationDialogs    │
                  │               TraceabilityChain       │
                  └──────────────┬──────────────────────┘
                                 │ /api/grc/...
                                 ▼
                  ┌─────────────────────────────────────┐
                  │     Nginx (strips /api/ prefix)     │
                  └──────────────┬──────────────────────┘
                                 │ /grc/...
                                 ▼
        ┌────────────────────────────────────────────────────┐
        │              Backend (NestJS)                       │
        │                                                    │
        │  TopologyImpactController                          │
        │  ├── GET  .../topology/impact                      │
        │  ├── GET  .../topology/governance                  │
        │  ├── POST .../topology/governance/evaluate         │
        │  ├── POST .../topology/impact/recalculate          │
        │  ├── GET  .../topology/suggested-tasks             │
        │  ├── GET  .../topology/traceability                │
        │  ├── GET  .../topology/rca-hypotheses              │
        │  ├── POST .../topology/rca/create-problem          │
        │  ├── POST .../topology/rca/create-known-error      │
        │  └── POST .../topology/rca/create-pir-action       │
        │                                                    │
        │  Services:                                         │
        │  ├── TopologyGovernanceService                     │
        │  ├── RcaOrchestrationService                       │
        │  ├── SuggestedTaskPackService                      │
        │  └── TraceabilitySummaryService                    │
        └────────────────────────────────────────────────────┘
```

---

## Deploy Steps

### Prerequisites
- Docker Compose staging environment running
- Access to staging server (`ssh` or equivalent)
- Database migrations up to date

### Step-by-step

```bash
# 1. SSH into staging server
ssh staging-server

# 2. Navigate to project directory
cd /opt/grc-platform

# 3. Pull latest images (after merging PRs)
docker compose -f docker-compose.staging.yml pull

# 4. Run migrations (if any new ones)
docker compose -f docker-compose.staging.yml exec backend \
  node dist/node_modules/typeorm/cli.js migration:run -d dist/data-source.js

# 5. Restart services
docker compose -f docker-compose.staging.yml up -d

# 6. Verify health
docker compose -f docker-compose.staging.yml exec backend \
  wget -qO- http://localhost:3002/health/live

# 7. Run seeds (see next section)
```

---

## Migrations & Seeds

### No new migrations required
Phases 1-4 use existing tables and JSON/JSONB columns for topology data. No schema changes needed.

### Seed dependency chain

```
seed:grc                    ← Base tenant + admin user
  └── seed:cmdb:baseline    ← CI classes (application, database, cloud_service)
       └── seed:topology:demo         ← 6 topology CIs + 8 relationships + 1 service
            └── seed:topology:closed-loop  ← Demo change + MI for closed-loop scenario
```

### Running seeds on staging

```bash
# Inside the backend container:
docker compose -f docker-compose.staging.yml exec backend bash

# Run seeds in order (idempotent — safe to re-run):
node dist/scripts/seed-grc.js
node dist/scripts/seed-cmdb-baseline.js
node dist/scripts/seed-topology-demo.js
node dist/scripts/seed-topology-closed-loop-demo.js
```

### Running seeds locally (development)

```bash
cd backend-nest

# Using ts-node:
npx ts-node src/scripts/seed-topology-closed-loop-demo.ts
```

### Seed data summary

| Record | ID | Key Properties |
|--------|-----|----------------|
| Change CHG-TOPO-001 | `cccc0001-0000-0000-0000-000000000001` | High blast radius, 6 CIs, CAB required |
| Risk Assessment | `cccc0001-0000-0000-0000-000000000002` | Score 92, Level HIGH |
| MI MI-TOPO-001 | `cccc0001-0000-0000-0000-000000000003` | SEV1, 3 RCA hypotheses |

---

## Staging Verification Checklist

Run these checks after deploying to staging:

### Health checks

```bash
# Backend liveness
curl -s http://46.224.99.150/api/health/live | jq .

# Backend DB connectivity
curl -s http://46.224.99.150/api/health/db | jq .
```

### Authentication

```bash
# Get token
TOKEN=$(curl -s http://46.224.99.150/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@grc-platform.local","password":"TestPassword123!"}' \
  | jq -r '.data.accessToken // .accessToken // .access_token')

echo "Token: ${TOKEN:0:20}..."
```

### Topology endpoints

```bash
TENANT="00000000-0000-0000-0000-000000000001"
CHANGE_ID="cccc0001-0000-0000-0000-000000000001"
MI_ID="cccc0001-0000-0000-0000-000000000003"

# 1. Topology impact
curl -s "http://46.224.99.150/api/grc/itsm/changes/${CHANGE_ID}/topology/impact" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT}" | jq .status

# 2. Governance decision
curl -s "http://46.224.99.150/api/grc/itsm/changes/${CHANGE_ID}/topology/governance" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT}" | jq .data.decision

# 3. Suggested task pack
curl -s "http://46.224.99.150/api/grc/itsm/changes/${CHANGE_ID}/topology/suggested-tasks" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT}" | jq .data.totalTasks

# 4. Traceability summary (change)
curl -s "http://46.224.99.150/api/grc/itsm/changes/${CHANGE_ID}/topology/traceability" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT}" | jq .data.metrics.completenessScore

# 5. RCA hypotheses
curl -s "http://46.224.99.150/api/grc/itsm/major-incidents/${MI_ID}/topology/rca-hypotheses" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT}" | jq '.data.hypotheses | length'

# 6. MI traceability
curl -s "http://46.224.99.150/api/grc/itsm/major-incidents/${MI_ID}/topology/traceability" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT}" | jq .data.metrics.completenessScore
```

### UI verification

- [ ] Open Change CHG-TOPO-001 detail page
- [ ] Verify "Topology Decision Support" section renders
- [ ] Verify governance decision chip shows (e.g., CAB_REQUIRED)
- [ ] Click "Why?" to see explainability
- [ ] Click "Recalculate" and see loading + result
- [ ] Verify "Suggested Task Pack" card renders with tasks
- [ ] Verify "Traceability" widget renders
- [ ] Open MI MI-TOPO-001 detail page
- [ ] Verify RCA Hypotheses table renders with 3 hypotheses
- [ ] Click "Create Problem" on first hypothesis
- [ ] Verify confirmation dialog with prefilled fields
- [ ] Verify traceability chain widget on MI page

### Smoke test script

```bash
# Run the automated smoke test
docker compose -f docker-compose.staging.yml exec backend \
  npx ts-node src/scripts/smoke-topology-intelligence.ts
```

---

## Rollback Guidance

### Low-risk rollback (recommended)
Since Phase-C adds new endpoints and UI panels without modifying existing ones, rollback is straightforward:

1. **Revert to previous image:** Re-deploy the previous Docker image tag
2. **No migration rollback needed:** No schema changes were made
3. **Seeds are safe to leave:** Demo data won't cause issues with older code
4. **Frontend:** Previous build won't call new endpoints (they simply won't exist)

### If issues arise with specific phases

| Issue | Action |
|-------|--------|
| Governance panel crashes | The panel is fail-open; check browser console for JS errors |
| RCA orchestration creates duplicate records | Check traceability metadata for idempotency guards |
| Topology endpoint returns 500 | Check backend logs; the frontend will show a banner and continue |
| 403 on topology endpoints | Check user permissions (see Permissions section below) |

### Emergency rollback

```bash
cd /opt/grc-platform

# 1. Stop current containers
docker compose -f docker-compose.staging.yml down

# 2. Revert to previous tag
# Edit docker-compose.staging.yml to use previous image tag

# 3. Start previous version
docker compose -f docker-compose.staging.yml up -d

# 4. Verify health
docker compose -f docker-compose.staging.yml exec backend \
  wget -qO- http://localhost:3002/health/live
```

---

## 1-Minute Demo Script

> **Audience:** Stakeholders, product team, auditors  
> **Setup:** Seeds must be run. Log in as demo admin.

### Scene 1: Change Governance (30 seconds)

1. Navigate to **ITSM > Changes**
2. Open **CHG-TOPO-001** ("Upgrade API Gateway TLS certificates")
3. Point out:
   - **Topology Decision Support** panel showing blast radius of 12 nodes
   - **Governance decision:** CAB_REQUIRED with explainability
   - **Fragility signals:** SPOF at API Gateway, no redundancy
4. Expand **"Why?"** to show policy reasoning
5. Show **Suggested Task Pack** with recommended pre-implementation tasks
6. Show **Traceability Chain** linking topology analysis → governance → tasks

### Scene 2: MI RCA Orchestration (30 seconds)

1. Navigate to **ITSM > Major Incidents**
2. Open **MI-TOPO-001** ("Authentication Platform Complete Outage")
3. Point out **RCA Hypotheses** table with 3 hypotheses:
   - Database Failure (85% confidence)
   - Cache Failure (65% confidence)
   - Network Partition (45% confidence)
4. Click **"Create Problem"** on the DB failure hypothesis
5. Show the confirmation dialog with prefilled title, description, and traceability metadata
6. Show **Traceability Chain** linking MI → topology analysis → orchestrated records

### Talking points
- "Every decision is explainable — click 'Why?' to see the reasoning"
- "Topology intelligence is fail-open — if it's unavailable, core workflows continue"
- "Full audit trail from topology analysis through governance to actions"
- "All records preserve traceability metadata back to the original hypothesis"

---

## Troubleshooting

### 403 Forbidden on topology endpoints

**Symptom:** User sees "Access restricted" banner on topology panels.

**Diagnosis:**
```bash
# Check user permissions
curl -s "http://46.224.99.150/api/grc/itsm/changes/${CHANGE_ID}/topology/impact" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT}" -w "\nHTTP: %{http_code}\n"
```

**Fix:**
- Ensure the user's role has the required permissions
- Check that `x-tenant-id` header is set correctly
- Verify the JWT token is valid and not expired
- The frontend handles 403 gracefully (shows banner, no logout)

### 401 Unauthorized

**Symptom:** All API calls return 401.

**Diagnosis:**
- Token may be expired — re-authenticate
- Check `JWT_SECRET` environment variable is set in backend
- Verify `Authorization: Bearer <token>` header format

**Fix:**
```bash
# Re-authenticate
curl -s http://46.224.99.150/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@grc-platform.local","password":"TestPassword123!"}'
```

### Empty topology data

**Symptom:** Topology panels show "No topology data available" or empty states.

**Diagnosis:**
1. Check if CMDB CIs exist:
   ```sql
   SELECT COUNT(*) FROM cmdb_cis 
   WHERE tenant_id = '00000000-0000-0000-0000-000000000001' 
   AND is_deleted = false;
   ```
2. Check if CI relationships exist:
   ```sql
   SELECT COUNT(*) FROM cmdb_ci_rels 
   WHERE tenant_id = '00000000-0000-0000-0000-000000000001' 
   AND is_deleted = false;
   ```
3. Check if the change has a `serviceId` linked to CMDB services

**Fix:**
- Run the topology demo seed: `node dist/scripts/seed-topology-demo.js`
- Run the closed-loop seed: `node dist/scripts/seed-topology-closed-loop-demo.js`
- Verify the change record has `service_id` set

### Seed dependency errors

**Symptom:** Seed script fails with "Demo tenant not found" or "Missing CI classes".

**Fix:** Run seeds in the correct dependency order:
```bash
node dist/scripts/seed-grc.js                        # 1. Base tenant
node dist/scripts/seed-cmdb-baseline.js               # 2. CI classes
node dist/scripts/seed-topology-demo.js               # 3. Topology CIs
node dist/scripts/seed-topology-closed-loop-demo.js   # 4. Closed-loop demo
```

### RCA orchestration creates duplicate records

**Symptom:** Multiple Problem/KE/PIR records created from the same hypothesis.

**Diagnosis:** Check traceability metadata on created records:
```sql
SELECT id, title, metadata 
FROM itsm_problems 
WHERE metadata->>'sourceType' = 'TOPOLOGY_RCA_HYPOTHESIS'
AND tenant_id = '00000000-0000-0000-0000-000000000001';
```

**Mitigation:** The UI shows a confirmation dialog before creating records. Users should check existing records before creating new ones. Future improvement: add server-side duplicate detection.

### Backend container has no src/ directory

**Important:** The production container only has `dist/`. All scripts must use `dist/` paths:
```bash
# Correct (production):
node dist/scripts/seed-topology-closed-loop-demo.js

# Incorrect (will fail in production):
npx ts-node src/scripts/seed-topology-closed-loop-demo.ts
```

---

## Permissions & RBAC

Topology intelligence endpoints use the standard guard stack:
- `JwtAuthGuard` — validates JWT token
- `TenantGuard` — validates `x-tenant-id` header matches token
- `PermissionsGuard` — validates role-based permissions

All topology endpoints require the same permissions as their parent entity:
- Change topology endpoints → change read/write permissions
- MI topology endpoints → major incident read/write permissions
- RCA orchestration (create Problem/KE/PIR) → respective entity write permissions

---

## Endpoint Reference

### Change Topology Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/grc/itsm/changes/:id/topology/impact` | Get topology impact analysis |
| POST | `/grc/itsm/changes/:id/topology/impact/recalculate` | Recalculate topology impact |
| GET | `/grc/itsm/changes/:id/topology/governance` | Get governance decision |
| POST | `/grc/itsm/changes/:id/topology/governance/evaluate` | Re-evaluate governance |
| GET | `/grc/itsm/changes/:id/topology/suggested-tasks` | Get suggested task pack |
| GET | `/grc/itsm/changes/:id/topology/traceability` | Get traceability summary |

### Major Incident Topology Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/grc/itsm/major-incidents/:id/topology/rca-hypotheses` | Get RCA hypotheses |
| POST | `/grc/itsm/major-incidents/:id/topology/rca/create-problem` | Create Problem from hypothesis |
| POST | `/grc/itsm/major-incidents/:id/topology/rca/create-known-error` | Create Known Error from hypothesis |
| POST | `/grc/itsm/major-incidents/:id/topology/rca/create-pir-action` | Create PIR Action from hypothesis |
| GET | `/grc/itsm/major-incidents/:id/topology/traceability` | Get traceability summary |

> **Note:** All endpoints require `Authorization: Bearer <token>` and `x-tenant-id: <uuid>` headers.  
> **Note:** Frontend calls use `/api/grc/...` prefix (Nginx strips `/api/`).
