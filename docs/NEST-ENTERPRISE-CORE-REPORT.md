# NestJS Enterprise Core Implementation Report

This document summarizes the implementation of the NestJS enterprise core infrastructure and Express-Nest bridge architecture.

## Summary

This sprint implemented the foundational enterprise features for the NestJS backend, establishing it as the future core for GRC/ITSM functionality. The implementation includes audit logging, settings management, event bus, multi-tenant repository abstraction, and a minimal Express-to-NestJS proxy bridge.

## What Was Implemented

### 1. Audit Logging Core

A comprehensive audit logging system that automatically captures all API requests:

**Components:**
- `AuditLog` entity (`nest_audit_logs` table) with fields for userId, tenantId, action, resource, resourceId, statusCode, metadata, ipAddress, and timestamp
- `AuditInterceptor` - Global interceptor that captures request/response data and emits audit events
- `AuditService` - Handles persistence and event listening

**Features:**
- Automatic logging of all authenticated requests
- Excludes health check endpoints to reduce noise
- Configurable via `NEST_AUDIT_LOG_ENABLED` environment variable
- Captures HTTP method, path, user, tenant, status code, and IP address
- Stores additional metadata as JSONB for flexible querying

### 2. Event Bus (Domain Events)

A synchronous event bus using `@nestjs/event-emitter` for decoupled communication:

**Domain Events:**
- `UserLoggedInEvent` - Emitted after successful login
- `TenantAccessedEvent` - Emitted when TenantGuard validates access
- `AuditLogEvent` - Emitted by AuditInterceptor for all auditable actions

**Usage:**
```typescript
// Emit an event
this.eventEmitter.emit(DomainEventNames.USER_LOGGED_IN, new UserLoggedInEvent(...));

// Listen to an event
@OnEvent(DomainEventNames.USER_LOGGED_IN)
handleUserLogin(event: UserLoggedInEvent) { ... }
```

### 3. Settings/Configuration Core

A flexible settings system with tenant-specific overrides:

**Entities:**
- `SystemSetting` (`nest_system_settings`) - Global settings for all tenants
- `TenantSetting` (`nest_tenant_settings`) - Tenant-specific overrides

**Features:**
- Fallback pattern: tenant setting → system setting → default value
- Auto-seeding of default settings on startup
- Settings categories: security, localization, limits, audit

**Default Settings Seeded:**
- `maxLoginAttempts`: 5
- `sessionTimeoutMinutes`: 60
- `defaultLocale`: "en-US"
- `defaultTimezone`: "UTC"
- `maxFileUploadSizeMB`: 10
- `auditLogRetentionDays`: 90

**Endpoints:**
- `GET /settings/effective?key=<key>` - Get effective setting with fallback
- `GET /settings/system` - List all system settings
- `GET /settings/tenant` - List tenant-specific settings (requires x-tenant-id)

### 4. Multi-Tenant Repository Abstraction

A base service class that provides tenant-aware CRUD operations:

**`MultiTenantServiceBase<T>`:**
- `findAllForTenant(tenantId, options)` - Find all entities for a tenant
- `findOneForTenant(tenantId, id)` - Find one entity ensuring tenant ownership
- `createForTenant(tenantId, data)` - Create with automatic tenantId assignment
- `updateForTenant(tenantId, id, data)` - Update with tenant verification
- `deleteForTenant(tenantId, id)` - Delete with tenant verification
- `countForTenant(tenantId)` - Count entities for a tenant
- `existsForTenant(tenantId, id)` - Check existence with tenant filter

**Applied to UsersService** as a demonstration of the pattern.

### 5. RBAC Layer

Role-Based Access Control for protecting routes:

**Components:**
- `UserRole` enum: ADMIN, MANAGER, USER
- `@Roles()` decorator for specifying required roles
- `RolesGuard` for enforcing role requirements

**Usage:**
```typescript
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Get('admin-only')
adminOnly() { ... }
```

### 6. Express → NestJS Proxy Bridge

A minimal proxy in the Express backend for gradual migration:

