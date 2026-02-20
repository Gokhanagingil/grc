# Golden Flow Verification Runbook

This document provides step-by-step instructions for verifying the GRC Golden Flow implementation, including API curl examples and UI verification steps.

## Prerequisites

Before running the verification steps, ensure:

1. Backend is running on port 3002
2. Database migrations have been applied
3. Golden Flow seed data has been created

## Setup Commands

### Local Development

```bash
# Navigate to backend directory
cd ~/repos/grc/backend-nest

# Install dependencies
npm ci

# Run migrations
npm run migration:run

# Seed Golden Flow demo data
npm run seed:golden-flow

# Start the backend
npm run start:dev
```

### Staging Environment

```bash
# SSH to staging server
ssh root@46.224.99.150

# Navigate to project directory
cd /opt/grc-platform

# Run migrations (inside container)
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'npx typeorm migration:run -d dist/data-source.js'

# Seed Golden Flow data (inside container)
docker compose -f docker-compose.staging.yml exec -T backend sh -lc 'node dist/scripts/seed-golden-flow.js'
```

## Authentication

All API requests require authentication. First, obtain a JWT token:

```bash
# Login to get JWT token
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@grc-platform.local",
    "password": "TestPassword123!"
  }'

# Response will contain:
# {
#   "success": true,
#   "data": {
#     "accessToken": "eyJhbGciOiJIUzI1NiIs...",
#     "refreshToken": "...",
#     "user": { ... }
#   }
# }

# Export the token for subsequent requests
export TOKEN="eyJhbGciOiJIUzI1NiIs..."
export TENANT_ID="00000000-0000-0000-0000-000000000001"
```

## Golden Flow API Verification

### 1. Verify Requirement (Standard)

```bash
# List requirements
curl -X GET "http://localhost:3002/api/grc/requirements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Expected: Should see GF-REQ-001 "Access Control Testing Requirement"
```

### 2. Verify Control

```bash
# List controls
curl -X GET "http://localhost:3002/api/grc/controls" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Get specific Golden Flow control
curl -X GET "http://localhost:3002/api/grc/controls?code=GF-CTL-001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Expected: Should see GF-CTL-001 "Role-Based Access Control"
```

### 3. Verify Evidence

```bash
# List evidence
curl -X GET "http://localhost:3002/api/grc/evidence" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Expected: Should see "GF-Access Control Policy Document"
```

### 4. Verify Control-Evidence Link

```bash
# List control evidence links
curl -X GET "http://localhost:3002/api/grc/control-evidence" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Get evidence for specific control (replace CONTROL_ID with actual ID)
curl -X GET "http://localhost:3002/api/grc/control-evidence/control/{CONTROL_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Expected: Should see link between GF-CTL-001 and GF-Access Control Policy Document
```

### 5. Verify Control Test

```bash
# List control tests
curl -X GET "http://localhost:3002/api/grc/control-tests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Get tests for specific control (replace CONTROL_ID with actual ID)
curl -X GET "http://localhost:3002/api/grc/control-tests/control/{CONTROL_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Expected: Should see a COMPLETED control test for GF-CTL-001
```

### 6. Verify Test Result

```bash
# List test results
curl -X GET "http://localhost:3002/api/grc/test-results" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Get results for specific control test (replace CONTROL_TEST_ID with actual ID)
curl -X GET "http://localhost:3002/api/grc/test-results/control-test/{CONTROL_TEST_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Expected: Should see a FAIL result with effectivenessRating of 2
```

### 7. Verify Issue

```bash
# List issues
curl -X GET "http://localhost:3002/api/grc/issues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Expected: Should see "GF-Access Control Deficiencies" with status IN_PROGRESS
```

### 8. Verify CAPA

```bash
# List CAPAs
curl -X GET "http://localhost:3002/api/grc/capas" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Expected: Should see "GF-Access Control Remediation Plan" with status IN_PROGRESS
```

### 9. Verify CAPA Tasks

```bash
# List CAPA tasks (replace CAPA_ID with actual ID)
curl -X GET "http://localhost:3002/api/grc/capa-tasks/capa/{CAPA_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Expected: Should see 2 tasks:
# - "Disable Dormant Accounts" (COMPLETED)
# - "Review Excessive Privileges" (IN_PROGRESS)
```

### 10. Verify Status History

