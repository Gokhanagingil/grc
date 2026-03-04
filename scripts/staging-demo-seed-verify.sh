#!/usr/bin/env bash
# =============================================================================
# Staging Demo Seed Verification & Safe Run
# =============================================================================
# Run this script ON the staging host (e.g. after cd /opt/grc-platform or repo root).
# SAFETY: No DB resets, no volume prune. Read-only checks + idempotent seeds only.
# Do NOT print or log any secrets (only variable names if needed).
#
# Usage:
#   ./scripts/staging-demo-seed-verify.sh
#   BACKEND_CONTAINER=grc-staging-backend POSTGRES_CONTAINER=grc-staging-db ./scripts/staging-demo-seed-verify.sh
#   VERIFY_ONLY=1 ./scripts/staging-demo-seed-verify.sh   # skip Phase 3 (no seeds)
# =============================================================================

set -e
BACKEND_CONTAINER="${BACKEND_CONTAINER:-grc-staging-backend}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-grc-staging-db}"
DB_NAME="${DB_NAME:-grc_platform}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
VERIFY_ONLY="${VERIFY_ONLY:-0}"

echo "=============================================="
echo "STAGING DEMO SEED VERIFICATION"
echo "=============================================="
echo "Backend: $BACKEND_CONTAINER | Postgres: $POSTGRES_CONTAINER | DB: $DB_NAME"
echo ""

# -----------------------------------------------------------------------------
# PHASE 0 — Identify containers and environment
# -----------------------------------------------------------------------------
echo "=== PHASE 0: Containers and environment ==="
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "--- Disk (df -h) ---"
df -h
echo ""
echo "--- Docker disk (docker system df) ---"
docker system df
echo ""

# -----------------------------------------------------------------------------
# PHASE 1 — Did the demo seed run? (evidence from logs)
# -----------------------------------------------------------------------------
echo "=== PHASE 1: Backend logs — demo seed markers ==="
docker logs --tail 500 "$BACKEND_CONTAINER" 2>&1 | grep -i -E "seed:demo|demo pack|scenario checklist|DEMO-SC|DEMO-SC1|DEMO-SC2|SEED-DEMO-PACK" || true
if [ "${PIPESTATUS[1]}" -ne 0 ]; then
  echo "(No demo seed markers found in last 500 lines — assume demo pack did NOT run during deploy.)"
fi
echo ""

# -----------------------------------------------------------------------------
# PHASE 2 — Verify prerequisites inside backend container
# -----------------------------------------------------------------------------
echo "=== PHASE 2: Prerequisites inside backend container ==="
echo "--- Workspace and seed scripts ---"
docker exec "$BACKEND_CONTAINER" sh -c '
  if [ -d /app ]; then cd /app; elif [ -d /app/backend-nest ]; then cd /app/backend-nest; else echo "FAIL: no /app or backend-nest"; exit 1; fi
  echo "PWD=$PWD"
  ls -la package.json dist/scripts/seed-grc.js dist/scripts/seed-demo-pack.js 2>/dev/null || true
  echo "--- npm run (seed-related) ---"
  npm run 2>/dev/null | grep -E "seed:(grc|standards|demo)" || true
  echo "--- core-companies (optional; demo pack can create DEMO-CUST) ---"
  (test -f dist/scripts/seed-core-companies.js && echo "dist/scripts/seed-core-companies.js exists") || echo "seed-core-companies.js not present"
'
echo ""

# -----------------------------------------------------------------------------
# PHASE 3 — Run seeds safely (in order) [skipped when VERIFY_ONLY=1]
# -----------------------------------------------------------------------------
if [ "$VERIFY_ONLY" = "1" ] || [ "$VERIFY_ONLY" = "true" ]; then
  echo "=== PHASE 3: SKIPPED (VERIFY_ONLY) — no seeds run ==="
  echo "Set VERIFY_ONLY=0 and re-run to execute seeds."
  echo ""
