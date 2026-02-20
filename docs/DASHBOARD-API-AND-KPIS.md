# Dashboard API and KPIs

This document describes the Dashboard API endpoints implemented in the NestJS backend, their response formats, and how to extend them with new KPIs.

## Overview

The Dashboard API provides aggregated KPIs and visualizations for the GRC Platform's Dashboard page. It composes data from existing GRC and ITSM services to provide a unified view of organizational risk, compliance, and incident status.

## Endpoints

### GET /dashboard/overview

Returns an aggregated summary of all KPIs for the main Dashboard view.

**Headers:**
- `Authorization: Bearer <token>` (required)
- `x-tenant-id: <tenant-uuid>` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "risks": {
      "total": 25,
      "open": 12,
      "high": 5,
      "overdue": 3,
      "top5OpenRisks": [
        {
          "id": "uuid",
          "title": "Risk Title",
          "severity": "high",
          "status": "identified"
        }
      ]
    },
    "compliance": {
      "total": 50,
      "pending": 20,
      "completed": 25,
      "overdue": 5,
      "coveragePercentage": 50
    },
    "policies": {
      "total": 15,
      "active": 10,
      "draft": 5,
      "coveragePercentage": 66.67
    },
    "incidents": {
      "total": 100,
      "open": 15,
      "closed": 70,
      "resolved": 15,
      "resolvedToday": 3,
      "avgResolutionTimeHours": 24.5
    },
    "users": {
      "total": 0,
      "admins": 0,
      "managers": 0
    }
  }
}
```

**Data Sources:**
- `risks`: Aggregated from `/grc/risks/summary` via `GrcRiskService.getSummary()`
- `compliance`: Aggregated from `/grc/requirements/summary` via `GrcRequirementService.getSummary()`
- `policies`: Aggregated from `/grc/policies/summary` via `GrcPolicyService.getSummary()`
- `incidents`: Aggregated from `/itsm/incidents/summary` via `IncidentService.getSummary()`
- `users`: Placeholder (returns zeros, can be extended with UserService)

### GET /dashboard/risk-trends

Returns risk breakdown by severity level for trend visualization.

**Headers:**
- `Authorization: Bearer <token>` (required)
- `x-tenant-id: <tenant-uuid>` (required)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-12-08",
      "total_risks": 25,
      "critical": 2,
      "high": 5,
      "medium": 10,
      "low": 8
    }
  ]
}
```

**Data Sources:**
- Risk summary from `GrcRiskService.getSummary()` with severity breakdown

**Notes:**
- Currently returns a single data point with today's date and current severity breakdown
- Can be extended to return historical time-series data by querying risk creation dates

### GET /dashboard/compliance-by-regulation

Returns compliance status grouped by regulatory framework.

**Headers:**
- `Authorization: Bearer <token>` (required)
- `x-tenant-id: <tenant-uuid>` (required)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "regulation": "iso27001",
      "completed": 15,
      "pending": 8,
      "overdue": 2
    },
    {
      "regulation": "gdpr",
      "completed": 10,
      "pending": 5,
      "overdue": 1
    },
    {
      "regulation": "soc2",
      "completed": 8,
      "pending": 3,
      "overdue": 0
    }
  ]
}
```

**Data Sources:**
- Requirements from `GrcRequirementService.findAllActiveForTenant()` grouped by `framework` field

**Status Mapping:**
- `completed`: Requirements with status `implemented` or `verified`
- `pending`: Requirements with status `not_started` or `in_progress`
- `overdue`: Requirements with status `non_compliant`

## Architecture

### Module Structure

```
backend-nest/src/dashboard/
├── dashboard.module.ts      # Module definition
├── dashboard.controller.ts  # REST endpoints
├── dashboard.service.ts     # Business logic
├── dto/
│   ├── index.ts
│   └── dashboard-overview.dto.ts  # Response DTOs
└── index.ts                 # Public exports
```

### Dependencies

The Dashboard module imports and uses services from:
- `GrcModule`: Risk, Policy, and Requirement services
- `ItsmModule`: Incident service
- `AuthModule`: Authentication and authorization
- `TenantsModule`: Multi-tenant support

### Permissions

All Dashboard endpoints require the `GRC_STATISTICS_READ` permission.

## Extending the Dashboard

### Adding New KPIs to Overview

1. Add the new field to `DashboardOverviewResponse` in `dto/dashboard-overview.dto.ts`
2. Update `DashboardService.getOverview()` to fetch and transform the data
3. Update the frontend `DashboardOverview` interface in `grcClient.ts`
4. Update the Dashboard component to display the new KPI

### Adding Time-Series Risk Trends

To extend risk trends with historical data:

1. Query risks with `createdAt` timestamps
2. Group by time intervals (day/week/month)
3. Return array of data points with date and severity counts

Example implementation:
```typescript
async getRiskTrendsTimeSeries(tenantId: string, days: number = 30): Promise<RiskTrendDataPoint[]> {
  const risks = await this.riskService.findAllForTenant(tenantId);
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  // Group risks by creation date
  const byDate = new Map<string, { critical: number; high: number; medium: number; low: number }>();
  
  for (const risk of risks) {
    if (risk.createdAt >= startDate) {
      const dateKey = risk.createdAt.toISOString().split('T')[0];
      // ... aggregate by severity
    }
  }
  
  return Array.from(byDate.entries()).map(([date, counts]) => ({
    date,
    total_risks: counts.critical + counts.high + counts.medium + counts.low,
    ...counts,
  }));
}
```

### Adding New Compliance Groupings

To add groupings by different fields (e.g., by requirement type):

1. Add a new endpoint or query parameter
2. Group requirements by the desired field
3. Return the same structure with different grouping keys

## Testing

### Unit Tests

Run Dashboard service unit tests:
```bash
cd backend-nest
npm run test -- --testPathPattern="dashboard.service.spec.ts"
```

### E2E Tests

Run Dashboard e2e tests:
```bash
cd backend-nest
npm run test:e2e -- --testPathPattern="dashboard.e2e-spec.ts"
```

### Smoke Tests

The Dashboard endpoints are included in the GRC smoke tests:
```bash
cd backend-nest
npm run smoke:grc
```

## Limitations and TODOs

1. **Risk Trends**: Currently returns a single data point with today's severity breakdown. Can be extended to return historical time-series data.

2. **User Statistics**: The `users` section returns zeros. Can be extended by integrating with UserService to provide actual user counts.

3. **Caching**: Dashboard data is fetched fresh on each request. Consider adding caching for frequently accessed KPIs.

4. **Real-time Updates**: Dashboard data is point-in-time. Consider WebSocket integration for real-time updates.

## Related Documentation

- [GRC Domain Model](./GRC-DOMAIN-MODEL.md)
- [GRC Analytics and Reporting](./GRC-ANALYTICS-AND-REPORTING.md)
- [GRC Summary KPI Enhancement](./GRC-SUMMARY-KPI-ENHANCEMENT.md)
- [ITSM Incident MVP Design](./ITSM-INCIDENT-MVP-DESIGN.md)
