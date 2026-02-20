# Risk Management Module - MVP+ Documentation

## Overview

The Risk Management module provides enterprise-grade risk identification, assessment, and treatment capabilities for the GRC platform. It supports multi-tenant isolation, inherent and residual risk scoring, control linkage, and visual analytics through a risk heatmap.

## Data Model

### Core Entities

#### GrcRisk (Risk Register Item)
The primary entity representing an identified risk in the organization's risk register.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | Tenant identifier (FK to nest_tenants) |
| code | VARCHAR(50) | Optional unique risk code per tenant |
| title | VARCHAR(255) | Risk title (required) |
| description | TEXT | Detailed risk description |
| riskCategoryId | UUID | FK to GrcRiskCategory |
| riskType | ENUM | strategic, operational, compliance, financial, technology, cyber, third_party, other |
| status | ENUM | draft, identified, assessed, treatment_planned, treating, monitored, closed |
| ownerUserId | UUID | FK to users table |
| ownerDisplayName | VARCHAR(255) | Fallback display name for owner |
| inherentLikelihood | INT (1-5) | Likelihood before controls |
| inherentImpact | INT (1-5) | Impact before controls |
| inherentScore | INT | Computed: inherentLikelihood × inherentImpact |
| inherentBand | ENUM | LOW, MEDIUM, HIGH, CRITICAL |
| residualLikelihood | INT (1-5) | Likelihood after controls |
| residualImpact | INT (1-5) | Impact after controls |
| residualScore | INT | Computed: residualLikelihood × residualImpact |
| residualBand | ENUM | LOW, MEDIUM, HIGH, CRITICAL |
| riskAppetite | ENUM | LOW, MEDIUM, HIGH |
| treatmentStrategy | ENUM | AVOID, MITIGATE, TRANSFER, ACCEPT |
| treatmentPlan | TEXT | Description of treatment approach |
| targetDate | DATE | Target date for treatment completion |
| lastReviewedAt | TIMESTAMP | Last review timestamp |
| tags | JSONB | Array of string tags |
| metadata | JSONB | Additional custom metadata |

#### GrcRiskCategory
Taxonomy for organizing risks by category.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | Tenant identifier |
| name | VARCHAR(100) | Category name (unique per tenant) |
| description | TEXT | Category description |

#### GrcRiskAssessment
Historical record of risk assessments for auditability.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | Tenant identifier |
| riskId | UUID | FK to GrcRisk |
| assessmentType | ENUM | INHERENT, RESIDUAL |
| likelihood | INT (1-5) | Assessed likelihood |
| impact | INT (1-5) | Assessed impact |
| score | INT | Computed score |
| band | ENUM | Computed band |
| rationale | TEXT | Assessment rationale |
| assessedAt | TIMESTAMP | Assessment timestamp |
| assessedByUserId | UUID | FK to users |

#### GrcRiskControl (M2M Link)
Links risks to controls with effectiveness tracking.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | Tenant identifier |
| riskId | UUID | FK to GrcRisk |
| controlId | UUID | FK to GrcControl |
| effectivenessRating | ENUM | UNKNOWN, EFFECTIVE, PARTIALLY_EFFECTIVE, INEFFECTIVE |
| notes | TEXT | Notes about the linkage |

#### GrcRiskTreatmentAction
Represents an action/task within a risk treatment plan.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | Tenant identifier (FK to nest_tenants) |
| riskId | UUID | FK to GrcRisk (CASCADE delete) |
| title | VARCHAR(255) | Action title (required) |
| description | TEXT | Detailed description |
| status | ENUM | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED |
| ownerUserId | UUID | FK to users table (nullable) |
| ownerDisplayName | VARCHAR(255) | Fallback display name for owner |
| dueDate | DATE | Target completion date |
| completedAt | TIMESTAMP | Actual completion timestamp |
| progressPct | INT (0-100) | Progress percentage |
| evidenceLink | VARCHAR(1024) | Link to evidence (metadata only) |
| sortOrder | INT | Ordering field for display |
| notes | TEXT | Additional notes |
| metadata | JSONB | Additional custom metadata |

## Scoring & Banding Rules

### Risk Score Calculation
```
score = likelihood × impact
```

Where likelihood and impact are integers from 1 to 5:
- 1 = Very Low / Rare / Negligible
- 2 = Low / Unlikely / Minor
- 3 = Medium / Possible / Moderate
- 4 = High / Likely / Major
- 5 = Very High / Almost Certain / Catastrophic

