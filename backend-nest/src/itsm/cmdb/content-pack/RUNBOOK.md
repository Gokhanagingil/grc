# CMDB Baseline Content Pack v1 — Runbook

## Overview

The CMDB Baseline Content Pack v1 delivers a versioned, idempotent default CMDB model:
- **19 system CI classes** with inheritance hierarchy
- **Field definitions** for each class (root, hardware, server, network, database, application, service)
- **9 relationship types** with full semantics (directionality, risk propagation, class constraints)

Version: `v1.0.0`

---

## Prerequisites

1. **Tenant must exist** — run `seed:grc` first
2. **Migration 1741900000000** must be applied (adds `is_system` column to `cmdb_ci_class`)
3. **Prior CMDB MI seeds** (PR #468) should be applied first if you want backward compatibility

```bash
# Ensure migrations are up to date
npm run migration:run

# Ensure base tenant exists
npm run seed:grc
```

---

## Apply Commands

### Development (ts-node)

```bash
# Full apply
npm run seed:cmdb-content-pack-v1:dev

# Dry-run (report only, no writes)
npm run seed:cmdb-content-pack-v1:dry-run:dev

# Custom tenant
CMDB_CONTENT_PACK_TENANT_ID=<uuid> npm run seed:cmdb-content-pack-v1:dev
```

### Production (compiled JS)

```bash
# Build first
npm run build

# Full apply
npm run seed:cmdb-content-pack-v1

# Dry-run
npm run seed:cmdb-content-pack-v1:dry-run
```

### Docker / Staging

```bash
docker compose exec backend node dist/scripts/seed-cmdb-content-pack-v1.js

# Dry-run
docker compose exec -e CMDB_CONTENT_PACK_DRY_RUN=true backend node dist/scripts/seed-cmdb-content-pack-v1.js
```

---

## Re-Apply / Idempotency

The content pack is **safe to run multiple times**:

| Scenario | Action | Result |
|---|---|---|
| First run, empty DB | CREATED | All 20 classes + 9 rel types created |
| Second run, no changes | REUSED | All records matched, no updates |
| Re-run after version bump | UPDATED | System-managed fields updated |
| Customer class with same name exists | SKIPPED | Customer data preserved |
| Soft-deleted system class | UPDATED | Restored from soft-delete |

---

## Verification

### API Verification

```bash
# List CI classes (should show 20 system classes)
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3000/grc/cmdb/classes

# Get class tree (should show hierarchy with isSystem field)
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3000/grc/cmdb/classes/tree

# Get class summary counts (total/system/custom/abstract)
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3000/grc/cmdb/classes/summary

# Check content pack status
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3000/grc/cmdb/classes/content-pack-status

# Filter system-only classes
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  "http://localhost:3000/grc/cmdb/classes?isSystem=true"

# Filter custom-only classes
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  "http://localhost:3000/grc/cmdb/classes?isSystem=false"

# Get effective schema for linux_server
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3000/grc/cmdb/classes/c1a00000-0000-0000-0000-000000000013/effective-schema

# List relationship types (should show 9 system types)
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3000/grc/cmdb/relationship-types
```

### UI Verification

1. **Class List** (`/cmdb/classes`): Should display classes with **System** / **Custom** badges
2. **Summary Banner**: Class list page should show total/system/custom/abstract counts at top
3. **Class Tree Link**: Class list should have a "Class Tree" button in the header
4. **Class Tree** (`/cmdb/classes/tree`): Should display the full hierarchy with **System** badges on system nodes
5. **Tree Summary**: Tree page should show system/custom counts in summary chips
6. **Class Detail**: Detail header should show **System** or **Custom** badge
7. **Empty Local Fields**: Classes with no local fields should show guidance to view Effective Schema tab
8. **Effective Schema**: Click any leaf class (e.g., Linux Server) → should show inherited + local fields
9. **Parent Selector**: Create new class → parent dropdown should list all 20 system classes
10. **Relationship Types** (`/cmdb/relationship-types`): Should show 9 system types with semantics

### Content Pack Status Verification

```bash
# Check if content pack was applied (returns applied=true/false, version, counts)
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3000/grc/cmdb/classes/content-pack-status

# Expected response when applied:
# { "applied": true, "version": "v1.0.0", "systemClasses": 19, "customClasses": 0, "totalClasses": 19, "abstractClasses": 5 }
```

---

## Conflict Interpretation

| Status | Meaning |
|---|---|
| `CREATED` | New record created with deterministic ID |
| `UPDATED` | Existing system record updated (baseline fields changed, or restored from soft-delete) |
| `REUSED` | Record exists and matches baseline — no changes needed |
| `SKIPPED` | Customer-created record with same name found — preserved without modification |
| `ERROR` | Unexpected failure during apply (check logs) |

### What SKIPPED Means

A `SKIPPED` result means a customer-created record (with a different ID) already uses the same name as a baseline record. The content pack **does not overwrite** customer data. To resolve:

1. Rename the customer record to avoid name collision
2. Re-run the content pack
3. The baseline record will be created with its deterministic ID

---

## Rollback Strategy

**Safe rollback is limited** — the content pack creates records but does not support full automated rollback.

### Manual Rollback Steps

```sql
-- Soft-delete all system classes for a tenant
UPDATE cmdb_ci_class
SET is_deleted = true
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND is_system = true;

-- Soft-delete all system relationship types for a tenant
UPDATE cmdb_relationship_type
SET is_deleted = true
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND is_system = true;
```

### Limitations

- Soft-delete preserves data for re-apply recovery
- CIs that reference system classes will still exist but may lose class context
- Relationships using system types will still exist
- Full hard-delete requires manual CASCADE consideration

---

## Content Pack Structure

```
src/itsm/cmdb/content-pack/
├── version.ts              # Version constants
├── classes.ts              # 20 class definitions with hierarchy
├── fields.ts               # Field definitions per class
├── relationship-types.ts   # 9 relationship type definitions
├── apply.ts                # Idempotent apply engine
├── index.ts                # Public API exports
├── RUNBOOK.md              # This file
└── __tests__/
    └── content-pack-apply.spec.ts  # Comprehensive tests
```

---

## Known Deferred Items

- **Cloud-specific packs**: AWS/Azure/GCP deep class libraries (future content packs)
- **Discovery mappings**: Auto-discovery connector field mappings
- **CSDM alignment**: Full Common Service Data Model breadth
- **Approval workflows**: Content pack governance / approval lifecycle
- **Version upgrade path**: v1 → v2 migration strategy (will be defined when v2 is needed)
