# GRC Dashboard API Documentation

This document describes the Phase 8 Dashboard API endpoints for the GRC Platform. These endpoints provide aggregated data for executive-grade dashboards covering Audit, Compliance, and GRC Health metrics.

## Base URL

All dashboard endpoints are available under:
```
/api/grc/dashboard/*
```

## Authentication

All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Role-Based Access Control

Each dashboard endpoint has specific role requirements:

| Endpoint | Allowed Roles |
|----------|---------------|
| `/audit-overview` | auditor, audit_manager, governance, admin |
| `/compliance-overview` | governance, compliance, audit_manager, admin |
| `/grc-health` | governance, executive, director, admin |
| `/filters` | All authenticated users |

## Endpoints

### GET /api/grc/dashboard/audit-overview

Returns aggregated audit metrics including pipeline status, findings by department, CAPA performance, top risk areas, and audit calendar data.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | string (ISO date) | Start date for filtering (optional) |
| `to` | string (ISO date) | End date for filtering (optional) |
| `department` | string | Filter by department name (optional) |

#### Response

```json
{
  "auditPipeline": {
    "draft": 5,
    "planned": 12,
    "fieldwork": 8,
    "reporting": 4,
    "final": 2,
    "closed": 25
  },
  "findingsByDepartment": [
    {
      "department": "IT",
      "critical": 2,
      "high": 4,
      "medium": 7,
      "low": 3
    }
  ],
  "capaPerformance": {
    "total": 45,
    "open": 12,
    "overdue": 3,
    "avgClosureDays": 28.5,
    "validatedRate": 0.85
  },
  "topRiskAreas": [
    {
      "riskId": "risk-001",
      "riskTitle": "Data Security Risk",
      "relatedFindings": 8,
      "maxSeverity": "high"
    }
  ],
  "auditCalendar": [
    {
      "month": "2024-01",
      "planned": 3,
      "fieldwork": 2,
      "reporting": 1,
      "closed": 4
    }
  ]
}
```

### GET /api/grc/dashboard/compliance-overview

Returns compliance metrics including standards coverage, clause heatmap, requirement status breakdown, and domain analysis.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `family` | string | Filter by standard family (e.g., iso27001, nist, cobit) |
| `version` | string | Filter by standard version |

#### Response

```json
{
  "standardsCoverage": [
    {
      "family": "iso27001",
      "totalRequirements": 93,
      "audited": 45,
      "withFindings": 12,
      "complianceScore": 0.73
    }
  ],
  "clauseHeatmap": [
    {
      "family": "iso27001",
      "code": "A.5",
      "critical": 1,
      "high": 3,
      "medium": 4,
      "low": 2
    }
  ],
  "requirementStatus": {
    "compliant": 65,
    "partiallyCompliant": 15,
    "nonCompliant": 8,
    "notAssessed": 12
  },
  "domainBreakdown": [
    {
      "domain": "security",
      "requirements": 120,
      "findings": 18,
      "capas": 10
    }
  ]
}
```

#### Compliance Status Logic

- **Compliant**: Requirement has no mapped findings, OR all mapped findings are closed
- **Partially Compliant**: Finding exists but CAPA is validated
- **Non-Compliant**: One or more open findings exist
- **Not Assessed**: Requirement has not been audited

### GET /api/grc/dashboard/grc-health

Returns organization-level GRC health metrics including department scores, repeated findings, policy compliance, and risk clusters.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | string (ISO date) | Start date for filtering (optional) |
| `to` | string (ISO date) | End date for filtering (optional) |

#### Response

```json
{
  "departmentScores": [
    {
      "department": "IT",
      "score": 0.78,
      "auditScore": 0.7,
      "riskScore": 0.8,
      "policyScore": 0.9,
      "capaScore": 0.6
    }
  ],
  "repeatedFindings": [
    {
      "theme": "Change Management Weakness",
      "count": 8
    }
  ],
  "policyCompliance": [
    {
      "policyId": "policy-001",
      "policyTitle": "Information Security Policy",
      "acknowledgedRate": 0.82
    }
  ],
  "riskClusters": [
    {
      "cluster": "Operational Risk",
      "openFindings": 12,
      "highRisks": 4
    }
  ]
}
```

#### Department Scoring Model

The department score is calculated as the average of four component scores:
```
score = average(auditScore, riskScore, capaScore, policyScore)
```

All scores are normalized to a 0-1 scale based on severity and counts.

### GET /api/grc/dashboard/filters

Returns available filter options for dashboard dropdowns.

#### Response

```json
{
  "departments": ["IT", "Finance", "HR", "Operations"],
  "families": ["iso27001", "nist", "cobit", "kvkk"],
  "versions": ["2022", "2023", "2024"]
}
```

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions to access this dashboard"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal Server Error",
  "message": "Failed to fetch dashboard data"
}
```

## Performance Considerations

- All endpoints use optimized SQL queries with appropriate indexes
- Date range filtering is recommended for large datasets
- Results are cached where appropriate to improve response times
- Tenant isolation is enforced at the database query level

## Integration Examples

### JavaScript/TypeScript

```typescript
import { grcDashboardApi } from './services/grcClient';

// Fetch audit overview with filters
const auditData = await grcDashboardApi.getAuditOverview({
  from: '2024-01-01',
  to: '2024-12-31',
  department: 'IT'
});

// Fetch compliance overview
const complianceData = await grcDashboardApi.getComplianceOverview({
  family: 'iso27001'
});

// Fetch GRC health
const healthData = await grcDashboardApi.getGrcHealth();

// Fetch filter options
const filters = await grcDashboardApi.getFilters();
```

### cURL

```bash
# Audit Overview
curl -X GET "http://localhost:3001/api/grc/dashboard/audit-overview?from=2024-01-01&to=2024-12-31" \
  -H "Authorization: Bearer <token>"

# Compliance Overview
curl -X GET "http://localhost:3001/api/grc/dashboard/compliance-overview?family=iso27001" \
  -H "Authorization: Bearer <token>"

# GRC Health
curl -X GET "http://localhost:3001/api/grc/dashboard/grc-health" \
  -H "Authorization: Bearer <token>"
```
