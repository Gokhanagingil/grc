# GRC Relationship Engine

This document describes the Relationship Engine for the GRC domain, enabling many-to-many links between Risks, Policies, and Requirements.

## Overview

The GRC Relationship Engine provides enterprise-level capabilities for linking GRC entities together, enabling coverage metrics, audit readiness, and comprehensive risk management.

### Supported Relationships

The engine supports the following many-to-many relationships:

- **Risk to Policy**: Link risks to the policies that mitigate them
- **Risk to Requirement**: Link risks to compliance requirements they affect
- **Policy to Risk** (reverse): View which risks a policy addresses
- **Requirement to Risk** (reverse): View which risks affect a requirement

## Data Model

### Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│     GrcRisk     │       │    GrcRiskPolicy     │       │    GrcPolicy    │
├─────────────────┤       ├──────────────────────┤       ├─────────────────┤
│ id (PK)         │───────│ riskId (PK, FK)      │───────│ id (PK)         │
│ title           │       │ policyId (PK, FK)    │       │ title           │
│ description     │       │ createdAt            │       │ description     │
│ severity        │       │ createdBy            │       │ status          │
│ status          │       └──────────────────────┘       │ category        │
│ tenantId        │                                      │ tenantId        │
└─────────────────┘                                      └─────────────────┘
        │
        │              ┌──────────────────────┐       ┌─────────────────────┐
        │              │  GrcRiskRequirement  │       │   GrcRequirement    │
        │              ├──────────────────────┤       ├─────────────────────┤
        └──────────────│ riskId (PK, FK)      │───────│ id (PK)             │
                       │ requirementId (PK,FK)│       │ title               │
                       │ createdAt            │       │ description         │
                       │ createdBy            │       │ status              │
                       └──────────────────────┘       │ framework           │
                                                      │ tenantId            │
                                                      └─────────────────────┘
```

### Linking Tables

#### GrcRiskPolicy

Links risks to policies with a composite primary key.

| Column | Type | Description |
|--------|------|-------------|
| riskId | UUID | Foreign key to GrcRisk |
| policyId | UUID | Foreign key to GrcPolicy |
| createdAt | TIMESTAMP | When the link was created |
| createdBy | UUID | User who created the link |

#### GrcRiskRequirement

Links risks to requirements with a composite primary key.

| Column | Type | Description |
|--------|------|-------------|
| riskId | UUID | Foreign key to GrcRisk |
| requirementId | UUID | Foreign key to GrcRequirement |
| createdAt | TIMESTAMP | When the link was created |
| createdBy | UUID | User who created the link |

### Indexes

The following indexes are created for performance:

- `IDX_risk_policy_risk_id` on `risk_policies(riskId)`
- `IDX_risk_policy_policy_id` on `risk_policies(policyId)`
- `IDX_risk_requirement_risk_id` on `risk_requirements(riskId)`
- `IDX_risk_requirement_requirement_id` on `risk_requirements(requirementId)`

## API Contract

### Risk-Policy Relationship Endpoints

#### Link Policies to Risk

```http
POST /grc/risks/:id/policies
Content-Type: application/json
Authorization: Bearer <token>
x-tenant-id: <tenant-id>

