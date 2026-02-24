# Runbook: Change Detail — Linked Risks & Controls

## Overview

This runbook covers validation and troubleshooting for the Change Detail linked risks/controls feature (GRC Bridge v1). The endpoints allow ITSM Change requests to be linked to GRC Risks and Controls.

## API Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/grc/itsm/changes/:id/risks` | `GRC_RISK_READ` | List linked risks |
| POST | `/grc/itsm/changes/:id/risks/:riskId` | `ITSM_CHANGE_WRITE` | Link a risk |
| DELETE | `/grc/itsm/changes/:id/risks/:riskId` | `ITSM_CHANGE_WRITE` | Unlink a risk |
| GET | `/grc/itsm/changes/:id/controls` | `GRC_CONTROL_READ` | List linked controls |
| POST | `/grc/itsm/changes/:id/controls/:controlId` | `ITSM_CHANGE_WRITE` | Link a control |
| DELETE | `/grc/itsm/changes/:id/controls/:controlId` | `ITSM_CHANGE_WRITE` | Unlink a control |

> **Note:** Frontend calls use `/api/grc/itsm/changes/...` — Nginx strips the `/api` prefix before forwarding to the backend.

## API Validation Commands

### 1. Get Linked Risks (Success)

```bash
curl -s -X GET http://localhost:3002/grc/itsm/changes/<CHANGE_ID>/risks \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .
```

**Expected response (with linked risks):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Risk title",
      "tenantId": "00000000-0000-0000-0000-000000000001",
      "isDeleted": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**Expected response (no linked risks):**
```json
{
  "success": true,
  "data": []
}
```

### 2. Get Linked Controls (Success)

```bash
curl -s -X GET http://localhost:3002/grc/itsm/changes/<CHANGE_ID>/controls \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .
```

**Expected response (with linked controls):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Control name",
      "tenantId": "00000000-0000-0000-0000-000000000001",
      "isDeleted": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**Expected response (no linked controls):**
```json
{
  "success": true,
  "data": []
}
```

### 3. Link a Risk

```bash
curl -s -X POST http://localhost:3002/grc/itsm/changes/<CHANGE_ID>/risks/<RISK_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" | jq .
```

### 4. Unlink a Risk

```bash
curl -s -X DELETE http://localhost:3002/grc/itsm/changes/<CHANGE_ID>/risks/<RISK_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

**Expected:** 204 No Content

## Troubleshooting Matrix

| Symptom | Status | Cause | Action |
|---------|--------|-------|--------|
| `[]` returned | 200 | Change exists but has no linked risks/controls | Normal behavior — not an error |
| `"Linked risks could not be loaded"` | 404 | Change ID not found or tenant mismatch | Verify change exists in correct tenant |
| `"insufficient permissions"` | 403 | User lacks `GRC_RISK_READ` / `GRC_CONTROL_READ` | Check user role permissions |
| `"session expired"` | 401 | JWT token expired | Re-authenticate and retry |
| `"server error (500)"` | 500 | Backend exception | Check backend logs for stack trace |
| `"network error"` | N/A | Network connectivity issue | Check backend health: `curl http://localhost:3002/health/live` |
| `"Risk linking is not available"` | 400 | GRC Bridge entities not registered in module | Verify `ItsmChangeRisk` / `ItsmChangeControl` in `TypeOrmModule.forFeature()` |

## UI Validation Checklist

1. **Change Detail loads** — Navigate to `/itsm/changes/<id>` and verify the page loads without a white screen or "Something went wrong" boundary
2. **Linked Risks section** — Verify the linked risks section renders (either with data or empty state, but no error banner)
3. **Linked Controls section** — Verify the linked controls section renders (either with data or empty state, but no error banner)
4. **Change Tasks section** — Verify the tasks section renders with Add Task / Apply Template buttons
5. **No generic crash** — The page must not show a React error boundary ("Something went wrong") for any combination of linked data failures
6. **Error classification** — When a linked section fails (e.g., 403), verify the error message is specific (e.g., "insufficient permissions") rather than generic

## Tenant/RBAC Expectations

- All endpoints enforce **tenant isolation** via `x-tenant-id` header and `TenantGuard`
- Read endpoints require **`GRC_RISK_READ`** / **`GRC_CONTROL_READ`** permissions
- Write endpoints (link/unlink) require **`ITSM_CHANGE_WRITE`** permission
- A user with `ITSM_CHANGE_READ` but not `GRC_RISK_READ` will get 403 on the risks endpoint
- Cross-tenant access returns 404 (not 403) to avoid leaking change existence

## Data Model

The linkage uses explicit join tables:

- `itsm_change_risks` — Links `itsm_changes.id` to `grc_risks.id` (with tenant isolation)
- `itsm_change_controls` — Links `itsm_changes.id` to `grc_controls.id` (with tenant isolation)

Both tables have:
- Unique constraint on `(tenant_id, change_id, risk_id/control_id)`
- `created_at` timestamp for ordering
- `created_by` for audit trail
- CASCADE delete on both change and risk/control deletion

## Staging Validation (Docker)

```bash
# Inside backend container
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'wget -qO- http://localhost:3002/health/live'

# Verify endpoint is reachable (should return 401 without token)
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'wget -S -qO- http://localhost:3002/grc/itsm/changes/test/risks 2>&1 | head -5'
```
