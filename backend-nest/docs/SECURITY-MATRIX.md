# Security Matrix - GRC Platform Backend

This document provides a comprehensive security matrix for all backend API endpoints, documenting authentication, authorization, and tenant isolation controls.

## Legend

| Symbol | Meaning |
|--------|---------|
| JwtAuthGuard | JWT token authentication required |
| TenantGuard | x-tenant-id header validation required |
| RolesGuard | Role-based access control (ADMIN, MANAGER, USER) |
| PermissionsGuard | Permission-based access control |
| Public | No authentication required |

## Security Matrix

### Health & Monitoring Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /health | GET | HealthController | Public | - | No | System | Low |
| /health/live | GET | HealthController | Public | - | No | System | Low |
| /health/ready | GET | HealthController | Public | - | No | System | Low |
| /health/db | GET | HealthController | Public | - | No | System | Low |
| /health/auth | GET | HealthController | Public | - | No | System | Low |
| /health/dotwalking | GET | HealthController | Public | - | No | System | Low |
| /metrics | GET | MetricsController | Public | - | No | System | Medium |
| /metrics/json | GET | MetricsController | Public | - | No | System | Medium |
| /metrics/basic | GET | MetricsController | Public | - | No | System | Medium |

### Authentication Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /auth/login | POST | AuthController | Public | - | No | User | Low |
| /auth/refresh | POST | AuthController | Public | - | No | User | Low |
| /auth/logout | POST | AuthController | JwtAuthGuard | - | No | User | Low |
| /auth/mfa/setup | POST | MfaController | JwtAuthGuard | - | No | User | Low |
| /auth/mfa/verify | POST | MfaController | Public | - | No | User | Low |
| /auth/mfa/disable | POST | MfaController | JwtAuthGuard | - | No | User | Low |
| /auth/mfa/status | GET | MfaController | JwtAuthGuard | - | No | User | Low |
| /auth/mfa/settings | GET | MfaController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_READ | Yes | Tenant | Low |
| /auth/mfa/admin/enforce | POST | MfaController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_USERS_WRITE | Yes | Tenant | Low |
| /auth/mfa/admin/status | GET | MfaController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_USERS_READ | Yes | Tenant | Low |
| /auth/mfa/admin/reset/:userId | POST | MfaController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_USERS_WRITE | Yes | Tenant | Low |
| /auth/ldap/status | GET | LdapController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_READ | Yes | Tenant | Low |
| /auth/ldap/config | GET | LdapController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_READ | Yes | Tenant | Low |
| /auth/ldap/config | PUT | LdapController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /auth/ldap/test | POST | LdapController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /auth/ldap/sync | POST | LdapController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |

### Tenant Management Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /tenants | GET | TenantsController | JwtAuthGuard, RolesGuard | ADMIN | No | All Tenants | Low |
| /tenants/current | GET | TenantsController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /tenants/users | GET | TenantsController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /tenants/health | GET | TenantsController | Public | - | No | System | Medium |

### User Management Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /users | GET | UsersController | JwtAuthGuard, RolesGuard | ADMIN, MANAGER | Yes | Tenant | Low |
| /users/me | GET | UsersController | JwtAuthGuard | - | No | User | Low |
| /users/count | GET | UsersController | Public | - | No | System | Medium |
| /users/health | GET | UsersController | Public | - | No | System | Low |
| /users/statistics/overview | GET | UsersController | JwtAuthGuard, RolesGuard | ADMIN, MANAGER | Yes | Tenant | Low |
| /users/departments/list | GET | UsersController | JwtAuthGuard | - | Yes | Tenant | Low |
| /users/:id | GET | UsersController | JwtAuthGuard | - | Yes | Tenant | Low |
| /users | POST | UsersController | JwtAuthGuard, RolesGuard | ADMIN | Yes | Tenant | Low |
| /users/:id | PATCH | UsersController | JwtAuthGuard | - | Yes | Tenant | Low |
| /users/:id | PUT | UsersController | JwtAuthGuard | - | Yes | Tenant | Low |
| /users/:id/role | PUT | UsersController | JwtAuthGuard, RolesGuard | ADMIN | Yes | Tenant | Low |
| /users/:id/password | PUT | UsersController | JwtAuthGuard | - | Yes | Tenant | Low |
| /users/:id/activate | PUT | UsersController | JwtAuthGuard, RolesGuard | ADMIN | Yes | Tenant | Low |
| /users/:id/deactivate | PUT | UsersController | JwtAuthGuard, RolesGuard | ADMIN | Yes | Tenant | Low |
| /users/:id | DELETE | UsersController | JwtAuthGuard, RolesGuard | ADMIN | Yes | Tenant | Low |

