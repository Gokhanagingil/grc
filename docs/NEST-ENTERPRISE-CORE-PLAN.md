# NestJS Enterprise Core Plan

## Overview

This document outlines the plan to strengthen the NestJS backend (`backend-nest/`) as the future enterprise core for the GRC + ITSM platform, while maintaining the existing Express backend (`backend/`) during the transition period.

## Current State Summary

### Express Backend (`backend/`)

The Express backend is the current production API serving the frontend:

- **Port**: 3001
- **Database**: SQLite (with PostgreSQL support via `DB_CLIENT` env var)
- **Authentication**: JWT-based with bcrypt password hashing
- **Major Modules**:
  - Auth (login, register, /me)
  - Users (CRUD, role management)
  - Governance (policies, organizations)
  - Risk (risks, assessments)
  - Compliance (requirements, audit logs)
  - Dashboard (analytics, trends)
- **Security**: Helmet, CORS (configurable origins), rate limiting on auth endpoints
- **Tests**: Jest + Supertest (health, auth rate limiting, DB connectivity)

### NestJS Backend (`backend-nest/`)

The NestJS backend is the new enterprise-ready core:

- **Port**: 3002
- **Database**: PostgreSQL (TypeORM 0.3.28, `autoLoadEntities: true`, `synchronize` in dev)
- **Authentication**: JWT with Passport strategy
- **RBAC**: Role enum (ADMIN, MANAGER, USER), `@Roles()` decorator, `RolesGuard`
- **Multi-Tenancy**: 
  - `Tenant` entity with UUID primary key
  - `User.tenantId` foreign key (one-to-many: many users per tenant)
  - `TenantGuard` validates `x-tenant-id` header and user membership
- **Health**: `/health/live` and `/health/ready` endpoints
- **Tests**: Jest + Supertest (health, auth, users, RBAC, tenants e2e tests)
- **CI**: GitHub Actions workflow with PostgreSQL service container

### Frontend

- **Port**: 3000
- **API Target**: Express backend only (`http://localhost:3001/api`)
- **Stack**: React + TypeScript + Material-UI

## Role of Each Backend

### NestJS: Future "GRC/ITSM Core Backend"

NestJS will become the primary backend for:
- All new enterprise features (audit logging, settings, event-driven architecture)
- Multi-tenant data isolation
- Role-based access control
- Future GRC/ITSM modules (Risk, Compliance, Governance, ITSM)

### Express: Legacy API + Thin Gateway

Express will:
- Continue serving the frontend during transition
- Act as a proxy/gateway to NestJS for new features
- Gradually deprecate as modules migrate to NestJS

## Migration Path (High-Level)

### Phase 1: Enterprise Core (This Sprint)
- Add audit logging, settings, event bus to NestJS
- Implement multi-tenant repository abstraction
- Create Express-to-Nest proxy pattern
- Document architecture bridge

### Phase 2: Module Migration (Future)
- Migrate Risk module from Express to NestJS
- Migrate Compliance module
- Migrate Governance module
- Update frontend to call NestJS directly for migrated modules

### Phase 3: Full Transition (Future)
- Migrate remaining modules (Dashboard, Users)
- Frontend points directly to NestJS
- Express deprecated or removed

## Implementation Tasks (This Sprint)

### Task 1: Audit Logging Core
- `AuditLog` entity with tenantId, userId, action, resource, metadata
- Global `AuditInterceptor` that emits events (not direct DB writes)
- `NEST_AUDIT_LOG_ENABLED` config flag
- E2E tests verifying audit log creation

### Task 2: Settings/Configuration Core
- `SystemSetting` entity (global settings)
- `TenantSetting` entity (tenant-specific overrides)
- `SettingsService` with fallback logic (tenant -> system)
- Protected endpoint: `GET /settings/effective?key=<key>`
- Seed default settings

### Task 3: Event Bus
- Install `@nestjs/event-emitter`
- Define domain events: `UserLoggedInEvent`, `TenantAccessedEvent`, `AuditLogEvent`
- Emit events in AuthService and TenantGuard
- Event handlers for audit logging

### Task 4: Multi-Tenant Repository Abstraction
- `MultiTenantServiceBase<T>` abstract class
- Methods: `findAllForTenant()`, `findOneForTenant()`, `createForTenant()`
- Apply to `TenantSetting` (new) and `UsersService` (existing)
- Tests verifying tenant isolation

### Task 5: Architecture Blueprint Doc
- Document current vs target architecture
- JWT and tenant context flow between Express and NestJS
- Guidelines for new module development

### Task 6: Express-to-Nest Proxy
- `NEST_API_BASE_URL` config in Express
- `/api/nest/health` proxy route
- Forward Authorization and x-tenant-id headers
- Tests with mocked HTTP client

## Technical Decisions

### Event Bus Choice
Using `@nestjs/event-emitter` (synchronous, no external dependencies) per user constraint "keep it light, no queues".

### Multi-Tenant Abstraction Pattern
Using service composition (base service wrapping Repository) rather than extending Repository directly, as this is more idiomatic for NestJS and works well with TypeORM 0.3+.

### Audit Logging Architecture
Interceptor emits events -> Event handler persists to DB. This keeps the interceptor thin and reuses the event bus infrastructure.

### Express Proxy Implementation
Simple axios-based HTTP client (not http-proxy-middleware) for single-route proxy. Easier to test and maintain.

## Files to Create/Modify

### New Files (NestJS)
- `src/audit/audit-log.entity.ts`
- `src/audit/audit.module.ts`
- `src/audit/audit.service.ts`
- `src/audit/audit.interceptor.ts`
- `src/settings/system-setting.entity.ts`
- `src/settings/tenant-setting.entity.ts`
- `src/settings/settings.module.ts`
- `src/settings/settings.service.ts`
- `src/settings/settings.controller.ts`
- `src/events/events.module.ts`
- `src/events/domain-events.ts`
- `src/events/handlers/*.ts`
- `src/common/multi-tenant-service.base.ts`
- `test/audit.e2e-spec.ts`
- `test/settings.e2e-spec.ts`

### New Files (Express)
- `services/nest-client.js`
- `routes/nest.js`

### Modified Files
- `backend-nest/src/app.module.ts` (add new modules)
- `backend-nest/src/config/configuration.ts` (add audit config)
- `backend-nest/src/auth/auth.service.ts` (emit login event)
- `backend-nest/src/tenants/guards/tenant.guard.ts` (emit access event)
- `backend/config/index.js` (add NEST_API_BASE_URL)
- `backend/server.js` (mount nest proxy routes)
- `backend/.env.example` (document new env var)

## Success Criteria

1. All existing Express tests pass
2. All existing NestJS tests pass
3. New audit logging creates DB entries for protected endpoints
4. Settings service returns correct values with tenant fallback
5. Events are emitted and handled correctly
6. Multi-tenant abstraction enforces tenant isolation
7. Express proxy forwards requests to NestJS correctly
8. Documentation is clear and actionable
