# Risk Module v1

This document describes the Risk Module v1 implementation for the GRC Platform, including entity schema, API endpoints, audit/history functionality, and frontend integration.

## Overview

The Risk Module provides comprehensive risk management capabilities for the GRC platform. It allows organizations to identify, assess, track, and mitigate risks across their operations while maintaining full audit trails and multi-tenant isolation.

## Entity Schema

### GrcRisk Entity

The `GrcRisk` entity extends `BaseEntity` and includes all standard audit fields plus risk-specific attributes.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `tenantId` | UUID | Tenant identifier for multi-tenant isolation |
| `title` | VARCHAR(255) | Risk title (required) |
| `description` | TEXT | Detailed risk description (optional) |
| `category` | VARCHAR(100) | Risk category (e.g., Operational, Financial, Compliance) |
| `severity` | ENUM | Risk severity level: `low`, `medium`, `high`, `critical` |
| `likelihood` | ENUM | Probability of occurrence: `rare`, `unlikely`, `possible`, `likely`, `almost_certain` |
| `impact` | ENUM | Impact level: `low`, `medium`, `high`, `critical` |
| `score` | INT | Calculated risk score (1-100) |
| `status` | ENUM | Risk status: `draft`, `identified`, `assessed`, `mitigating`, `accepted`, `closed` |
| `ownerUserId` | UUID | User responsible for the risk (optional) |
| `dueDate` | DATE | Target date for risk resolution (optional) |
| `mitigationPlan` | TEXT | Description of mitigation strategy (optional) |
| `tags` | JSONB | Array of string tags for categorization |
| `metadata` | JSONB | Additional custom metadata |
| `createdAt` | TIMESTAMP | Record creation timestamp |
| `updatedAt` | TIMESTAMP | Last update timestamp |
| `createdBy` | UUID | User who created the record |
| `updatedBy` | UUID | User who last updated the record |
| `isDeleted` | BOOLEAN | Soft delete flag |

### Database Indexes

The following indexes are defined for optimal query performance:

- `(tenantId, status)` - Filter risks by status within a tenant
- `(tenantId, severity)` - Filter risks by severity within a tenant
- `(tenantId, ownerUserId)` - Filter risks by owner within a tenant
- `(tenantId, status, createdAt)` - Sort and filter by status and creation date

### GrcRiskHistory Entity

The `GrcRiskHistory` entity stores snapshots of risk changes for audit purposes.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `riskId` | UUID | Reference to the original risk |
| `tenantId` | UUID | Tenant identifier |
| `title` | VARCHAR(255) | Risk title at time of change |
| `description` | TEXT | Description at time of change |
| `severity` | ENUM | Severity at time of change |
| `status` | ENUM | Status at time of change |
| `ownerUserId` | UUID | Owner at time of change |
| `likelihood` | INT | Likelihood at time of change |
| `impact` | INT | Impact at time of change |
| `riskScore` | INT | Score at time of change |
| `mitigation` | TEXT | Mitigation plan at time of change |
| `metadata` | JSONB | Metadata at time of change |
| `changedBy` | UUID | User who made the change |
| `changeReason` | TEXT | Reason for the change |
| `createdAt` | TIMESTAMP | When the history record was created |

## API Endpoints

All endpoints require authentication (JWT) and tenant context (`x-tenant-id` header).

### Base URL

```
/api/grc/risks
```

### List Risks

```http
GET /grc/risks
```

Query Parameters:
- `page` (number, default: 1) - Page number
- `pageSize` (number, default: 10) - Items per page
- `status` (string) - Filter by status
- `severity` (string) - Filter by severity
- `sortBy` (string) - Field to sort by
- `sortOrder` (string) - Sort direction: `ASC` or `DESC`

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "title": "Data Breach Risk",
      "description": "Risk of unauthorized access to customer data",
      "category": "Security",
      "severity": "high",
      "likelihood": "possible",
      "impact": "critical",
      "score": 15,
      "status": "mitigating",
      "ownerUserId": "uuid",
      "dueDate": "2024-03-15",
      "mitigationPlan": "Implement encryption and access controls",
      "tags": ["security", "compliance"],
      "metadata": {},
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:45:00Z",
      "createdBy": "uuid",
      "updatedBy": "uuid",
      "isDeleted": false
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 10,
  "totalPages": 3
}
```

### Get Risk by ID

```http
GET /grc/risks/:id
```

Response: Single risk object (same structure as list item)

### Create Risk

```http
POST /grc/risks
```

Request Body:
```json
{
  "title": "New Risk Title",
  "description": "Detailed description of the risk",
  "category": "Operational",
  "severity": "medium",
  "likelihood": "possible",
  "impact": "medium",
  "status": "draft",
  "ownerUserId": "uuid",
  "dueDate": "2024-06-30",
  "mitigationPlan": "Steps to mitigate...",
  "tags": ["operations"],
  "metadata": {}
}
```

Required Fields:
- `title` (string, max 255 characters)

Optional Fields:
- All other fields have sensible defaults

Response: Created risk object with `201 Created` status

### Update Risk

```http
PATCH /grc/risks/:id
```

Request Body: Partial risk object with fields to update

Response: Updated risk object

### Delete Risk (Soft Delete)

```http
DELETE /grc/risks/:id
```

Response: `204 No Content`

Note: This performs a soft delete by setting `isDeleted = true`. The record remains in the database for audit purposes.

## Enums

### RiskSeverity

```typescript
enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### RiskLikelihood

