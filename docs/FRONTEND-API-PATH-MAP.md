# Frontend API Path Mapping

This document provides a comprehensive mapping of all frontend API calls to their corresponding NestJS backend endpoints.

## Overview

The GRC Platform frontend makes API calls to various backend endpoints. This document maps each frontend API call to:
- The current path being called
- The actual NestJS backend endpoint
- The required action to align them

## API Base Configuration

- **Frontend API Base URL**: `REACT_APP_API_URL` (defaults to `http://localhost:3001/api`)
- **NestJS Backend Port**: 3002 (no global prefix)
- **Express Backend Port**: 3001 (legacy, `/api` prefix)

## Module-by-Module API Path Mapping

### 1. Authentication (AuthContext.tsx)

| Component | HTTP Method | Frontend Path | NestJS Endpoint | Status | Notes |
|-----------|-------------|---------------|-----------------|--------|-------|
| AuthContext | POST | `/auth/login` | `/auth/login` | WORKING | NestJS has this endpoint |
| AuthContext | POST | `/auth/register` | N/A | LEGACY | Only exists in Express backend |
| AuthContext | GET | `/auth/me` | `/users/me` | NEEDS FIX | NestJS has `/users/me` instead |
| AuthContext | POST | `/auth/refresh` | N/A | LEGACY | Only exists in Express backend |

### 2. Dashboard (Dashboard.tsx)

| Component | HTTP Method | Frontend Path | NestJS Endpoint | Status | Notes |
|-----------|-------------|---------------|-----------------|--------|-------|
| Dashboard | GET | `/dashboard/overview` | N/A | NEEDS FIX | Use aggregated summary endpoints |
| Dashboard | GET | `/dashboard/risk-trends` | N/A | NEEDS FIX | No direct equivalent in NestJS |
| Dashboard | GET | `/dashboard/compliance-by-regulation` | N/A | NEEDS FIX | No direct equivalent in NestJS |

**Recommended Fix**: Dashboard should aggregate data from:
- `GET /grc/risks/summary` - Risk statistics
- `GET /grc/policies/summary` - Policy statistics
- `GET /grc/requirements/summary` - Compliance requirement statistics
- `GET /itsm/incidents/summary` - Incident statistics

### 3. Governance (Governance.tsx)

| Component | HTTP Method | Frontend Path | NestJS Endpoint | Status | Notes |
|-----------|-------------|---------------|-----------------|--------|-------|
| Governance | GET | `/governance/policies` | `/grc/policies` | NEEDS FIX | Path mismatch |
| Governance | POST | `/governance/policies` | `/grc/policies` | NEEDS FIX | Path mismatch |
| Governance | PUT | `/governance/policies/:id` | `/grc/policies/:id` (PATCH) | NEEDS FIX | Path + method mismatch |
| Governance | DELETE | `/governance/policies/:id` | `/grc/policies/:id` | NEEDS FIX | Path mismatch |

**NestJS Policy Endpoints Available**:
- `GET /grc/policies` - List policies with pagination/filtering
- `GET /grc/policies/:id` - Get single policy
- `GET /grc/policies/summary` - Policy summary stats
- `GET /grc/policies/statistics` - Policy statistics
- `GET /grc/policies/active` - Active policies
- `GET /grc/policies/due-for-review` - Policies due for review
- `GET /grc/policies/:id/controls` - Policy with controls
- `POST /grc/policies` - Create policy
- `PATCH /grc/policies/:id` - Update policy
- `DELETE /grc/policies/:id` - Soft delete policy

### 4. Compliance (Compliance.tsx)

| Component | HTTP Method | Frontend Path | NestJS Endpoint | Status | Notes |
|-----------|-------------|---------------|-----------------|--------|-------|
| Compliance | GET | `/compliance/requirements` | `/grc/requirements` | NEEDS FIX | Path mismatch |
| Compliance | POST | `/compliance/requirements` | `/grc/requirements` | NEEDS FIX | Path mismatch |
| Compliance | PUT | `/compliance/requirements/:id` | `/grc/requirements/:id` (PATCH) | NEEDS FIX | Path + method mismatch |
| Compliance | DELETE | `/compliance/requirements/:id` | `/grc/requirements/:id` | NEEDS FIX | Path mismatch |

**NestJS Requirement Endpoints Available**:
- `GET /grc/requirements` - List requirements with pagination/filtering
- `GET /grc/requirements/:id` - Get single requirement
- `GET /grc/requirements/summary` - Requirement summary stats
- `GET /grc/requirements/statistics` - Requirement statistics
- `GET /grc/requirements/frameworks` - Available frameworks
- `GET /grc/requirements/:id/controls` - Requirement with controls
- `POST /grc/requirements` - Create requirement
- `PATCH /grc/requirements/:id` - Update requirement
- `DELETE /grc/requirements/:id` - Soft delete requirement

### 5. Risk Management (RiskManagement.tsx)

| Component | HTTP Method | Frontend Path | NestJS Endpoint | Status | Notes |
|-----------|-------------|---------------|-----------------|--------|-------|
| RiskManagement | GET | `/nest/grc/risks` | `/grc/risks` | NEEDS FIX | Remove `/nest/` prefix |
| RiskManagement | POST | `/nest/grc/risks` | `/grc/risks` | NEEDS FIX | Remove `/nest/` prefix |
| RiskManagement | PATCH | `/nest/grc/risks/:id` | `/grc/risks/:id` | NEEDS FIX | Remove `/nest/` prefix |
| RiskManagement | DELETE | `/nest/grc/risks/:id` | `/grc/risks/:id` | NEEDS FIX | Remove `/nest/` prefix |