**Configuration:**
- `NEST_API_BASE_URL` environment variable (default: http://localhost:3002)

**Proxy Route:**
- `GET /api/nest/health` - Proxies to NestJS `/health/ready`
- `ALL /api/nest/*` - Proxies any request to NestJS backend

**Features:**
- Forwards Authorization header
- Forwards x-tenant-id header
- Forwards User-Agent and X-Forwarded-For for audit logging
- Transparent status code and body forwarding
- Returns 502 Bad Gateway if NestJS is unavailable

## Files Created

### NestJS Backend (`backend-nest/`)

**Audit Module:**
- `src/audit/audit-log.entity.ts` - AuditLog entity
- `src/audit/audit.service.ts` - Audit service with event handlers
- `src/audit/audit.interceptor.ts` - Global audit interceptor
- `src/audit/audit.module.ts` - Audit module
- `src/audit/index.ts` - Barrel export

**Events Module:**
- `src/events/domain-events.ts` - Domain event definitions
- `src/events/events.module.ts` - Event emitter configuration
- `src/events/index.ts` - Barrel export

**Settings Module:**
- `src/settings/system-setting.entity.ts` - SystemSetting entity
- `src/settings/tenant-setting.entity.ts` - TenantSetting entity
- `src/settings/settings.service.ts` - Settings service with fallback logic
- `src/settings/settings.controller.ts` - Settings endpoints
- `src/settings/settings.module.ts` - Settings module
- `src/settings/index.ts` - Barrel export

**Common Module:**
- `src/common/multi-tenant-service.base.ts` - Multi-tenant service base class
- `src/common/index.ts` - Barrel export

**Auth Decorators/Guards:**
- `src/auth/decorators/roles.decorator.ts` - @Roles() decorator
- `src/auth/decorators/index.ts` - Barrel export
- `src/auth/guards/roles.guard.ts` - RolesGuard
- `src/auth/guards/index.ts` - Barrel export

**Tests:**
- `test/audit.e2e-spec.ts` - Audit logging e2e tests
- `test/settings.e2e-spec.ts` - Settings e2e tests

### Express Backend (`backend/`)

**Proxy Route:**
- `routes/nest-proxy.js` - NestJS proxy implementation

**Tests:**
- `tests/nest-proxy.test.js` - Proxy route tests with mocked fetch

### Documentation (`docs/`)

- `NEST-ENTERPRISE-CORE-PLAN.md` - Implementation plan
- `ARCHITECTURE-BRIDGE-EXPRESS-NEST.md` - Architecture blueprint
- `NEST-ENTERPRISE-CORE-REPORT.md` - This report

## Files Modified

### NestJS Backend (`backend-nest/`)

- `src/app.module.ts` - Added EventsModule, AuditModule, SettingsModule imports
- `src/config/configuration.ts` - Added audit configuration
- `src/auth/auth.service.ts` - Added UserLoggedInEvent emission
- `src/tenants/guards/tenant.guard.ts` - Added TenantAccessedEvent emission
- `src/users/users.service.ts` - Extended MultiTenantServiceBase
- `.env.example` - Added NEST_AUDIT_LOG_ENABLED documentation

### Express Backend (`backend/`)

- `server.js` - Added nest-proxy route registration
- `config/index.js` - Added nestApiBaseUrl configuration
- `.env.example` - Added NEST_API_BASE_URL documentation

## How to Use

### Adding a New Tenant-Aware Module

1. Create entity with `tenantId` field
2. Create service extending `MultiTenantServiceBase`
3. Create controller with `@UseGuards(JwtAuthGuard, TenantGuard)`
4. Register module in `AppModule`

See `docs/ARCHITECTURE-BRIDGE-EXPRESS-NEST.md` for detailed examples.

### Exposing NestJS Routes via Express

1. NestJS routes are automatically available at `/api/nest/*`
2. Example: NestJS `/users/me` → Express `/api/nest/users/me`
3. Headers (Authorization, x-tenant-id) are forwarded automatically

### Running the Backends

**Express Backend (port 3001):**
```bash
cd backend
npm run dev
```

**NestJS Backend (port 3002):**
```bash
cd backend-nest
npm run start:dev
```

### Testing

**Express Backend:**
```bash
cd backend
npm test  # 31 tests
```

**NestJS Backend:**
```bash
cd backend-nest
npm test       # Unit tests
npm run test:e2e  # E2E tests (requires PostgreSQL)
```

## Test Results

- **Express Backend:** 31 tests passing (including 12 new proxy tests)
- **NestJS Backend:** Unit tests passing, e2e tests require PostgreSQL

## Next Steps

1. **Migrate Auth Module** - Move authentication from Express to NestJS
2. **Migrate Risk Module** - Implement risk management in NestJS
3. **Migrate Compliance Module** - Implement compliance tracking in NestJS
4. **Migrate Governance Module** - Implement policy management in NestJS
5. **Update Frontend** - Optionally update frontend to call NestJS directly
6. **Deprecate Express** - Once all modules migrated, Express becomes optional gateway
