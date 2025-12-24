# Identity and Tenant Canon

This document freezes identity and tenant semantics for the GRC Platform as of FAZ 1 Platform Stabilization.

## Canonical User Model (NestJS, UUID)

The canonical user model is defined in the NestJS backend at `backend-nest/src/users/user.entity.ts`.

The canonical user entity uses the `nest_users` table with the following characteristics:

- Primary key: UUID (`id: string`)
- Email: unique identifier for authentication
- Password: stored as bcrypt hash in `password_hash` column
- Role: enum with values `admin`, `manager`, `user`
- Tenant association: `tenant_id` (UUID, nullable for demo admin)
- Soft deletion: not implemented at user level (users are deactivated, not deleted)
- Timestamps: `created_at`, `updated_at`

The canonical user model supports multi-tenancy through the `tenant_id` foreign key relationship to the `tenants` table. Each user belongs to exactly one tenant, with the exception of system-level demo admin users which may have a null `tenant_id`.

User roles and their permissions:

- `admin`: Full access to all tenant resources, user management, system configuration
- `manager`: Read/write access to GRC entities, limited user management
- `user`: Read access to GRC entities, limited write access based on ownership

## Legacy User Model (Express, Read-Only)

The legacy user model exists in the Express backend and uses the `users` table.

The legacy user entity has the following characteristics:

- Primary key: Integer (`id: number`)
- Username: legacy identifier (not used in NestJS)
- Email: authentication identifier
- Password: stored as bcrypt hash
- Role: string with values `admin`, `manager`, `user`
- No tenant association in legacy model
- Timestamps: `created_at`, `updated_at`

The legacy user model is READ-ONLY. No new users should be created in the legacy `users` table. All user management operations should be performed through the NestJS backend.

The Express backend user routes are deprecated with a sunset date of 2025-06-01. These routes emit deprecation headers on every request.

## Tenant Context Derivation (Login-Based)

Tenant context is derived from the authenticated user at login time.

When a user authenticates via `/auth/login`, the response includes:

```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "admin",
      "tenantId": "tenant-uuid",
      "firstName": "...",
      "lastName": "..."
    }
  }
}
```

The `tenantId` from the login response is stored in the frontend (`localStorage`) and sent with every subsequent API request via the `x-tenant-id` header.

The NestJS backend enforces tenant isolation through:

1. `TenantGuard`: Validates that the `x-tenant-id` header is present and matches the authenticated user's tenant
2. `MultiTenantServiceBase`: Automatically scopes all database queries to the current tenant
3. Entity-level `tenant_id` column: Every GRC entity includes a `tenant_id` column for data isolation

## Current Limitations

The following limitations exist in the current implementation:

### x-tenant-id Header Usage

The `x-tenant-id` header is required for all authenticated API requests to the NestJS backend. This header must match the `tenantId` of the authenticated user. Cross-tenant access is not permitted.

The frontend automatically includes this header via the `api.ts` interceptor:

```typescript
const tenantId = localStorage.getItem(STORAGE_TENANT_ID_KEY);
if (tenantId) {
  config.headers['x-tenant-id'] = tenantId;
}
```

### Demo Admin User

The demo admin user (`admin@demo.com` or `admin@grc-platform.local`) may have a nullable `tenant_id` for initial setup purposes. This is a transitional state and should be resolved by assigning the demo admin to a specific tenant.

### User Table Separation

The `nest_users` and `users` tables are separate and not synchronized. This is intentional to prevent conflicts during the migration period. Users created in NestJS are not visible to Express, and vice versa.

## What is Transitional vs Permanent

### Transitional (Will Be Eliminated)

- Express backend user routes (`/api/users/*`)
- Legacy `users` table with integer IDs
- `userClient.ts` compatibility layer in frontend
- Dual backend architecture (Express + NestJS)
- `REACT_APP_USER_API_MODE` environment variable

### Permanent (Canonical)

- NestJS user model with UUID primary keys
- `nest_users` table as the single source of truth
- Multi-tenant architecture with `tenant_id` isolation
- JWT-based authentication with refresh tokens
- Role-based access control (admin, manager, user)
- `x-tenant-id` header requirement for API requests

## Data Migration Status

No data migration is performed in FAZ 1.

The existing data in both `users` and `nest_users` tables remains as-is. Data migration between user tables is explicitly deferred to a future phase. This document serves to acknowledge the current state and freeze the identity semantics without introducing changes to the data layer.

## Governance Statement

This document represents a governance decision that is immutable within FAZ 1. The identity and tenant semantics documented here are not subject to challenge or reinterpretation. Any deviation from these declarations requires explicit governance approval in a subsequent phase.

---

Document Version: 1.0.0
FAZ: 1 - Platform Stabilization
Date: 2024-12-23