### GRC Risk Management Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /grc/risks | GET | GrcRiskController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_RISK_READ | Yes | Tenant | Low |
| /grc/risks/statistics | GET | GrcRiskController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_RISK_READ | Yes | Tenant | Low |
| /grc/risks/summary | GET | GrcRiskController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_RISK_READ | Yes | Tenant | Low |
| /grc/risks/:id | GET | GrcRiskController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_RISK_READ | Yes | Tenant | Low |
| /grc/risks | POST | GrcRiskController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_RISK_WRITE | Yes | Tenant | Low |
| /grc/risks/:id | PUT | GrcRiskController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_RISK_WRITE | Yes | Tenant | Low |
| /grc/risks/:id | DELETE | GrcRiskController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_RISK_DELETE | Yes | Tenant | Low |

### GRC Policy Management Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /grc/policies | GET | GrcPolicyController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_POLICY_READ | Yes | Tenant | Low |
| /grc/policies/:id | GET | GrcPolicyController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_POLICY_READ | Yes | Tenant | Low |
| /grc/policies | POST | GrcPolicyController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_POLICY_WRITE | Yes | Tenant | Low |
| /grc/policies/:id | PUT | GrcPolicyController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_POLICY_WRITE | Yes | Tenant | Low |
| /grc/policies/:id | DELETE | GrcPolicyController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_POLICY_DELETE | Yes | Tenant | Low |

### GRC Requirement Management Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /grc/requirements | GET | GrcRequirementController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_REQUIREMENT_READ | Yes | Tenant | Low |
| /grc/requirements/:id | GET | GrcRequirementController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_REQUIREMENT_READ | Yes | Tenant | Low |
| /grc/requirements | POST | GrcRequirementController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_REQUIREMENT_WRITE | Yes | Tenant | Low |
| /grc/requirements/:id | PUT | GrcRequirementController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_REQUIREMENT_WRITE | Yes | Tenant | Low |
| /grc/requirements/:id | DELETE | GrcRequirementController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_REQUIREMENT_DELETE | Yes | Tenant | Low |

### GRC Audit Management Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /grc/audits | GET | GrcAuditController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_AUDIT_READ | Yes | Tenant | Low |
| /grc/audits/:id | GET | GrcAuditController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_AUDIT_READ | Yes | Tenant | Low |
| /grc/audits | POST | GrcAuditController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_AUDIT_WRITE | Yes | Tenant | Low |
| /grc/audits/:id | PUT | GrcAuditController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_AUDIT_WRITE | Yes | Tenant | Low |
| /grc/audits/:id | DELETE | GrcAuditController | JwtAuthGuard, TenantGuard, PermissionsGuard | GRC_AUDIT_DELETE | Yes | Tenant | Low |

### ITSM Incident Management Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /itsm/incidents | GET | IncidentController | JwtAuthGuard, TenantGuard, PermissionsGuard | ITSM_INCIDENT_READ | Yes | Tenant | Low |
| /itsm/incidents/:id | GET | IncidentController | JwtAuthGuard, TenantGuard, PermissionsGuard | ITSM_INCIDENT_READ | Yes | Tenant | Low |
| /itsm/incidents | POST | IncidentController | JwtAuthGuard, TenantGuard, PermissionsGuard | ITSM_INCIDENT_WRITE | Yes | Tenant | Low |
| /itsm/incidents/:id | PUT | IncidentController | JwtAuthGuard, TenantGuard, PermissionsGuard | ITSM_INCIDENT_WRITE | Yes | Tenant | Low |
| /itsm/incidents/:id | DELETE | IncidentController | JwtAuthGuard, TenantGuard, PermissionsGuard | ITSM_INCIDENT_DELETE | Yes | Tenant | Low |

### Platform Module Endpoints (FIXED)

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /platform/modules/available | GET | ModulesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/modules/enabled | GET | ModulesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/modules/status | GET | ModulesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/modules/menu | GET | ModulesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/modules/menu/nested | GET | ModulesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/modules/check/:moduleKey | GET | ModulesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/modules/category/:category | GET | ModulesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/modules/:moduleKey/config | GET | ModulesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/modules/:moduleKey/enable | POST | ModulesController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /platform/modules/:moduleKey/disable | POST | ModulesController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /platform/modules/:moduleKey/config | PUT | ModulesController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /platform/modules/initialize | POST | ModulesController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |

### Platform UI Policies Endpoints (FIXED)

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /platform/ui-policies | GET | UiPoliciesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/ui-policies/tables | GET | UiPoliciesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/ui-policies/table/:tableName | GET | UiPoliciesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/ui-policies/:id | GET | UiPoliciesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/ui-policies | POST | UiPoliciesController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /platform/ui-policies/:id | PUT | UiPoliciesController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /platform/ui-policies/:id | DELETE | UiPoliciesController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /platform/ui-policies/evaluate | POST | UiPoliciesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/ui-policies/test | POST | UiPoliciesController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |

