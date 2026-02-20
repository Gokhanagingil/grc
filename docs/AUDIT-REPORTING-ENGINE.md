# Audit Reporting Engine

## Overview

The Audit Reporting Engine is a comprehensive feature that enables the generation, management, and lifecycle control of audit reports within the GRC Platform. It is designed to align with ISO 19011 and IIA standards for enterprise-grade audit reporting.

## Features

### Report Generation
- Generates full HTML audit reports using Handlebars templates
- Aggregates all audit-related data including findings, CAPAs, evidence, criteria, scope objects, risks, and ITSM links
- Calculates metrics such as total findings, findings by severity, open CAPAs, and overdue CAPAs
- Supports report versioning with automatic version incrementing

### Report Lifecycle
Reports follow a defined lifecycle with the following states:
- **Draft**: Initial state after generation. Can be regenerated and modified.
- **Under Review**: Submitted for review. Can be regenerated or finalized.
- **Final**: Approved and locked. Cannot be modified, only archived.
- **Archived**: Historical record. Read-only.

### Access Control
The reporting engine enforces role-based access control:
- **Auditors (admin/manager)**: Can generate draft reports and submit for review
- **Audit Managers (admin/manager)**: Can finalize reports
- **Governance/Quality (admin)**: Can archive final reports

## Database Schema

### audit_reports Table
```sql
CREATE TABLE audit_reports (
  id INTEGER PRIMARY KEY,
  audit_id INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'final', 'archived')),
  generated_html TEXT,
  generated_pdf_path TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (audit_id) REFERENCES audits (id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);
```

## API Endpoints

### List Reports
```
GET /api/grc/audits/:id/reports
```
Returns a list of all reports for an audit (summary only).

### Get Report
```
GET /api/grc/audits/:id/reports/:reportId
```
Returns full report details including generated HTML.

### Generate Report
```
POST /api/grc/audits/:id/reports/generate
```
Creates a new draft report version. Requires auditor permissions.

### Regenerate Report
```
POST /api/grc/audits/:id/reports/:reportId/regenerate
```
Regenerates an existing draft or under_review report. Requires auditor permissions.

### Update Report Status
```
PATCH /api/grc/audits/:id/reports/:reportId/status
```
Updates the report status. Allowed transitions:
- draft → under_review (auditor)
- under_review → final (audit manager)
- final → archived (governance/quality)

### Get Report Permissions
```
GET /api/grc/audits/:id/reports/:reportId/permissions
```
Returns the current user's permissions for the report.

## Report Template

The report template is located at `backend/templates/audit-report/default.hbs` and includes:

### Sections
1. **Report Header**: Audit name, version, status, metadata
2. **Executive Summary**: Audit description, findings summary, conclusion
3. **Metrics Dashboard**: Total findings, CAPAs, overdue CAPAs
4. **Severity Heatmap**: Visual breakdown of findings by severity
5. **Audit Schedule**: Planned and actual dates
6. **Scope & Objectives**: Audit scope, objectives, methodology
7. **Criteria Coverage**: Linked requirements and policies
8. **Scope Objects**: CMDB/Service objects in scope
9. **Detailed Findings**: Full finding details with root cause, recommendations, CAPAs
10. **Evidence**: List of attached evidence
11. **Audit Team**: Owner and lead auditor information

### Template Features
- Handlebars templating with {{#each}}, {{#if}}, nested loops
- Severity color badges for findings
- Status indicators for CAPAs
- Risk level indicators
- Responsive design for print and screen

## Frontend Components

### Reports Tab (AuditDetail.tsx)
Added to the Audit Detail page with features:
- List of existing report versions
- Generate Report button
- Status change actions (Submit for Review, Finalize, Archive)
- View report navigation

### Report Viewer Page (ReportViewer.tsx)
New page at `/audits/:auditId/reports/:reportId` with:
- Rendered HTML report with safe sanitization (DOMPurify)
- Metadata sidebar (status, version, created by, dates)
- Action buttons based on lifecycle and permissions
- Regenerate functionality for draft/under_review reports

## Search Integration

The Search DSL has been extended to support audit_reports filtering:
- Filter by audit_id
- Filter by status
- Filter by created_by
- Filter by date range (created_at)

## Permissions

### New Permissions
- `audit_reports.read`: View audit reports
- `audit_reports.generate`: Generate new reports
- `audit_reports.submit_review`: Submit reports for review
- `audit_reports.finalize`: Finalize reports
- `audit_reports.archive`: Archive reports
- `audit_reports.regenerate`: Regenerate existing reports

### Role Assignments
- **Admin**: All permissions
- **Manager**: All except archive
- **User**: Read only

## Local Testing

### Prerequisites
1. Run the Phase 5 migration script:
```bash
cd backend
node scripts/migrate-platform-core-phase5.js
```

2. Start the backend:
```bash
cd backend
npm run dev
```

3. Start the frontend:
```bash
cd frontend
npm start
```

### Smoke Test
1. Create a new audit or use an existing one
2. Add findings, CAPAs, and evidence to the audit
3. Navigate to the audit detail page
4. Click on the "Reports" tab
5. Click "Generate Report"
6. View the generated report
7. Submit for review (if you have auditor permissions)
8. Finalize the report (if you have audit manager permissions)
9. Archive the report (if you have governance/quality permissions)

### Unit Tests
Run the unit tests:
```bash
cd backend
npm test -- --testPathPattern=AuditReportGeneratorService
```

## Configuration

### Template Customization
To customize the report template, edit `backend/templates/audit-report/default.hbs`. The template receives the following data:
- `audit`: Audit metadata
- `criteria`: Linked requirements
- `scopeObjects`: CMDB/Service objects
- `findings`: Findings with CAPAs, risks, requirements, ITSM links
- `evidence`: Evidence metadata
- `metrics`: Calculated metrics
- `reportVersion`: Report version number
- `reportStatus`: Current status
- `generatedAt`: Generation timestamp
- `generatedBy`: User who generated the report

### ACL Rules
ACL rules for audit reports are defined in the migration script and can be customized in the admin panel.

## Future Enhancements

- PDF generation (currently stubbed)
- Email notifications for status changes
- Report comparison between versions
- Custom report templates per audit type
- Scheduled report generation
