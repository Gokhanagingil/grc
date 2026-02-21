# Customer Risk Intelligence — Runbook

## Overview

Customer Risk Intelligence bridges ITSM Change Management with GRC Customer Risk data.
When a change touches risky assets/services, the system explains which customer risks are
relevant, shows how much they contribute to change risk, influences governance decisions,
and allows operators to take mitigation actions.

---

## 1-Minute Demo Script

### Prerequisites

- Staging is running at `http://46.224.99.150` (or local backend on `http://localhost:3002`)
- At least one ITSM change exists with a linked service/offering/CI
- Customer risk catalog items and bindings exist (see PR-E seed data)

### Steps

1. **Login**

```bash
# Get auth token
TOKEN=$(curl -sf http://localhost:3002/auth/login \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  -d '{"email":"admin@grc-platform.local","password":"changeme"}' \
  | jq -r '.data.accessToken // .accessToken')

echo "Token: ${TOKEN:0:20}..."
```

2. **List changes**

```bash
curl -sf http://localhost:3002/grc/itsm/changes \
  -H "Authorization: Bearer $TOKEN" \
  -H 'x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  | jq '.data.items[:2] | .[].id'
```

Pick a `CHANGE_ID` from the output.

3. **View Customer Risk Impact**

```bash
CHANGE_ID=<paste-id-here>

curl -sf "http://localhost:3002/grc/itsm/changes/$CHANGE_ID/customer-risk-impact" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  | jq '.data | {aggregateScore, aggregateLabel, riskCount: (.resolvedRisks | length)}'
```

4. **Recalculate Customer Risk (triggers event bus + policy evaluation)**

```bash
curl -sf -X POST "http://localhost:3002/grc/itsm/changes/$CHANGE_ID/recalculate-customer-risk" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  -H 'Content-Type: application/json' \
  | jq '.data | {
    aggregateScore: .customerRiskImpact.aggregateScore,
    aggregateLabel: .customerRiskImpact.aggregateLabel,
    decision: .policyEvaluation.decisionRecommendation,
    rulesTriggered: (.policyEvaluation.rulesTriggered | length)
  }'
```

5. **Create a Mitigation Action**

```bash
curl -sf -X POST "http://localhost:3002/grc/itsm/changes/$CHANGE_ID/mitigation-actions" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  -H 'Content-Type: application/json' \
  -d '{
    "actionType": "RISK_OBSERVATION",
    "title": "Review EOS risk before deployment",
    "description": "Service has end-of-support OS risk — verify patch plan"
  }' | jq '.data | {id, actionType, status, title}'
```

6. **List Mitigation Actions**

```bash
curl -sf "http://localhost:3002/grc/itsm/changes/$CHANGE_ID/mitigation-actions" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  | jq '.data | {total, items: [.items[] | {id, actionType, status, title}]}'
```

7. **UI Walkthrough**

- Open browser to Change Detail page: `/itsm/changes/<CHANGE_ID>`
- Scroll to **Customer Risk Intelligence** panel
- Verify summary card shows aggregate score + label
- Click **Recalculate** button
- Click **Create Mitigation** button
- Fill in the modal and submit
- Verify the **Governance Banner** appears if risk is HIGH/CRITICAL

---

## API Reference

### Customer Risk Impact

| Method | Path | Description |
|--------|------|-------------|
| GET | `/grc/itsm/changes/:changeId/customer-risk-impact` | Get aggregated customer risk impact |
| POST | `/grc/itsm/changes/:changeId/recalculate-customer-risk` | Recalculate risk + policy evaluation |

### Risk Assessment

| Method | Path | Description |
|--------|------|-------------|
| GET | `/grc/itsm/changes/:changeId/risk` | Get risk assessment with policy evaluation |
| POST | `/grc/itsm/changes/:changeId/recalculate-risk` | Recalculate risk score |

### Mitigation Actions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/grc/itsm/changes/:changeId/mitigation-actions` | List mitigation actions (paginated) |
| POST | `/grc/itsm/changes/:changeId/mitigation-actions` | Create mitigation action |
| GET | `/grc/itsm/changes/:changeId/mitigation-actions/:id` | Get single mitigation action |
| PATCH | `/grc/itsm/changes/:changeId/mitigation-actions/:id/status` | Update action status |
| DELETE | `/grc/itsm/changes/:changeId/mitigation-actions/:id` | Soft-delete action |

### Change Policies

| Method | Path | Description |
|--------|------|-------------|
| GET | `/grc/itsm/change-policies` | List change governance policies |

> **Note**: All paths above are backend-direct (no `/api` prefix). Frontend calls use `/api/grc/...`.

---

## Response Shapes

### Customer Risk Impact

