# CMDB Foundation — Staging Runbook

Covers PR-A (CMDB Foundation) deployment and verification on the staging server.

## Prerequisites

- SSH access to the staging server (`46.224.99.150`)
- The CMDB Foundation PR (#393) is merged into `main`
- Staging is running via `docker-compose.staging.yml` at `/opt/grc-platform`

## 1. Pull Latest Code

```bash
cd /opt/grc-platform
git fetch origin main
git checkout main
git pull origin main
```

## 2. Rebuild Containers

```bash
docker compose -f docker-compose.staging.yml up -d --build backend frontend
```

## 3. Verify Backend Health

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'wget -qO- http://localhost:3002/health/live'
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'wget -qO- http://localhost:3002/health/db'
```

Expected: `{"status":"OK"}` for both.

## 4. Run Migrations

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npx typeorm migration:show -d dist/data-source.js'
```

Verify the CMDB migration (`CreateCmdbTables`) is listed. Then run:

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npx typeorm migration:run -d dist/data-source.js'
```

## 5. Verify CMDB Tables Exist

```bash
docker compose -f docker-compose.staging.yml exec -T db psql -U postgres -d grc_platform -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'cmdb%' ORDER BY table_name;"
```

Expected tables: `cmdb_ci`, `cmdb_ci_class`, `cmdb_ci_rel`.

## 6. Run CMDB Seed Script

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'node dist/scripts/seed-cmdb-baseline.js'
```

Expected output:
```
=== CMDB Baseline Seed ===
1) Seeding CMDB sys_choice entries...
   Choices: 16 created, 0 skipped
2) Seeding CI classes...
   CI Classes: 10 created, 0 skipped
3) Seeding sample CIs...
   CIs: 10 created, 0 skipped
4) Seeding CI relationships...
   Relationships: 8 created, 0 skipped
=== CMDB Baseline Seed Complete ===
```

On re-run, all entries should show `0 created, N skipped` (idempotent).

## 7. Verify Seeded Choices

```bash
docker compose -f docker-compose.staging.yml exec -T db psql -U postgres -d grc_platform -c "SELECT table_name, field_name, value, label FROM sys_choice WHERE table_name LIKE 'cmdb%' ORDER BY table_name, field_name, sort_order;"
```

Verify all values are **lowercase_snake** (e.g., `installed`, `active`, `depends_on`).

## 8. Verify CI Classes via API

```bash
# Get a token first
TOKEN=$(docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'wget -qO- --header="Content-Type: application/json" --post-data="{\"email\":\"admin@grc-platform.local\",\"password\":\"TestPassword123!\"}" http://localhost:3002/auth/login' | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))")

# List CI classes (should return 10)
docker compose -f docker-compose.staging.yml exec -T backend sh -lc "wget -qO- --header='Authorization: Bearer ${TOKEN}' --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' http://localhost:3002/grc/cmdb/classes"
```

## 9. Verify CIs via API

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc "wget -qO- --header='Authorization: Bearer ${TOKEN}' --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' http://localhost:3002/grc/cmdb/cis"
```

Should return 10 seeded CIs.

## 10. Verify Relationships via API

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc "wget -qO- --header='Authorization: Bearer ${TOKEN}' --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' http://localhost:3002/grc/cmdb/relationships"
```

Should return 8 seeded relationships.

## 11. Verify Frontend Pages

Open in browser:

1. `http://46.224.99.150/cmdb/cis` — CI list with seeded data
2. `http://46.224.99.150/cmdb/classes` — CI Class list with seeded data
3. Click any CI to verify detail page loads with relationships table

## 12. Run Smoke Tests (Optional)

From a machine with Playwright installed:

```bash
cd frontend
E2E_BASE_URL=http://46.224.99.150 npx playwright test e2e/smoke/cmdb-smoke.spec.ts --project=staging
```

---

## Rollback

If issues arise, the migration is idempotent (`CREATE TABLE IF NOT EXISTS`). To remove seeded data:

```bash
docker compose -f docker-compose.staging.yml exec -T db psql -U postgres -d grc_platform -c "
  DELETE FROM cmdb_ci_rel WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM cmdb_ci WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM cmdb_ci_class WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM sys_choice WHERE table_name LIKE 'cmdb%' AND tenant_id = '00000000-0000-0000-0000-000000000001';
"
```

## Choice Casing Convention

All `sys_choice.value` fields across ITSM and CMDB use **lowercase_snake** as the canonical convention (e.g., `installed`, `depends_on`, `production`). The `ChoiceService.resolveCanonicalValue()` method performs case-insensitive lookup, so inputs like `Active` or `ACTIVE` resolve to the canonical `active`. The `validateChoiceFields()` method auto-normalizes input data to the canonical value before persisting.
