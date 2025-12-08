# User API Switch Readiness Guide

This document explains how to switch the frontend User Management from the legacy Express backend (port 3001) to the new NestJS UsersModule (port 3002) using the feature-flag based configuration.

## Overview

The frontend now supports a dual-backend configuration for User Management operations. This allows for a controlled, gradual migration from Express to NestJS without requiring a "big bang" cutover.

**Current Default:** Express backend (port 3001) - no changes to existing behavior.

## Configuration

### Environment Variables

The following environment variables control the User API behavior:

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_USER_API_MODE` | API mode: `"express"` or `"nest"` | `"express"` |
| `REACT_APP_EXPRESS_API_URL` | Express backend base URL | `http://localhost:3001/api` |
| `REACT_APP_NEST_API_URL` | NestJS backend base URL | `http://localhost:3002` |

### How to Switch to NestJS

To switch User Management to use the NestJS backend:

1. Ensure the NestJS backend is running on port 3002
2. Set the environment variable:
   ```bash
   REACT_APP_USER_API_MODE=nest
   ```
3. Optionally, configure the NestJS URL if not using the default:
   ```bash
   REACT_APP_NEST_API_URL=http://your-nest-server:3002
   ```
4. Restart the frontend application

### Example .env Configuration

For Express (current default):
```env
REACT_APP_USER_API_MODE=express
REACT_APP_EXPRESS_API_URL=http://localhost:3001/api
```

For NestJS:
```env
REACT_APP_USER_API_MODE=nest
REACT_APP_NEST_API_URL=http://localhost:3002
```

## Important Differences

### ID Formats

The two backends use different ID formats:

| Backend | ID Format | Example |
|---------|-----------|---------|
| Express | Integer | `1`, `42`, `100` |
| NestJS | UUID | `550e8400-e29b-41d4-a716-446655440000` |

The `userClient` handles this automatically by using `string | number` for ID types. However, be aware that:

- Existing user IDs from Express will be integers
- New users created in NestJS will have UUID IDs
- During migration, you may have a mix of both formats

### Response Formats

The backends return data in different formats:

**Express (raw data):**
```json
{
  "users": [...],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

**NestJS (envelope format):**
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

The `userClient` normalizes both formats to a consistent structure for the UI.

### Field Naming

| Field | Express (snake_case) | NestJS (camelCase) |
|-------|---------------------|-------------------|
| First Name | `first_name` | `firstName` |
| Last Name | `last_name` | `lastName` |
| Active Status | `is_active` | `isActive` |
| Created Date | `created_at` | `createdAt` |

The `userClient` automatically converts between formats.

### Authentication Headers

Both backends use JWT Bearer tokens. NestJS additionally requires:

- `x-tenant-id` header for multi-tenant operations

The `userClient` automatically includes these headers from localStorage.

## Architecture

### Files Added

```
frontend/src/services/
├── userApiConfig.ts    # Configuration helper for dual API support
├── userClient.ts       # User API client with adapter logic
└── __tests__/
    ├── userApiConfig.test.ts
    └── userClient.test.ts
```

### How It Works

1. **Configuration Layer** (`userApiConfig.ts`):
   - Reads environment variables
   - Provides `getUserApiMode()` and `getUserApiBaseUrl()` functions
   - Defaults to Express mode for backward compatibility

2. **Client Layer** (`userClient.ts`):
   - Creates axios instance with appropriate base URL
   - Transforms request data to backend-specific format
   - Normalizes response data to a common UI format
   - Handles both integer and UUID IDs

3. **UI Layer** (`UserManagement.tsx`):
   - Uses `userClient` for all API operations
   - Works with normalized `User` interface
   - No knowledge of which backend is being used

## Testing the Switch

### Local Development

1. Start Express backend:
   ```bash
   cd backend && npm run dev  # Runs on port 3001
   ```

2. Start NestJS backend:
   ```bash
   cd backend-nest && npm run start:dev  # Runs on port 3002
   ```

3. Test Express mode (default):
   ```bash
   cd frontend && npm start
   # User Management should work with Express
   ```

4. Test NestJS mode:
   ```bash
   REACT_APP_USER_API_MODE=nest npm start
   # User Management should work with NestJS
   ```

### Staging/Production

1. Deploy both backends
2. Configure environment variables in your deployment platform
3. Start with `REACT_APP_USER_API_MODE=express` (default)
4. When ready to switch:
   - Update `REACT_APP_USER_API_MODE=nest`
   - Redeploy or restart the frontend

## Rollback Plan

If issues occur after switching to NestJS:

1. Set `REACT_APP_USER_API_MODE=express`
2. Restart the frontend application
3. User Management will revert to Express backend

No code changes are required for rollback.

## Remaining Work for Full Cutover

After this PR, the following steps remain for complete migration:

1. **Staging Testing**: Deploy to staging with `REACT_APP_USER_API_MODE=nest` and verify all User Management operations work correctly.

2. **Data Migration**: If needed, migrate existing user data from Express (SQLite) to NestJS (PostgreSQL/TypeORM).

3. **Production Switch**: Update production environment variables to use NestJS.

4. **Deprecation**: After successful production deployment, deprecate Express user routes.

5. **Cleanup**: Remove Express user routes and the dual-mode configuration code.

## Troubleshooting

### "Failed to fetch users" Error

- Verify the correct backend is running on the expected port
- Check that `REACT_APP_USER_API_MODE` matches the running backend
- Verify JWT token is valid and not expired

### ID Mismatch Errors

- If you see errors about invalid IDs, ensure you're using the correct backend
- Express expects integer IDs, NestJS expects UUIDs

### Missing Tenant ID

- NestJS requires `x-tenant-id` header
- Ensure the user is logged in and tenant ID is stored in localStorage

## Related Documentation

- [NestJS User Management Migration Report](./NEST-USER-MANAGEMENT-MIGRATION.md)
