# UI Route & Feature Inventory

**Last Updated:** 2024-12-19  
**Sprint:** UI Recovery Sprint (UI-1)  
**Staging URL:** http://46.224.99.150

## Overview

This document provides a comprehensive inventory of all frontend routes, pages, menu entries, required permissions, API endpoints, and current status. This inventory is used for tracking UI recovery progress and identifying broken or missing features.

---

## Main Application Routes

### Public Routes

| Route | Component | Purpose | Status | Notes |
|-------|-----------|---------|--------|-------|
| `/login` | `Login` | User authentication | ✅ OK | Uses `/auth/login` endpoint |

### Protected Routes (Main Layout)

All routes below are wrapped in `<Layout />` component and require authentication.

#### Dashboard & Navigation

| Route | Menu Entry | Component | Purpose | Required Permissions | API Endpoints | Status | Notes |
|-------|------------|-----------|---------|---------------------|---------------|--------|-------|
| `/` | - | Redirect | Redirects to `/dashboard` | Any authenticated user | - | ✅ OK | Auto-redirect |
| `/dashboard` | Dashboard (standalone) | `Dashboard` | Main dashboard with KPIs and charts | Any authenticated user | `/dashboard/overview`, `/dashboard/risk-trends`, `/dashboard/compliance-by-regulation` | ✅ OK | Has loading/error states |
| `/todos` | To-Do (standalone) | `TodoList` | User task list | Any authenticated user | TBD | ⚠️ Unknown | Needs API endpoint verification |

#### GRC Module Routes

| Route | Menu Entry | Component | Purpose | Required Permissions | API Endpoints | Status | Notes |
|-------|------------|-----------|---------|---------------------|---------------|--------|-------|
| `/risk` | GRC > Risk Management | `RiskManagement` | Risk register and management | Any authenticated user (module: `risk`) | `/grc/risks`, `/grc/risks/:id`, `/grc/risks/summary`, `/grc/risks/statistics` | ✅ OK | Has loading/error states |
| `/governance` | GRC > Policies | `Governance` | Policy management | Any authenticated user (module: `policy`) | `/grc/policies`, `/grc/policies/:id`, `/grc/policies/summary` | ✅ OK | Has loading/error states |
| `/compliance` | GRC > Requirements | `Compliance` | Compliance requirements management | Any authenticated user (module: `compliance`) | `/grc/requirements`, `/grc/requirements/:id`, `/grc/requirements/summary` | ✅ OK | Has loading/error states |
| `/audits` | GRC > Audits | `AuditList` | Audit listing | Any authenticated user (module: `audit`) | `/grc/audits` | ⚠️ Needs verification | Check API endpoints |
| `/audits/new` | - | `AuditDetail` | Create new audit | Any authenticated user (module: `audit`) | `/grc/audits` (POST) | ⚠️ Needs verification | Check API endpoints |
| `/audits/:id` | - | `AuditDetail` | View audit details | Any authenticated user (module: `audit`) | `/grc/audits/:id` | ⚠️ Needs verification | Check API endpoints |
| `/audits/:id/edit` | - | `AuditDetail` | Edit audit | Any authenticated user (module: `audit`) | `/grc/audits/:id` (PATCH) | ⚠️ Needs verification | Check API endpoints |
| `/audits/:auditId/reports/:reportId` | - | `ReportViewer` | View audit report | Any authenticated user (module: `audit`) | `/audit-report-templates/:id/render` | ⚠️ Needs verification | Check API endpoints |
| `/findings/:id` | - | `FindingDetail` | View finding details | Any authenticated user (module: `audit`) | `/grc/findings/:id` | ⚠️ Needs verification | Check API endpoints |
| `/findings/:id/edit` | - | `FindingDetail` | Edit finding | Any authenticated user (module: `audit`) | `/grc/findings/:id` (PATCH) | ⚠️ Needs verification | Check API endpoints |
| `/standards` | - | `StandardsLibrary` | Standards library browser | Any authenticated user | `/grc/standards`, `/grc/standards/:id` | ⚠️ Needs verification | Check API endpoints |
| `/standards/:id` | - | `StandardDetail` | View standard details | Any authenticated user | `/grc/standards/:id`, `/grc/standards/:id/with-clauses` | ⚠️ Needs verification | Check API endpoints |
| `/processes` | GRC > Processes | `ProcessManagement` | Process management | Any authenticated user | `/grc/processes`, `/grc/processes/:id` | ⚠️ Needs verification | Check API endpoints |
| `/violations` | GRC > Violations | `ProcessViolations` | Process violations tracking | Any authenticated user | `/grc/process-violations`, `/grc/process-violations/:id` | ⚠️ Needs verification | Check API endpoints |

#### ITSM Module Routes

| Route | Menu Entry | Component | Purpose | Required Permissions | API Endpoints | Status | Notes |
|-------|------------|-----------|---------|---------------------|---------------|--------|-------|
| `/incidents` | ITSM > Incidents | `IncidentManagement` | Incident management | Any authenticated user | `/itsm/incidents`, `/itsm/incidents/:id` | ⚠️ Needs verification | Check API endpoints |

