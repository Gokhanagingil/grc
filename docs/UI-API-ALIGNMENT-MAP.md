# UI-API Alignment Map

## Overview

This document maps the frontend UI pages to their backend API endpoints, identifying misalignments, missing endpoints, and required fixes for the GRC Platform stabilization sprint.

**Analysis Date:** December 7, 2025

**Architecture Summary:**
- **Express Backend:** Runs on port 3001, serves `/api/*` routes
- **NestJS Backend:** Runs on port 3002, accessed via `/api/nest/*` proxy
- **Frontend:** React SPA, configured with `REACT_APP_API_URL=http://localhost:3001/api`

---

## API Endpoint Mapping Table

### Authentication Module

| UI Component | Current Frontend Call | Backend Route | Status | Notes |
|--------------|----------------------|---------------|--------|-------|
| AuthContext (login) | `POST /auth/login` | `POST /api/auth/login` | EXISTS | Works - uses `username` field |
| AuthContext (register) | `POST /auth/register` | `POST /api/auth/register` | EXISTS | Works |
| AuthContext (me) | `GET /auth/me` | `GET /api/auth/me` | EXISTS | Backend has this endpoint |
| AuthContext (refresh) | `POST /auth/refresh` | N/A | MISSING | No refresh endpoint in Express backend |
| AuthContext (logout) | `POST /auth/logout` | `POST /api/auth/logout` | EXISTS | Works |

**Issue:** The staging error `Cannot GET /auth/me` suggests the frontend might be calling a wrong base URL or the request is not reaching the Express backend properly.

---

### Dashboard Module

| UI Component | Current Frontend Call | Backend Route | Status | Notes |
|--------------|----------------------|---------------|--------|-------|
| Dashboard.tsx | `GET /dashboard/overview` | `GET /api/dashboard/overview` | EXISTS | Should work |
| Dashboard.tsx | `GET /dashboard/risk-trends` | `GET /api/dashboard/risk-trends` | EXISTS | Should work |
| Dashboard.tsx | `GET /dashboard/compliance-by-regulation` | `GET /api/dashboard/compliance-by-regulation` | EXISTS | Should work |

**Issue:** Staging shows `Cannot GET /dashboard/overview` - this suggests the API base URL configuration issue or the Express backend is not running/accessible.

---

### Governance Module (Policies)

| UI Component | Current Frontend Call | Backend Route | Status | Notes |
|--------------|----------------------|---------------|--------|-------|
| Governance.tsx | `GET /governance/policies` | `GET /api/governance/policies` | EXISTS | Returns `{ policies, pagination }` |
| Governance.tsx | `POST /governance/policies` | `POST /api/governance/policies` | EXISTS | Works |
| Governance.tsx | `PUT /governance/policies/:id` | `PUT /api/governance/policies/:id` | EXISTS | Works |
| Governance.tsx | `DELETE /governance/policies/:id` | `DELETE /api/governance/policies/:id` | EXISTS | Works |

**Issue:** Staging shows `Cannot GET /governance/policies` - same base URL issue as above.

---

### Risk Management Module

| UI Component | Current Frontend Call | Backend Route | Status | Notes |
|--------------|----------------------|---------------|--------|-------|
| RiskManagement.tsx | `GET /grc/risks` | N/A | MISMATCH | Frontend calls `/grc/risks` but Express has `/api/risk/risks` |
| RiskManagement.tsx | `POST /grc/risks` | N/A | MISMATCH | Same issue |
| RiskManagement.tsx | `PATCH /grc/risks/:id` | N/A | MISMATCH | Express uses PUT, not PATCH |
| RiskManagement.tsx | `DELETE /grc/risks/:id` | N/A | MISMATCH | Same issue |

**Analysis:** The RiskManagement.tsx page is designed for a NestJS backend with `/grc/risks` endpoints and uses:
- `x-tenant-id` header (multi-tenant)
- Different response format: `{ items, total, page, pageSize, totalPages }`
- Different field names: `tenantId`, `ownerUserId`, `score`, etc.

**Express Backend has:**
- `GET /api/risk/risks` - Returns `{ risks, pagination }`
- `POST /api/risk/risks`
- `PUT /api/risk/risks/:id`
- `DELETE /api/risk/risks/:id`

---

### Compliance Module

| UI Component | Current Frontend Call | Backend Route | Status | Notes |
|--------------|----------------------|---------------|--------|-------|
| Compliance.tsx | `GET /compliance/requirements` | `GET /api/compliance/requirements` | EXISTS | Returns `{ requirements, pagination }` |
| Compliance.tsx | `POST /compliance/requirements` | `POST /api/compliance/requirements` | EXISTS | Works |
| Compliance.tsx | `PUT /compliance/requirements/:id` | `PUT /api/compliance/requirements/:id` | EXISTS | Works |
| Compliance.tsx | `DELETE /compliance/requirements/:id` | `DELETE /api/compliance/requirements/:id` | EXISTS | Works |

