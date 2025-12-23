# Frontend Compatibility Debt

This document formally acknowledges frontend technical debt in the GRC Platform as of FAZ 1 Platform Stabilization.

## Why userClient.ts Exists

The `userClient.ts` file located at `frontend/src/services/userClient.ts` exists to provide a compatibility layer between the frontend and two different backend implementations.

The file was created to address the following requirements:

1. Support for both Express (legacy) and NestJS (canonical) backends during the migration period
2. Normalization of response formats between the two backends
3. Abstraction of ID format differences (integer vs UUID)
4. Consistent interface for the UI layer regardless of which backend is active

The `userClient.ts` implements a mode-based routing system controlled by the `REACT_APP_USER_API_MODE` environment variable, which can be set to `express`, `nest`, or `auto`.

## What Differences It Compensates For

The `userClient.ts` compensates for the following differences between Express and NestJS backends:

### Response Format Differences

Express backend returns raw data:
```json
{
  "users": [...],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

NestJS backend returns envelope format:
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

### Field Naming Conventions

Express backend uses snake_case:
- `first_name`, `last_name`, `is_active`, `created_at`

NestJS backend uses camelCase:
- `firstName`, `lastName`, `isActive`, `createdAt`

### ID Format Differences

Express backend uses integer IDs:
- `id: 1`, `id: 2`, `id: 3`

NestJS backend uses UUID strings:
- `id: "550e8400-e29b-41d4-a716-446655440000"`

### Request Payload Adaptation

The `userClient.ts` converts frontend form data to the appropriate backend format:

For Express:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "is_active": true
}
```

For NestJS:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true
}
```

## Why It Is NOT Addressed in FAZ 1

The `userClient.ts` compatibility layer is NOT addressed in FAZ 1 for the following reasons:

1. FAZ 1 is focused on platform stabilization and governance documentation, not feature development or refactoring
2. Removing the compatibility layer requires completing the Express-to-NestJS migration, which is out of scope for FAZ 1
3. The Express backend still serves specific functionality (audit reports, search) that has not been migrated
4. Changing the frontend API layer introduces risk of regression that is not acceptable during stabilization
5. The compatibility layer is functioning correctly and does not introduce bugs or security issues

FAZ 1 explicitly does NOT:
- Add features
- Improve UX
- Introduce new modules
- Refactor unrelated code
- Simplify frontend logic

The `userClient.ts` is acknowledged as technical debt but is intentionally deferred.

## When and How It Will Be Eliminated

The `userClient.ts` compatibility layer will be eliminated in a future phase when the following conditions are met:

1. All Express backend functionality has been migrated to NestJS
2. The Express backend has been fully deprecated and removed
3. The `users` table has been migrated to `nest_users` or unified
4. The frontend can communicate exclusively with the NestJS backend

The elimination process will involve:

1. Removing the `REACT_APP_USER_API_MODE` environment variable
2. Updating all frontend components to use the NestJS API directly
3. Removing the `userClient.ts` file and related adapters
4. Removing the `userApiConfig.ts` configuration file
5. Updating the `api.ts` service to handle all user operations

The specific timeline and implementation details will be defined in a subsequent phase. No further details are provided in FAZ 1 as this is outside the scope of platform stabilization.

## Current State Summary

| Component | Status | Action in FAZ 1 |
|-----------|--------|-----------------|
| `userClient.ts` | Technical Debt | Acknowledged, not addressed |
| `userApiConfig.ts` | Technical Debt | Acknowledged, not addressed |
| Express user routes | Deprecated | Documented, not removed |
| NestJS user routes | Canonical | No changes |
| Frontend user components | Using compatibility layer | No changes |

## Governance Statement

This document formally acknowledges the existence of frontend technical debt related to backend compatibility. The debt is intentionally not addressed in FAZ 1 as it falls outside the scope of platform stabilization.

This acknowledgment represents a governance decision that is immutable within FAZ 1. The technical debt will be addressed in a future phase with explicit governance approval.

---

Document Version: 1.0.0
FAZ: 1 - Platform Stabilization
Date: 2024-12-23