{
  "policyIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Response (201 Created):**
```json
{
  "message": "Policies linked successfully",
  "linkedCount": 3
}
```

**Authorization:** Requires MANAGER or ADMIN role.

#### Get Linked Policies for Risk

```http
GET /grc/risks/:id/policies
Authorization: Bearer <token>
x-tenant-id: <tenant-id>
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid-1",
    "title": "Data Protection Policy",
    "status": "active",
    "category": "Security"
  },
  {
    "id": "uuid-2",
    "title": "Access Control Policy",
    "status": "active",
    "category": "Security"
  }
]
```

#### Get Linked Risks for Policy

```http
GET /grc/policies/:id/risks
Authorization: Bearer <token>
x-tenant-id: <tenant-id>
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid-1",
    "title": "Data Breach Risk",
    "severity": "critical",
    "status": "open"
  }
]
```

### Risk-Requirement Relationship Endpoints

#### Link Requirements to Risk

```http
POST /grc/risks/:id/requirements
Content-Type: application/json
Authorization: Bearer <token>
x-tenant-id: <tenant-id>

{
  "requirementIds": ["uuid-1", "uuid-2"]
}
```

**Response (201 Created):**
```json
{
  "message": "Requirements linked successfully",
  "linkedCount": 2
}
```

**Authorization:** Requires MANAGER or ADMIN role.

#### Get Linked Requirements for Risk

```http
GET /grc/risks/:id/requirements
Authorization: Bearer <token>
x-tenant-id: <tenant-id>
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid-1",
    "title": "GDPR Article 32 - Security",
    "status": "compliant",
    "framework": "GDPR"
  }
]
```

#### Get Linked Risks for Requirement

```http
GET /grc/requirements/:id/risks
Authorization: Bearer <token>
x-tenant-id: <tenant-id>
```

**Response (200 OK):**
```json
[
  {
    "id": "uuid-1",
    "title": "Data Breach Risk",
    "severity": "critical",
    "status": "open"
  }
]
```

## UI Flow for Relationship Management

### Risk Detail Page

The Risk Detail page includes a "Linked Relationships" section with:

1. **Linked Policies** multi-select dropdown
   - Fetches all available policies from `/grc/policies`
   - Displays currently linked policies as chips
   - Allows selecting/deselecting policies

2. **Linked Requirements** multi-select dropdown
   - Fetches all available requirements from `/grc/requirements`
   - Displays currently linked requirements as chips
   - Allows selecting/deselecting requirements

3. **Save Relationships** button
   - Calls POST endpoints to update links
   - Shows success/error feedback

### Policy Detail Page

The Policy Detail page includes an "Associated Risks" section:

- Read-only list of risks linked to this policy
- Displayed as chips with severity color coding
- Click to navigate to risk detail (future enhancement)

### Requirement Detail Page

The Requirement Detail page includes an "Associated Risks" section:

- Read-only list of risks linked to this requirement
- Displayed as chips with severity color coding
- Click to navigate to risk detail (future enhancement)

## Impact on Dashboard KPIs

### Risk Summary Enhancements

The risk summary endpoint now includes relationship counts:

```json
{
  "totalCount": 25,
  "byStatus": { "open": 10, "mitigated": 8, "closed": 7 },
  "bySeverity": { "critical": 5, "high": 10, "medium": 7, "low": 3 },
  "linkedPoliciesCount": 45,
  "linkedRequirementsCount": 32,
  "top5OpenRisks": [...]
}
```

### Policy Summary Enhancements

The policy summary endpoint now includes:

```json
{
  "totalCount": 15,
  "activeCount": 12,
  "linkedRisksCount": 28,
  "policyCoveragePercentage": 80.0
}
```

### Requirement Summary Enhancements

The requirement summary endpoint now includes:

```json
{
  "totalCount": 50,
  "compliantCount": 35,
  "linkedRisksCount": 42,
  "requirementCoveragePercentage": 70.0
}
```

## Validation Rules

### Tenant Isolation

All relationship operations enforce tenant isolation:

- Risks, policies, and requirements must belong to the same tenant
- Cross-tenant linking is not allowed
- Queries filter by tenant ID from request header

### Entity Existence

Before creating links:

- Risk must exist and not be soft-deleted
- Policy/Requirement must exist and not be soft-deleted
- Invalid IDs return 404 Not Found

### RBAC Permissions

- **Read operations** (GET): Available to all authenticated users
- **Write operations** (POST): Require MANAGER or ADMIN role

## Future Extensions

### GRC Scoring

The relationship engine provides the foundation for:

- Risk scoring based on linked policy coverage
- Compliance scoring based on requirement fulfillment
- Aggregate risk scores for dashboard widgets

### Audit Module Integration

Future audit capabilities will leverage relationships:

- Audit trails for relationship changes
- Evidence linking to requirements
- Compliance audit reports

### Advanced Analytics

Planned analytics features:

- Risk-policy coverage heatmaps
- Compliance gap analysis
- Trend analysis over time

## Testing

### Smoke Tests

Run the smoke tests to verify relationship endpoints:

```bash
cd backend-nest
npm run smoke:grc
```

The smoke tests verify:

- GET /grc/risks/:id/policies
- GET /grc/risks/:id/requirements
- POST /grc/risks/:id/policies
- POST /grc/risks/:id/requirements
- GET /grc/policies/:id/risks
- GET /grc/requirements/:id/risks

### Manual Testing

1. Start the backend: `npm run start:dev`
2. Start the frontend: `cd ../frontend && npm start`
3. Log in as admin user
4. Navigate to Risk Management
5. Click View on a risk
6. Use the multi-select dropdowns to link policies/requirements
7. Click Save Relationships
8. Navigate to Governance/Compliance to verify reverse associations

## Migration Notes

The relationship engine uses TypeORM's synchronize feature for development. For production deployments, create explicit migrations:

```bash
npm run migration:generate -- -n AddRelationshipTables
npm run migration:run
```

## Troubleshooting

### Common Issues

**Issue:** Relationships not saving
- Verify user has MANAGER or ADMIN role
- Check tenant ID header is set correctly
- Verify entity IDs exist and are not soft-deleted

**Issue:** Associated risks not showing
- Ensure relationships were saved successfully
- Check browser console for API errors
- Verify tenant isolation is correct

**Issue:** Performance issues with large datasets
- Indexes are created automatically
- Consider pagination for large relationship lists
- Monitor query performance in production
