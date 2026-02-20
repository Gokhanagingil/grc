# Audit Module NestJS Migration Notes

This document describes the migration of the Audit module frontend from the legacy Express backend paths to the NestJS backend endpoints.

## Overview

The Audit module frontend has been updated to use the NestJS backend endpoints at `/grc/audits` instead of the legacy Express paths. This ensures the Audits page works correctly in the staging environment where only the NestJS backend is deployed.

## Backend Endpoints

The NestJS backend exposes the following Audit endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/grc/audits` | List audits with pagination and filtering |
| POST | `/grc/audits` | Create a new audit |
| GET | `/grc/audits/:id` | Get a single audit by ID |
| PATCH | `/grc/audits/:id` | Update an audit |
| DELETE | `/grc/audits/:id` | Soft delete an audit |
| GET | `/grc/audits/statistics` | Get audit statistics |
| GET | `/grc/audits/distinct/:field` | Get distinct values for filters |
| GET | `/grc/audits/can/create` | Check if user can create audits |

## Query Parameters for List Endpoint

The list endpoint (`GET /grc/audits`) supports the following query parameters:

- `page` - Page number (1-indexed)
- `pageSize` - Number of items per page
- `status` - Filter by status (planned, in_progress, completed, closed, cancelled)
- `riskLevel` - Filter by risk level (low, medium, high, critical)
- `auditType` - Filter by audit type (internal, external, regulatory, compliance)
- `department` - Filter by department
- `search` - Search query for name/description

## Response Format

The list endpoint returns data in the following format:

```json
{
  "success": true,
  "data": {
    "audits": [...],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

## Field Name Mapping

The NestJS backend uses camelCase field names. The frontend has been updated to use these field names:

| Old (snake_case) | New (camelCase) |
|------------------|-----------------|
| audit_type | auditType |
| risk_level | riskLevel |
| owner_id | ownerUserId |
| lead_auditor_id | leadAuditorId |
| planned_start_date | plannedStartDate |
| planned_end_date | plannedEndDate |
| actual_start_date | actualStartDate |
| actual_end_date | actualEndDate |
| findings_summary | findingsSummary |
| created_at | createdAt |
| updated_at | updatedAt |

## Audit Types

The NestJS backend supports the following audit types:

- `internal` - Internal audit
- `external` - External audit
- `regulatory` - Regulatory audit
- `compliance` - Compliance audit

## Audit Statuses

The NestJS backend supports the following audit statuses:

- `planned` - Audit is planned
- `in_progress` - Audit is in progress
- `completed` - Audit is completed
- `closed` - Audit is closed
- `cancelled` - Audit is cancelled

## Risk Levels

The NestJS backend supports the following risk levels:

- `low` - Low risk
- `medium` - Medium risk
- `high` - High risk
- `critical` - Critical risk

## Frontend Changes

The following frontend files were updated:

1. `frontend/src/pages/AuditList.tsx` - Updated Audit interface and field references to use camelCase
2. `frontend/src/pages/AuditDetail.tsx` - Updated Audit interface, formData types, and field references to use camelCase

## Staging Deployment Verification

After deploying to staging, verify the Audits page works correctly:

1. Navigate to the Audits page from the sidebar menu
2. Verify the page loads without errors (no white screen)
3. If audits exist, verify they are displayed in the list
4. If no audits exist, verify the "No audits found" empty state is displayed
5. Test creating a new audit (if permissions allow)
6. Test viewing an existing audit
7. Test editing an existing audit
8. Test filtering by status, risk level, type, and department

## Related Documentation

- `docs/AUDIT-MODULE-SHOWCASE.md` - Audit module feature showcase
- `docs/AUDIT-REPORT-TEMPLATE-DESIGN.md` - Audit report template design
- `docs/AUDIT-REPORTING-ENGINE.md` - Audit reporting engine documentation
