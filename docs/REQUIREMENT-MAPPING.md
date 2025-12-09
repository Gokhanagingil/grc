# Requirement Mapping Engine

The Requirement Mapping Engine enables linking compliance requirements to policies, risks, findings, and audits. This creates a comprehensive traceability matrix that supports compliance tracking, gap analysis, and audit preparation.

## Overview

The mapping engine provides bidirectional relationships between requirements and other GRC objects, allowing organizations to:
- Track which policies address specific requirements
- Identify risks associated with compliance requirements
- Link audit findings to violated requirements
- Map audit criteria to requirements for assessment

## Database Schema

### policy_requirements

Links policies to requirements with optional justification.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| policy_id | uuid | Foreign key to policies |
| requirement_id | uuid | Foreign key to compliance_requirements |
| justification | text | Optional explanation of the mapping |
| created_at | timestamp | Creation timestamp |

Unique constraint on (policy_id, requirement_id) prevents duplicates.

### risk_requirements

Links risks to requirements.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| risk_id | uuid | Foreign key to risks |
| requirement_id | uuid | Foreign key to compliance_requirements |
| created_at | timestamp | Creation timestamp |

Unique constraint on (risk_id, requirement_id) prevents duplicates.

### finding_requirements

Links findings to requirements with evidence strength.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| finding_id | uuid | Foreign key to findings |
| requirement_id | uuid | Foreign key to compliance_requirements |
| evidence_strength | enum | Strength of evidence (strong, medium, weak) |
| created_at | timestamp | Creation timestamp |

Unique constraint on (finding_id, requirement_id) prevents duplicates.

### audit_criteria

Links audits to requirements for assessment criteria.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| audit_id | uuid | Foreign key to audits |
| requirement_id | uuid | Foreign key to compliance_requirements |
| created_at | timestamp | Creation timestamp |

Unique constraint on (audit_id, requirement_id) prevents duplicates.

## API Endpoints

### Policy Mappings

#### Create Policy-Requirement Mapping
```
POST /api/grc/requirements/map/policy
Content-Type: application/json

{
  "requirementId": "uuid-of-requirement",
  "targetId": "uuid-of-policy",
  "justification": "This policy addresses the control requirements"
}
```

#### Get Policies for Requirement
```
GET /api/grc/requirements/:id/policies
```

#### Remove Policy Mapping
```
DELETE /api/grc/requirements/map/policy/:policyId/:requirementId
```

### Risk Mappings

#### Create Risk-Requirement Mapping
```
POST /api/grc/requirements/map/risk
Content-Type: application/json

{
  "requirementId": "uuid-of-requirement",
  "targetId": "uuid-of-risk"
}
```

#### Get Risks for Requirement
```
GET /api/grc/requirements/:id/risks
```

#### Remove Risk Mapping
```
DELETE /api/grc/requirements/map/risk/:riskId/:requirementId
```

### Finding Mappings

#### Create Finding-Requirement Mapping
```
POST /api/grc/requirements/map/finding
Content-Type: application/json

{
  "requirementId": "uuid-of-requirement",
  "targetId": "uuid-of-finding",
  "evidenceStrength": "strong"
}
```

Evidence strength values: `strong`, `medium`, `weak`

#### Get Findings for Requirement
```
GET /api/grc/requirements/:id/findings
```

#### Remove Finding Mapping
```
DELETE /api/grc/requirements/map/finding/:findingId/:requirementId
```

### Audit Mappings

#### Create Audit-Requirement Mapping
```
POST /api/grc/requirements/map/audit
Content-Type: application/json

{
  "requirementId": "uuid-of-requirement",
  "targetId": "uuid-of-audit"
}
```

#### Get Audits for Requirement
```
GET /api/grc/requirements/:id/audits
```

#### Remove Audit Mapping
```
DELETE /api/grc/requirements/map/audit/:auditId/:requirementId
```

### Get All Mappings for Requirement

```
GET /api/grc/requirements/:id
```

Returns the requirement with all associated mappings:
- policies
- risks
- findings
- audits
- metadata