#### Dashboard Routes

| Route | Menu Entry | Component | Purpose | Required Permissions | API Endpoints | Status | Notes |
|-------|------------|-----------|---------|---------------------|---------------|--------|-------|
| `/dashboards/audit` | Dashboards > Audit Dashboard | `AuditDashboard` | Audit analytics dashboard | `admin`, `auditor`, `audit_manager`, `governance` | `/grc/dashboard/audit-overview` | ⚠️ Needs verification | Check API endpoints |
| `/dashboards/compliance` | Dashboards > Compliance Dashboard | `ComplianceDashboard` | Compliance analytics dashboard | `admin`, `governance`, `compliance`, `audit_manager` | `/grc/dashboard/compliance-overview` | ⚠️ Needs verification | Check API endpoints |
| `/dashboards/grc-health` | Dashboards > GRC Health | `GrcHealthDashboard` | GRC health score dashboard | `admin`, `governance`, `executive`, `director` | `/grc/dashboard/grc-health` | ⚠️ Needs verification | Check API endpoints |

#### User Management Routes

| Route | Menu Entry | Component | Purpose | Required Permissions | API Endpoints | Status | Notes |
|-------|------------|-----------|---------|---------------------|---------------|--------|-------|
| `/users` | Admin > User Management | `UserManagement` | User CRUD operations | `admin`, `manager` | `/users` (Express backend) | ✅ OK | Has loading/error states |

#### Admin Routes (Legacy)

| Route | Menu Entry | Component | Purpose | Required Permissions | API Endpoints | Status | Notes |
|-------|------------|-----------|---------|---------------------|---------------|--------|-------|
| `/admin-legacy` | Admin > Admin Panel | `AdminPanel` | Legacy admin panel (tabs) | `admin` | `/users`, `/health/detailed`, `/compliance/audit-logs` | ⚠️ Legacy | Deprecated in favor of `/admin/*` routes |

#### Utility Routes

| Route | Menu Entry | Component | Purpose | Required Permissions | API Endpoints | Status | Notes |
|-------|------------|-----------|---------|---------------------|---------------|--------|-------|
| `/dotwalking` | Admin > Query Builder | `DotWalkingBuilder` | Dot-walking query builder | Any authenticated user | `/dotwalking/schema`, `/dotwalking/suggestions`, `/dotwalking/validate` | ⚠️ Needs verification | Check API endpoints |
| `/profile` | - (Profile menu) | `Profile` | User profile settings | Any authenticated user | `/users/me`, `/auth/me` | ⚠️ Needs verification | Check API endpoints |

---

## Admin Panel Routes

All routes below are wrapped in `<AdminLayout />` component and require `admin` role.

| Route | Menu Entry | Component | Purpose | API Endpoints | Status | Notes |
|-------|------------|-----------|---------|---------------|--------|-------|
| `/admin` | - | Redirect | Redirects to `/admin/users` | - | ✅ OK | Auto-redirect |
| `/admin/users` | Users | `AdminUsers` | User management (NestJS) | `/users` (NestJS) | ⚠️ Needs verification | Check if uses NestJS or Express |
| `/admin/roles` | Roles | `AdminRoles` | Role management | `/platform/acl/permissions`, `/platform/acl/permissions/role/:role` | ⚠️ Needs verification | Check API endpoints |
| `/admin/permissions` | Permissions | `AdminRoles` | Permission management (same as roles) | `/platform/acl/permissions` | ⚠️ Needs verification | Check API endpoints |
| `/admin/tenants` | Tenants | `AdminTenants` | Tenant management | `/tenants/current`, `/tenants/users` | ⚠️ Needs verification | Check API endpoints |
| `/admin/audit-logs` | Audit Logs | `AdminAuditLogs` | System audit logs | `/platform/audit-logs` or similar | ⚠️ Needs verification | Check API endpoints |
| `/admin/system` | System Status | `AdminSystem` | System health and diagnostics | `/health/live`, `/health/db`, `/health/auth`, `/health/detailed` | ✅ OK | Has diagnostics (needs enhancement) |
| `/admin/settings` | System Settings | `AdminSettings` | System configuration | TBD | ⚠️ Needs verification | Check API endpoints |

---

## Menu Structure

### Main Navigation Menu (`Layout.tsx`)

The main navigation is organized into groups:

#### Standalone Items
- **Dashboard** (`/dashboard`) - Always visible
- **To-Do** (`/todos`) - Always visible

#### GRC Group
- **Risk Management** (`/risk`) - Module: `risk`
- **Policies** (`/governance`) - Module: `policy`
- **Requirements** (`/compliance`) - Module: `compliance`
- **Audits** (`/audits`) - Module: `audit`
- **Processes** (`/processes`) - No module requirement
- **Violations** (`/violations`) - No module requirement

#### ITSM Group
- **Incidents** (`/incidents`) - No module requirement

