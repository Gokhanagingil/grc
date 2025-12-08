# GRC Frontend-Backend Path Alignment Report

## Summary

This report documents the alignment of frontend API paths with the NestJS backend across all GRC/ITSM modules. The work was completed as part of a sprint to fix broken API paths and establish a centralized API client layer.

## Changes Made

### Phase 1: API Path Inventory & Mapping

Created `docs/FRONTEND-API-PATH-MAP.md` with a comprehensive mapping of all frontend API calls to their corresponding NestJS backend endpoints.

### Phase 2: Centralized API Client Layer

Created `frontend/src/services/grcClient.ts` - a typed API client layer that:
- Defines all NestJS endpoint paths in one place (`API_PATHS` constant)
- Provides typed API functions for each module (riskApi, policyApi, requirementApi, incidentApi, dashboardApi, authApi, userApi)
- Handles response unwrapping for both NestJS envelope format and legacy Express format
- Automatically injects `x-tenant-id` header for multi-tenant operations

### Phase 3: Module Updates

#### Dashboard (Dashboard.tsx)
| Before | After |
|--------|-------|
| `GET /dashboard/overview` | Aggregated from `/grc/*/summary` endpoints |
| `GET /dashboard/risk-trends` | Not available in NestJS (returns empty) |
| `GET /dashboard/compliance-by-regulation` | Not available in NestJS (returns empty) |

**Note**: The NestJS backend doesn't have dedicated dashboard endpoints. The dashboard now aggregates data from the summary endpoints of each module.

#### Governance (Governance.tsx)
| Before | After |
|--------|-------|
| `GET /governance/policies` | `GET /grc/policies` |
| `POST /governance/policies` | `POST /grc/policies` |
| `PUT /governance/policies/:id` | `PATCH /grc/policies/:id` |
| `DELETE /governance/policies/:id` | `DELETE /grc/policies/:id` |

#### Compliance (Compliance.tsx)
| Before | After |
|--------|-------|
| `GET /compliance/requirements` | `GET /grc/requirements` |
| `POST /compliance/requirements` | `POST /grc/requirements` |
| `PUT /compliance/requirements/:id` | `PATCH /grc/requirements/:id` |
| `DELETE /compliance/requirements/:id` | `DELETE /grc/requirements/:id` |

#### Risk Management (RiskManagement.tsx)
| Before | After |
|--------|-------|
| `GET /nest/grc/risks` | `GET /grc/risks` |
| `POST /nest/grc/risks` | `POST /grc/risks` |
| `PATCH /nest/grc/risks/:id` | `PATCH /grc/risks/:id` |
| `DELETE /nest/grc/risks/:id` | `DELETE /grc/risks/:id` |

**Note**: Removed the `/nest/` prefix that was incorrectly added in PR #30.

#### Incident Management (IncidentManagement.tsx)
| Before | After |
|--------|-------|
| `GET /nest/itsm/incidents` | `GET /itsm/incidents` |
| `POST /nest/itsm/incidents` | `POST /itsm/incidents` |
| `PATCH /nest/itsm/incidents/:id` | `PATCH /itsm/incidents/:id` |
| `DELETE /nest/itsm/incidents/:id` | `DELETE /itsm/incidents/:id` |
| `POST /nest/itsm/incidents/:id/resolve` | `POST /itsm/incidents/:id/resolve` |
| `POST /nest/itsm/incidents/:id/close` | `POST /itsm/incidents/:id/close` |

**Note**: Removed the `/nest/` prefix that was incorrectly added in PR #30.

#### Authentication (AuthContext.tsx)
| Before | After |
|--------|-------|
| `GET /auth/me` | `GET /users/me` |

**Note**: The NestJS backend has the user profile endpoint at `/users/me`, not `/auth/me`.

### Phase 4: Smoke Tests

Updated `backend-nest/src/scripts/smoke-grc.ts` to include:
- ITSM Incidents endpoints (`GET /itsm/incidents`, `GET /itsm/incidents/statistics`)
- User profile endpoint (`GET /users/me`)

## How to Run Smoke Tests

```bash
# Start the NestJS backend
cd backend-nest && npm run start:dev

# In another terminal, run the smoke tests
cd backend-nest && npm run smoke:grc
```

The smoke test validates:
1. Health check (`GET /health/live`)
2. Authentication (`POST /auth/login`)
3. GRC Risks (`GET /grc/risks`, `GET /grc/risks/statistics`)
4. GRC Policies (`GET /grc/policies`, `GET /grc/policies/statistics`)
5. GRC Requirements (`GET /grc/requirements`, `GET /grc/requirements/statistics`, `GET /grc/requirements/frameworks`)
6. ITSM Incidents (`GET /itsm/incidents`, `GET /itsm/incidents/statistics`)
7. User Profile (`GET /users/me`)

## Module Status After Changes

| Module | Status | Notes |
|--------|--------|-------|
| Dashboard | WORKING | Aggregates from summary endpoints |
| Governance | WORKING | Uses `/grc/policies` |
| Compliance | WORKING | Uses `/grc/requirements` |
| Risk Management | WORKING | Uses `/grc/risks` (removed `/nest/` prefix) |
| Incident Management | WORKING | Uses `/itsm/incidents` (removed `/nest/` prefix) |
| Authentication | WORKING | Uses `/users/me` for profile |
| User Management | LEGACY | Still uses Express backend (full CRUD not in NestJS) |

## Known Issues / TODOs

1. **Dashboard Trends**: The NestJS backend doesn't have dedicated endpoints for risk trends and compliance-by-regulation. These features would need new backend endpoints to be implemented.

2. **User Management**: Full user CRUD operations are only available in the Express backend. The NestJS backend has a skeleton implementation with only `/users/me`, `/users/count`, and `/users/health` endpoints.

3. **Auth Register/Refresh**: The `/auth/register` and `/auth/refresh` endpoints are only available in the Express backend. The NestJS backend only has `/auth/login`.

## Required Headers

All authenticated NestJS endpoints require:
- `Authorization: Bearer <jwt_token>` - JWT authentication
- `x-tenant-id: <tenant-uuid>` - Tenant context for multi-tenant operations

## Files Changed

### Frontend
- `frontend/src/services/grcClient.ts` (NEW) - Centralized API client layer
- `frontend/src/pages/Dashboard.tsx` - Updated to use grcClient
- `frontend/src/pages/Governance.tsx` - Updated to use grcClient
- `frontend/src/pages/Compliance.tsx` - Updated to use grcClient
- `frontend/src/pages/RiskManagement.tsx` - Updated to use grcClient, removed `/nest/` prefix
- `frontend/src/pages/IncidentManagement.tsx` - Updated to use grcClient, removed `/nest/` prefix
- `frontend/src/contexts/AuthContext.tsx` - Updated to use `/users/me`

### Backend
- `backend-nest/src/scripts/smoke-grc.ts` - Added ITSM incidents and /users/me tests

### Documentation
- `docs/FRONTEND-API-PATH-MAP.md` (NEW) - API path mapping table
- `docs/GRC-FRONTEND-BACKEND-PATH-ALIGNMENT-REPORT.md` (NEW) - This report
