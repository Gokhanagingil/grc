# Backend-Frontend Contract Sync Report

## Overview

This document provides a comprehensive analysis of the backend-frontend contract alignment for the GRC-ITSM platform. It identifies mismatches between API endpoints, DTOs, return types, and provides recommendations for synchronization.

## API Endpoint Analysis

### Authentication Endpoints

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `POST /auth/login` | `POST /api/auth/login` | ALIGNED | Both accept `{username, password}`, return `{token, user}` |
| `POST /auth/register` | `POST /api/auth/register` | ALIGNED | Both accept user registration data |
| `GET /auth/me` | `GET /api/auth/me` | ALIGNED | Returns current user profile |
| `POST /auth/refresh` | NOT IMPLEMENTED | MISSING | Backend needs refresh token endpoint |

### User Management Endpoints

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `GET /users` | `GET /api/users` | ALIGNED | Returns paginated user list |
| `POST /users` | `POST /api/users` | ALIGNED | Creates new user |
| `PUT /users/:id` | `PUT /api/users/:id` | ALIGNED | Updates user |
| `DELETE /users/:id` | `DELETE /api/users/:id` | ALIGNED | Deletes user (admin only) |

### Governance Endpoints

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `GET /governance/policies` | `GET /api/governance/policies` | ALIGNED | Returns policy list |
| `POST /governance/policies` | `POST /api/governance/policies` | ALIGNED | Creates policy |
| `PUT /governance/policies/:id` | `PUT /api/governance/policies/:id` | ALIGNED | Updates policy |
| `DELETE /governance/policies/:id` | `DELETE /api/governance/policies/:id` | ALIGNED | Deletes policy |

### Risk Management Endpoints

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `GET /risk/risks` | `GET /api/risk/risks` | ALIGNED | Returns risk list |
| `POST /risk/risks` | `POST /api/risk/risks` | ALIGNED | Creates risk |
| `PUT /risk/risks/:id` | `PUT /api/risk/risks/:id` | ALIGNED | Updates risk |
| `DELETE /risk/risks/:id` | `DELETE /api/risk/risks/:id` | ALIGNED | Deletes risk |

### Compliance Endpoints

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `GET /compliance/requirements` | `GET /api/compliance/requirements` | ALIGNED | Returns requirements list |
| `POST /compliance/requirements` | `POST /api/compliance/requirements` | ALIGNED | Creates requirement |
| `PUT /compliance/requirements/:id` | `PUT /api/compliance/requirements/:id` | ALIGNED | Updates requirement |
| `DELETE /compliance/requirements/:id` | `DELETE /api/compliance/requirements/:id` | ALIGNED | Deletes requirement |

### Dashboard Endpoints

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `GET /dashboard/overview` | `GET /api/dashboard/overview` | ALIGNED | Returns overview stats |
| `GET /dashboard/risk-trends` | `GET /api/dashboard/risk-trends` | ALIGNED | Returns risk trend data |
| `GET /dashboard/compliance-by-regulation` | `GET /api/dashboard/compliance-by-regulation` | ALIGNED | Returns compliance breakdown |

### To-Do Endpoints (NEW)

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `GET /todos` | `GET /api/todos` | ALIGNED | Returns user's todos |
| `POST /todos` | `POST /api/todos` | ALIGNED | Creates todo |
| `PUT /todos/:id` | `PUT /api/todos/:id` | ALIGNED | Updates todo |
| `DELETE /todos/:id` | `DELETE /api/todos/:id` | ALIGNED | Deletes todo |
| `GET /todos/stats/summary` | `GET /api/todos/stats/summary` | ALIGNED | Returns todo statistics |

## DTO/Type Analysis

### User Interface

**Frontend Definition** (`AuthContext.tsx`):
```typescript
interface User {
  id: number | string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: 'admin' | 'manager' | 'user';
  tenantId?: string;
}
```

**Backend Response** (`routes/auth.js`):
```javascript
{
  id: user.id,
  username: user.username,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  department: user.department,
  role: user.role
}
```

**Status**: ALIGNED - Backend transforms snake_case to camelCase in response

### Risk Interface

**Frontend Definition** (`RiskManagement.tsx`):
```typescript
interface Risk {
  id: number;
  title: string;
  description: string;
  category: string;
  severity: string;
  likelihood: string;
  impact: string;
  risk_score: number;
  status: string;
  owner_id: number;
  assigned_to: number;
  mitigation_plan: string;
  due_date: string;
  owner_first_name?: string;
  owner_last_name?: string;
  assigned_first_name?: string;
  assigned_last_name?: string;
}
```

**Backend Response** (`routes/risk.js`):
```javascript
{
  id, title, description, category, severity, likelihood, impact,
  risk_score, status, owner_id, assigned_to, mitigation_plan, due_date,
  owner_first_name, owner_last_name, assigned_first_name, assigned_last_name
}
```

**Status**: ALIGNED - Backend joins user data for display names

### Policy Interface

**Frontend Definition** (`Governance.tsx`):
```typescript
interface Policy {
  id: number;
  title: string;
  description: string;
  category: string;
  version: string;
  status: string;
  owner_id: number;
  effective_date: string;
  review_date: string;
  content: string;
  owner_first_name?: string;
  owner_last_name?: string;
}
```

