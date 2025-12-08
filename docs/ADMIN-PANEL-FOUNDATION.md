# Admin Panel Foundation

This document describes the foundational architecture for the GRC Platform Admin Panel, implemented as part of Sprint B.

## Overview

The Admin Panel provides a centralized interface for system administrators to manage users, roles, permissions, and system settings. It establishes a scalable and extensible admin backbone that future modules (Table Builder, Field Designer, Workflow Designer, Evidence Storage) can attach to.

## Architecture

### Frontend Structure

```
frontend/src/
├── components/admin/
│   ├── AdminLayout.tsx       # Main layout with navigation drawer
│   ├── AdminPageHeader.tsx   # Reusable page header component
│   ├── AdminCard.tsx         # Card component for displaying info
│   ├── AdminTable.tsx        # Generic table with pagination/sorting
│   ├── AdminModal.tsx        # Modal dialog component
│   ├── AdminFormField.tsx    # Form field component
│   ├── PermissionGuard.tsx   # Permission-based access control
│   └── index.ts              # Exports
├── pages/admin/
│   ├── AdminUsers.tsx        # User management page
│   ├── AdminRoles.tsx        # Roles and permissions page
│   ├── AdminSettings.tsx     # System settings page
│   └── index.ts              # Exports
└── hooks/
    └── usePermission.ts      # Permission hook and utilities
```

### Backend Structure

```
backend-nest/src/
├── auth/permissions/
│   ├── permission.enum.ts    # Permission definitions
│   ├── permission.service.ts # Role-to-permission mapping
│   └── permissions.guard.ts  # Permission guard decorator
├── settings/
│   └── settings.controller.ts # System settings endpoints
└── users/
    └── users.controller.ts   # User management endpoints
```

## Route Structure

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin` | AdminLayout | Admin panel shell with navigation |
| `/admin/users` | AdminUsers | User management (CRUD) |
| `/admin/roles` | AdminRoles | Roles and permissions view |
| `/admin/settings` | AdminSettings | System settings overview |
| `/admin/permissions` | AdminRoles | Permissions matrix (read-only) |
| `/admin/tenants` | AdminSettings | Tenant information (read-only) |

## Shared Components

### AdminLayout

The main layout component providing:
- Permanent left navigation drawer (260px width)
- Role-based menu visibility
- Current user info display
- Outlet for nested routes

### AdminPageHeader

Reusable header component with:
- Breadcrumb navigation
- Page title and subtitle
- Action buttons slot

### AdminCard

Card component supporting:
- Title, subtitle, and value display
- Icon support
- Loading and error states
- Refresh button
- Custom children content

### AdminTable

Generic table component with:
- Column definitions with custom formatters
- Pagination (configurable rows per page)
- Sorting (client-side)
- Row selection (single/multiple)
- Row actions
- Loading, error, and empty states
- Nested property access via dot notation

### AdminModal

Modal dialog component with:
- Customizable title and content
- Primary and secondary actions
- Loading states
- Close button and backdrop click handling

### AdminFormField

Form field component supporting:
- Multiple input types (text, email, password, number, select, multiselect, switch, textarea)
- Validation error display
- Helper text
- Required field indicator

### PermissionGuard

Permission-based access control component:
- Single or multiple permission checks
- Require all or any permissions
- Custom fallback content
- Access denied message

## Navigation Menu

The admin navigation includes:

**Active Items:**
- Users - User management
- Roles - Role and permission management
- System Settings - System configuration

**Read-Only Items:**
- Permissions - Permission matrix view
- Tenants - Tenant information

**Coming Soon:**
- Tables - Table Builder (future)
- Fields - Field Designer (future)
- Workflows - Workflow Designer (future)

## User Management Features

The AdminUsers page provides:
- User list with search and pagination
- Create new user with form validation
- Edit existing user details
- Delete user (with confirmation)
- Change user role
- Toggle active/inactive status
- Role-based chip display (color-coded)
- Status chip display (Active/Inactive)

## System Settings Display

The AdminSettings page shows:
- Backend version
- Frontend version
- API Gateway status
- Database status
- System uptime
- JWT expiry configuration
- Active tenant
- Storage provider
- Environment information
- Grouped settings by category

## API Endpoints

### User Management
- `GET /users` - List all users
- `GET /users/:id` - Get user details
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
- `PATCH /users/:id/role` - Change user role
- `PATCH /users/:id/activate` - Activate user
- `PATCH /users/:id/deactivate` - Deactivate user

### System Settings
- `GET /settings/system` - Get all system settings
- `GET /settings/system-info` - Get system information
- `GET /health/detailed` - Get detailed health status

## Security

All admin routes are protected by:
1. JWT authentication (JwtAuthGuard)
2. Role-based access control (admin role required)
3. Permission-based access control (granular permissions)

See [RBAC-DESIGN.md](./RBAC-DESIGN.md) for detailed RBAC documentation.

## Future Extensibility

The admin panel is designed to be extensible:

1. **New Menu Items**: Add entries to the `menuItems` array in AdminLayout
2. **New Pages**: Create new page components in `pages/admin/`
3. **New Permissions**: Add to Permission enum and role mappings
4. **New Shared Components**: Add to `components/admin/`

Future modules will integrate by:
1. Adding their routes under `/admin/*`
2. Using shared admin components for consistent UI
3. Implementing permission checks for their features
4. Adding navigation items to AdminLayout
