# Platform Usability & Change Activation Stabilization — Runbook

## Overview

This runbook covers troubleshooting and validation for the 6 critical usability fixes delivered in the Platform Usability Stabilization Pack.

---

## 1. Incident Validation Troubleshooting

### Problem
Incident create/save returns "Validation failed" with no field-level detail.

### Root Cause
ChoiceService validates field values against `itsm_choices` table. If a value is not in the table, the backend returns a generic error. The frontend error classifier was not extracting the `details` array from the ChoiceService response.

### Fix
Updated `apiErrorClassifier.ts` to extract field-level validation details from `error.details` array when `error.error === 'INVALID_CHOICE'`.

### Validation Steps
1. Navigate to **ITSM > Incidents > New Incident**
2. Fill required fields (title, description)
3. Select a category/status and save — should succeed
4. Enter an invalid value (e.g., via API) — error should show field-level detail

### API Test
```bash
# Create incident with valid payload
curl -X POST http://localhost/api/grc/itsm/incidents \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test","description":"Test incident"}'
```

---

## 2. CAB Permissions Troubleshooting

### Problem
CAB menu/pages return "Access denied: Insufficient permissions" for admin users.

### Root Cause
`ITSM_CAB_READ` and `ITSM_CAB_WRITE` permissions existed in the Permission enum but were not mapped to admin/manager roles in `permission.service.ts`.

### Fix
Added both permissions to `ROLE_PERMISSIONS[UserRole.ADMIN]`, `ROLE_PERMISSIONS[UserRole.MANAGER]`, and `ITSM_CAB_READ` to `ROLE_PERMISSIONS[UserRole.USER]`.

### Validation Steps
1. Log in as admin (`admin@grc-platform.local`)
2. Navigate to **ITSM > CAB** menu
3. Should load without "Access denied" error
4. Verify CAB meetings list loads

### Permission Matrix
| Role    | ITSM_CAB_READ | ITSM_CAB_WRITE |
|---------|:---:|:---:|
| ADMIN   | Y | Y |
| MANAGER | Y | Y |
| USER    | Y | N |

---

## 3. Change Template Task Authoring

### Problem
Change Template UI displayed tasks read-only with message "Tasks can be added via the API."

### Root Cause
Frontend only rendered tasks in a read-only table. The backend `updateTemplate` already supported `tasks` and `dependencies` arrays for full CRUD.

### Fix
Replaced read-only tasks section with full CRUD UI:
- Add Task button creates new task with auto-generated key
- Inline edit form with fields: key, title, description, type, priority, stage, blocking
- Delete button removes task and cleans up related dependencies
- Dependency editor with predecessor/successor selects and cycle detection
- Unsaved changes indicator

### Validation Steps
1. Navigate to **ITSM > Change Templates > [any template]**
2. Click "Add Task" — inline editor should appear
3. Fill in task key and title, click "Apply"
4. Add a second task
5. Add a dependency between tasks
6. Try adding a circular dependency — should show error
7. Click "Save" — changes persist after reload

---

## 4. Change-CI Linkage Validation

### Problem
Change records had no way to link affected Configuration Items (CIs).

### Root Cause
The Change entity lacked a CI linkage model/API. The Incident module already had this pattern (`itsm_incident_ci`).

### Fix
Created additive Change-CI linkage following the Incident-CI pattern:
- Entity: `ItsmChangeCi` (table: `itsm_change_ci`)
- Service: `ChangeCiService` with CRUD operations
- Controller: endpoints under `grc/itsm/changes/:changeId/affected-cis`
- Frontend: `ChangeAffectedCisSection` component in Change Detail page

### Validation Steps
1. Navigate to **ITSM > Changes > [any change]**
2. Scroll to "Affected CIs" section
3. Search and select a CI
4. Choose relationship type and click "Add"
5. CI should appear in the linked CIs table
6. Click delete icon to remove a link

### API Endpoints
```bash
# List affected CIs
GET /api/grc/itsm/changes/:changeId/affected-cis

# Add affected CI
POST /api/grc/itsm/changes/:changeId/affected-cis
Body: { "ciId": "uuid", "relationshipType": "AFFECTED" }

# Remove link
DELETE /api/grc/itsm/changes/:changeId/affected-cis/:linkId
```

---

## 5. CMDB Hierarchy Visibility / Content-Pack Checks

### Problem
Users cannot reliably see the class hierarchy.

### Root Cause
The tree page exists and works, but discoverability and empty states were unclear.

### Fix
- Enhanced empty state with content pack guidance
- Clear diagnostic messages for: no classes, content pack not applied, permission issues
- "Go to CI Classes" navigation button in empty state

### Validation Steps
1. Navigate to **CMDB > CI Classes**
2. Click "Class Tree" button — should navigate to tree view
3. If classes exist, tree should render with expand/collapse
4. If empty, should show diagnostic guidance
5. Summary chips should show total/root/system/custom counts

### Content Pack Check
```bash
# Check if content pack classes exist
curl http://localhost/api/grc/cmdb/classes?pageSize=5 \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 6. SLA Condition Builder Typed Inputs Verification

### Problem
SLA Condition Builder rendered all value inputs as free text, even for choice/enum fields.

### Root Cause
The frontend field registry had `type: 'string'` for fields like `category`, `status`, `source` which should be enums with predefined options.

### Fix
Implemented generalized typed value editor strategy:
- `enum` fields with `options` → Select dropdown (single or multi for `in`/`not_in`)
- `boolean` fields → True/False select
- `number` fields → Numeric input
- `date` fields → Date picker input
- `uuid` fields → Text with UUID hint
- `string` fields → Text input (default)
- Unary operators (`is_empty`/`is_not_empty`) → Value input hidden

### Validation Steps
1. Navigate to **ITSM > SLA Policies > [any policy] > Edit**
2. In Matching Conditions section, add a condition
3. Select field "Category" — value should be a **dropdown** (not text)
4. Select field "Status" — value should be a **dropdown**
5. Select field "Source / Channel" — value should be a **dropdown**
6. Select operator "is empty" — value input should **disappear**
7. Select field "Subcategory" — value should be a **text input**
8. Existing saved conditions should still render correctly

### Fields with Typed Editors
| Field | Type | Editor |
|-------|------|--------|
| Priority | enum | Select: P1, P2, P3, P4 |
| Impact | enum | Select: HIGH, MEDIUM, LOW |
| Urgency | enum | Select: HIGH, MEDIUM, LOW |
| Category | enum | Select: HARDWARE, SOFTWARE, NETWORK, ... |
| Status | enum | Select: NEW, IN_PROGRESS, ON_HOLD, ... |
| Source | enum | Select: EMAIL, PHONE, WEB, ... |
| Subcategory | string | Text input |
| Service | uuid | Text with UUID hint |
| Assignment Group | string | Text input |
