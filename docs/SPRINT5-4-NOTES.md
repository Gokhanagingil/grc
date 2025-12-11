# Sprint 5.4 - Audit Create Flow Fix & Process Control UI

## Overview

This sprint addresses two issues observed on staging:
1. **Audit Create Flow Bug**: Clicking "New Audit" showed "Failed to load audit" error
2. **Process Control UI Discovery**: Documenting the existing ProcessControl and ControlResult UI

## Phase 0 - Diagnosis

### Audit Create Flow Issue

**Root Cause Identified:**

The issue was in `frontend/src/pages/AuditDetail.tsx`. The component used `useParams()` to get the `id` parameter, but the route configuration in `App.tsx` had two separate routes:

```tsx
<Route path="audits/new" element={<AuditDetail />} />
<Route path="audits/:id" element={<AuditDetail />} />
```

When navigating to `/audits/new`, the first route matches (not the parameterized one), so `useParams()` returns `{ id: undefined }` instead of `{ id: 'new' }`.

The original code:
```tsx
const isNew = id === 'new';  // undefined === 'new' = false
```

This caused `isNew` to be `false`, which triggered the audit fetch logic with `id = undefined`, resulting in a failed API call and the "Failed to load audit" error.

### Process Control UI Status

**Finding:** The ProcessControl and ControlResult UI is already fully implemented in Sprint 5.

The UI is accessed through the Process Management page (`/processes`):
1. Click "View Details" on any process row
2. A dialog opens with "Details" and "Controls" tabs
3. The "Controls" tab shows all ProcessControls for that process
4. Each control has a "Record Result" button to enter ControlResults

## Phase 1 - Audit Create Flow Fix

**File Changed:** `frontend/src/pages/AuditDetail.tsx`

**Fix Applied:**
```tsx
// Before (line 159):
const isNew = id === 'new';

// After:
// Check for create mode: either no id (from /audits/new route) or id === 'new' (from /audits/:id route)
const isNew = !id || id === 'new';
```

This fix handles both cases:
- When `/audits/new` route matches: `id` is `undefined`, so `!id` is `true`
- When `/audits/:id` route matches with `id='new'`: `id === 'new'` is `true`

## Phase 2 - ProcessControl & ControlResult UI Documentation

### 2A) ProcessControls for each Process

**Location:** Process Management page (`/processes`)

**How to access:**
1. Navigate to Processes in the sidebar
2. Click the "View Details" (eye icon) button on any process row
3. In the dialog, click the "Controls" tab

**Features:**
- List all controls for the selected process
- "Add Control" button to create new controls
- Each control shows: Name, Method, Frequency, Expected Result Type, Status
- Edit and Delete buttons for each control
- "Record Result" button (play icon) to record control execution results

**Control Fields:**
- Name (required)
- Description
- Method: SCRIPT, SAMPLING, INTERVIEW, WALKTHROUGH, OBSERVATION
- Frequency: DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUALLY, EVENT_DRIVEN
- Expected Result Type: BOOLEAN, NUMERIC, QUALITATIVE
- Automated (toggle)
- Active (toggle)

### 2B) ControlResult Input

**Location:** Process Management page > View Details > Controls tab > Record Result button

**How to record a result:**
1. Click the "Record Result" (play icon) button on any control
2. A dialog opens with:
   - Control name and expected result type displayed
   - "Compliant" toggle (default: true)
   - Result value field (type depends on expectedResultType):
     - BOOLEAN: Pass/Fail toggle
     - NUMERIC: Number input
     - QUALITATIVE: Text input
   - Evidence Reference field (optional)
3. Click "Record Result" to save

**Important:** If "Compliant" is set to `false`, a warning message appears:
> "A violation will be automatically created for non-compliant results."

### 2C) Violations Page

**Location:** Process Violations page (`/violations`)

**Features:**
- Lists all violations with: Title, Process/Control, Severity, Status, Linked Risk, Due Date, Created Date
- Filter by Status (OPEN, IN_PROGRESS, RESOLVED) and Severity (LOW, MEDIUM, HIGH, CRITICAL)
- View Details dialog showing full violation information
- Edit dialog to update Status, Due Date, and Resolution Notes
- Link/Unlink Risk functionality

**Violation Flow:**
1. Record a ControlResult with `isCompliant = false`
2. Backend automatically creates a ProcessViolation
3. Violation appears on the Violations page
4. Can be linked to a Risk for tracking

## Manual Test Steps

### Test 1: Audit Create Flow

1. Log in as admin user
2. Navigate to Audits (`/audits`)
3. Click "New Audit" button
4. **Expected:** Create form opens without error
5. Fill in required fields:
   - Audit Name: "Test Audit"
   - Audit Type: Internal
   - Status: Planned
   - Risk Level: Medium
6. Click "Save"
7. **Expected:** Audit created successfully, redirects to audit detail

### Test 2: ProcessControl Management

1. Navigate to Processes (`/processes`)
2. Click "New Process" and create a test process:
   - Name: "Test Process"
   - Code: "TEST-001"
3. Click "View Details" on the new process
4. Click "Controls" tab
5. Click "Add Control" and create:
   - Name: "Test Control"
   - Method: WALKTHROUGH
   - Frequency: MONTHLY
   - Expected Result Type: BOOLEAN
6. **Expected:** Control appears in the list

### Test 3: ControlResult and Violation Creation

1. On the Controls tab, click "Record Result" for the test control
2. Set "Compliant" to OFF (false)
3. Click "Record Result"
4. **Expected:** Success message mentions violation created
5. Navigate to Violations (`/violations`)
6. **Expected:** New violation appears for the test control

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/pages/AuditDetail.tsx` | Fixed `isNew` check to handle undefined id |
| `docs/SPRINT5-4-NOTES.md` | This documentation file |

## Acceptance Criteria

- [x] "New Audit" no longer triggers "Failed to load audit"
- [x] Admin user can create an audit from UI end-to-end
- [x] Newly created audits appear in the list
- [x] ProcessControl UI documented and accessible
- [x] ControlResult recording documented and functional
- [x] Violation creation via non-compliant result documented