**Status**: ALIGNED - Backend provides matching structure

### Compliance Requirement Interface

**Frontend Definition** (`Compliance.tsx`):
```typescript
interface ComplianceRequirement {
  id: number;
  title: string;
  description: string;
  regulation: string;
  category: string;
  status: string;
  due_date: string;
  owner_id: number;
  assigned_to: number;
  evidence: string;
  owner_first_name?: string;
  owner_last_name?: string;
  assigned_first_name?: string;
  assigned_last_name?: string;
}
```

**Status**: ALIGNED - Backend provides matching structure

### Todo Interface (NEW)

**Frontend Definition** (`TodoList.tsx`):
```typescript
interface Todo {
  id: number;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  category: string | null;
  tags: string | null;
  due_date: string | null;
  completed_at: string | null;
  owner_id: number;
  assigned_to: number | null;
  assigned_first_name: string | null;
  assigned_last_name: string | null;
  created_at: string;
  updated_at: string;
}
```

**Backend Response** (`routes/todos.js`):
```javascript
{
  id, title, description, priority, status, category, tags,
  due_date, completed_at, owner_id, assigned_to,
  assigned_first_name, assigned_last_name, created_at, updated_at
}
```

**Status**: ALIGNED - New feature with matching contract

## Status Code Analysis

| Endpoint Type | Success | Client Error | Server Error |
|---------------|---------|--------------|--------------|
| GET (list) | 200 | 401, 403 | 500 |
| GET (single) | 200 | 401, 403, 404 | 500 |
| POST | 201 | 400, 401, 403 | 500 |
| PUT | 200 | 400, 401, 403, 404 | 500 |
| DELETE | 200 | 401, 403, 404 | 500 |

**Status**: ALIGNED - Frontend handles all status codes appropriately

## Enum Value Analysis

### User Roles

| Frontend | Backend | Status |
|----------|---------|--------|
| `'admin'` | `'admin'` | ALIGNED |
| `'manager'` | `'manager'` | ALIGNED |
| `'user'` | `'user'` | ALIGNED |

### Risk Severity

| Frontend | Backend | Status |
|----------|---------|--------|
| `'Low'` | `'Low'` | ALIGNED |
| `'Medium'` | `'Medium'` | ALIGNED |
| `'High'` | `'High'` | ALIGNED |
| `'Critical'` | `'Critical'` | ALIGNED |

### Risk/Compliance Status

| Frontend | Backend | Status |
|----------|---------|--------|
| `'open'` | `'open'` | ALIGNED |
| `'closed'` | `'closed'` | ALIGNED |
| `'pending'` | `'pending'` | ALIGNED |
| `'completed'` | `'completed'` | ALIGNED |

### Policy Status

| Frontend | Backend | Status |
|----------|---------|--------|
| `'draft'` | `'draft'` | ALIGNED |
| `'active'` | `'active'` | ALIGNED |
| `'archived'` | `'archived'` | ALIGNED |

### Todo Priority (NEW)

| Frontend | Backend | Status |
|----------|---------|--------|
| `'low'` | `'low'` | ALIGNED |
| `'medium'` | `'medium'` | ALIGNED |
| `'high'` | `'high'` | ALIGNED |
| `'urgent'` | `'urgent'` | ALIGNED |

### Todo Status (NEW)

| Frontend | Backend | Status |
|----------|---------|--------|
| `'pending'` | `'pending'` | ALIGNED |
| `'in_progress'` | `'in_progress'` | ALIGNED |
| `'completed'` | `'completed'` | ALIGNED |

## Identified Issues and Fixes

### Issue 1: Missing Refresh Token Endpoint

**Problem**: Frontend expects `POST /auth/refresh` but backend doesn't implement it.

**Resolution**: The frontend has been updated to gracefully handle missing refresh token functionality. When the backend implements refresh tokens, the frontend will automatically use them.

### Issue 2: NestJS Backend Differences

**Problem**: The NestJS backend (port 3002) has different API structures than the Express backend (port 3001).

**Resolution**: The frontend is configured to use the Express backend. NestJS backend is available via `/api/nest/*` proxy for gradual migration.

### Issue 3: Tenant Context

**Problem**: NestJS backend requires `x-tenant-id` header for multi-tenant operations.

**Resolution**: The Express backend doesn't require tenant context. When migrating to NestJS, the frontend will need to add tenant header support.

## Recommendations

1. **Implement Refresh Token Endpoint**: Add `POST /api/auth/refresh` to the Express backend to support token refresh lifecycle.

2. **Add Tenant Support**: When ready to migrate to NestJS, add tenant context to the frontend API service.

3. **Standardize Error Responses**: Ensure all error responses follow a consistent format:
   ```json
   {
     "error": "Error Type",
     "message": "Human-readable message",
     "statusCode": 400
   }
   ```

4. **Add API Versioning**: Consider adding API versioning (e.g., `/api/v1/`) for future compatibility.

## Conclusion

The backend-frontend contract is well-aligned for the Express backend. The main areas requiring attention are:

1. Refresh token implementation (backend)
2. Tenant context support (future migration)
3. Error response standardization

All existing endpoints have matching contracts between frontend and backend, with proper type definitions and enum values aligned.
