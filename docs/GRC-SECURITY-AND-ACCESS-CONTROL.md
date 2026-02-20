# GRC Backend Security & Access Control

This document describes the security architecture, access control model, and protection mechanisms implemented in the NestJS GRC backend.

## Table of Contents

1. [RBAC & Permission Model](#rbac--permission-model)
2. [Tenant Isolation Model](#tenant-isolation-model)
3. [Rate Limiting & Abuse Protection](#rate-limiting--abuse-protection)
4. [Security Headers](#security-headers)
5. [Security Logging](#security-logging)
6. [Authentication Flow](#authentication-flow)

---

## RBAC & Permission Model

The GRC backend implements a centralized Role-Based Access Control (RBAC) system with explicit permissions.

### Roles

The system defines three user roles:

| Role | Description |
|------|-------------|
| `ADMIN` | Full system access, including administrative functions |
| `MANAGER` | Full GRC module access (read/write) but no admin functions |
| `USER` | Read-only access to GRC modules |

### Permissions

Permissions are defined in `src/auth/permissions/permission.enum.ts`:

| Permission | Description |
|------------|-------------|
| `GRC_RISK_READ` | View risks |
| `GRC_RISK_WRITE` | Create, update, delete risks |
| `GRC_POLICY_READ` | View policies |
| `GRC_POLICY_WRITE` | Create, update, delete policies |
| `GRC_REQUIREMENT_READ` | View compliance requirements |
| `GRC_REQUIREMENT_WRITE` | Create, update, delete requirements |
| `GRC_STATISTICS_READ` | View GRC statistics and dashboards |
| `GRC_ADMIN` | Administrative functions |

### Role-to-Permission Matrix

| Permission | ADMIN | MANAGER | USER |
|------------|:-----:|:-------:|:----:|
| `GRC_RISK_READ` | Y | Y | Y |
| `GRC_RISK_WRITE` | Y | Y | - |
| `GRC_POLICY_READ` | Y | Y | Y |
| `GRC_POLICY_WRITE` | Y | Y | - |
| `GRC_REQUIREMENT_READ` | Y | Y | Y |
| `GRC_REQUIREMENT_WRITE` | Y | Y | - |
| `GRC_STATISTICS_READ` | Y | Y | - |
| `GRC_ADMIN` | Y | - | - |

### Implementation

Permissions are enforced using the `@Permissions()` decorator and `PermissionsGuard`:

```typescript
// Example: Protecting a route with permissions
@Get()
@Permissions(Permission.GRC_RISK_READ)
async findAll() {
  // Only users with GRC_RISK_READ permission can access
}

@Post()
@Permissions(Permission.GRC_RISK_WRITE)
async create(@Body() dto: CreateRiskDto) {
  // Only users with GRC_RISK_WRITE permission can access
}
```

### Access Denied Response

When a user lacks required permissions, the system returns:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied: Insufficient permissions",
  "code": "ACCESS_DENIED_INSUFFICIENT_PERMISSIONS",
  "requiredPermissions": ["grc:risk:write"],
  "missingPermissions": ["grc:risk:write"]
}
```

---

## Tenant Isolation Model

The GRC backend enforces strict tenant isolation to prevent cross-tenant data access.

### How Tenant ID is Resolved

1. The `x-tenant-id` header is required for all GRC endpoints
2. The `TenantGuard` validates that:
   - The tenant ID is a valid UUID
   - The tenant exists in the database
   - The authenticated user belongs to the requested tenant

### Query Scoping

All GRC repository operations are automatically scoped by tenant ID:

```typescript
// MultiTenantServiceBase ensures all queries include tenant filter
async findAllActiveForTenant(tenantId: string, options?: FindManyOptions<T>) {
  return this.repository.find({
    where: {
      tenantId,
      isDeleted: false,
      ...options?.where,
    } as FindOptionsWhere<T>,
    ...options,
  });
}
```

### Cross-Tenant Access Attempts

When a user attempts to access another tenant's data:

| Scenario | Response |
|----------|----------|
| Missing `x-tenant-id` header | 400 Bad Request |
| Invalid UUID format | 400 Bad Request |
| Non-existent tenant | 403 Forbidden |
| User not member of tenant | 403 Forbidden |
| Valid tenant access | 200 OK (with tenant-scoped data) |

### Tenant Isolation Guarantees

1. **Repository Level**: All queries include `tenantId` filter
2. **Guard Level**: `TenantGuard` validates tenant membership before request processing
3. **Response Level**: All returned entities include `tenantId` for verification
4. **Audit Level**: All operations are logged with `tenantId` for traceability

---

## Rate Limiting & Abuse Protection

### Global Rate Limiting

The backend uses `@nestjs/throttler` for rate limiting:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Default (all endpoints) | 100 requests | 60 seconds |
| Auth endpoints (`/auth/login`) | 10 requests | 60 seconds |

### Brute Force Protection

The login endpoint includes additional brute force protection:

| Feature | Behavior |
|---------|----------|
| Tracking | By IP address + username combination |
| Exponential Backoff | 1s, 2s, 4s, 8s, 16s, 32s, 60s max |
| Lockout Threshold | 5 failed attempts |
| Lockout Duration | 5 minutes |
| Reset | Successful login resets counter |

### Rate Limit Response

When rate limited, the system returns:

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Too many login attempts. Please try again later.",
  "retryAfterMs": 60000
}
```

---

## Security Headers

All responses include security headers via `SecurityHeadersMiddleware`:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Enable XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer info |
| `Cache-Control` | `no-store, no-cache, must-revalidate` | Prevent caching |
| `Content-Security-Policy` | `default-src 'self'; ...` | Restrict resource loading |
| `Permissions-Policy` | `accelerometer=(), camera=(), ...` | Restrict browser features |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforce HTTPS (production only) |

---

## Security Logging

### Access Denied Events

When access is denied, the system logs:

```json
{
  "timestamp": "2024-12-05T08:00:00.000Z",
  "level": "warn",
  "message": "access.denied",
  "context": "PermissionsGuard",
  "correlationId": "abc123-def456",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "userId": "user-uuid",
  "path": "/grc/risks",
  "method": "POST",
  "requiredPermissions": ["grc:risk:write"],
  "userPermissions": ["grc:risk:read"],
  "reason": "Missing permissions: grc:risk:write"
}
```

### Brute Force Detection Events

When brute force is detected, the system logs:

```json
{
  "timestamp": "2024-12-05T08:00:00.000Z",
  "level": "warn",
  "message": "auth.bruteforce_detected",
  "context": "BruteForceService",
  "correlationId": "abc123-def456",
  "ip": "192.168.1.100",
  "username": "attacker@example.com",
  "tenantId": null,
  "attemptCount": 5,
  "lockedUntilMs": 1733385600000,
  "lockoutDurationSeconds": 300
}
```

### Failed Login Attempts

```json
{
  "timestamp": "2024-12-05T08:00:00.000Z",
  "level": "log",
  "message": "auth.failed_attempt",
  "context": "BruteForceService",
  "correlationId": "abc123-def456",
  "ip": "192.168.1.100",
  "username": "user@example.com",
  "tenantId": null,
  "attemptCount": 2,
  "maxAttempts": 5
}
```

---

## Authentication Flow

### Login Process

1. User sends `POST /auth/login` with email and password
2. Rate limiting check (10 requests/minute)
3. Brute force protection check (exponential backoff)
4. Credential validation
5. On success: Return JWT token, reset brute force counter
6. On failure: Record failed attempt, return 401

### JWT Token

The JWT token contains:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "ADMIN",
  "iat": 1733385600,
  "exp": 1733472000
}
```

### Protected Endpoint Flow

1. `JwtAuthGuard`: Validates JWT token
2. `TenantGuard`: Validates tenant membership
3. `PermissionsGuard`: Validates user permissions
4. Controller: Processes request with tenant-scoped data

---

## Files Reference

| File | Description |
|------|-------------|
| `src/auth/permissions/permission.enum.ts` | Permission definitions |
| `src/auth/permissions/permissions.decorator.ts` | @Permissions() decorator |
| `src/auth/permissions/permissions.guard.ts` | Permission enforcement guard |
| `src/auth/permissions/permission.service.ts` | Role-to-permission mapping |
| `src/auth/security/brute-force.service.ts` | Brute force protection |
| `src/common/middleware/security-headers.middleware.ts` | Security headers |
| `src/tenants/guards/tenant.guard.ts` | Tenant isolation guard |
| `test/security-access-control.e2e-spec.ts` | Security e2e tests |

---

## Testing Security

Run security e2e tests:

```bash
cd backend-nest
npm run test:e2e -- --testPathPattern=security-access-control
```

The tests cover:
- Authentication (401 vs 403 scenarios)
- Permission-based access control
- Tenant isolation boundaries
- Security headers verification
- Rate limiting behavior
- Login security and validation
