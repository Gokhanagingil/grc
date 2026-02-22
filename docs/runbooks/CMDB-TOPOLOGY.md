# CMDB Topology Visualization — Runbook & Acceptance Checklist

Covers the CMDB Topology Graph Foundation (PRs #436, #437, #438) — backend API, frontend viewer, tests, and seed data.

## Overview

The topology feature adds graph visualization of CMDB CI/Service relationships, providing foundation for:
- **Change Risk Assessment** — blast radius visualization
- **Major Incident RCA** — root cause propagation analysis

### Architecture

```
Frontend (React Flow)          Backend (NestJS)              Database (PostgreSQL)
┌──────────────────┐    GET   ┌───────────────────┐         ┌──────────────────┐
│ TopologyPanel    │ ──────── │ TopologyController │ ─────── │ cmdb_ci          │
│ TopologyGraph    │  /api/   │ TopologyService    │  BFS    │ cmdb_ci_rel      │
│ (React Flow)     │  grc/    │ (BFS traversal)    │ query   │ cmdb_service     │
│                  │  cmdb/   │                    │         │ cmdb_service_ci  │
│  Pan/Zoom/Legend │  topo..  │  Cycle detection   │         │ service_offering │
│  Filters/Depth   │         │  Node/Edge caps    │         └──────────────────┘
│  Node Detail     │         │  Tenant isolation  │
└──────────────────┘         └───────────────────┘
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/grc/cmdb/topology/ci/:ciId` | Topology graph centered on a CI |
| GET | `/grc/cmdb/topology/service/:serviceId` | Topology graph centered on a Service |

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `depth` | int | 1 | Traversal depth (1-3) |
| `relationTypes` | string | all | Comma-separated filter (e.g. `depends_on,runs_on`) |
| `includeOrphans` | bool | false | Include disconnected nodes |
| `direction` | enum | both | `both`, `upstream`, `downstream` |

### Response Contract

```json
{
  "nodes": [
    {
      "id": "uuid",
      "type": "ci | service | service_offering",
      "label": "PROD-WEB-01",
      "className": "server",
      "status": "active",
      "environment": "production",
      "ipAddress": "10.0.1.10"
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "source": "uuid",
      "target": "uuid",
      "relationType": "depends_on",
      "direction": "downstream",
      "inferred": false
    }
  ],
  "meta": {
    "rootNodeId": "uuid",
    "depth": 1,
    "nodeCount": 5,
    "edgeCount": 4,
    "truncated": false,
    "warnings": []
  },
  "annotations": {
    "highlightedNodeIds": [],
    "highlightedEdgeIds": [],
    "badgesByNodeId": {}
  }
}
```

### Performance Guardrails

| Guardrail | Limit | Behavior |
|-----------|-------|----------|
| Max depth | 3 | 400 if exceeded |
| Node cap | 200 | Truncated + warning |
| Edge cap | 500 | Truncated + warning |
| Cycle detection | BFS visited set | Prevents infinite loops |
| Duplicate edge | De-duplication | Silent removal |

---

## Prerequisites

- CMDB baseline seed has been run (`seed-cmdb-baseline`)
- Service-CI mapping seed has been run (`seed-service-ci-mapping`)
- Topology demo seed has been run (`seed-topology-demo`)
- PRs #436 (backend) and #437 (frontend) are merged

## 1. Seed Data Setup

### Run topology demo seed (idempotent)

```bash
# Local development
cd backend-nest
npx ts-node src/scripts/seed-topology-demo.ts

# Staging (inside container)
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'node dist/scripts/seed-topology-demo.js'
```

**Expected output:**
```
============================================================
CMDB Topology Demo Seed
============================================================

1. Verifying demo tenant...
   Demo tenant: Demo Tenant
2. Resolving CI classes...
   Resolved N CI classes
3. Seeding topology demo CIs (6)...
   CIs: 6 created, 0 skipped
4. Seeding topology CI relationships (8)...
   Relationships: 8 created, 0 skipped
5. Seeding topology demo Service (1)...
   + Created Service: TOPO-Auth-Platform
6. Linking service to CIs...
   Service-CI links: 4 created, 0 skipped
```

On re-run, all entries should show `0 created, N skipped` (idempotent).

### Seed dependency chain

```
seed:grc → seed:cmdb:baseline → seed:service-ci-mapping → seed-topology-demo
```

### Seeded topology graph

```
                    ┌──────────┐
                    │ TOPO-MON │ (Monitoring)
                    └────┬─────┘
              connects_to │ │ connects_to │ connects_to
         ┌────────────────┘ │             │
         ▼                  ▼             ▼
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │ TOPO-API-GW  │──▶│TOPO-AUTH-SVC │   │ TOPO-USER-DB │
  │ (API Gateway)│   │(Auth Service)│──▶│  (User DB)   │
  └──────┬───────┘   └──────┬───────┘   └──────────────┘
         │                  │
  connects_to          depends_on
         │                  │
         ▼                  ▼
  ┌──────────────┐   ┌──────────────┐
  │  TOPO-MQ     │──▶│ TOPO-CACHE   │
  │(Message Queue)   │  (Redis)     │
  └──────────────┘   └──────────────┘

  Service: TOPO-Auth-Platform
    └─depends_on→ TOPO-API-GW
    └─depends_on→ TOPO-AUTH-SVC
    └─hosted_on→  TOPO-USER-DB
    └─depends_on→ TOPO-CACHE
```

## 2. API Verification

### Authenticate and get token

```bash
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"email":"admin@grc.local","password":"Admin123!"}' \
  | jq -r '.data.accessToken // .accessToken')
echo "Token: ${TOKEN:0:20}..."
```

### Test topology for CI

```bash
# Topology for API Gateway CI (depth=1)
curl -s http://localhost:3002/grc/cmdb/topology/ci/bbbb0001-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .

# Topology with depth=2
curl -s "http://localhost:3002/grc/cmdb/topology/ci/bbbb0001-0000-0000-0000-000000000001?depth=2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq '.meta'

# Topology with relation filter
curl -s "http://localhost:3002/grc/cmdb/topology/ci/bbbb0001-0000-0000-0000-000000000001?relationTypes=depends_on" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq '.meta'
```

### Test topology for Service

```bash
curl -s http://localhost:3002/grc/cmdb/topology/service/bbbb0002-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .
```

### Error cases

```bash
# 404 for nonexistent CI
curl -s -w "\n%{http_code}" http://localhost:3002/grc/cmdb/topology/ci/00000000-dead-beef-0000-000000000000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"

# 400 for invalid depth
curl -s -w "\n%{http_code}" "http://localhost:3002/grc/cmdb/topology/ci/bbbb0001-0000-0000-0000-000000000001?depth=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"

# 401 without token
curl -s -w "\n%{http_code}" http://localhost:3002/grc/cmdb/topology/ci/bbbb0001-0000-0000-0000-000000000001 \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

## 3. Frontend Verification

1. Log in to the application
2. Navigate to **CMDB > Configuration Items**
3. Click on any CI to open the detail page
4. Scroll down to find the **Topology** collapsible card
5. Click the expand button to open the topology panel
6. Verify the graph renders with nodes and edges
7. Test controls:
   - Change depth selector (1/2/3) and click refresh
   - Toggle relation type filter chips
   - Click a node to open the detail drawer
   - Use pan/zoom controls
   - Click "Fit View" button
8. Navigate to **CMDB > Services** and repeat steps 3-7

## 4. Running Smoke Tests

### API smoke tests (Playwright)

```bash
# From repo root
E2E_MODE=REAL_STACK BASE_URL=http://localhost:3002 \
  npx playwright test tests/platform-health/topology-smoke.spec.ts

# Against staging
E2E_MODE=REAL_STACK BASE_URL=http://46.224.99.150/api \
  npx playwright test tests/platform-health/topology-smoke.spec.ts
```

### Backend unit tests

```bash
cd backend-nest
npx jest --testPathPattern=topology.service.spec --verbose
```

## 5. Staging Deployment

```bash
cd /opt/grc-platform

# Pull latest
git fetch origin main && git checkout main && git pull origin main

# Rebuild
docker compose -f docker-compose.staging.yml up -d --build backend frontend

# Verify health
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'wget -qO- http://localhost:3002/health/live'
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'wget -qO- http://localhost:3002/health/db'

# Run topology seed
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'node dist/scripts/seed-topology-demo.js'

# Verify API
TOKEN=$(docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'wget -qO- --header="Content-Type: application/json" --post-data="{\"email\":\"admin@grc-platform.local\",\"password\":\"TestPassword123!\"}" http://localhost:3002/auth/login' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))")

docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  "wget -qO- --header='Authorization: Bearer ${TOKEN}' --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' http://localhost:3002/grc/cmdb/topology/ci/bbbb0001-0000-0000-0000-000000000001"
```

## 6. Rollback

The topology feature is purely additive (read-only endpoints, no schema migration needed). To rollback:

1. Revert the merge commits for PRs #436, #437, #438
2. Rebuild containers: `docker compose -f docker-compose.staging.yml up -d --build backend frontend`
3. Topology demo seed data can remain (harmless) or be cleaned:

```bash
docker compose -f docker-compose.staging.yml exec -T db psql -U postgres -d grc_platform -c "
  DELETE FROM cmdb_service_ci WHERE service_id = 'bbbb0002-0000-0000-0000-000000000001';
  DELETE FROM cmdb_ci_rel WHERE source_ci_id LIKE 'bbbb0001%' OR target_ci_id LIKE 'bbbb0001%';
  DELETE FROM cmdb_ci WHERE id LIKE 'bbbb0001%';
  DELETE FROM cmdb_service WHERE id = 'bbbb0002-0000-0000-0000-000000000001';
"
```

---

## Acceptance Checklist (26 items)

### Backend API

- [ ] 1. `GET /grc/cmdb/topology/ci/:ciId` returns 200 with valid graph
- [ ] 2. `GET /grc/cmdb/topology/service/:serviceId` returns 200 with valid graph
- [ ] 3. Response contains `nodes`, `edges`, `meta`, `annotations` top-level keys
- [ ] 4. `meta.rootNodeId` matches the requested entity ID
- [ ] 5. `meta.nodeCount` matches `nodes.length`
- [ ] 6. `meta.edgeCount` matches `edges.length`
- [ ] 7. `depth=2` returns deeper graph than `depth=1`
- [ ] 8. `depth=3` returns 200 and works correctly
- [ ] 9. `depth=10` (invalid) returns 400
- [ ] 10. `relationTypes=depends_on` filters edges correctly
- [ ] 11. `direction=upstream` returns only upstream nodes
- [ ] 12. Nonexistent CI returns 404
- [ ] 13. Nonexistent Service returns 404
- [ ] 14. Missing auth token returns 401
- [ ] 15. Missing `x-tenant-id` header returns 400
- [ ] 16. Cycle detection prevents infinite loops (unit tested)
- [ ] 17. Node cap (200) triggers truncation warning (unit tested)
- [ ] 18. Duplicate edges are de-duplicated (unit tested)
- [ ] 19. Tenant isolation — cannot see other tenant's data

### Frontend Graph Viewer

- [ ] 20. TopologyPanel renders as collapsible card on CI detail page
- [ ] 21. TopologyPanel renders as collapsible card on Service detail page
- [ ] 22. Graph renders with nodes and edges when topology data exists
- [ ] 23. Loading spinner shown while fetching
- [ ] 24. Error alert shown when API returns error (does NOT break page)
- [ ] 25. Empty state shown when no relationships exist
- [ ] 26. Pan/zoom/fit-to-screen controls work
- [ ] 27. Node click opens detail drawer with metadata
- [ ] 28. Depth selector (1/2/3) changes graph on reload
- [ ] 29. Relation type filter chips toggle edge visibility
- [ ] 30. Legend shows node types and relation types with colors
- [ ] 31. Truncation warning banner shown when graph exceeds limits
- [ ] 32. MiniMap renders for large graphs

### Phase C Extension Points

- [ ] 33. `annotations` object present in API response
- [ ] 34. TopologyGraph component accepts and renders `annotations` overlay props
- [ ] 35. `highlightedNodeIds` / `highlightedEdgeIds` are respected in rendering

### Infrastructure

- [ ] 36. All backend unit tests pass (14 tests)
- [ ] 37. E2E topology smoke tests pass (20+ assertions)
- [ ] 38. Topology demo seed is idempotent (re-run = 0 created, N skipped)
- [ ] 39. Frontend compiles with no errors (lint + typecheck clean)
- [ ] 40. CI pipeline fully green
- [ ] 41. No new security vulnerabilities (TruffleHog, CodeQL clean)
- [ ] 42. No auto-logout issues introduced

---

## Known Limitations (v1)

1. **Max depth = 3** — Deeper traversal may be needed for very large graphs; will be addressed in v2
2. **No real-time updates** — Graph is fetched on-demand; live updates planned for future
3. **No graph export** — Snapshot/export capability is an extension point but not implemented
4. **Node cap = 200** — Very large service maps may be truncated; progressive loading planned
5. **No 3D/advanced layout** — Using dagre auto-layout; custom layouts possible in future
6. **Annotations are minimal** — Phase C will add change risk / RCA overlays
7. **No offline/cached graph** — Each panel open triggers a fresh API call

## Phase 2/3 Integration Plan

### Phase 2: Change Risk Blast Radius
- Populate `annotations.highlightedNodeIds` with affected CIs from change ticket
- Add risk badges via `annotations.badgesByNodeId`
- Color-code edges based on risk propagation path
- Add "blast radius score" to meta

### Phase 3: Major Incident RCA
- Highlight incident propagation path in graph
- Add timeline overlay showing incident spread
- Support "replay" mode stepping through timeline
- Link MI/PIR data to graph nodes
