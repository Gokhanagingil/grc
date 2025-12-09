# GRC Platform Acceptance Scenarios

This document defines the core end-to-end acceptance scenarios for the GRC + ITSM platform. These scenarios validate the main user flows using the demo admin user.

## Overview

The acceptance scenarios are designed to be ACU-optimized, meaning they are robust, scenario-based tests that cover the critical user journeys rather than many small isolated tests. Each scenario validates a complete user flow from start to finish.

## Prerequisites

Before running acceptance scenarios, ensure:

1. The NestJS backend is running on the configured `BASE_URL` (default: `http://localhost:3002`)
2. The database is seeded with demo data (`npm run seed:grc`)
3. The demo admin user exists with the following credentials:
   - Email: `admin@grc-platform.local` (or `DEMO_ADMIN_EMAIL` env var)
   - Password: `TestPassword123!` (or `DEMO_ADMIN_PASSWORD` env var)

## Scenario 1: Login + Dashboard

**Purpose:** Validate authentication and dashboard summary endpoints return expected data.

### Steps

1. **Health Check**
   - Call `GET /health/live`
   - Expected: 200 OK with `{ status: 'ok' }`

2. **Login**
   - Call `POST /auth/login` with demo admin credentials
   - Expected: 200/201 with `{ access_token: string }` or `{ data: { accessToken: string, user: {...} } }`

3. **Verify User Profile**
   - Call `GET /users/me` with JWT token
   - Expected: 200 OK with user object containing:
     - `email`: matches demo admin email
     - `role`: should be `admin`
     - `tenantId`: valid UUID

4. **Dashboard Summary Endpoints**
   - Call `GET /grc/risks/summary` with auth headers
   - Expected: 200 OK with shape `{ totalCount, byStatus, top5OpenRisks }`
   - Call `GET /grc/policies/summary` with auth headers
   - Expected: 200 OK with shape `{ totalCount, activeCount, policyCoveragePercentage }`
   - Call `GET /grc/requirements/summary` with auth headers
   - Expected: 200 OK with shape `{ totalCount, compliantCount, requirementCoveragePercentage }`
   - Call `GET /itsm/incidents/summary` with auth headers
   - Expected: 200 OK with shape `{ totalCount, openCount, closedCount, resolvedCount }`

### Expected Outcome

All endpoints return 200 with valid JSON responses matching the expected shapes.

---

## Scenario 2: Risk Lifecycle

**Purpose:** Validate the complete risk management lifecycle including creation, linking, and retrieval.

### Steps

1. **Authenticate** (reuse token from Scenario 1 or re-login)

2. **Create a New Risk**
   - Call `POST /grc/risks` with:
     ```json
     {
       "title": "Acceptance Test Risk",
       "description": "Risk created by acceptance test runner",
       "category": "Operational",
       "severity": "high",
       "likelihood": "possible",
       "status": "identified"
     }
     ```
   - Expected: 201 Created with risk object containing `id`, `title`, `tenantId`

3. **Fetch Risk Details**
   - Call `GET /grc/risks/{riskId}`
   - Expected: 200 OK with the created risk details

4. **Link Policy to Risk**
   - First, get an existing policy: `GET /grc/policies` (use first policy ID)
   - Call `POST /grc/risks/{riskId}/policies` with `{ policyIds: [policyId] }`
   - Expected: 201 Created

5. **Link Requirement to Risk**
   - First, get an existing requirement: `GET /grc/requirements` (use first requirement ID)
   - Call `POST /grc/risks/{riskId}/requirements` with `{ requirementIds: [requirementId] }`
   - Expected: 201 Created

6. **Verify Relations**
   - Call `GET /grc/risks/{riskId}/policies`
   - Expected: 200 OK with array containing the linked policy
   - Call `GET /grc/risks/{riskId}/requirements`
   - Expected: 200 OK with array containing the linked requirement

7. **Cleanup (Optional)**
   - Call `DELETE /grc/risks/{riskId}` to soft-delete the test risk
   - Expected: 204 No Content

### Expected Outcome

Risk is created, linked to policies and requirements, and relations are verified.

---

## Scenario 3: Incident Lifecycle

**Purpose:** Validate the ITSM incident management lifecycle including creation, status updates, and metrics.

### Steps

1. **Authenticate** (reuse token or re-login)

2. **Create a New Incident**
   - Call `POST /itsm/incidents` with:
     ```json
     {
       "shortDescription": "Acceptance Test Incident",
       "description": "Incident created by acceptance test runner",
       "category": "software",
       "impact": "medium",
       "urgency": "medium",
       "source": "user",
       "assignmentGroup": "IT Support"
     }
     ```
   - Expected: 201 Created with incident object containing:
     - `id`: UUID
     - `number`: matches pattern `INC\d{6}`
     - `status`: `open`
     - `priority`: `p3` (calculated from medium impact/urgency)

3. **Update Incident Status**
   - Call `PATCH /itsm/incidents/{incidentId}` with `{ status: "in_progress" }`
   - Expected: 200 OK with updated status

4. **Resolve Incident**
   - Call `POST /itsm/incidents/{incidentId}/resolve` with:
     ```json
     { "resolutionNotes": "Resolved by acceptance test" }
     ```
   - Expected: 201 Created with `status: "resolved"` and `resolvedAt` timestamp

5. **Close Incident**
   - Call `POST /itsm/incidents/{incidentId}/close`
   - Expected: 201 Created with `status: "closed"`