#### Dashboards Group
- **Audit Dashboard** (`/dashboards/audit`) - Module: `audit`, Roles: `admin`, `auditor`, `audit_manager`, `governance`
- **Compliance Dashboard** (`/dashboards/compliance`) - Module: `compliance`, Roles: `admin`, `governance`, `compliance`, `audit_manager`
- **GRC Health** (`/dashboards/grc-health`) - Roles: `admin`, `governance`, `executive`, `director`

#### Admin Group (admin role only)
- **User Management** (`/users`) - Roles: `admin`, `manager`
- **Admin Panel** (`/admin`) - Module: `platform.admin`, Role: `admin`
- **Query Builder** (`/dotwalking`) - No restrictions

### Profile Menu (Top Right)
- **Profile Settings** (`/profile`) - Any authenticated user
- **Logout** - Clears auth and redirects to `/login`

---

## API Endpoint Mapping

### Backend Types

The application supports two backend types:
1. **NestJS Backend** (port 3002) - Primary backend with tenant isolation
2. **Express Backend** (port 3001) - Legacy backend for some endpoints

### API Base URL Configuration

- **Development:** `http://localhost:3001/api` (default)
- **Staging:** Configured via `REACT_APP_API_URL` environment variable
- **Production:** Configured via `REACT_APP_API_URL` environment variable

### API Client Services

1. **`api.ts`** - Base axios instance with auth/tenant interceptors
2. **`grcClient.ts`** - GRC domain API clients (risks, policies, requirements, audits, etc.)
3. **`platformApi.ts`** - Platform API clients (ACL, form layouts, UI policies, modules, search)
4. **`userClient.ts`** - User management API client (Express backend)

### Key API Endpoints by Domain

#### Authentication
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user
- `POST /auth/refresh` - Refresh access token

#### GRC Domain
- `GET /grc/risks` - List risks
- `GET /grc/policies` - List policies
- `GET /grc/requirements` - List requirements
- `GET /grc/audits` - List audits
- `GET /grc/standards` - List standards
- `GET /grc/processes` - List processes
- `GET /grc/process-violations` - List process violations

#### ITSM Domain
- `GET /itsm/incidents` - List incidents

#### Platform Domain
- `GET /platform/modules/enabled` - Get enabled modules
- `GET /platform/acl/permissions` - Get permissions
- `GET /platform/search/:tableName` - Search entities

#### Health & Diagnostics
- `GET /health` - Overall health
- `GET /health/live` - Liveness check
- `GET /health/ready` - Readiness check
- `GET /health/db` - Database health
- `GET /health/auth` - Auth service health
- `GET /health/detailed` - Detailed health with uptime

---

## Status Legend

- ✅ **OK** - Route is functional, has proper loading/error states, API endpoints verified
- ⚠️ **Needs Verification** - Route exists but API endpoints or functionality need verification
- ❌ **Broken** - Route is broken (white screen, errors, missing API endpoints)
- 🚫 **Hidden** - Route exists but is hidden from menu (may be deprecated)
- 📝 **Missing** - Route should exist but component is missing

---

## Known Issues

### High Priority
1. **Missing Diagnostics Page** - Need to add diagnostics page in Admin Panel with:
   - Frontend version/commit
   - API base URL
   - Current tenant ID
   - Logged-in user email/role
   - "Ping backend" button calling `/health`

2. **API Path Verification** - Many routes need API endpoint verification:
   - Audit routes (`/audits/*`)
   - Finding routes (`/findings/*`)
   - Standards routes (`/standards/*`)
   - Process routes (`/processes`, `/violations`)
   - Dashboard routes (`/dashboards/*`)

3. **Missing Loading/Error States** - Some pages may lack proper loading/error/empty states:
   - `TodoList`
   - `AuditList`
   - `AuditDetail`
   - `FindingDetail`
   - `StandardsLibrary`
   - `StandardDetail`
   - `ProcessManagement`
   - `ProcessViolations`
   - `IncidentManagement`
   - `ReportViewer`
   - `Profile`
   - `DotWalkingBuilder`

### Medium Priority
1. **Legacy Admin Panel** - `/admin-legacy` route should be deprecated or removed
2. **Module-based Menu Filtering** - Some menu items depend on enabled modules; verify module checking logic
3. **Tenant Header Verification** - Ensure all API calls include `x-tenant-id` header where required

### Low Priority
1. **Breadcrumb Navigation** - Some detail pages may not have proper breadcrumbs
2. **Empty State Messages** - Some pages may lack user-friendly empty state messages

---

## Next Steps

1. ✅ Create route inventory (this document)
2. ⏳ Add Diagnostics page to Admin Panel
3. ⏳ Verify and fix API endpoint paths
4. ⏳ Add missing loading/error/empty states to all pages
5. ⏳ Run frontend build and lint
6. ⏳ Create staging smoke test checklist
7. ⏳ Test all routes in staging environment

---

## Notes

- All routes use React Router v6
- Authentication is handled via `AuthContext` and `ProtectedRoute` component
- Tenant isolation is handled via `x-tenant-id` header in API interceptor
- Module-based access control is handled via `ModuleGuard` component
- Role-based access control is handled via `ProtectedRoute` component with `allowedRoles` prop
