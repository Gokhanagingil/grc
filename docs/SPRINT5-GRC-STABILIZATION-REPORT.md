# Sprint 5.x GRC Stabilization Report

## Overview

This document summarizes the bug fixes and stabilization work completed for the GRC platform's Processes, Violations, and Audits modules during Sprint 5.x.

## Bugs Fixed

### 1. Violations Edit - "Failed to update violation" Error

**Problem**: When editing a violation and saving, users received the error "Failed to update violation".

**Root Cause**: The frontend was sending uppercase enum values (e.g., 'OPEN', 'IN_PROGRESS', 'RESOLVED') for the status field, but the backend expects lowercase values (e.g., 'open', 'in_progress', 'resolved') as defined in the `ViolationStatus` enum.

**Fix**: Updated `ProcessViolations.tsx` to use lowercase enum values for `VIOLATION_STATUSES` and `VIOLATION_SEVERITIES` constants. Added label mappings (`STATUS_LABELS`, `SEVERITY_LABELS`) to display user-friendly uppercase labels in the UI while sending lowercase values to the backend.

**Files Changed**:
- `frontend/src/pages/ProcessViolations.tsx`

### 2. Violations Status Filter - "Failed to fetch violations" Error

**Problem**: When filtering violations by status (e.g., OPEN, IN_PROGRESS), users received "Failed to fetch violations. Please try again."

**Root Cause**: Same as above - the frontend was sending uppercase status filter values but the backend expects lowercase values.

**Fix**: The status filter dropdown now uses lowercase values that match the backend enum definitions while displaying uppercase labels for user readability.

**Files Changed**:
- `frontend/src/pages/ProcessViolations.tsx`

### 3. LINK RISK Modal - Empty Risk List

**Problem**: When clicking "LINK RISK" on a violation, the modal opened but showed an empty list of risks.

**Root Cause**: The `fetchAllRisks` function was not properly handling cases where `tenantId` was not yet available, and error handling was insufficient.

**Fix**: Added defensive checks to ensure `tenantId` is available before fetching risks, and improved error handling to set an empty array on failure rather than leaving the state undefined.

**Files Changed**:
- `frontend/src/pages/ProcessViolations.tsx`

### 4. Audits Page - White Screen

**Problem**: Clicking "Audits" in the left menu resulted in a blank white screen.

**Root Cause**: The local `unwrapResponse` function in `AuditList.tsx` was not properly handling edge cases where the response or response.data might be null/undefined.

**Fix**: Added defensive null checks to the `unwrapResponse` function to handle cases where the response is null or undefined, and improved error logging.

**Files Changed**:
- `frontend/src/pages/AuditList.tsx`

## Tests Added

### Backend E2E Tests

Added comprehensive tests for Process Violations endpoints in `backend-nest/test/grc.e2e-spec.ts`:

- `GET /grc/process-violations` - List violations with valid auth
- `GET /grc/process-violations` - Returns 401 without token
- `GET /grc/process-violations` - Returns 400 without x-tenant-id header
- `GET /grc/process-violations?status=open` - Filter by status (lowercase)
- `GET /grc/process-violations?severity=high` - Filter by severity (lowercase)
- `PATCH /grc/process-violations/:id` - Returns 404 for non-existent violation
- `PATCH /grc/process-violations/:id` - Rejects invalid status values
- `PATCH /grc/process-violations/:id/link-risk` - Returns 404 for non-existent violation

## Smoke Test Steps

### Prerequisites

1. Start the backend: `cd backend-nest && npm run start:dev`
2. Start the frontend: `cd frontend && npm start`
3. Login as demo admin: `admin@grc-platform.local`

### Test Scenarios

#### Scenario 1: Violations List and Edit

1. Navigate to **Processes** in the left menu
2. Open any process and click **View Violations**
3. Verify the violations list loads without errors
4. Click the **Edit** button on any violation
5. Change the status (e.g., from "OPEN" to "IN PROGRESS")
6. Click **Save**
7. **Expected**: Violation updates successfully without "Failed to update violation" error

#### Scenario 2: Violations Status Filter

1. Navigate to **Violations** page
2. Use the **Status** dropdown to filter by "OPEN"
3. **Expected**: List filters correctly without "Failed to fetch violations" error
4. Try other status filters: "IN PROGRESS", "RESOLVED"
5. **Expected**: All filters work correctly

#### Scenario 3: Link Risk to Violation

1. Navigate to **Violations** page
2. Click **LINK RISK** on any violation
3. **Expected**: Modal opens and shows list of available risks
4. Select a risk and click **Link**
5. **Expected**: Risk is linked successfully

#### Scenario 4: Audits Page

1. Click **Audits** in the left menu
2. **Expected**: Audits list page loads without white screen
3. Verify the page renders correctly even with no audits (empty state)
4. If audits exist, verify they are displayed in the table

## Technical Notes

### Enum Case Sensitivity

The backend uses lowercase enum values for `ViolationStatus` and `ViolationSeverity`:

```typescript
export enum ViolationStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
}

export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

Frontend components must send lowercase values to match these enums.

### Response Unwrapping

The platform uses a standard API response envelope format:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 100, "page": 1, "pageSize": 20 }
}
```

Components should use the `unwrapResponse` or `unwrapPaginatedResponse` helpers from `grcClient.ts` to properly extract data from responses.

## Conclusion

All identified bugs in the Violations and Audits modules have been fixed. The fixes maintain backward compatibility and follow existing architectural patterns. Backend tests have been added to prevent regression.
