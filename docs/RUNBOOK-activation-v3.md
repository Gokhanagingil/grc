# Activation Stabilization Pack v3 - Runbook

## Overview
This runbook covers the 4 P0 production blockers fixed in this PR:
- **A)** CAB page "Validation failed" on create/edit
- **B)** Change Template save failure
- **C)** Incident edit/save "Validation failed"
- **D)** Change detail missing UI to link Risk/Control records

---

## API Validation Commands (curl)

### A) CAB Meeting - Create
```bash
TOKEN="<jwt-token>"
TENANT="00000000-0000-0000-0000-000000000001"

# Create CAB meeting (should return 201)
curl -s -X POST http://localhost/api/grc/itsm/cab-meetings \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test CAB","meetingAt":"2026-03-01T10:00:00.000Z"}' | jq .
```

### A) CAB Meeting - Update
```bash
CAB_ID="<cab-meeting-id>"

curl -s -X PATCH http://localhost/api/grc/itsm/cab-meetings/$CAB_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated CAB","status":"IN_REVIEW","notes":"Updated notes"}' | jq .
```

### B) Change Template - Update
```bash
TEMPLATE_ID="<template-id>"

# Update template (must NOT include 'code' field)
curl -s -X PATCH http://localhost/api/grc/itsm/change-templates/$TEMPLATE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Template","isActive":true,"tasks":[{"title":"Task 1","type":"REVIEW","order":0}]}' | jq .
```

### C) Incident - Update
```bash
INCIDENT_ID="<incident-id>"

# Update incident (must NOT include id, number, createdAt, updatedAt, etc.)
curl -s -X PATCH http://localhost/api/grc/itsm/incidents/$INCIDENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"shortDescription":"Updated incident","status":"in_progress","impact":"medium"}' | jq .
```

### D) Change - Link Risk
```bash
CHANGE_ID="<change-id>"
RISK_ID="<risk-id>"

curl -s -X POST http://localhost/api/grc/itsm/changes/$CHANGE_ID/risks/$RISK_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" | jq .
```

### D) Change - Link Control
```bash
CONTROL_ID="<control-id>"

curl -s -X POST http://localhost/api/grc/itsm/changes/$CHANGE_ID/controls/$CONTROL_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" | jq .
```

---

## UI Verification Checklist

### A) CAB Meeting Flows
- [ ] Navigate to ITSM > CAB Meetings
- [ ] Click "New Meeting" - fill title + meeting date
- [ ] Click Create - should succeed without "Validation failed"
- [ ] Click into the created meeting
- [ ] Edit title, status, notes, summary
- [ ] Click Save - should succeed without "Validation failed"
- [ ] Verify field-level error messages appear if title is empty

### B) Change Template Flows
- [ ] Navigate to ITSM > Change Templates
- [ ] Open an existing template
- [ ] Add a new task (fill title, type, order)
- [ ] Click Save - should succeed without "Failed to save change template"
- [ ] Reload page - verify tasks persist
- [ ] Edit template name and description
- [ ] Save again - should succeed

### C) Incident Edit/Save Flows
- [ ] Navigate to ITSM > Incidents
- [ ] Click "Create Incident" - fill required fields - Save (should work)
- [ ] Open the newly created incident
- [ ] Edit description, category, impact, urgency
- [ ] Click Save - should succeed without "Validation failed"
- [ ] Clear optional fields (set to empty) and Save - should succeed
- [ ] Verify field-level error messages appear for invalid inputs

### D) Change Detail - Link Risk/Control
- [ ] Navigate to ITSM > Changes
- [ ] Open an existing change record
- [ ] Scroll to "Linked Risks" section
- [ ] Click "Link Risk" button - search dialog opens
- [ ] Select a risk - should link successfully
- [ ] Verify linked risk appears in the list
- [ ] Click unlink (X) on a linked risk - should remove it
- [ ] Scroll to "Linked Controls" section
- [ ] Click "Link Control" button - search dialog opens
- [ ] Select a control - should link successfully
- [ ] Verify linked control appears in the list
- [ ] Click unlink (X) on a linked control - should remove it

---

## Troubleshooting Matrix

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Validation failed" on CAB create | Forbidden fields in payload (id, tenantId, etc.) | Payload normalizer strips non-DTO fields |
| "Validation failed" on CAB edit | Empty strings for enum/date fields | `normalizeUpdatePayload` converts empty strings to undefined |
| "Failed to save change template" | `code` field in update payload (read-only) | `stripForbiddenFields` removes `code` from updates |
| "Validation failed" on incident edit | Generated fields (id, number, createdAt) in payload | Payload normalizer with INCIDENT_UPDATE_FIELDS allowlist |
| "Validation failed" with empty enum | Empty string "" sent for optional enum field | `emptyToUndefined()` converts "" to undefined |
| Link Risk/Control buttons missing | Feature not implemented | LinkRecordDialog component added with search/select UI |
| Link Risk/Control API 404 | Wrong API method name | Fixed: `getLinkedRisks`/`getLinkedControls` (not `linkedRisks`) |
| Generic error instead of field details | classifyApiError not used | All 4 flows now use `classifyApiError()` for error classification |

---

## Root Causes (Summary)

### A) CAB "Validation failed"
- **Root cause**: Frontend sent raw form state including forbidden/readonly fields. Backend `ValidationPipe` with `forbidNonWhitelisted: true` rejected the payload.
- **Fix**: Added `payloadNormalizer.ts` with `stripForbiddenFields()` + `CAB_MEETING_CREATE_FIELDS`/`CAB_MEETING_UPDATE_FIELDS` allowlists. Added `classifyApiError()` for better error surfacing.

### B) Change Template save failure
- **Root cause**: Update payload included `code` field (read-only, set only on create). Backend DTO rejected it.
- **Fix**: `CHANGE_TEMPLATE_UPDATE_FIELDS` allowlist excludes `code`. Tasks/dependencies normalized with proper structure.

### C) Incident edit "Validation failed"
- **Root cause**: Update payload included generated fields (id, number, state, createdAt, updatedAt, tenant info). Empty strings sent for optional enum/UUID fields.
- **Fix**: `INCIDENT_UPDATE_FIELDS` allowlist + `INCIDENT_EMPTY_STRING_FIELDS` set for empty-to-undefined conversion.

### D) No UI to link Risk/Control
- **Root cause**: Backend endpoints existed but frontend had no UI to invoke them.
- **Fix**: Added `LinkRecordDialog` component with search/select UI. Added "Link Risk" and "Link Control" buttons to Change Detail page with proper envelope normalization.

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/utils/payloadNormalizer.ts` | NEW | Shared payload normalization utilities |
| `frontend/src/utils/__tests__/payloadNormalizer.test.ts` | NEW | Regression tests for normalizer |
| `frontend/src/components/itsm/LinkRecordDialog.tsx` | NEW | Reusable search/select dialog for linking records |
| `frontend/src/pages/itsm/ItsmCabMeetingList.tsx` | MODIFIED | Payload normalization on create |
| `frontend/src/pages/itsm/ItsmCabMeetingDetail.tsx` | MODIFIED | Payload normalization on update |
| `frontend/src/pages/itsm/ItsmChangeTemplateDetail.tsx` | MODIFIED | Strip `code` field, normalize tasks |
| `frontend/src/pages/itsm/ItsmIncidentDetail.tsx` | MODIFIED | Payload normalization on update |
| `frontend/src/pages/itsm/ItsmChangeDetail.tsx` | MODIFIED | Link Risk/Control UI + handlers |
