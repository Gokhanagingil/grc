# CMDB Import & Reconciliation — Staging Runbook

Covers the CMDB Import & Reconciliation feature deployment and verification on staging.

## Prerequisites

- SSH access to the staging server (`46.224.99.150`)
- The CMDB Import & Reconcile PRs are merged into `main`
- CMDB Foundation (PR #393) is already deployed (baseline CIs exist)
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

Verify the CMDB Import migration is listed. Then run:

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npx typeorm migration:run -d dist/data-source.js'
```

## 5. Verify Import Tables Exist

```bash
docker compose -f docker-compose.staging.yml exec -T db psql -U postgres -d grc_platform -c "
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'cmdb_import%' OR table_name LIKE 'cmdb_reconcile%'
ORDER BY table_name;"
```

Expected tables: `cmdb_import_job`, `cmdb_import_row`, `cmdb_import_source`, `cmdb_reconcile_result`, `cmdb_reconcile_rule`.

## 6. Seed Baseline CIs (if not already done)

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'node dist/scripts/seed-cmdb-baseline.js'
```

## 7. Seed Import Demo Data

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'node dist/scripts/seed-cmdb-import-demo.js'
```

Expected output:
```
=== CMDB Import & Reconcile Demo Seed ===
1) Seeding import source...
   Source created: <uuid>
2) Seeding reconcile rules...
   Rules: 3 created, 0 skipped
3) Seeding demo import job...
   Job created: <uuid>
4) Seeding import rows...
   Rows: 15 created
5) Generating reconcile results...
   Results: create=5, update=4, conflict=3, skip=2, error=1
=== CMDB Import Demo Seed Complete ===
```

On re-run, all entries should show `skipped` (idempotent).

## 8. Verify via API

```bash
# Get a token
TOKEN=$(docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'wget -qO- --header="Content-Type: application/json" \
   --post-data="{\"email\":\"admin@grc-platform.local\",\"password\":\"TestPassword123!\"}" \
   http://localhost:3002/auth/login' | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))")

# List import jobs
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  "wget -qO- --header='Authorization: Bearer ${TOKEN}' \
   --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' \
   http://localhost:3002/grc/cmdb/import-jobs"

# List reconcile rules
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  "wget -qO- --header='Authorization: Bearer ${TOKEN}' \
   --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' \
   http://localhost:3002/grc/cmdb/reconcile-rules"
```

## 9. How to Run a Dry-Run Import Job

```bash
# Create a new import job with JSON rows (dry-run mode)
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  "wget -qO- --header='Authorization: Bearer ${TOKEN}' \
   --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' \
   --header='Content-Type: application/json' \
   --post-data='{
     \"dryRun\": true,
     \"rows\": [
       {\"hostname\": \"PROD-WEB-01\", \"description\": \"Updated via API\"},
       {\"hostname\": \"BRAND-NEW-SERVER\", \"description\": \"New server\", \"environment\": \"production\"}
     ]
   }' \
   http://localhost:3002/grc/cmdb/import-jobs"
```

The response includes the job ID and summary counts (`wouldCreate`, `wouldUpdate`, `conflicts`).

## 10. How to Apply a Dry-Run Job

```bash
# Replace <JOB_ID> with the actual job ID from step 9
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  "wget -qO- --method=POST --header='Authorization: Bearer ${TOKEN}' \
   --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' \
   http://localhost:3002/grc/cmdb/import-jobs/<JOB_ID>/apply"
```

## 11. Verify Frontend Pages

Open in browser:

1. `http://46.224.99.150/cmdb/import-jobs` — Import Jobs list with status chips and counts
2. Click any job to see the detail page with summary cards and tabs
3. `http://46.224.99.150/cmdb/reconcile-rules` — Reconcile Rules admin page

## 12. Verify RBAC

- Non-admin users should see the import jobs list but NOT the Apply button
- Non-admin users should NOT be able to create/edit reconcile rules
- API calls without `x-tenant-id` header should return 400
- API calls with wrong tenant should return empty results (no cross-tenant leakage)

---

## Rollback

The seed is idempotent. To remove demo import data:

```bash
docker compose -f docker-compose.staging.yml exec -T db psql -U postgres -d grc_platform -c "
  DELETE FROM cmdb_reconcile_result WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM cmdb_import_row WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM cmdb_import_job WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM cmdb_import_source WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM cmdb_reconcile_rule WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
"
```