### Risk Band Mapping
| Score Range | Band | Color |
|-------------|------|-------|
| 1-4 | LOW | Green (#388e3c) |
| 5-9 | MEDIUM | Yellow (#fbc02d) |
| 10-15 | HIGH | Orange (#f57c00) |
| 16-25 | CRITICAL | Red (#d32f2f) |

## API Endpoints

All endpoints require:
- JWT authentication via `Authorization: Bearer <token>` header
- Tenant context via `x-tenant-id: <uuid>` header

### Risk CRUD Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/grc/risks | List risks with pagination, filtering, sorting |
| POST | /api/grc/risks | Create a new risk |
| GET | /api/grc/risks/:id | Get risk by ID |
| PATCH | /api/grc/risks/:id | Update risk |
| DELETE | /api/grc/risks/:id | Soft delete risk |

### Risk Detail & Relationships

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/grc/risks/:id/detail | Get risk with assessments and linked controls |
| GET | /api/grc/risks/:id/controls | Get linked controls |
| POST | /api/grc/risks/:riskId/controls/:controlId/link | Link control with effectiveness |
| PATCH | /api/grc/risks/:riskId/controls/:controlId/effectiveness | Update control effectiveness |
| DELETE | /api/grc/risks/:riskId/controls/:controlId | Unlink control |

### Risk Assessments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/grc/risks/:id/assessments | Create assessment (updates risk scores) |
| GET | /api/grc/risks/:id/assessments | Get assessment history |

### Treatment Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/grc/risks/:riskId/treatment/actions | List treatment actions for a risk |
| POST | /api/grc/risks/:riskId/treatment/actions | Create a treatment action |
| GET | /api/grc/risks/:riskId/treatment/actions/:actionId | Get a specific treatment action |
| PATCH | /api/grc/risks/:riskId/treatment/actions/:actionId | Update a treatment action |
| DELETE | /api/grc/risks/:riskId/treatment/actions/:actionId | Delete a treatment action |
| GET | /api/grc/risks/:riskId/treatment/summary | Get treatment plan summary (counts by status) |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/grc/risks/heatmap | Get 5×5 heatmap aggregation |

### Example Requests

#### Create Risk
```bash
curl -X POST http://localhost:3002/grc/risks \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Data Breach Risk",
    "description": "Risk of unauthorized access to customer data",
    "riskType": "CYBER",
    "inherentLikelihood": 3,
    "inherentImpact": 5,
    "treatmentStrategy": "MITIGATE"
  }'
```

#### Create Assessment
```bash
curl -X POST http://localhost:3002/grc/risks/<risk-id>/assessments \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "assessmentType": "RESIDUAL",
    "likelihood": 2,
    "impact": 4,
    "rationale": "Controls have reduced likelihood"
  }'
```

#### Get Heatmap
```bash
curl http://localhost:3002/grc/risks/heatmap \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

#### Create Treatment Action
```bash
curl -X POST http://localhost:3002/grc/risks/<risk-id>/treatment/actions \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement encryption at rest",
    "description": "Enable AES-256 encryption for all customer data",
    "status": "PLANNED",
    "ownerDisplayName": "Security Team",
    "dueDate": "2026-03-15",
    "progressPct": 0
  }'
```

#### Update Treatment Action Status
```bash
curl -X PATCH http://localhost:3002/grc/risks/<risk-id>/treatment/actions/<action-id> \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED",
    "progressPct": 100
  }'
```

## UI Flows

### Risk List Page (/risks)
- Table displaying all risks with columns: Code, Title, Status, Category, Inherent Score/Band, Residual Score/Band, Owner, Target Date
- Search bar for text search across title and description
- Filters for status, severity, category, risk type
- Pagination with configurable page size
- Click row to navigate to detail page
- "New Risk" button to create new risk

### Risk Detail Page (/risks/:id)
Tabbed interface with:

1. **Overview Tab**
   - Risk details (title, description, category, type)
   - Owner information
   - Status and dates
   - Current inherent and residual scores with band indicators

2. **Relations Tab**
   - Linked policies list
   - Linked controls list with effectiveness ratings
   - Link/unlink controls

3. **Treatment Plan Tab**
   - Progress summary card showing completed/total actions
   - Treatment actions table with columns: Title, Owner, Due Date, Progress, Status, Actions
   - Quick status update buttons (Start, Complete)
   - Add/Edit/Delete treatment actions
   - Each action tracks: title, description, status (PLANNED/IN_PROGRESS/COMPLETED/CANCELLED), owner, due date, progress percentage, evidence link, notes

4. **Timeline Tab**
   - Created timestamp
   - Last updated timestamp
   - Next review date

### Risk Heatmap Widget
- 5×5 grid visualization
- X-axis: Impact (1-5)
- Y-axis: Likelihood (1-5)
- Cell color indicates band (Low/Medium/High/Critical)
- Cell shows count of risks in that position
- Click cell to filter risk list by that likelihood/impact combination
- Toggle between inherent and residual views

## Default Risk Categories

The following categories are seeded by default:
- Strategic
- Operational
- Financial
- Compliance
- Technology
- Cyber Security
- Third Party
- Reputational
- Environmental
- Human Resources

## Permissions

| Permission | Description |
|------------|-------------|
| GRC_RISK_READ | View risks and assessments |
| GRC_RISK_WRITE | Create, update, delete risks |
| GRC_RISK_ASSESS | Create assessments |

## Future Enhancements

Potential future improvements for the Risk Management module:

1. **Key Risk Indicators (KRIs)**: Automated monitoring of risk metrics with threshold alerts
2. **Risk Appetite Thresholds**: Configurable appetite levels with automatic flagging
3. **Approval Workflows**: Multi-level approval for risk acceptance and treatment plans
4. **Evidence Attachment**: Link evidence documents to risks and assessments
5. **Third-Party Risk Management**: Extended vendor/supplier risk tracking
6. **Risk Scenarios**: Monte Carlo simulation for quantitative risk analysis
7. **Bow-Tie Analysis**: Visual cause-consequence diagrams
8. **Risk Aggregation**: Roll-up views for enterprise risk reporting
9. **Automated Risk Scoring**: ML-based risk scoring suggestions
10. **Integration with External Threat Feeds**: Automatic risk updates from threat intelligence
