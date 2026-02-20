# Change Governance Runbook

## Overview

This runbook covers the Change Governance system: CAB (Change Advisory Board) approvals, workflow state machine, risk-based gating, freeze window enforcement, and notification integration.

**PRs:**
- PR1: Calendar + Freeze Windows + Collision Detection
- PR2: Risk Scoring Engine + Policy Rules
- PR3: CAB Approvals + Workflow Integration + Notifications

---

## Architecture

```
Change Detail Page
  |
  v
Governance Strip (risk score, conflicts, freeze, approval badge, CTA)
  |
  v
Request CAB Approval  -->  ApprovalService.requestApproval()
  |                           |
  |                           +-- Checks freeze windows (FreezeWindowService)
  |                           +-- Checks conflict detection (ConflictDetectionService)
  |                           +-- Creates ItsmApproval rows (one per approver role)
  |                           +-- Emits sys.event: itsm.change.approval_requested
  |                           +-- Updates change.approvalStatus = REQUESTED
  |
Approve / Reject  -->  ApprovalService.approve() / reject()
  |                       |
  |                       +-- RBAC check (admin/manager only)
  |                       +-- Updates approval state
  |                       +-- If all approved: change.approvalStatus = APPROVED
  |                       +-- If any rejected: change.approvalStatus = REJECTED
  |                       +-- Emits sys.event: itsm.change.approved / rejected
  |
Implement  -->  ChangeService.update() with state=IMPLEMENT
  |               |
  |               +-- Gate: approvalStatus must be APPROVED
  |               +-- Gate: no active freeze window conflicts
  |               +-- Returns 409 if blocked
```

---

## Staging Deployment

### Prerequisites

- SSH access to staging server (46.224.99.150)
- Docker Compose available at `/opt/grc-platform`

### Steps

```bash
# 1. SSH to staging
ssh user@46.224.99.150

# 2. Navigate to platform
cd /opt/grc-platform

# 3. Pull latest
git pull origin main

# 4. Build and deploy
docker compose -f docker-compose.staging.yml up -d --build backend frontend

# 5. Run migrations
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npx typeorm migration:run -d dist/data-source.js'

# 6. Seed change governance demo data
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'node dist/scripts/seed-change-governance-demo.js'

# 7. Verify health
curl -s http://localhost/api/health/live | jq .
curl -s http://localhost/api/health/db | jq .
```

---

## Seed Commands

### Development

```bash
cd backend-nest
npm run seed:change-governance-demo:dev
```

