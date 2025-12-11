# Sprint 5.3 - Audit Permissions & Create Visibility

## PHASE 0 Investigation Findings

### 1. Audit Permissions in Backend

**Status: Audit permissions ALREADY EXIST in the backend**

Location: `backend-nest/src/auth/permissions/permission.enum.ts`

```typescript
// Audit permissions (lines 22-24)
GRC_AUDIT_READ = 'grc:audit:read',
GRC_AUDIT_WRITE = 'grc:audit:write',
```

The permissions are properly defined with descriptions:
- `GRC_AUDIT_READ`: "View audits and audit details"
- `GRC_AUDIT_WRITE`: "Create, update, and delete audits"

### 2. Role-to-Permission Mapping

**Status: Audit permissions ARE mapped to roles in the backend**

Location: `backend-nest/src/auth/permissions/permission.service.ts`

| Role    | GRC_AUDIT_READ | GRC_AUDIT_WRITE |
|---------|----------------|-----------------|
| Admin   | Yes            | Yes             |
| Manager | Yes            | Yes             |
| User    | Yes            | No              |

### 3. Audit Controller Protection

**Status: Audit endpoints ARE properly protected**

Location: `backend-nest/src/grc/controllers/grc-audit.controller.ts`

The controller uses the three-guard chain:
```typescript
@Controller('grc/audits')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
```

Endpoint permissions:
- `GET /grc/audits` - Requires `GRC_AUDIT_READ`
- `POST /grc/audits` - Requires `GRC_AUDIT_WRITE`
- `PATCH /grc/audits/:id` - Requires `GRC_AUDIT_WRITE`
- `DELETE /grc/audits/:id` - Requires `GRC_AUDIT_WRITE`
- `GET /grc/audits/can/create` - Requires `GRC_AUDIT_READ`

### 4. "New Audit" Button Visibility

**Status: Button EXISTS but visibility depends on `canCreate` API call**

Location: `frontend/src/pages/AuditList.tsx`

The button is rendered conditionally:
```tsx
{canCreate && (
  <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/audits/new')}>
    New Audit
  </Button>
)}
```

The `canCreate` state is set by:
1. Calling `GET /grc/audits/can/create` endpoint
2. Fallback: If API fails, allows admin/manager roles

The backend `canCreate()` method always returns `true` (line 361-363 in service).

### 5. ROOT CAUSE IDENTIFIED

**The Permission Matrix UI uses HARDCODED static lists that are OUT OF SYNC with the backend!**

Location: `frontend/src/pages/admin/AdminRoles.tsx`

The `ALL_PERMISSIONS` constant (lines 58-70) does NOT include:
- `grc:audit:read` / `grc:audit:write`
- `grc:control:read` / `grc:control:write` / `grc:control:delete`
- `grc:process:read` / `grc:process:write` / `grc:process:delete`
- `admin:users:read` / `admin:users:write`
- `admin:roles:read` / `admin:roles:write`
- `admin:settings:read` / `admin:settings:write`
- `admin:tenants:read` / `admin:tenants:write`

Similarly, `ROLE_PERMISSIONS_MAP` (lines 72-104) is missing these permissions.

### 6. How Other Modules Handle Create Buttons

**Risk Management** (`RiskManagement.tsx`):
- Always shows "New Risk" button (no permission check)
- Uses role-based delete button visibility: `user?.role === 'admin' || user?.role === 'manager'`

**Audit List** (`AuditList.tsx`):
- Uses `canCreate` state from API call
- Has fallback to role check if API fails

## Summary of Required Changes

### PHASE 1 - Backend (No changes needed)
- Audit permissions already exist in enum
- Role mappings already configured correctly
- Controller guards already in place

### PHASE 2 - Frontend Permission Matrix UI
- Update `ALL_PERMISSIONS` to include all permissions from backend enum
- Update `ROLE_PERMISSIONS_MAP` to match backend `ROLE_PERMISSIONS` constant

### PHASE 3 - Audit Create Button
- The button already exists and should work once the API call succeeds
- Verify the `/grc/audits/can/create` endpoint is accessible
- The issue may be that the endpoint requires `GRC_AUDIT_READ` permission, which the user should have

## Files Changed in This Sprint

1. `frontend/src/pages/admin/AdminRoles.tsx` - Add missing permissions to static lists
2. `docs/SPRINT5-3-NOTES.md` - This documentation file
