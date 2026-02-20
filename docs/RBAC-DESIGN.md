# RBAC Design Document

This document describes the Role-Based Access Control (RBAC) system implemented in the GRC Platform.

## Overview

The GRC Platform implements a comprehensive RBAC system that controls access to features and data based on user roles and granular permissions. The system supports three predefined roles with different permission levels.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Request                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      JWT Authentication                          │
│                       (JwtAuthGuard)                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Role Verification                           │
│                        (RolesGuard)                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Permission Verification                        │
│                    (PermissionsGuard)                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Route Handler                               │
└─────────────────────────────────────────────────────────────────┘
```

## Roles

### Admin
Full access to all platform features including:
- All GRC module operations (read/write)
- All ITSM module operations (read/write)
- User management (create, update, delete, role assignment)
- System settings management
- Tenant management
- Statistics and analytics

### Manager
Elevated access for team leads:
- All GRC module operations (read/write)
- All ITSM module operations (read/write)
- Statistics and analytics access
- No admin panel access
- No user management

### User
Standard access for regular users:
- GRC module read access (risks, policies, requirements)
- ITSM incident read access
- No write access to modules
- No statistics access
- No admin panel access

## Permissions

### Permission Naming Convention

Permissions follow the pattern: `{module}:{resource}:{action}`

Examples:
- `grc:risk:read` - Read risks
- `grc:risk:write` - Create/update/delete risks
- `admin:users:read` - View users
- `admin:users:write` - Manage users

### Permission Categories

#### GRC Permissions
| Permission | Description |
|------------|-------------|
| `grc:risk:read` | View risks and risk details |
| `grc:risk:write` | Create, update, and delete risks |
| `grc:policy:read` | View policies and policy details |
| `grc:policy:write` | Create, update, and delete policies |
| `grc:requirement:read` | View requirements and requirement details |
| `grc:requirement:write` | Create, update, and delete requirements |
| `grc:statistics:read` | View statistics and analytics dashboards |
| `grc:admin` | Full administrative access to all GRC features |

#### ITSM Permissions
| Permission | Description |
|------------|-------------|
| `itsm:incident:read` | View incidents and incident details |
| `itsm:incident:write` | Create, update, and delete incidents |
| `itsm:statistics:read` | View ITSM statistics and analytics dashboards |

#### Admin Permissions
| Permission | Description |
|------------|-------------|
| `admin:users:read` | View users and user details |
| `admin:users:write` | Create, update, and delete users |
| `admin:roles:read` | View roles and role permissions |
| `admin:roles:write` | Create, update, and delete roles |
| `admin:settings:read` | View system settings |
| `admin:settings:write` | Modify system settings |
| `admin:tenants:read` | View tenants and tenant details |
| `admin:tenants:write` | Create, update, and delete tenants |

## Permission Matrix

| Permission | Admin | Manager | User |
|------------|-------|---------|------|
| `grc:risk:read` | Yes | Yes | Yes |
| `grc:risk:write` | Yes | Yes | No |
| `grc:policy:read` | Yes | Yes | Yes |
| `grc:policy:write` | Yes | Yes | No |
| `grc:requirement:read` | Yes | Yes | Yes |
| `grc:requirement:write` | Yes | Yes | No |
| `grc:statistics:read` | Yes | Yes | No |
| `grc:admin` | Yes | No | No |
| `itsm:incident:read` | Yes | Yes | Yes |
| `itsm:incident:write` | Yes | Yes | No |
| `itsm:statistics:read` | Yes | Yes | No |
| `admin:users:read` | Yes | No | No |
| `admin:users:write` | Yes | No | No |
| `admin:roles:read` | Yes | No | No |
| `admin:roles:write` | Yes | No | No |
| `admin:settings:read` | Yes | No | No |
| `admin:settings:write` | Yes | No | No |
| `admin:tenants:read` | Yes | No | No |
| `admin:tenants:write` | Yes | No | No |

## Backend Implementation

### Permission Enum

```typescript
// backend-nest/src/auth/permissions/permission.enum.ts
export enum Permission {
  GRC_RISK_READ = 'grc:risk:read',
  GRC_RISK_WRITE = 'grc:risk:write',
  // ... more permissions
}
```

### Permission Service

```typescript
// backend-nest/src/auth/permissions/permission.service.ts
@Injectable()
export class PermissionService {
  getPermissionsForRole(role: UserRole): Permission[];
  roleHasPermission(role: UserRole, permission: Permission): boolean;
  roleHasAllPermissions(role: UserRole, permissions: Permission[]): boolean;
  roleHasAnyPermission(role: UserRole, permissions: Permission[]): boolean;
}
```

### Permission Guard

```typescript
// Usage in controllers
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  @Get()
  @Permissions(Permission.ADMIN_USERS_READ)
  findAll() { ... }

  @Post()
  @Permissions(Permission.ADMIN_USERS_WRITE)
  create() { ... }
}
```

## Frontend Implementation

### usePermission Hook

```typescript
// frontend/src/hooks/usePermission.ts
const { 
  permissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  canRead,
  canWrite,
  isAdmin,
  isManager 
} = usePermission();
```

### PermissionGuard Component

```tsx
// Require single permission
<PermissionGuard permission="admin:users:read">
  <UserList />