### Production / Staging

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'node dist/scripts/seed-change-governance-demo.js'
```

### What the seed creates

| Resource | ID | Description |
|---|---|---|
| Policy: Block during freeze | 33333333-...-30001 | Blocks changes overlapping freeze windows |
| Policy: CAB for HIGH risk | 33333333-...-30002 | Requires CAB approval for risk >= HIGH |
| Freeze Window | 33333333-...-30010 | Next 22:00-06:00 UTC nightly freeze |
| Template: Approval Requested | 33333333-...-30101 | Notification template for approval requests |
| Template: Approved | 33333333-...-30102 | Notification template for approvals |
| Template: Rejected | 33333333-...-30103 | Notification template for rejections |
| Rule: Notify approvers | 33333333-...-30201 | Routes approval_requested to managers/admins |
| Rule: Notify on approve | 33333333-...-30202 | Routes approved to requester/assignee |
| Rule: Notify on reject | 33333333-...-30203 | Routes rejected to requester/assignee |
| Change: HIGH risk | 33333333-...-31001 | Demo change (CHG900001) in ASSESS state |
| Change: Freeze blocked | 33333333-...-31002 | Demo change (CHG900002) overlapping freeze |

---

## API Endpoints

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| POST | /grc/itsm/changes/:id/request-approval | ITSM_CHANGE_WRITE | Request CAB approval |
| POST | /grc/itsm/approvals/:id/approve | ITSM_APPROVAL_WRITE | Approve a pending approval |
| POST | /grc/itsm/approvals/:id/reject | ITSM_APPROVAL_WRITE | Reject a pending approval |
| GET | /grc/itsm/changes/:id/approvals | ITSM_APPROVAL_READ | List approvals for a change |

All endpoints require:
- `Authorization: Bearer <token>` header
- `x-tenant-id: <uuid>` header

---

## Acceptance Checklist

### Data Model
- [ ] 1. `itsm_approval` table exists with correct columns
- [ ] 2. `approval_state_enum` has values: REQUESTED, APPROVED, REJECTED, CANCELLED
- [ ] 3. Foreign keys to tenant, change record
- [ ] 4. Timestamps (createdAt, updatedAt, decidedAt) populated correctly

### Approval API
- [ ] 5. POST request-approval creates approval rows
- [ ] 6. POST request-approval checks freeze windows and returns 409 if blocked
- [ ] 7. POST request-approval checks conflict detection
- [ ] 8. POST request-approval updates change.approvalStatus to REQUESTED
- [ ] 9. POST approve updates approval state to APPROVED
- [ ] 10. POST approve updates change.approvalStatus to APPROVED when all approvals granted
- [ ] 11. POST reject updates approval state to REJECTED
- [ ] 12. POST reject updates change.approvalStatus to REJECTED
- [ ] 13. GET approvals returns list with correct data
- [ ] 14. Approval endpoints require ITSM_APPROVAL_WRITE permission
- [ ] 15. Regular users (role=user) cannot approve/reject

### Workflow Gating
- [ ] 16. Transition to IMPLEMENT blocked when approvalStatus != APPROVED
- [ ] 17. Transition to IMPLEMENT blocked during active freeze window
- [ ] 18. Transition to IMPLEMENT allowed after all approvals granted
- [ ] 19. State transitions emit journal entries
- [ ] 20. Rejected changes cannot transition to IMPLEMENT

### Notifications
- [ ] 21. approval_requested event fires on request-approval
- [ ] 22. approved event fires on approve
- [ ] 23. rejected event fires on reject
- [ ] 24. Notification templates seeded with correct variables
- [ ] 25. Notification rules route to correct recipients
- [ ] 26. In-app notifications appear for managers/admins on approval request
- [ ] 27. In-app notifications appear for requester/assignee on approve/reject

### Frontend UX
- [ ] 28. Governance strip shows risk score, risk level, approval status badge
- [ ] 29. Governance strip shows freeze window badge when applicable
- [ ] 30. Governance strip shows conflicts count badge
- [ ] 31. "Request CAB Approval" button visible in ASSESS/AUTHORIZE state
- [ ] 32. "Implement" button visible after all approvals granted
- [ ] 33. Approve/Reject buttons visible on pending approvals
- [ ] 34. Approve/Reject dialog with comment field works
- [ ] 35. 409 errors show clear banner with reason
- [ ] 36. Banner includes "View Calendar" link
- [ ] 37. CAB Approvals section shows approval list with state badges
- [ ] 38. Audit trail shows who/when/comment for each approval

### Multi-Tenant Isolation
- [ ] 39. All approval queries scoped to tenantId
- [ ] 40. Cannot access approvals from another tenant
- [ ] 41. Freeze window checks scoped to tenant

### Security
- [ ] 42. Server-side approval gating cannot be bypassed via direct API calls
- [ ] 43. RBAC enforced: only admin/manager can approve
- [ ] 44. No secrets exposed in API responses
- [ ] 45. Permission guards applied to all endpoints

### Seeds & Demo
- [ ] 46. Seed script is idempotent (safe to run multiple times)
- [ ] 47. Demo changes created with correct risk assessments
- [ ] 48. Freeze window created for next nightly window
- [ ] 49. Notification templates and rules created
- [ ] 50. Policies created for freeze blocking and CAB requirement

---

## 2-Minute Demo Script

### Setup
1. Run seed: `npm run seed:change-governance-demo:dev`
2. Login as admin user

### Demo Flow (exact clicks)

1. **Navigate to Changes**: Click "ITSM" in sidebar > "Changes"
2. **Open demo change**: Click on **CHG900001** ("Demo: High risk change requiring CAB approval")
3. **Observe governance strip**: Note the risk score (85), risk level (HIGH), and approval status (NOT REQUESTED)
4. **Request CAB Approval**: Click the **"Request CAB Approval"** button in the governance strip
5. **Observe state change**: Approval status badge updates to "REQUESTED", CAB Approvals section appears in sidebar
6. **Approve**: Click the green checkmark icon next to the pending approval
7. **Enter comment**: Type "Approved after risk review" > Click **"Approve"**
8. **Observe approval**: Status badge updates to "APPROVED", "Implement" button appears
9. **Implement**: Click **"Implement"** button
10. **Verify**: Change state updates to IMPLEMENT

### Error Demo (optional)

1. Open **CHG900002** ("Demo: Change blocked by freeze window")
2. Click "Request CAB Approval"
3. Observe the error banner showing freeze window conflict with "View Calendar" link
