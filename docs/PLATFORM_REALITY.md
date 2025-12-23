# Platform Reality

This document defines the single source of truth for the GRC Platform architecture as of FAZ 1 Platform Stabilization.

## Canonical Backend Declaration

NestJS is the ONLY canonical backend for the GRC Platform.

The NestJS backend is located at `/backend-nest` and serves as the authoritative source for all platform functionality. All new development MUST occur in the NestJS backend. The NestJS backend runs on port 3002 by default and provides the complete GRC domain model including risks, policies, requirements, audits, controls, issues, CAPA, and evidence management.

Key characteristics of the canonical NestJS backend:

- Uses TypeORM with PostgreSQL for data persistence
- Implements multi-tenant architecture with tenant isolation via `tenant_id` column
- Uses UUID-based primary keys for all entities
- Provides standardized API response envelope format
- Implements JWT-based authentication with refresh token support
- Enforces role-based access control (RBAC) with admin, manager, and user roles
- Uses soft deletion pattern (`is_deleted` flag) for all entities

## Express Backend Role

The Express backend located at `/backend` is legacy and transitional.

The Express backend serves the following limited purposes:

- Audit report generation using Handlebars templates (`AuditReportGeneratorService`)
- DSL-based search functionality (`SearchService`)
- Legacy user management routes (deprecated, sunset date: 2025-06-01)

The Express backend is NOT canonical. It operates as a proxy or supplementary service for specific legacy functionality that has not yet been migrated to NestJS. The Express backend uses SQLite for local development and integer-based primary keys for the legacy `users` table.

All Express user management routes include deprecation headers:
- `Deprecation: true`
- `Sunset: Sat, 01 Jun 2025 00:00:00 GMT`
- `Link: </api/v2/users>; rel="successor-version"`

## Where New Development MUST Happen

All new development MUST occur in the NestJS backend (`/backend-nest`).

This includes:

- New API endpoints
- New entities and database migrations
- New business logic and services
- New authentication and authorization features
- New integrations and external service connections

The frontend (`/frontend`) communicates primarily with the NestJS backend. The `userClient.ts` service provides a compatibility layer that abstracts differences between Express and NestJS backends during the transition period.

## What is Explicitly NOT Canonical

The following are explicitly NOT canonical and should not be treated as authoritative sources:

- Express backend user management (`/backend/routes/users.js`) - deprecated
- Express backend authentication routes - transitional only
- SQLite database schema in Express backend - local development only
- Integer-based user IDs from Express backend - legacy format
- Any `users` table (Express) - superseded by `nest_users` table (NestJS)

## Platform Architecture Summary

```
Frontend (React)
    |
    v
NestJS Backend (CANONICAL) -----> PostgreSQL
    |                                  |
    |                                  v
    |                            nest_users (UUID)
    |                            grc_* tables
    |                            tenant_* tables
    |
Express Backend (LEGACY/PROXY)
    |
    v
SQLite (local dev only)
    |
    v
users (integer ID) - DEPRECATED
```

## Governance Statement

This document represents a governance decision that is immutable within FAZ 1. The architectural decisions documented here are not subject to challenge or reinterpretation. Any deviation from these declarations requires explicit governance approval in a subsequent phase.

---

Document Version: 1.0.0
FAZ: 1 - Platform Stabilization
Date: 2024-12-23