</PermissionGuard>

// Require all permissions
<PermissionGuard 
  permissions={['admin:users:read', 'admin:users:write']} 
  requireAll={true}
>
  <UserManagement />
</PermissionGuard>

// Require any permission
<PermissionGuard 
  permissions={['admin:users:read', 'grc:admin']} 
  requireAll={false}
>
  <AdminContent />
</PermissionGuard>

// Custom fallback
<PermissionGuard 
  permission="admin:settings:write"
  fallback={<ReadOnlySettings />}
>
  <EditableSettings />
</PermissionGuard>
```

### Utility Functions

```typescript
import { hasPermission, hasAllPermissions, hasAnyPermission } from './hooks/usePermission';

// Check single permission
if (hasPermission('admin', 'admin:users:write')) {
  // Allow action
}

// Check multiple permissions
if (hasAllPermissions('admin', ['admin:users:read', 'admin:users:write'])) {
  // Allow action
}
```

## Permission Resolution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. Extract User from JWT                      │
│                    (user.role = 'admin')                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              2. Get Permissions for Role                         │
│         PermissionService.getPermissionsForRole('admin')        │
│         Returns: ['grc:risk:read', 'admin:users:write', ...]    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│           3. Check Required Permission                           │
│      PermissionService.roleHasPermission(role, permission)      │
│                    Returns: true/false                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              4. Allow or Deny Access                             │
│           true → Continue to handler                            │
│           false → Return 403 Forbidden                          │
└─────────────────────────────────────────────────────────────────┘
```

## UI Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        App.tsx                                   │
│                    (Route Definitions)                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ProtectedRoute                                │
│              (Authentication Check)                             │
│              allowedRoles={['admin']}                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AdminLayout                                  │
│              (Role-based Menu Visibility)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Page Components                                │
│              (PermissionGuard for Actions)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Security Considerations

1. **Defense in Depth**: Both frontend and backend enforce permissions
2. **Backend Authority**: Frontend checks are for UX; backend is authoritative
3. **JWT Validation**: All requests require valid JWT token
4. **Role Immutability**: Users cannot change their own role
5. **Audit Logging**: All permission-sensitive actions are logged

## Extending the System

### Adding New Permissions

1. Add to `Permission` enum in `permission.enum.ts`
2. Add description to `PermissionDescriptions`
3. Update role mappings in `permission.service.ts`
4. Update frontend `ROLE_PERMISSIONS` in `usePermission.ts`

### Adding New Roles

1. Add to `UserRole` enum in `user.entity.ts`
2. Add role permissions mapping in `permission.service.ts`
3. Update frontend `ROLE_PERMISSIONS` in `usePermission.ts`
4. Update UI components as needed

## Testing

### Backend Tests
- Unit tests for PermissionService methods
- Integration tests for PermissionsGuard
- E2E tests for protected endpoints

### Frontend Tests
- Unit tests for usePermission hook
- Component tests for PermissionGuard
- E2E tests for admin panel access control
