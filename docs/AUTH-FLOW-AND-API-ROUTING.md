# Authentication Flow and API Routing

This document describes the authentication flow and API routing configuration for the GRC Platform.

## Overview

The GRC Platform uses a NestJS backend (`backend-nest`) with JWT-based authentication. This document ensures consistency between the backend, frontend, and test scripts.

## Backend Configuration (NestJS)

### Login Endpoint

**Canonical Path:** `/auth/login`

**Method:** POST

**Request Body:**
```json
{
  "email": "admin@grc-platform.local",
  "password": "TestPassword123!"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@grc-platform.local",
    "firstName": "Demo",
    "lastName": "Admin",
    "role": "admin",
    "tenantId": "uuid"
  }
}
```

### Backend Port and Prefix

- **Port:** 3002 (default, configurable via `PORT` env var)
- **Global Prefix:** None (routes are at root level)
- **Auth Controller:** `@Controller('auth')` - routes are `/auth/*`

### Key Files

- `backend-nest/src/main.ts` - Application bootstrap, no global prefix
- `backend-nest/src/auth/auth.controller.ts` - Auth routes (`@Controller('auth')`)
- `backend-nest/src/auth/dto/login.dto.ts` - Login request validation (email + password)
- `backend-nest/src/auth/auth.service.ts` - Authentication logic

## Frontend Configuration (React)

### API Base URL

The frontend uses an environment variable to configure the API base URL:

**File:** `frontend/.env`
```
REACT_APP_API_URL=http://localhost:3002
```

**Note:** The frontend should NOT include `/api` prefix since NestJS has no global prefix.

### API Service

**File:** `frontend/src/services/api.ts`

The Axios instance is configured with the base URL from the environment variable. All API calls are relative to this base URL.

### Login Request

**File:** `frontend/src/contexts/AuthContext.tsx`

The login function sends:
```javascript
api.post('/auth/login', { email, password })
```

**Important:** The frontend uses `email` field (not `username`) to match the NestJS backend.

## Test Scripts

### Smoke Test

**File:** `backend-nest/src/scripts/smoke-grc.ts`

**Base URL:** `http://localhost:3002` (configurable via `NEST_API_URL` env var)

**Login Path:** `/auth/login`

### Seed Script

**File:** `backend-nest/src/scripts/seed-grc.ts`

Seeds demo data including:
- Demo tenant: `Demo Organization`
- Demo admin: `admin@grc-platform.local`
- Demo password: `TestPassword123!`

## API Routing Summary

| Component | Base URL | Login Path | Full Login URL |
|-----------|----------|------------|----------------|
| Backend (NestJS) | `http://localhost:3002` | `/auth/login` | `http://localhost:3002/auth/login` |
| Frontend | `REACT_APP_API_URL` | `/auth/login` | `${REACT_APP_API_URL}/auth/login` |
| Smoke Test | `NEST_API_URL` or `http://localhost:3002` | `/auth/login` | `http://localhost:3002/auth/login` |

## Troubleshooting

### "Cannot POST /api/auth/login"

This error occurs when:
1. Frontend is configured with wrong API URL (pointing to Express backend on port 3001)
2. Frontend includes `/api` prefix but NestJS has no global prefix

**Solution:** Ensure `REACT_APP_API_URL=http://localhost:3002` (no `/api` suffix)

### "Invalid email or password"

This error occurs when:
1. Demo admin user doesn't exist - run `npm run seed:grc` in `backend-nest`
2. Wrong credentials - use `admin@grc-platform.local` / `TestPassword123!`
3. Frontend sends `username` instead of `email` field

### Connection Refused

Ensure the NestJS backend is running:
```bash
cd backend-nest
npm run start:dev
```

## Environment Variables

### Backend (`backend-nest/.env.development`)

```
NODE_ENV=development
PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=grc_platform
JWT_SECRET=dev-jwt-secret-change-in-production-32chars
DEMO_ADMIN_EMAIL=admin@grc-platform.local
DEMO_ADMIN_PASSWORD=TestPassword123!
```

### Frontend (`frontend/.env`)

```
REACT_APP_API_URL=http://localhost:3002
```

## Related Documentation

- [GRC Deployment and Environments](./GRC-DEPLOYMENT-AND-ENVIRONMENTS.md)
- [GRC Security and Access Control](./GRC-SECURITY-AND-ACCESS-CONTROL.md)