```json
{
  "data": {
    "aggregateScore": 75,
    "aggregateLabel": "HIGH",
    "resolvedRisks": [
      {
        "riskCode": "CRK-001",
        "title": "End-of-Support Operating System",
        "severity": "HIGH",
        "likelihood": "LIKELY",
        "exposureLevel": "HIGH",
        "relevancePaths": ["service_binding"],
        "contributionScore": 60,
        "status": "ACTIVE"
      }
    ],
    "recalculatedAt": "2026-02-21T..."
  }
}
```

### Policy Evaluation

```json
{
  "data": {
    "policyEvaluation": {
      "decisionRecommendation": "CAB_REQUIRED",
      "rulesTriggered": [
        {
          "policyId": "...",
          "policyName": "High Risk Change Policy",
          "conditionsSummary": "customerRiskScore >= 60"
        }
      ],
      "reasons": [
        "Customer risk score 75 exceeds threshold 60",
        "Change impacts service with CRITICAL risk binding"
      ],
      "requiredActions": [
        "CAB_APPROVAL",
        "IMPLEMENTATION_PLAN_REQUIRED"
      ]
    }
  }
}
```

### Mitigation Action

```json
{
  "data": {
    "id": "...",
    "changeId": "...",
    "actionType": "RISK_OBSERVATION",
    "status": "OPEN",
    "title": "Review EOS risk before deployment",
    "description": "...",
    "ownerId": null,
    "dueDate": null,
    "comment": null,
    "createdBy": "...",
    "tenantId": "..."
  }
}
```

---

## Event Bus Events

| Event Name | Trigger |
|------------|---------|
| `itsm.change.customer_risk.recalculated` | POST recalculate-customer-risk |
| `itsm.change.customer_risk.policy_triggered` | Policy decision is not ALLOW |
| `itsm.change.customer_risk.mitigation_created` | New mitigation action created |
| `itsm.change.customer_risk.mitigation_updated` | Mitigation action status changed |

Events are stored in the `sys_events` table and emitted via `EventEmitter2`.

---

## Smoke Tests

### Running Customer Risk Smoke Tests

```bash
# Local
E2E_MODE=REAL_STACK npx playwright test --project=smoke-customer-risk

# Against staging
BASE_URL=http://46.224.99.150:3002 \
E2E_EMAIL=admin@grc-platform.local \
E2E_PASSWORD=changeme \
E2E_TENANT_ID=00000000-0000-0000-0000-000000000001 \
npx playwright test --project=smoke-customer-risk
```

### What the Smoke Tests Cover

| Suite | Checks |
|-------|--------|
| Changes list | GET `/grc/itsm/changes` returns 200 with items array |
| Change Policies | GET `/grc/itsm/change-policies` returns 200 with items array |
| Customer Risk Impact | GET `customer-risk-impact` returns valid shape (aggregateScore, aggregateLabel, resolvedRisks) |
| Recalculate | POST `recalculate-customer-risk` returns assessment + policyEvaluation |
| Risk Assessment | GET `risk` includes policyEvaluation with decisionRecommendation |
| Mitigation Actions | List returns paginated items; create+delete round-trip |
| Permission boundary | Unauthenticated = 401; invalid changeId = 404 (not 500) |

---

## Troubleshooting

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Customer risk impact returns empty `resolvedRisks` | No customer risk bindings for the change's service/offering/CIs | Add customer risk bindings via GRC module or seed data |
| Policy evaluation returns `ALLOW` for risky changes | No change policies configured with customer risk conditions | Create a change policy with `customerRiskScoreMin` or `customerRiskLabelMin` condition |
| Mitigation action returns 404 | Migration not applied | Run `npx typeorm migration:run -d dist/data-source.js` |
| Governance banner not showing | Policy evaluation returns `ALLOW` | Configure a change policy with conditions that match the change |
| 403 on customer-risk-impact | User missing `GRC_CUSTOMER_RISK_READ` or `GRC_CUSTOMER_RISK_BIND_READ` permission | Ensure user role has required permissions |
| Event bus events not in sys_events | EventBusService not registered in module | Verify `EventBusModule` is imported in `ItsmModule` |

---

## Architecture

```
Change Detail Page
  |
  +-- CustomerRiskIntelligence panel
  |     |-- GET customer-risk-impact
  |     |-- POST recalculate-customer-risk
  |     |-- CreateMitigationModal
  |           |-- POST mitigation-actions
  |
  +-- GovernanceBanner
        |-- policyEvaluation from risk assessment
        |-- decisionRecommendation (ALLOW/REVIEW/CAB_REQUIRED/BLOCK)
```

### Data Flow

1. Change Detail loads → fetches `customer-risk-impact`
2. `CustomerRiskImpactService` resolves risks via service/offering/CI/blast_radius bindings
3. `PolicyService` evaluates change policies against risk scores
4. UI renders summary, resolved risks table, and governance banner
5. User can create mitigation actions → stored in `itsm_change_mitigation_actions`
6. All mutations emit event bus events for audit trail