```typescript
enum RiskLikelihood {
  RARE = 'rare',
  UNLIKELY = 'unlikely',
  POSSIBLE = 'possible',
  LIKELY = 'likely',
  ALMOST_CERTAIN = 'almost_certain'
}
```

### RiskStatus

```typescript
enum RiskStatus {
  DRAFT = 'draft',
  IDENTIFIED = 'identified',
  ASSESSED = 'assessed',
  MITIGATING = 'mitigating',
  ACCEPTED = 'accepted',
  CLOSED = 'closed'
}
```

## Audit and History

### Automatic Audit Fields

The Risk entity automatically tracks:
- `createdAt` / `createdBy` - Set on creation
- `updatedAt` / `updatedBy` - Updated on every modification

These fields are populated automatically by the `BaseEntity` and service layer.

### History Records

When a risk is created, updated, or deleted, a history record is created in the `grc_risk_history` table. This provides:

1. Complete audit trail of all changes
2. Point-in-time snapshots of risk state
3. Attribution of changes to specific users
4. Optional change reasons for compliance

### Querying History

History records can be queried to:
- View the evolution of a risk over time
- Identify who made specific changes
- Restore previous states if needed
- Generate compliance reports

## Frontend Integration

### RiskManagement Page

The frontend provides a `RiskManagement` component (`/src/pages/RiskManagement.tsx`) with:

1. **Risk List Table**
   - Displays all risks with pagination
   - Columns: Title, Category, Severity, Likelihood, Score, Status, Due Date, Actions
   - Sortable and filterable

2. **Filters**
   - Status filter dropdown
   - Severity filter dropdown
   - Clear filters button

3. **Create Risk Dialog**
   - Form with all risk fields
   - Validation for required fields
   - Enum dropdowns for severity, likelihood, impact, status
   - Date picker for due date

4. **View Risk Dialog**
   - Read-only view of all risk details
   - Quick edit button

5. **Edit Risk Dialog**
   - Pre-populated form for editing
   - Same validation as create

6. **Delete Confirmation**
   - Confirmation dialog before soft delete

### API Integration

The frontend uses the `api` service to communicate with the backend:

```typescript
// List risks with filters and pagination
const response = await api.get('/grc/risks', {
  params: { page, pageSize, status, severity },
  headers: { 'x-tenant-id': tenantId }
});

// Create risk
await api.post('/grc/risks', riskData, {
  headers: { 'x-tenant-id': tenantId }
});

// Update risk
await api.patch(`/grc/risks/${id}`, riskData, {
  headers: { 'x-tenant-id': tenantId }
});

// Delete risk
await api.delete(`/grc/risks/${id}`, {
  headers: { 'x-tenant-id': tenantId }
});
```

## Security

### Authentication

All endpoints require a valid JWT token in the `Authorization` header.

### Multi-Tenant Isolation

- All queries are scoped to the tenant specified in `x-tenant-id` header
- `TenantGuard` validates tenant access
- Database queries automatically filter by `tenantId`

### Role-Based Access Control

- `PermissionsGuard` enforces role-based access
- Create/Update/Delete operations require appropriate permissions
- Read operations available to authenticated users within the tenant

## Testing

### Unit Tests

Unit tests cover:
- Risk service CRUD operations
- Filtering and pagination logic
- Audit field population
- History record creation

### E2E Tests

E2E tests cover:
- Authenticated risk list endpoint
- Risk creation with validation
- Risk update operations
- Risk deletion (soft delete)
- Filter scenarios (by status, severity)

## Related Entities

The Risk entity has relationships with:

- **GrcRiskControl** - Controls linked to mitigate the risk
- **GrcIssue** - Issues that arise from the risk
- **User** - Owner of the risk
- **Tenant** - Multi-tenant isolation

## Future Enhancements

Planned improvements for future versions:

1. Risk assessment workflows
2. Automated risk scoring based on likelihood and impact
3. Risk heat maps and visualizations
4. Integration with control effectiveness
5. Risk treatment plans
6. Notifications and alerts for due dates
7. Risk aggregation and reporting
