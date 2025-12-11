# Sprint 5.7 Exit Validation Report

## Summary

Sprint 5.7 addresses the audit creation flow issue where clicking Save on "New Audit" navigated to `/audits/undefined` instead of the newly created audit's detail page.

## Root Cause

### Response Envelope Mismatch

The NestJS backend has a global `ResponseTransformInterceptor` that wraps ALL successful responses in a standard envelope format:

```json
{
  "success": true,
  "data": <actual_response>
}
```

The frontend code in `AuditDetail.tsx` was attempting to extract the audit ID using:

```typescript
const auditId = response.data.audit?.id || response.data.id;
```

This failed because:
- `response.data` is `{ success: true, data: { id: "...", ... } }`
- `response.data.audit` is `undefined` (no `audit` property exists)
- `response.data.id` is also `undefined` (the `id` is inside `data.data`)
- The actual ID is at `response.data.data.id`

Result: `auditId` becomes `undefined`, causing navigation to `/audits/undefined`.

## Changes Made

### 1. AuditDetail.tsx

Added `unwrapResponse<T>()` helper function to handle the NestJS envelope format:

```typescript
const unwrapResponse = <T,>(response: { data: { success?: boolean; data?: T } | T }): T => {
  const data = response.data;
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data as { success: boolean; data: T }).data;
  }
  return data as T;
};
```

Updated the following functions to use `unwrapResponse`:
- `fetchAudit()` - Now correctly extracts audit data from envelope
- `fetchPermissions()` - Now correctly extracts permissions from envelope
- `fetchRelatedData()` - Now correctly extracts findings, criteria, scope objects, and reports
- `handleSave()` - Now correctly extracts the created audit ID and includes defensive check

The `handleSave()` function now includes a defensive check to prevent navigation when ID is missing:

```typescript
const createdAudit = unwrapResponse<{ id: string }>(response);
const auditId = createdAudit?.id;

if (!auditId) {
  setError('Audit was created but the system could not determine its ID. Please check the audit list.');
  return;
}
```

### 2. AuditList.tsx

Added the same `unwrapResponse<T>()` helper function.

Updated the following functions:
- `fetchAudits()` - Now correctly extracts audits array and pagination from envelope
- `fetchDepartments()` - Now correctly extracts departments array from envelope

## Verification Checklist

- [x] Lint checks pass
- [x] Response handling aligns with NestJS envelope format
- [x] Defensive check prevents `/audits/undefined` navigation
- [x] List fetch correctly unwraps response to display audits
- [x] Create flow extracts audit ID from correct location in response

## Testing Instructions

1. Login as admin@grc-platform.local
2. Navigate to Audits
3. Click "New Audit"
4. Fill in the required fields (at minimum: Audit Name)
5. Click Save
6. Verify:
   - POST /grc/audits request is sent (check Network tab)
   - Navigation goes to `/audits/<uuid>` (not `/audits/undefined`)
   - Success message "Audit created successfully" is shown
7. Navigate back to Audits list
8. Verify the newly created audit appears in the list
