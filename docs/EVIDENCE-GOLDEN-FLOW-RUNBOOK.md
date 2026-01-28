# Evidence Golden Flow v1 Runbook

This document describes the Evidence Golden Flow implementation, including API endpoints, frontend pages, and testing procedures.

## Overview

The Evidence Golden Flow enables the complete compliance control lifecycle:

```
Standard/Requirement -> Control -> Evidence -> ControlTest -> TestResult -> Issue -> CAPA -> CAPATasks
```

Evidence is a central artifact that can be linked to Controls, Issues, and Test Results to provide audit trail and compliance documentation.

## API Endpoints

### Evidence CRUD

All endpoints require:
- `Authorization: Bearer <token>` header
- `x-tenant-id: <tenant-uuid>` header

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grc/evidence` | List evidence with pagination, filtering, sorting |
| POST | `/api/grc/evidence` | Create new evidence |
| GET | `/api/grc/evidence/:id` | Get evidence by ID |
| PATCH | `/api/grc/evidence/:id` | Update evidence |
| DELETE | `/api/grc/evidence/:id` | Soft delete evidence |

### Evidence Linkage Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grc/evidence/:id/controls` | Get controls linked to evidence |
| POST | `/api/grc/evidence/:id/controls/:controlId` | Link evidence to control |
| DELETE | `/api/grc/evidence/:id/controls/:controlId` | Unlink evidence from control |
| GET | `/api/grc/evidence/:id/issues` | Get issues linked to evidence |
| POST | `/api/grc/evidence/:id/issues/:issueId` | Link evidence to issue |
| DELETE | `/api/grc/evidence/:id/issues/:issueId` | Unlink evidence from issue |
| GET | `/api/grc/evidence/:id/test-results` | Get test results linked to evidence |

### Reverse Linkage Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grc/controls/:id/evidences` | Get evidence linked to a control |
| GET | `/api/grc/issues/:id/evidence` | Get evidence linked to an issue |
| POST | `/api/grc/issues/:id/evidence/:evidenceId` | Link evidence to issue |
| DELETE | `/api/grc/issues/:id/evidence/:evidenceId` | Unlink evidence from issue |

### Evidence Attachments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grc/attachments?refTable=grc_evidence&refId=:id` | List attachments for evidence |
| POST | `/api/grc/attachments` | Upload attachment (with refTable=grc_evidence, refId) |
| DELETE | `/api/grc/attachments/:attachmentId` | Delete attachment |
| GET | `/api/grc/attachments/:attachmentId/download` | Download attachment |

## Frontend Pages

### Evidence List Page

- **Route**: `/evidence`
- **Features**:
  - Paginated table with evidence records
  - Filter by status and type
  - Search by name/description
  - Create new evidence via dialog
  - Row click navigates to detail page

### Evidence Detail Page

- **Route**: `/evidence/:id`
- **Tabs**:
  1. **Overview**: View/edit evidence fields (name, description, type, status, etc.)
  2. **Links**: View linked Controls, Issues, Test Results with link/unlink actions
  3. **Attachments**: Upload, view, download, delete file attachments
  4. **History**: View status change history

### Integration in Other Pages

- **Control Detail** (`/controls/:id`): Evidence tab shows linked GRC Evidence records
- **Issue Detail** (`/issues/:id`): Links tab shows linked Evidence with create/link actions

## Data Model

### Evidence Entity Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | Tenant isolation |
| name | string | Evidence name (required) |
| description | string | Description |
| type | enum | DOCUMENT, SCREENSHOT, LOG, REPORT, CONFIG_EXPORT, LINK, OTHER |
| sourceType | enum | MANUAL, URL, SYSTEM |
| status | enum | DRAFT, APPROVED, RETIRED |
| location | string | File path or location |
| externalUrl | string | External URL reference |
| collectedAt | timestamp | When evidence was collected |
| dueDate | date | Due date for evidence collection |
| metadata | jsonb | Additional metadata |

### Linkage Tables

- `grc_control_evidence`: Links Evidence to Controls
- `grc_issue_evidence`: Links Evidence to Issues
- `grc_test_result_evidence`: Links Evidence to Test Results

## Running Tests

### Backend E2E Tests

```bash
cd ~/repos/grc/backend-nest
npm run test:e2e -- --testPathPattern=evidence
```

### Playwright Smoke Tests

```bash
cd ~/repos/grc/frontend

# Run all evidence flow tests
npx playwright test evidence-flow.spec.ts

# Run with UI mode
npx playwright test evidence-flow.spec.ts --ui

# Run with headed browser
npx playwright test evidence-flow.spec.ts --headed
```

### Test Coverage

Backend E2E tests cover:
- Evidence CRUD operations
- Evidence-Control linkage
- Evidence-Issue linkage
- Tenant isolation
- Optional issueId in create

Playwright tests cover:
- Evidence list page loads
- Create evidence dialog
- Evidence detail page with all tabs
- Links tab shows linked entities
- Attachments tab loads
- History tab shows status history
- Integration with Issue detail
- Integration with Control detail

## Seed Data

The Golden Flow seed script creates sample evidence data:

```bash
cd ~/repos/grc/backend-nest
npm run seed:golden-flow
```

This creates:
- `GF-Access Control Policy Document` evidence
- Links evidence to `GF-CTL-001` control
- Links evidence to `GF-Access Control Deficiencies` issue

## Manual Testing Flow

1. **Login** to the application
2. **Navigate to Evidence** list page (`/evidence`)
3. **Create new evidence** using the "Add Evidence" button
4. **Open evidence detail** by clicking a row
5. **Verify tabs**:
   - Overview shows evidence fields
   - Links shows linked entities
   - Attachments allows file upload
   - History shows status changes
6. **Navigate to Issue detail** and verify Evidence appears in Links tab
7. **Navigate to Control detail** and verify Evidence appears in Evidence tab

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Ensure valid JWT token in Authorization header
2. **400 Bad Request**: Check x-tenant-id header is valid UUID
3. **403 Forbidden**: User doesn't have permission or wrong tenant
4. **404 Not Found**: Evidence ID doesn't exist or is soft-deleted

### Debug Endpoints

```bash
# Check evidence exists
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     http://localhost:3002/grc/evidence

# Check linked controls
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     http://localhost:3002/grc/evidence/$EVIDENCE_ID/controls
```

## Related Documentation

- [GRC Acceptance and Smoke Runbook](./GRC-ACCEPTANCE-AND-SMOKE-RUNBOOK.md)
- [Staging Maintenance Runbook](./STAGING-MAINTENANCE-RUNBOOK.md)
- [Migrations Staging Runbook](../backend-nest/docs/MIGRATIONS-STAGING-RUNBOOK.md)
