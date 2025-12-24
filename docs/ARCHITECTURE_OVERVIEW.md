# Architecture Overview

This document provides a high-level overview of the GRC Platform architecture, repository layout, and the current backend migration strategy.

## Repository Layout

```
grc/
├── frontend/           # React + TypeScript SPA
├── backend-nest/       # NestJS backend (PRODUCTION PATH)
├── backend/            # Express.js backend (LEGACY - see deprecation note)
├── docs/               # Documentation
├── scripts/            # Deployment and utility scripts
└── docker-compose*.yml # Container orchestration
```

### Frontend (`/frontend`)

The frontend is a React single-page application built with TypeScript and Material-UI. It serves as the unified UI for all GRC Platform features.

Key technologies: React 18, TypeScript, Material-UI, React Router, Recharts, Axios

The frontend communicates with the backend via REST APIs and handles both Express and NestJS response formats through a compatibility layer.

### Backend-Nest (`/backend-nest`) - Production Path

The NestJS backend is the **authoritative production backend** for the GRC Platform. All new feature development should target this backend.

Key technologies: NestJS, TypeORM, PostgreSQL, JWT authentication, class-validator

Features implemented in backend-nest include GRC domain entities (risks, policies, requirements, audits, controls), ITSM incident management, multi-tenancy with tenant isolation, standards library for audit scoping, and the onboarding/policy engine.

### Backend (`/backend`) - Legacy

The Express.js backend is a **legacy system** retained for backward compatibility during the migration period.

Key technologies: Express.js, SQLite/PostgreSQL, JWT authentication

Features still served by the legacy backend include audit report generation with Handlebars templates and the DSL-based search service.

## Backend Strategy

### Current State: Dual Backend Architecture

The platform currently operates with two backends running simultaneously. The NestJS backend (port 3002) handles the majority of GRC operations, while the Express backend (port 3001) serves specific legacy features.

The frontend's API service layer abstracts this complexity, routing requests to the appropriate backend based on the endpoint.

### Production Path: NestJS (`backend-nest`)

All new development must target the NestJS backend. The NestJS backend is the source of truth for GRC domain models, multi-tenancy, authentication, and authorization.

### Legacy Backend Deprecation Notice

The Express backend (`/backend`) is scheduled for deprecation. Current plan:

1. **Phase 1 (Current):** Maintain both backends; NestJS handles primary GRC operations.
2. **Phase 2:** Migrate remaining Express features (audit reports, search) to NestJS.
3. **Phase 3:** Remove Express backend from the codebase.

Timeline: The Express backend will be maintained until all features are migrated to NestJS. No new features should be added to the Express backend.

Contributors should not add new features to the Express backend. Bug fixes for critical issues are acceptable but should be minimal.

## Staging Deployment

### Deployment Flow

Staging deployments use the `scripts/deploy-staging.sh` script, which performs the following steps:

1. Verify git repository state (must be on main branch)
2. Pull latest changes from origin
3. Build and restart Docker containers
4. Wait for health checks to pass
5. Run database migrations
6. Execute platform validation suite
7. Run smoke tests

### Validation Checklist

After automated deployment, manual UI validation is required. See `docs/STAGING_RELEASE_CHECKLIST.md` for the complete checklist.

### Docker Composition

Staging uses `docker-compose.staging.yml` which orchestrates the frontend (nginx), backend-nest, and PostgreSQL database containers.

## Key Architectural Decisions

### Multi-Tenancy

All data is isolated by tenant. Every database table includes a `tenant_id` column, and all queries are automatically scoped to the authenticated user's tenant. The `TenantGuard` enforces this at the API layer.

### Soft Deletion

Records are never physically deleted. Instead, they are marked with `is_deleted: true`. This preserves audit trails and enables data recovery.

### Response Format

The NestJS backend returns responses in a standardized envelope format with success status, data payload, and optional metadata for pagination. The frontend's API layer handles unwrapping these responses.

### Authentication

JWT-based authentication with access and refresh tokens. The NestJS backend includes brute-force protection and rate limiting.

## Additional Documentation

For more detailed information, see:

- `docs/AUTH-FLOW-AND-API-ROUTING.md` - Authentication and API routing details
- `docs/GRC-DOMAIN-MODEL.md` - GRC entity relationships
- `docs/STAGING_RELEASE_CHECKLIST.md` - Staging deployment validation
- `CONTRIBUTING.md` - Development setup and contribution guidelines
- `SECURITY.md` - Security practices and vulnerability reporting