**NestJS Risk Endpoints Available**:
- `GET /grc/risks` - List risks with pagination/filtering
- `GET /grc/risks/:id` - Get single risk
- `GET /grc/risks/summary` - Risk summary stats
- `GET /grc/risks/statistics` - Risk statistics
- `GET /grc/risks/high-severity` - High severity risks
- `GET /grc/risks/:id/controls` - Risk with controls
- `POST /grc/risks` - Create risk
- `PATCH /grc/risks/:id` - Update risk
- `DELETE /grc/risks/:id` - Soft delete risk

### 6. Incident Management (IncidentManagement.tsx)

| Component | HTTP Method | Frontend Path | NestJS Endpoint | Status | Notes |
|-----------|-------------|---------------|-----------------|--------|-------|
| IncidentManagement | GET | `/nest/itsm/incidents` | `/itsm/incidents` | NEEDS FIX | Remove `/nest/` prefix |
| IncidentManagement | POST | `/nest/itsm/incidents` | `/itsm/incidents` | NEEDS FIX | Remove `/nest/` prefix |
| IncidentManagement | PATCH | `/nest/itsm/incidents/:id` | `/itsm/incidents/:id` | NEEDS FIX | Remove `/nest/` prefix |
| IncidentManagement | DELETE | `/nest/itsm/incidents/:id` | `/itsm/incidents/:id` | NEEDS FIX | Remove `/nest/` prefix |
| IncidentManagement | POST | `/nest/itsm/incidents/:id/resolve` | `/itsm/incidents/:id/resolve` | NEEDS FIX | Remove `/nest/` prefix |
| IncidentManagement | POST | `/nest/itsm/incidents/:id/close` | `/itsm/incidents/:id/close` | NEEDS FIX | Remove `/nest/` prefix |

**NestJS Incident Endpoints Available**:
- `GET /itsm/incidents` - List incidents with pagination/filtering
- `GET /itsm/incidents/:id` - Get single incident
- `GET /itsm/incidents/statistics` - Incident statistics
- `GET /itsm/incidents/summary` - Incident summary stats
- `POST /itsm/incidents` - Create incident
- `PATCH /itsm/incidents/:id` - Update incident
- `DELETE /itsm/incidents/:id` - Soft delete incident
- `POST /itsm/incidents/:id/resolve` - Resolve incident
- `POST /itsm/incidents/:id/close` - Close incident

### 7. User Management (UserManagement.tsx)

| Component | HTTP Method | Frontend Path | NestJS Endpoint | Status | Notes |
|-----------|-------------|---------------|-----------------|--------|-------|
| UserManagement | GET | `/users` | N/A | LEGACY | Full CRUD not in NestJS |
| UserManagement | POST | `/users` | N/A | LEGACY | Full CRUD not in NestJS |
| UserManagement | PUT | `/users/:id` | N/A | LEGACY | Full CRUD not in NestJS |
| UserManagement | DELETE | `/users/:id` | N/A | LEGACY | Full CRUD not in NestJS |

**NestJS User Endpoints Available** (limited):
- `GET /users/me` - Get current user profile
- `GET /users/count` - Get user count
- `GET /users/health` - Users module health check

**Note**: Full user CRUD operations are only available in the Express backend. The NestJS backend has a skeleton implementation.

## Other NestJS Endpoints

### Health Endpoints
- `GET /health` - Overall health status
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /health/db` - Database health
- `GET /health/auth` - Auth configuration health
- `GET /health/dotwalking` - Dot-walking resolver health

### Tenant Endpoints
- `GET /tenants/current` - Get current tenant
- `GET /tenants/users` - Get tenant users
- `GET /tenants/health` - Tenants module health

### Settings Endpoints
- `GET /settings/effective` - Get effective setting value
- `GET /settings/system` - Get all system settings
- `GET /settings/tenant` - Get all tenant settings

### Metrics Endpoints
- `GET /metrics` - Prometheus metrics
- `GET /metrics/json` - JSON metrics

## Required Headers

All NestJS endpoints (except health and metrics) require:
- `Authorization: Bearer <token>` - JWT authentication
- `x-tenant-id: <tenant-uuid>` - Tenant context for multi-tenant operations

## Summary of Required Changes

| Module | Current Status | Action Required |
|--------|----------------|-----------------|
| Auth | Partially working | Change `/auth/me` to `/users/me` |
| Dashboard | FAILING | Aggregate from summary endpoints |
| Governance | FAILING | Change `/governance/policies` to `/grc/policies` |
| Compliance | FAILING | Change `/compliance/requirements` to `/grc/requirements` |
| Risk Management | WORKING (with prefix) | Remove `/nest/` prefix |
| Incident Management | WORKING (with prefix) | Remove `/nest/` prefix |
| User Management | LEGACY | Keep using Express backend |

## Implementation Plan

1. Create a centralized API client layer (`src/api/grcClient.ts`)
2. Define all endpoint paths in one place
3. Update each module to use the centralized client
4. Ensure proper error handling for both NestJS and Express responses