**Status:** Should work if base URL is correct.

---

### User Management Module

| UI Component | Current Frontend Call | Backend Route | Status | Notes |
|--------------|----------------------|---------------|--------|-------|
| UserManagement.tsx | `GET /users` | `GET /api/users` | EXISTS | Returns `{ users, pagination }` |
| UserManagement.tsx | `POST /users` | N/A | MISSING | No create user endpoint (only /auth/register) |
| UserManagement.tsx | `PUT /users/:id` | `PUT /api/users/:id` | EXISTS | Works |
| UserManagement.tsx | `DELETE /users/:id` | N/A | MISSING | No delete user endpoint |

**Issue:** Staging shows `Cannot GET /users` - base URL issue.

---

### Incident Management Module (ITSM)

| UI Component | Current Frontend Call | Backend Route | Status | Notes |
|--------------|----------------------|---------------|--------|-------|
| IncidentManagement.tsx | `GET /itsm/incidents` | Via NestJS proxy | WORKS | Uses `/api/nest/itsm/incidents` |
| IncidentManagement.tsx | `POST /itsm/incidents` | Via NestJS proxy | WORKS | Uses `/api/nest/itsm/incidents` |
| IncidentManagement.tsx | `PATCH /itsm/incidents/:id` | Via NestJS proxy | WORKS | Uses `/api/nest/itsm/incidents/:id` |
| IncidentManagement.tsx | `DELETE /itsm/incidents/:id` | Via NestJS proxy | WORKS | Uses `/api/nest/itsm/incidents/:id` |

**Status:** Working because it uses the NestJS backend via proxy.

---

## Root Cause Analysis

### Primary Issue: API Base URL Configuration

The staging errors suggest that requests are not reaching the Express backend correctly. Possible causes:

1. **Frontend .env misconfiguration:** The `REACT_APP_API_URL` might be pointing to wrong URL in staging
2. **Nginx/Proxy misconfiguration:** Requests might not be routed to the Express backend
3. **Express backend not running:** The backend service might not be started on staging

### Secondary Issue: Mixed Backend Architecture

The codebase has two backend architectures:
1. **Express Backend (Legacy):** Handles auth, users, governance, risk, compliance, dashboard
2. **NestJS Backend (New):** Handles ITSM incidents, GRC risks (new format)

The RiskManagement.tsx page is written for NestJS but the Express backend has different endpoints.

---

## Recommended Fixes

### Phase 2 Actions

1. **Fix API Base URL in Staging**
   - Verify `REACT_APP_API_URL` in frontend build
   - Ensure Express backend is running and accessible

2. **Align RiskManagement.tsx with Express Backend**
   - Change `/grc/risks` to `/risk/risks`
   - Update response handling for Express format
   - Use PUT instead of PATCH
   - Remove tenant-specific headers (or add tenant support to Express)

3. **Add Missing User Management Endpoints**
   - Option A: Add POST /users and DELETE /users/:id to Express
   - Option B: Disable create/delete in UI with "Coming soon" message

4. **Add Token Refresh Endpoint (Optional)**
   - Add POST /auth/refresh to Express backend
   - Or remove refresh logic from frontend

### Phase 3 Actions

1. **Add Empty State Handling**
   - All list pages should show "No records found" instead of errors
   - Add proper loading states

2. **Improve Error Messages**
   - 401: "Session expired, please login again"
   - 403: "You don't have permission to view this"
   - 404: "Resource not found"
   - 500: "Server error, please try again"

---

## Backend Endpoint Reference

### Express Backend Routes (server.js)

```
/api/auth/*        - Authentication (login, register, me, logout)
/api/users/*       - User management
/api/governance/*  - Policies and organizations
/api/risk/*        - Risks and assessments
/api/compliance/*  - Requirements and audit logs
/api/dashboard/*   - Analytics and metrics
/api/todos/*       - Todo items
/api/dotwalking/*  - Dot walking queries
/api/nest/*        - Proxy to NestJS backend
/api/health        - Health check
```

### NestJS Backend Routes (via proxy)

```
/api/nest/itsm/incidents/*  - ITSM Incident management
/api/nest/grc/risks/*       - GRC Risk management (new format)
/api/nest/health/*          - NestJS health check
```

---

## Response Format Comparison

### Express Backend Format
```json
{
  "policies": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

### NestJS Backend Format
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  }
}
```

The frontend's `unwrapApiResponse` helper in AuthContext.tsx handles both formats.

---

## Staging Environment Notes

- **Frontend URL:** Refer to team password manager
- **Backend URL:** Refer to team password manager
- **Login Credentials:** Stored in team password manager / vault. Ask Release Captain if you don't have access.

The 404 errors on staging suggest the Express backend routes are not being reached. This needs investigation during Phase 4 smoke testing.
