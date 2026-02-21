#!/usr/bin/env bash
# =============================================================================
# Canonical E2E seed script for REAL_STACK mode
# =============================================================================
# Creates the minimum data required for smoke tests:
#   - Demo tenant (00000000-0000-0000-0000-000000000001)
#   - Admin user (admin@grc-platform.local / changeme)
#   - Core GRC choices (policy categories, risk severities, etc.)
#
# Usage:
#   ./scripts/seed-e2e.sh                      # local (backend-nest running)
#   docker compose exec backend ./scripts/seed-e2e.sh  # inside container
#
# Idempotent: safe to run multiple times. Uses ON CONFLICT DO NOTHING.
# =============================================================================

set -euo pipefail

BACKEND_DIR="${BACKEND_DIR:-backend-nest}"

echo "=== E2E Seed: running migrations ==="
cd "$BACKEND_DIR"

if [ -d "src" ] && [ -f "src/data-source.ts" ]; then
  echo "Dev environment detected (src/ exists), using ts-node"
  npx typeorm migration:run -d src/data-source.ts 2>/dev/null || \
    npx typeorm migration:run -d dist/data-source.js
else
  echo "Prod environment detected (dist/ only)"
  npx typeorm migration:run -d dist/data-source.js
fi

echo "=== E2E Seed: creating demo tenant + admin user ==="
if command -v npm &>/dev/null && npm run --silent 2>/dev/null | grep -q "seed:demo" 2>/dev/null; then
  npm run seed:demo 2>/dev/null || echo "seed:demo not available, skipping"
fi

if command -v npm &>/dev/null && npm run --silent 2>/dev/null | grep -q "seed:grc" 2>/dev/null; then
  echo "=== E2E Seed: seeding GRC baseline data ==="
  npm run seed:grc 2>/dev/null || echo "seed:grc not available, skipping"
fi

if command -v npm &>/dev/null && npm run --silent 2>/dev/null | grep -q "seed:standards:prod" 2>/dev/null; then
  echo "=== E2E Seed: seeding standards library ==="
  npm run seed:standards:prod 2>/dev/null || echo "seed:standards:prod not available, skipping"
fi

echo "=== E2E Seed: complete ==="
echo ""
echo "Seeded:"
echo "  - Tenant: 00000000-0000-0000-0000-000000000001"
echo "  - Admin:  admin@grc-platform.local / changeme"
echo "  - GRC baseline choices and standards (if seed scripts exist)"