else
  echo "=== PHASE 3: Run seeds (idempotent; safe to re-run) ==="
  echo "Order: seed:grc -> seed:standards -> core-companies (if present) -> seed:demo:pack"
  echo ""

  docker exec "$BACKEND_CONTAINER" sh -c '
    cd /app
    echo "--- 1. seed:grc ---"
    npm run seed:grc
    echo ""
    echo "--- 2. seed:standards ---"
    npm run seed:standards
    echo ""
    echo "--- 3. core-companies (optional) ---"
    if [ -f dist/scripts/seed-core-companies.js ]; then
      node dist/scripts/seed-core-companies.js || true
    else
      echo "Skipped (no seed-core-companies.js; demo pack will create DEMO-CUST if needed)"
    fi
    echo ""
    echo "--- 4. seed:demo:pack ---"
    npm run seed:demo:pack
  ' 2>&1 | tee /tmp/staging-seed-output.txt

  echo ""
fi

echo "--- Scenario checklist excerpt ---"
if [ -f /tmp/staging-seed-output.txt ]; then
  grep -A 200 "SCENARIO CHECKLIST" /tmp/staging-seed-output.txt | head -30 || true
elif [ "$VERIFY_ONLY" = "1" ] || [ "$VERIFY_ONLY" = "true" ]; then
  echo "N/A (verify_only — no seeds run; use mode verify_and_seed to get checklist)"
else
  echo "No seed output file found."
fi
echo ""

# -----------------------------------------------------------------------------
# PHASE 4 — Prove data exists (DB counts, read-only)
# -----------------------------------------------------------------------------
echo "=== PHASE 4: DB counts (read-only) ==="
echo "--- Tables (sample) ---"
docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -c "\dt" 2>/dev/null | head -60

echo ""
echo "--- Counts by tenant (demo tenant = 00000000-0000-0000-0000-000000000001) ---"
COUNT_DEMO=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -t -c "
SELECT 'grc_risks' AS tbl, COUNT(*) AS cnt FROM grc_risks WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'itsm_changes', COUNT(*) FROM itsm_changes WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'itsm_incidents', COUNT(*) FROM itsm_incidents WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'itsm_problems', COUNT(*) FROM itsm_problems WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'itsm_known_errors', COUNT(*) FROM itsm_known_errors WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'itsm_major_incidents', COUNT(*) FROM itsm_major_incidents WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'grc_audits', COUNT(*) FROM grc_audits WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'bcm_bias', COUNT(*) FROM bcm_bias WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'bcm_exercises', COUNT(*) FROM bcm_exercises WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
" 2>/dev/null) || true
if [ -n "$COUNT_DEMO" ]; then
  echo "$COUNT_DEMO"
else
  echo "Count query failed or tables missing. Candidate tables (\\dt *risk*, *incident*, *change*, *audit*):"
  docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -c "\dt *risk*" 2>/dev/null || true
  docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -c "\dt *incident*" 2>/dev/null || true
  docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -c "\dt *change*" 2>/dev/null || true
  docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -c "\dt *audit*" 2>/dev/null || true
fi

echo ""
echo "--- Total counts (all tenants) ---"
COUNT_TOTAL=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -t -c "
SELECT 'grc_risks' AS tbl, COUNT(*) FROM grc_risks
UNION ALL SELECT 'itsm_changes', COUNT(*) FROM itsm_changes
UNION ALL SELECT 'itsm_incidents', COUNT(*) FROM itsm_incidents
UNION ALL SELECT 'itsm_problems', COUNT(*) FROM itsm_problems
UNION ALL SELECT 'itsm_known_errors', COUNT(*) FROM itsm_known_errors
UNION ALL SELECT 'itsm_major_incidents', COUNT(*) FROM itsm_major_incidents
UNION ALL SELECT 'grc_audits', COUNT(*) FROM grc_audits;
" 2>/dev/null) || true
if [ -n "$COUNT_TOTAL" ]; then
  echo "$COUNT_TOTAL"
else
  echo "Total count query failed. Listing all tables:"
  docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -c "\dt" 2>/dev/null | head -80 || true
fi

echo ""
echo "=============================================="
echo "VERIFICATION COMPLETE"
echo "=============================================="
if [ -f /tmp/staging-seed-output.txt ]; then
  echo "Full seed output saved to: /tmp/staging-seed-output.txt"
fi
echo "See docs/STAGING_DEMO_SEED_VERIFICATION_REPORT.md for conclusion template and UI checklist."