### Platform Form Layouts Endpoints (FIXED)

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /platform/form-layouts | GET | FormLayoutsController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/form-layouts/tables | GET | FormLayoutsController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/form-layouts/table/:tableName | GET | FormLayoutsController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/form-layouts/resolve/:tableName | GET | FormLayoutsController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/form-layouts/default/:tableName | GET | FormLayoutsController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /platform/form-layouts | POST | FormLayoutsController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /platform/form-layouts/:id | PUT | FormLayoutsController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /platform/form-layouts/:id | DELETE | FormLayoutsController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /platform/form-layouts/apply | POST | FormLayoutsController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |

### Onboarding Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /onboarding/context | GET | OnboardingController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |

### Todos Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /todos | GET | TodosController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /todos/:id | GET | TodosController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /todos | POST | TodosController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /todos/:id | PUT | TodosController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |
| /todos/:id | DELETE | TodosController | JwtAuthGuard, TenantGuard | - | Yes | Tenant | Low |

### Admin Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /admin/system/info | GET | SystemController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_READ | Yes | System | Low |
| /admin/system/health | GET | SystemController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_READ | Yes | System | Low |
| /admin/notifications/status | GET | NotificationsController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_READ | Yes | Tenant | Low |
| /admin/notifications/config | GET | NotificationsController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_READ | Yes | Tenant | Low |
| /admin/notifications/config | PUT | NotificationsController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /admin/notifications/test | POST | NotificationsController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |
| /admin/jobs/status | GET | JobsController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_READ | Yes | Tenant | Low |
| /admin/jobs/:jobId/run | POST | JobsController | JwtAuthGuard, TenantGuard, PermissionsGuard | ADMIN_SETTINGS_WRITE | Yes | Tenant | Low |

### Audit Log Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /audit-logs | GET | AuditController | JwtAuthGuard, RolesGuard | ADMIN | No | All | Low |

### Settings Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /settings/effective | GET | SettingsController | JwtAuthGuard, RolesGuard | ADMIN | Optional | System/Tenant | Low |
| /settings/system | GET | SettingsController | JwtAuthGuard, RolesGuard | ADMIN | No | System | Low |
| /settings/tenant | GET | SettingsController | JwtAuthGuard, RolesGuard | ADMIN | Yes | Tenant | Low |

### Dashboard Endpoints

| Endpoint | Method | Controller | Guards | Roles/Perms | Tenant Header | Data Scope | Risk |
|----------|--------|------------|--------|-------------|---------------|------------|------|
| /dashboard/metrics | GET | DashboardController | JwtAuthGuard, TenantGuard, PermissionsGuard | DASHBOARD_READ | Yes | Tenant | Low |
| /dashboard/summary | GET | DashboardController | JwtAuthGuard, TenantGuard, PermissionsGuard | DASHBOARD_READ | Yes | Tenant | Low |

## Security Fixes Applied

### 1. Platform Modules Controller (`/platform/modules/*`)

**Before:** Only `JwtAuthGuard` - no tenant isolation
**After:** `JwtAuthGuard` + `TenantGuard` for all endpoints, plus `PermissionsGuard` with `ADMIN_SETTINGS_WRITE` for write operations

**Risk Closed:** Authenticated users could access module configuration for any tenant by omitting or providing a different tenant ID.

### 2. Platform UI Policies Controller (`/platform/ui-policies/*`)

**Before:** Only `JwtAuthGuard` - no tenant isolation
**After:** `JwtAuthGuard` + `TenantGuard` for all endpoints, plus `PermissionsGuard` with `ADMIN_SETTINGS_WRITE` for write operations

**Risk Closed:** Authenticated users could create/modify/delete UI policies for any tenant.

### 3. Platform Form Layouts Controller (`/platform/form-layouts/*`)

**Before:** Only `JwtAuthGuard` - no tenant isolation
**After:** `JwtAuthGuard` + `TenantGuard` for all endpoints, plus `PermissionsGuard` with `ADMIN_SETTINGS_WRITE` for write operations

**Risk Closed:** Authenticated users could create/modify/delete form layouts for any tenant.

## Known Public Endpoints (Intentional)

The following endpoints are intentionally public for operational purposes:

1. **Health Endpoints** (`/health/*`) - Required for Kubernetes/Docker orchestration
2. **Metrics Endpoints** (`/metrics/*`) - Required for Prometheus monitoring
3. **Login/Auth Endpoints** (`/auth/login`, `/auth/mfa/verify`) - Required for authentication flow
4. **Tenant Health** (`/tenants/health`) - Exposes tenant count (consider restricting)
5. **User Count/Health** (`/users/count`, `/users/health`) - Exposes user count (consider restricting)

## Recommendations

1. Consider adding authentication to `/tenants/health` and `/users/count` endpoints to prevent information disclosure
2. Consider rate limiting on public endpoints to prevent enumeration attacks
3. Regularly audit new endpoints to ensure they follow the security patterns documented here