```bash
# Get status history for an issue (replace ISSUE_ID with actual ID)
curl -X GET "http://localhost:3002/api/grc/status-history/entity/ISSUE/{ISSUE_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Get status history for a CAPA (replace CAPA_ID with actual ID)
curl -X GET "http://localhost:3002/api/grc/status-history/entity/CAPA/{CAPA_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"

# Expected: Should see status transition history for each entity
```

## Workflow Operations

### Create a New Control Test

```bash
# Schedule a new control test (replace CONTROL_ID with actual ID)
curl -X POST "http://localhost:3002/api/grc/control-tests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "controlId": "{CONTROL_ID}",
    "testType": "MANUAL",
    "testFrequency": "QUARTERLY",
    "scheduledDate": "2026-02-01T00:00:00.000Z",
    "dueDate": "2026-02-15T00:00:00.000Z",
    "notes": "Q1 2026 quarterly access control review"
  }'
```

### Update Control Test Status

```bash
# Start a control test (replace CONTROL_TEST_ID with actual ID)
curl -X PATCH "http://localhost:3002/api/grc/control-tests/{CONTROL_TEST_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS",
    "reason": "Starting test execution"
  }'
```

### Create Test Result

```bash
# Create a test result (replace CONTROL_TEST_ID with actual ID)
curl -X POST "http://localhost:3002/api/grc/test-results" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "controlTestId": "{CONTROL_TEST_ID}",
    "result": "PASS",
    "effectivenessRating": 4,
    "notes": "All access controls verified and functioning correctly.",
    "executedAt": "2026-01-08T12:00:00.000Z"
  }'
```

### Create Issue from Test Result

```bash
# Create an issue linked to a failing test result
curl -X POST "http://localhost:3002/api/grc/issues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Access Control Finding",
    "description": "Issue identified during control test",
    "severity": "MEDIUM",
    "priority": "MEDIUM",
    "relatedControlId": "{CONTROL_ID}",
    "relatedTestResultId": "{TEST_RESULT_ID}"
  }'
```

### Update Issue Status

```bash
# Transition issue to IN_PROGRESS (replace ISSUE_ID with actual ID)
curl -X PATCH "http://localhost:3002/api/grc/issues/{ISSUE_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS",
    "reason": "Starting remediation work"
  }'

# Close issue (requires closureNote)
curl -X PATCH "http://localhost:3002/api/grc/issues/{ISSUE_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CLOSED",
    "reason": "All remediation tasks completed",
    "closureNote": "Issue resolved through CAPA implementation"
  }'
```

### Create CAPA from Issue

```bash
# Create a CAPA linked to an issue (replace ISSUE_ID with actual ID)
curl -X POST "http://localhost:3002/api/grc/capas" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Remediation Plan for Access Control Finding",
    "description": "CAPA to address access control deficiencies",
    "actionPlan": "1. Review current access controls\n2. Implement fixes\n3. Verify effectiveness",
    "relatedIssueId": "{ISSUE_ID}",
    "dueDate": "2026-02-28T00:00:00.000Z",
    "verificationPlan": "Conduct follow-up access review"
  }'
```

### Update CAPA Status

```bash
# Progress CAPA to IN_PROGRESS (replace CAPA_ID with actual ID)
curl -X PATCH "http://localhost:3002/api/grc/capas/{CAPA_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS",
    "reason": "Starting CAPA implementation"
  }'

# Progress to IMPLEMENTED (requires at least 1 task or justification)
curl -X PATCH "http://localhost:3002/api/grc/capas/{CAPA_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IMPLEMENTED",
    "reason": "All corrective actions completed"
  }'

# Progress to VERIFIED (requires verificationNote)
curl -X PATCH "http://localhost:3002/api/grc/capas/{CAPA_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "VERIFIED",
    "reason": "Verification completed",
    "verificationNote": "Follow-up review confirmed all issues resolved"
  }'

# Close CAPA (requires effectivenessRating and closureNote)
curl -X PATCH "http://localhost:3002/api/grc/capas/{CAPA_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CLOSED",
    "reason": "CAPA successfully completed",
    "effectivenessRating": 4,
    "closureNote": "All corrective and preventive actions implemented and verified effective"
  }'
```

### Create CAPA Task

```bash
# Create a CAPA task (replace CAPA_ID with actual ID)
curl -X POST "http://localhost:3002/api/grc/capa-tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "capaId": "{CAPA_ID}",
    "title": "Document Service Accounts",
    "description": "Create documentation for all service accounts including purpose and access levels",
    "dueDate": "2026-01-20T00:00:00.000Z",
    "sequenceOrder": 3
  }'
```

