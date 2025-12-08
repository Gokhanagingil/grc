# Audit Report Template Design

## Overview

The Audit Report Template system provides a flexible framework for generating standardized audit reports. It supports multiple compliance standards, languages, and customizable templates with placeholder-based content rendering.

## Entity Model

### GrcAuditReportTemplate

The `GrcAuditReportTemplate` entity stores report template definitions.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | string | Template name |
| standard | enum | Compliance standard (ISO27001, ISO22301, COBIT, etc.) |
| language | enum | Template language (en, tr) |
| templateBody | text | Template content with placeholders |
| sections | JSON | Structured section definitions |
| description | text | Template description |
| createdAt | timestamp | Creation timestamp |
| updatedAt | timestamp | Last update timestamp |
| tenantId | UUID | Multi-tenant isolation |
| isDeleted | boolean | Soft delete flag |

### Supported Standards

```typescript
enum AuditStandard {
  ISO27001 = 'iso27001',
  ISO22301 = 'iso22301',
  COBIT = 'cobit',
  NIST = 'nist',
  SOC2 = 'soc2',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  CUSTOM = 'custom',
}
```

### Supported Languages

```typescript
enum TemplateLanguage {
  EN = 'en',
  TR = 'tr',
}
```

## Template Syntax

### Simple Placeholders

```
{{audit.name}}
{{audit.date}}
{{organization.name}}
{{preparedBy}}
```

### Conditional Blocks

```
{{#if findings.length}}
  <h2>Findings</h2>
  ...
{{/if}}
```

### Iteration Blocks

```
{{#each findings}}
  <div class="finding">
    <h3>{{title}}</h3>
    <p>{{description}}</p>
    <span class="severity">{{severity}}</span>
  </div>
{{/each}}
```

## Template Rendering

The `GrcAuditReportTemplateService` provides template rendering with the following features:

### Placeholder Replacement

```typescript
renderTemplate(templateBody: string, context: Record<string, unknown>): string {
  let result = templateBody;
  
  // Simple placeholders
  result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    return getNestedValue(context, path) || '';
  });
  
  // Conditional blocks
  result = processConditionals(result, context);
  
  // Iteration blocks
  result = processIterations(result, context);
  
  return result;
}
```

### Context Object Structure

```typescript
interface AuditReportContext {
  audit: {
    id: string;
    name: string;
    date: string;
    scope: string;
    objectives: string[];
  };
  organization: {
    name: string;
    department?: string;
  };
  findings: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    recommendation: string;
  }>;
  requirements: Array<{
    id: string;
    title: string;
    status: string;
    evidence?: string;
  }>;
  summary: {
    totalFindings: number;
    criticalFindings: number;
    complianceScore: number;
  };
  preparedBy: string;
  reviewedBy?: string;
  generatedAt: string;
}
```

## API Endpoints

### List Templates
```
GET /audit-report-templates
```
Returns paginated list of all templates.

### Get Template
```
GET /audit-report-templates/:id
```
Returns template details.

### Create Template
```
POST /audit-report-templates
Body: { name, standard, language, templateBody, sections?, description? }
```

### Update Template
```
PATCH /audit-report-templates/:id
Body: { name?, standard?, language?, templateBody?, sections?, description? }
```

### Delete Template
```
DELETE /audit-report-templates/:id
```
Soft deletes the template.

### Render Template
```
POST /audit-report-templates/:id/render
Body: { context: AuditReportContext }
```
Returns rendered HTML report.

### Preview Template
```
POST /audit-report-templates/preview
Body: { templateBody, context }
```
Renders template without saving.

### Validate Template
```
POST /audit-report-templates/validate
Body: { templateBody }
```
Validates template syntax.

### Get Placeholders
```
GET /audit-report-templates/:id/placeholders
```
Extracts and returns all placeholders from template.

## Frontend Integration

### AuditReportDialog Component

The `AuditReportDialog` component provides:

- Template selection dropdown
- Template details preview
- Generate Report button
- Rendered report display with print functionality

### Integration with Compliance Page

A "Generate Report" button on the Compliance page opens the `AuditReportDialog` with compliance requirements context.

## Security

- All endpoints require authentication
- GRC_POLICY_READ permission for read operations
- GRC_POLICY_WRITE permission for write operations
- Multi-tenant isolation via tenantId

## Future Enhancements (Phase 2+)

- PDF generation with wkhtmltopdf or Puppeteer
- Template versioning
- Template marketplace/sharing
- Custom CSS styling per template
- Digital signatures
- Scheduled report generation
- Email distribution
