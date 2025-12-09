# GRC Platform - Phase 8 Dashboard Overview

This document provides an overview of the Phase 8 Dashboard implementation for the GRC Platform, including executive-grade dashboards for Audit, Compliance, and GRC Health monitoring.

## Overview

Phase 8 transforms platform data into executive-grade dashboards that provide high-level visibility with drill-down capability. The implementation includes:

1. **Audit Dashboard** - Findings heatmap, CAPA performance, audit pipeline, audit calendar
2. **Compliance Dashboard** - Standard coverage, clause heatmaps, compliance scoring
3. **GRC Health Overview** - Organization-level insights: department risk, repeated findings, policy compliance, risk clusters

## Architecture

### Backend

The dashboard backend is implemented as a new Express.js route module at `/api/grc/dashboard/*` with the following endpoints:

- `GET /audit-overview` - Audit metrics and pipeline data
- `GET /compliance-overview` - Compliance status and standards coverage
- `GET /grc-health` - Organization-wide GRC health metrics
- `GET /filters` - Available filter options for dashboard dropdowns

All endpoints use optimized SQL aggregation queries with support for:
- Date range filtering
- Department/family filtering
- Tenant isolation
- Role-based access control

### Frontend

The frontend implementation includes:

**Shared Components** (`/src/components/dashboard/`):
- `DashboardCard` - Container card for dashboard sections
- `MetricCard` - KPI display card with icon and trend
- `Heatmap` - Matrix heatmap for severity visualization
- `TrendChart` - Line chart for time-series data
- `BarList` - Horizontal bar list for rankings
- `RadarChart` - Radar/spider chart for multi-dimensional scores
- `PipelineChart` - Bar chart for pipeline visualization
- `StackedBarChart` - Stacked bar chart for grouped data
- `DonutChart` - Circular chart for status breakdown
- `FilterBar` - Reusable filter controls

**Dashboard Pages** (`/src/pages/dashboards/`):
- `AuditDashboard` - `/dashboards/audit`
- `ComplianceDashboard` - `/dashboards/compliance`
- `GrcHealthDashboard` - `/dashboards/grc-health`

## Dashboard Details

### Audit Dashboard

**URL:** `/dashboards/audit`

**Access:** auditor, audit_manager, governance, admin

**Features:**
- Audit Pipeline (horizontal bar chart showing audit status distribution)
- Findings Heatmap (matrix showing severity by department)
- CAPA Performance (metric cards for total, open, overdue, validated rate)
- Top Risk Areas (bar list of risks with most related findings)
- Audit Calendar (12-month stacked chart of audit activity)

**Filters:**
- Date range (from/to)
- Department

### Compliance Dashboard

**URL:** `/dashboards/compliance`

**Access:** governance, compliance, audit_manager, admin

**Features:**
- Compliance Status (donut chart showing compliant/partial/non-compliant/not assessed)
- Standards Coverage (progress bars showing compliance score per standard family)
- Clause Heatmap (matrix showing finding severity by clause)
- Domain Breakdown (grouped bar chart of requirements, findings, CAPAs by domain)

**Filters:**
- Standard family (iso27001, nist, cobit, kvkk, etc.)
- Version

**Compliance Logic:**
- Compliant: No findings OR all findings closed
- Partially Compliant: Findings exist but CAPA validated
- Non-Compliant: Open findings exist
- Not Assessed: Not yet audited

### GRC Health Overview

**URL:** `/dashboards/grc-health`

**Access:** governance, executive, director, admin

**Features:**
- Department GRC Scores (radar chart showing audit/risk/policy/CAPA scores)
- Repeated Findings (bar list of common finding themes)
- Policy Compliance (horizontal bar showing acknowledgment rates)
- Risk Clusters (grouped bar chart of open findings and high risks by cluster)

**Filters:**
- Date range (from/to)

**Scoring Model:**
```
Department Score = average(auditScore, riskScore, policyScore, capaScore)
```
All scores normalized to 0-1 scale.

## Security & Access Control

Role-based access is enforced at both backend and frontend levels:

| Dashboard | Backend Middleware | Frontend ProtectedRoute |
|-----------|-------------------|------------------------|
| Audit | auditor, audit_manager, governance | auditor, audit_manager, governance, admin |
| Compliance | governance, compliance, audit_manager | governance, compliance, audit_manager, admin |
| GRC Health | governance, executive, director | governance, executive, director, admin |

## Navigation

Dashboard links are added to the main navigation sidebar:
- Audit Dashboard (requires audit module enabled)
- Compliance Dashboard (requires compliance module enabled)
- GRC Health (requires admin or manager role)

## Technical Implementation

### Database Queries

All dashboard queries use:
- SQL `GROUP BY` for aggregation
- `CASE` statements for conditional counting
- Cross-database compatibility (SQLite and PostgreSQL)
- Tenant isolation via `tenant_id` filtering
- Date range filtering via `created_at` comparisons

### Chart Library

Charts are implemented using Recharts library with:
- Responsive containers for mobile compatibility
- Consistent color schemes
- Tooltips for data exploration
- Legend support

### State Management

Each dashboard page manages its own state with:
- Loading indicators
- Error handling with graceful degradation
- Filter state with URL parameter support
- Automatic data refresh on filter changes

## Testing

Backend tests are located at `/backend/tests/grc-dashboards.test.js` and cover:
- Response structure validation
- Filter parameter handling
- Authentication requirements
- Data type validation
- Access control enforcement

## API Documentation

See [DASHBOARD-API.md](./DASHBOARD-API.md) for detailed API endpoint documentation.

## Future Enhancements

Potential future improvements:
- Real-time data updates via WebSocket
- Export to PDF/Excel
- Custom date range presets (last 30 days, quarter, year)
- Drill-down navigation to detailed views
- Dashboard customization and saved views
- Email/Slack alerts for threshold breaches