## Access Control

The mapping engine enforces role-based access control:

| Mapping Type | Create/Delete Role |
|--------------|-------------------|
| Policy mappings | Admin, Manager, Compliance Manager |
| Risk mappings | Admin, Manager, Risk Manager |
| Finding mappings | Admin, Manager, Auditor |
| Audit mappings | Admin, Manager, Auditor |

## Service Layer

The `RequirementMappingService` (`/backend/services/RequirementMappingService.js`) provides business logic:

```javascript
const RequirementMappingService = require('./services/RequirementMappingService');

// Map a policy to a requirement
await RequirementMappingService.mapPolicyRequirement(
  policyId,
  requirementId,
  'Justification text'
);

// Get all policies for a requirement
const policies = await RequirementMappingService.getRequirementPolicies(requirementId);

// Map a finding with evidence strength
await RequirementMappingService.mapFindingRequirement(
  findingId,
  requirementId,
  'strong'
);

// Get complete requirement with all mappings
const requirement = await RequirementMappingService.getRequirementWithMappings(requirementId);
```

## Frontend Integration

### Requirement Detail Page

The requirement detail page (`/standards/:id`) displays all mappings in tabbed panels:
- Policies tab with justifications
- Risks tab with severity indicators
- Findings tab with evidence strength
- Audits tab with status

### Creating Mappings

Users can create mappings through modal dialogs:
1. Click "Map Policy/Risk/Finding/Audit" button
2. Enter the target object ID
3. Optionally add justification (policies) or evidence strength (findings)
4. Submit to create the mapping

### API Client

```typescript
import { standardsApi } from '../services/grcClient';

// Map a policy
await standardsApi.mapPolicy(requirementId, policyId, 'Justification');

// Map a risk
await standardsApi.mapRisk(requirementId, riskId);

// Map a finding with evidence strength
await standardsApi.mapFinding(requirementId, findingId, 'strong');

// Map an audit
await standardsApi.mapAudit(requirementId, auditId);

// Get mappings
const policies = await standardsApi.getPolicies(requirementId);
const risks = await standardsApi.getRisks(requirementId);
const findings = await standardsApi.getFindings(requirementId);
const audits = await standardsApi.getAudits(requirementId);
```

## Metrics and Reporting

The mapping engine supports metrics endpoints for dashboard visualization:

### Requirements Coverage
```
GET /api/grc/metrics/requirements/coverage
```

Returns per-family statistics:
- Total requirements
- Mapped in audits
- Mapped in findings
- Mapped in policies
- Mapped in risks
- Coverage scores

### Findings by Standard
```
GET /api/grc/metrics/findings/by-standard
```

Returns heatmap data:
- Family and code
- Severity counts (critical, high, medium, low, info)
- Total findings per requirement

### Requirements by Tags
```
GET /api/grc/metrics/requirements/tags
```

Returns tag statistics:
- Tag name and color
- Count of tagged requirements
- Grouped by tag type

## Idempotency

All mapping operations are idempotent:
- Creating a duplicate mapping returns the existing mapping
- Deleting a non-existent mapping returns success
- No duplicate entries are created in the database

## Best Practices

1. **Complete Mappings** - Map all relevant objects to requirements for comprehensive coverage
2. **Document Justifications** - Add justifications to policy mappings explaining the relationship
3. **Evidence Strength** - Accurately assess evidence strength for finding mappings
4. **Regular Review** - Periodically review mappings for accuracy and completeness
5. **Audit Preparation** - Ensure audit criteria are mapped before assessments
6. **Gap Analysis** - Use coverage metrics to identify unmapped requirements

## Integration Points

The Requirement Mapping Engine integrates with:
- **Standards Library** - Source of requirements to map
- **Policy Management** - Target for policy mappings
- **Risk Management** - Target for risk mappings
- **Audit Management** - Target for audit and finding mappings
- **Metrics Dashboard** - Coverage and compliance statistics
- **Reporting Engine** - Traceability matrix reports