6. **Verify in Statistics**
   - Call `GET /itsm/incidents/statistics`
   - Expected: 200 OK with statistics object (verify total count increased)

7. **Cleanup (Optional)**
   - Call `DELETE /itsm/incidents/{incidentId}` to soft-delete
   - Expected: 204 No Content

### Expected Outcome

Incident progresses through full lifecycle: open -> in_progress -> resolved -> closed.

---

## Scenario 4: Governance & Compliance

**Purpose:** Validate policy and requirement creation with risk associations.

### Steps

1. **Authenticate** (reuse token or re-login)

2. **Create a New Policy**
   - Call `POST /grc/policies` with:
     ```json
     {
       "name": "Acceptance Test Policy",
       "code": "POL-ACC-001",
       "version": "1.0",
       "status": "draft",
       "category": "Security",
       "summary": "Policy created by acceptance test runner"
     }
     ```
   - Expected: 201 Created with policy object containing `id`, `name`, `tenantId`

3. **Create a New Requirement**
   - Call `POST /grc/requirements` with:
     ```json
     {
       "framework": "iso27001",
       "referenceCode": "A.ACC.1",
       "title": "Acceptance Test Requirement",
       "description": "Requirement created by acceptance test runner",
       "category": "Security",
       "priority": "High",
       "status": "Pending"
     }
     ```
   - Expected: 201 Created with requirement object containing `id`, `title`, `tenantId`

4. **Create a Risk to Link**
   - Call `POST /grc/risks` with:
     ```json
     {
       "title": "Governance Test Risk",
       "description": "Risk for governance scenario",
       "category": "Compliance",
       "severity": "medium",
       "likelihood": "unlikely",
       "status": "identified"
     }
     ```
   - Expected: 201 Created

5. **Link Policy and Requirement to Risk**
   - Call `POST /grc/risks/{riskId}/policies` with `{ policyIds: [policyId] }`
   - Call `POST /grc/risks/{riskId}/requirements` with `{ requirementIds: [requirementId] }`
   - Expected: 201 Created for both

6. **Verify Reverse Associations**
   - Call `GET /grc/policies/{policyId}/risks`
   - Expected: 200 OK with array containing the linked risk
   - Call `GET /grc/requirements/{requirementId}/risks`
   - Expected: 200 OK with array containing the linked risk

7. **Cleanup (Optional)**
   - Soft-delete created entities

### Expected Outcome

Policy and requirement are created and properly linked to a risk with bidirectional associations.

---

## Scenario 5: Basic Users Check

**Purpose:** Validate user management endpoints and verify demo admin user configuration.

### Steps

1. **Authenticate** (reuse token or re-login)

2. **List Users**
   - Call `GET /users` with auth headers and tenant ID
   - Expected: 200 OK with:
     ```json
     {
       "success": true,
       "data": {
         "users": [...],
         "pagination": { "page": 1, "limit": 20, "total": number }
       }
     }
     ```

3. **Verify Demo Admin User**
   - Search for demo admin in users list by email
   - Expected: User found with:
     - `email`: matches `DEMO_ADMIN_EMAIL`
     - `role`: `admin`
     - `isActive`: `true`

4. **Get User Statistics**
   - Call `GET /users/statistics/overview`
   - Expected: 200 OK with:
     ```json
     {
       "total": number,
       "admins": number >= 1,
       "managers": number,
       "users": number,
       "inactive": number
     }
     ```

5. **Verify User Count**
   - Call `GET /users/count`
   - Expected: 200 OK with `{ count: number }`

### Expected Outcome

Demo admin user is present in the system with correct role and permissions.

---

## Running Acceptance Scenarios

### Local Development

```bash
# Ensure backend is running
cd backend-nest && npm run start:dev

# In another terminal, run acceptance tests
npm run acceptance:full
```

### Against Staging

```bash
BASE_URL=https://staging.example.com \
DEMO_ADMIN_EMAIL=admin@grc-platform.local \
DEMO_ADMIN_PASSWORD=YourStagingPassword \
npm run acceptance:full
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3002` | Backend API base URL |
| `DEMO_ADMIN_EMAIL` | `admin@grc-platform.local` | Demo admin email |
| `DEMO_ADMIN_PASSWORD` | `TestPassword123!` | Demo admin password |

---

## Interpreting Results

The acceptance runner outputs a clear PASS/FAIL summary for each scenario:

```
========================================
GRC Platform Acceptance Test Runner
========================================

Scenario 1: Login + Dashboard
  [PASS] Health check
  [PASS] Login
  [PASS] User profile verification
  [PASS] Dashboard summaries

Scenario 2: Risk Lifecycle
  [PASS] Create risk
  [PASS] Link policy
  [PASS] Link requirement
  [PASS] Verify relations

... (more scenarios)

========================================
SUMMARY
========================================
Scenarios: 5 passed, 0 failed
Total checks: 25 passed, 0 failed
Duration: 3.2s

[SUCCESS] All acceptance scenarios passed!
```

### Exit Codes

- `0`: All scenarios passed
- `1`: One or more scenarios failed

### Troubleshooting

1. **Connection refused**: Ensure backend is running on the correct port
2. **401 Unauthorized**: Check demo admin credentials and ensure user is seeded
3. **400 Bad Request**: Verify tenant ID header is being sent
4. **404 Not Found**: Ensure seed data exists (`npm run seed:grc`)