### Update CAPA Task Status

```bash
# Start a CAPA task (replace TASK_ID with actual ID)
curl -X PATCH "http://localhost:3002/api/grc/capa-tasks/{TASK_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS",
    "reason": "Starting task execution"
  }'

# Complete a CAPA task
curl -X PATCH "http://localhost:3002/api/grc/capa-tasks/{TASK_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED",
    "reason": "Task completed successfully",
    "completionNotes": "All service accounts documented in ServiceNow CMDB"
  }'
```

## State Machine Validation Tests

### Issue State Machine

Valid transitions:
- OPEN -> IN_PROGRESS
- IN_PROGRESS -> RESOLVED
- RESOLVED -> CLOSED (requires closureNote)
- Any state -> OPEN (reopen)

Invalid transition test:
```bash
# Try to close an OPEN issue directly (should fail)
curl -X PATCH "http://localhost:3002/api/grc/issues/{ISSUE_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CLOSED",
    "reason": "Attempting invalid transition"
  }'

# Expected: 400 Bad Request with validation error
```

### CAPA State Machine

Valid transitions:
- PLANNED -> IN_PROGRESS
- IN_PROGRESS -> IMPLEMENTED (requires actionPlan + tasks or justification)
- IMPLEMENTED -> VERIFIED (requires verificationNote)
- VERIFIED -> CLOSED (requires effectivenessRating + closureNote)

Invalid transition test:
```bash
# Try to verify a PLANNED CAPA directly (should fail)
curl -X PATCH "http://localhost:3002/api/grc/capas/{CAPA_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "VERIFIED",
    "reason": "Attempting invalid transition"
  }'

# Expected: 400 Bad Request with validation error
```

## UI Verification Steps

### Control Detail Page
1. Navigate to Controls list
2. Click on "GF-CTL-001 - Role-Based Access Control"
3. Verify evidence links section shows "GF-Access Control Policy Document"
4. Verify test history shows completed test with FAIL result
5. Click "Schedule Test" to create a new control test

### Test Execution
1. Navigate to Control Tests list
2. Find the scheduled test for GF-CTL-001
3. Click to view test details
4. Click "Start Test" to begin execution
5. Click "Record Result" to create test result
6. Fill in result details (outcome, effectiveness rating, notes)
7. Submit result

### Issue Detail Page
1. Navigate to Issues list
2. Click on "GF-Access Control Deficiencies"
3. Verify related control and test result links
4. Verify status history shows transitions
5. Click "Create CAPA" to create a corrective action plan

### CAPA Detail Page
1. Navigate to CAPAs list
2. Click on "GF-Access Control Remediation Plan"
3. Verify related issue link
4. Verify tasks list shows 2 tasks
5. Click on a task to update its status
6. Use status buttons to progress CAPA through workflow
7. Verify status history updates after each transition

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Token expired, re-authenticate
2. **403 Forbidden**: User lacks required permission
3. **400 Bad Request**: Invalid state transition or missing required fields
4. **404 Not Found**: Entity doesn't exist or belongs to different tenant

### Checking Logs

```bash
# Local development
tail -f ~/repos/grc/backend-nest/logs/app.log

# Staging
docker logs -f grc-staging-backend
```

### Database Verification

```bash
# Local
psql -U postgres -d grc_platform -c "SELECT * FROM grc_control_test LIMIT 5;"

# Staging
docker exec grc-staging-db psql -U grc_staging -d grc_staging -c "SELECT * FROM grc_control_test LIMIT 5;"
```

## Cleanup

To reset the Golden Flow demo data:

```bash
# Local development
psql -U postgres -d grc_platform -c "
  DELETE FROM grc_status_history WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM grc_capa_task WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM grc_capa WHERE title LIKE 'GF-%';
  DELETE FROM grc_issue WHERE title LIKE 'GF-%';
  DELETE FROM grc_test_result WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM grc_control_test WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM grc_control_evidence WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM grc_evidence WHERE name LIKE 'GF-%';
  DELETE FROM grc_requirement_control WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM grc_control WHERE code LIKE 'GF-%';
  DELETE FROM grc_requirement WHERE reference_code LIKE 'GF-%';
"

# Then re-run the seed script
npm run seed:golden-flow
```
