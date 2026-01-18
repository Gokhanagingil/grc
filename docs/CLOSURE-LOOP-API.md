# Closure Loop API

This document describes the Closure Loop MVP endpoints that enable the Golden Flow chain closure:
Standard/Requirement -> Control -> Evidence -> Test/Result -> Issue -> CAPA -> CAPA Tasks -> Closure

## Overview

The Closure Loop feature allows users to close CAPA tasks, which can automatically complete the parent CAPA, which can automatically close the linked Issue. Status history entries are recorded for every transition.

## Routing

Backend controllers use `@Controller('grc/...')` paths (no 'api/' prefix). External clients (frontend/nginx) call `/api/grc/...` and nginx strips the `/api/` prefix before proxying to the backend.

## Endpoints

### CAPA Task Status Update

**Endpoint:** `PATCH /grc/capa-tasks/:id/status`

**External URL:** `PATCH /api/grc/capa-tasks/:id/status`

**Request Body:**
```json
{
  "status": "COMPLETED",
  "comment": "Task completed successfully"
}
```

**Valid Status Values:** `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` (UPPERCASE)

**Allowed Transitions:**
- PENDING -> IN_PROGRESS, CANCELLED
- IN_PROGRESS -> COMPLETED, CANCELLED, PENDING

**Cascade Behavior:** When a CAPA task is marked as COMPLETED or CANCELLED, the system checks if all tasks for the parent CAPA are in terminal states (COMPLETED or CANCELLED). If so, the CAPA is automatically closed.

### CAPA Status Update

**Endpoint:** `PATCH /grc/capas/:id/status`

**External URL:** `PATCH /api/grc/capas/:id/status`

**Request Body:**
```json
{
  "status": "in_progress",
  "comment": "Starting implementation"
}
```

**Valid Status Values:** `planned`, `in_progress`, `implemented`, `verified`, `rejected`, `closed` (lowercase)

**Allowed Transitions:**
- planned -> in_progress, rejected
- in_progress -> implemented, planned, rejected
- implemented -> verified, in_progress
- verified -> closed, implemented
- closed -> in_progress (reopen)
- rejected -> planned (reopen)

**Cascade Behavior:** When a CAPA is closed, the system checks if all CAPAs for the linked Issue are closed. If so, the Issue is automatically closed.

### Issue Status Update

**Endpoint:** `PATCH /grc/issues/:id/status`

**External URL:** `PATCH /api/grc/issues/:id/status`

**Request Body:**
```json
{
  "status": "in_progress",
  "comment": "Starting investigation"
}
```

**Valid Status Values:** `open`, `in_progress`, `resolved`, `rejected`, `closed` (lowercase)

**Allowed Transitions:**
- open -> in_progress, rejected
- in_progress -> resolved, open, rejected
- resolved -> closed, in_progress
- closed -> in_progress (reopen)
- rejected -> open (reopen)

## Status History

Every status transition creates a status history entry with:
- `entityType`: The type of entity (capa_task, capa, issue)
- `entityId`: The ID of the entity
- `fromStatus`: The previous status
- `toStatus`: The new status
- `changedBy`: The user ID who made the change
- `reason`: Optional comment explaining the change
- `timestamp`: When the change occurred

## Authentication and Authorization

All endpoints require:
- JWT Bearer token in the `Authorization` header
- `x-tenant-id` header with the tenant ID
- Appropriate permissions:
  - CAPA Task: `GRC_CAPA_TASK_WRITE`
  - CAPA: `GRC_CAPA_WRITE`
  - Issue: `GRC_ISSUE_WRITE`

## Validation Examples with curl

### Login to get token

```bash
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@grc-platform.local", "password": "TestPassword123!"}'
```

Save the `accessToken` and `tenantId` from the response.

### Update CAPA Task Status (Backend Direct)

```bash
curl -X PATCH http://localhost:3002/grc/capa-tasks/{task_id}/status \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-id: {tenant_id}" \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED", "comment": "Task completed"}'
```

### Update CAPA Task Status (Via Nginx)

```bash
curl -X PATCH http://localhost/api/grc/capa-tasks/{task_id}/status \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-id: {tenant_id}" \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED", "comment": "Task completed"}'
```

### Update CAPA Status

```bash
curl -X PATCH http://localhost:3002/grc/capas/{capa_id}/status \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-id: {tenant_id}" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "comment": "Starting implementation"}'
```

### Update Issue Status

```bash
curl -X PATCH http://localhost:3002/grc/issues/{issue_id}/status \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-id: {tenant_id}" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "comment": "Starting investigation"}'
```

### Verify Cascade (Get CAPA after task completion)

```bash
curl -X GET http://localhost:3002/grc/capas/{capa_id} \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-id: {tenant_id}"
```

### Verify Cascade (Get Issue after CAPA closure)

```bash
curl -X GET http://localhost:3002/grc/issues/{issue_id} \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-id: {tenant_id}"
```

### Get Status History

```bash
curl -X GET "http://localhost:3002/grc/status-history?entityType=capa&entityId={capa_id}" \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-id: {tenant_id}"
```

## Error Responses

### Invalid Transition (400 Bad Request)

```json
{
  "statusCode": 400,
  "message": "Invalid status transition from 'planned' to 'closed'. Allowed transitions: in_progress, rejected",
  "error": "Bad Request"
}
```

### Entity Not Found (404 Not Found)

```json
{
  "statusCode": 404,
  "message": "CAPA with ID {id} not found",
  "error": "Not Found"
}
```

### Missing Tenant Header (400 Bad Request)

```json
{
  "statusCode": 400,
  "message": "x-tenant-id header is required",
  "error": "Bad Request"
}
```

### Unauthorized (401 Unauthorized)

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
