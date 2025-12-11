# Sprint 5.7 - Audit Create Flow & Response Contract Fix

## Phase 0 - Investigation Findings

### Issue Description
- When creating a new audit and clicking Save, the app navigates to `/audits/undefined`
- Backend logs reportedly show no POST /grc/audits request when Save is clicked

### Root Cause Analysis

#### 1. Response Envelope Mismatch

The NestJS backend has a global `ResponseTransformInterceptor` (registered in `app.module.ts:157-160`) that wraps ALL successful responses in:

```json
{
  "success": true,
  "data": <actual_response>
}
```

The `GrcAuditController.create` method returns the `GrcAudit` entity directly from `GrcAuditService.createAudit`. With the global interceptor, the actual HTTP response becomes:

```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "...",
    ...
  }
}
```

#### 2. Frontend Response Handling Bug

In `AuditDetail.tsx` (lines 385-390), the current code:

```typescript
const response = await api.post('/grc/audits', payload);
const auditId = response.data.audit?.id || response.data.id;
```

This fails because:
- `response.data` is `{ success: true, data: { id: "...", ... } }`
- `response.data.audit` is `undefined` (no `audit` property exists)
- `response.data.id` is also `undefined` (the `id` is inside `data.data`)
- The actual ID is at `response.data.data.id`
- Result: `auditId` becomes `undefined`, navigation goes to `/audits/undefined`

#### 3. Same Issue Affects Other Endpoints

The same envelope unwrapping issue affects:
- `AuditList.tsx` - `fetchAudits()` expects `response.data.audits` but it's at `response.data.data.audits`
- `AuditDetail.tsx` - `fetchAudit()` expects entity at `response.data` but it's at `response.data.data`
- `AuditDetail.tsx` - `fetchPermissions()` expects permissions at `response.data` but it's at `response.data.data`

### Routing Verification

Routes in `App.tsx` (lines 72-75):
```tsx
<Route path="audits" element={<AuditList />} />
<Route path="audits/new" element={<AuditDetail />} />
<Route path="audits/:id" element={<AuditDetail />} />
<Route path="audits/:id/edit" element={<AuditDetail />} />
```

New Audit button in `AuditList.tsx` (line 259):
```tsx
onClick={() => navigate('/audits/new')}
```

`isNew` computation in `AuditDetail.tsx` (line 160):
```typescript
const isNew = !id || id === 'new';
```

When navigating to `/audits/new`, the route `audits/new` is matched (not `audits/:id`), so `id` from `useParams()` is `undefined`. This means `isNew = !undefined = true`. The routing is correct.

### Save Button Wiring

The Save button (lines 549-558) is correctly wired:
```tsx
{isEditMode && (
  <Button
    variant="contained"
    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
    onClick={handleSave}
    disabled={saving}
  >
    {saving ? 'Saving...' : 'Save'}
  </Button>
)}
```

`isEditMode` is `true` when `isNew` is `true`, so the button appears correctly.

## Fix Strategy

1. Create a helper function to unwrap NestJS envelope responses
2. Update `handleSave` in `AuditDetail.tsx` to properly extract the audit ID
3. Add defensive check to prevent navigation when ID is missing
4. Update `AuditList.tsx` to properly unwrap the list response
5. Update `fetchAudit` and `fetchPermissions` in `AuditDetail.tsx` to unwrap responses
