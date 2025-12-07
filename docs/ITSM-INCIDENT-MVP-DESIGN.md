# ITSM Incident Management MVP Design

This document defines the ITSM Incident Management MVP for the GRC Platform. The design follows ITIL best practices and aligns with the existing GRC domain patterns.

## Design Principles

1. **Multi-tenancy First** - All ITSM entities include `tenantId` for data isolation, following the same pattern as GRC entities
2. **ITIL Alignment** - Incident lifecycle follows ITIL v4 practices (Open -> In Progress -> Resolved -> Closed)
3. **Consistency with GRC** - Reuses existing patterns from GRC domain (BaseEntity, MultiTenantServiceBase, DTOs, Guards)
4. **Extensibility** - Designed to support future Problem/Change management modules
5. **Audit Trail** - All changes logged via AuditService integration
6. **Soft Delete** - Records marked as deleted, not removed from database

## Alignment with GRC Domain

The ITSM Incident module aligns with the existing GRC domain in the following ways:

| Aspect | GRC Pattern | ITSM Incident Implementation |
|--------|-------------|------------------------------|
| Base Entity | Extends `BaseEntity` with tenantId, audit fields, soft delete | Same - extends `BaseEntity` |
| Service Pattern | Extends `MultiTenantServiceBase` | Same - extends `MultiTenantServiceBase` |
| Controller Guards | JwtAuthGuard, TenantGuard, PermissionsGuard | Same guards applied |
| DTOs | class-validator decorators, PaginationQueryDto | Same patterns |
| Enums | Defined in enums/index.ts | New enums in itsm/enums/index.ts |
| Audit Logging | AuditService.recordCreate/Update/Delete | Same integration |
| Response Format | ResponseTransformInterceptor envelope | Same format |
| Soft Delete | isDeleted flag, filtered in queries | Same approach |

## Entity Relationship Overview

```
                              ┌─────────────────┐
                              │     Tenant      │
                              └────────┬────────┘
                                       │ owns all
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────┐            ┌─────────────────┐            ┌─────────────────┐
│  ItsmIncident │───────────►│    GrcRisk      │            │   GrcPolicy     │
└───────────────┘            └─────────────────┘            └─────────────────┘
        │ (optional FK)              ▲
        └────────────────────────────┘
```

## Enumerations

### Incident Category

```typescript
enum IncidentCategory {
  HARDWARE = 'hardware',
  SOFTWARE = 'software',
  NETWORK = 'network',
  ACCESS = 'access',
  OTHER = 'other',
}
```

### Incident Impact

```typescript
enum IncidentImpact {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
```

### Incident Urgency

```typescript
enum IncidentUrgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
```

### Incident Priority

```typescript
enum IncidentPriority {
  P1 = 'p1', // Critical - High Impact + High Urgency
  P2 = 'p2', // High - High Impact + Medium Urgency OR Medium Impact + High Urgency
  P3 = 'p3', // Medium - Medium Impact + Medium Urgency OR Low combinations
  P4 = 'p4', // Low - Low Impact + Low Urgency
}
```

### Priority Matrix

| Impact \ Urgency | High | Medium | Low |
|------------------|------|--------|-----|
| High | P1 | P2 | P3 |
| Medium | P2 | P3 | P4 |
| Low | P3 | P4 | P4 |

### Incident Status

```typescript
enum IncidentStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}
```

### Incident Source

```typescript
enum IncidentSource {
  USER = 'user',
  MONITORING = 'monitoring',
  EMAIL = 'email',
  PHONE = 'phone',
  SELF_SERVICE = 'self_service',
}
```

## Entity Schema

### ItsmIncident

**Table:** `itsm_incidents`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL, INDEX | Tenant isolation |
| number | VARCHAR(20) | NOT NULL, UNIQUE per tenant | Human-readable ID (e.g., INC000001) |
| shortDescription | VARCHAR(255) | NOT NULL | Brief incident summary |
| description | TEXT | NULL | Detailed description |
| category | ENUM | NOT NULL, DEFAULT 'other' | Incident category |
| impact | ENUM | NOT NULL, DEFAULT 'medium' | Business impact |
| urgency | ENUM | NOT NULL, DEFAULT 'medium' | Time sensitivity |
| priority | ENUM | NOT NULL, DEFAULT 'p3' | Calculated priority |
| status | ENUM | NOT NULL, DEFAULT 'open' | Current status |
| source | ENUM | NOT NULL, DEFAULT 'user' | How incident was reported |
| assignmentGroup | VARCHAR(100) | NULL | Support group assigned |
| assignedTo | UUID | FK→nest_users, NULL | Individual assignee |
| relatedService | VARCHAR(100) | NULL | Affected service/CI |
| relatedRiskId | UUID | FK→grc_risks, NULL | Link to related risk |
| relatedPolicyId | UUID | FK→grc_policies, NULL | Link to related policy |
| firstResponseAt | TIMESTAMP | NULL | When first response was made |
| resolvedAt | TIMESTAMP | NULL | When incident was resolved |
| resolutionNotes | TEXT | NULL | Resolution details |
| metadata | JSONB | NULL | Additional metadata |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL | Last update timestamp |
| createdBy | UUID | NULL | User who created |
| updatedBy | UUID | NULL | User who last updated |
| isDeleted | BOOLEAN | NOT NULL, DEFAULT false | Soft delete flag |

**Indexes:**
- `(tenantId, number)` UNIQUE
- `(tenantId, status)`
- `(tenantId, priority)`
- `(tenantId, assignmentGroup)`
- `(tenantId, assignedTo)`
- `(tenantId, createdAt)`

## API Endpoints

### Base Path: `/itsm/incidents`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | / | ITSM_INCIDENT_READ | List incidents with pagination and filters |
| GET | /:id | ITSM_INCIDENT_READ | Get incident by ID |
| POST | / | ITSM_INCIDENT_WRITE | Create new incident |
| PATCH | /:id | ITSM_INCIDENT_WRITE | Update incident |
| DELETE | /:id | ITSM_INCIDENT_WRITE | Soft delete incident |
| POST | /:id/resolve | ITSM_INCIDENT_WRITE | Resolve incident |
| POST | /:id/close | ITSM_INCIDENT_WRITE | Close incident |
| GET | /statistics | ITSM_STATISTICS_READ | Get incident statistics |
| GET | /summary | ITSM_STATISTICS_READ | Get summary/reporting data |

### Query Parameters for GET /

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| pageSize | number | Items per page (default: 20, max: 100) |
| sortBy | string | Field to sort by |
| sortOrder | 'ASC' \| 'DESC' | Sort direction |
| status | IncidentStatus | Filter by status |
| priority | IncidentPriority | Filter by priority |
| category | IncidentCategory | Filter by category |
| assignmentGroup | string | Filter by assignment group |
| assignedTo | UUID | Filter by assignee |
| createdFrom | ISO date | Filter by creation date start |
| createdTo | ISO date | Filter by creation date end |
| search | string | Search in number, shortDescription, description |

### Request/Response Examples

#### Create Incident

**Request:**
```json
POST /itsm/incidents
Headers:
  Authorization: Bearer <token>
  x-tenant-id: <tenant-uuid>

{
  "shortDescription": "Email server not responding",
  "description": "Users unable to send or receive emails since 9:00 AM",
  "category": "software",
  "impact": "high",
  "urgency": "high",
  "source": "user",
  "assignmentGroup": "IT Support",
  "relatedService": "Email Service"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenantId": "tenant-uuid",
    "number": "INC000001",
    "shortDescription": "Email server not responding",
    "description": "Users unable to send or receive emails since 9:00 AM",
    "category": "software",
    "impact": "high",
    "urgency": "high",
    "priority": "p1",
    "status": "open",
    "source": "user",
    "assignmentGroup": "IT Support",
    "relatedService": "Email Service",
    "createdAt": "2025-12-07T12:00:00Z",
    "updatedAt": "2025-12-07T12:00:00Z"
  }
}
```

## Frontend UX Flow

### Navigation

The ITSM section is added to the sidebar navigation:

```
Dashboard
To-Do
Governance
Risk Management
Compliance
ITSM
  └── Incidents    <-- New
Query Builder
User Management (admin/manager)
Admin Panel (admin)
```

### Incident List Page

**Route:** `/itsm/incidents`

**Features:**
1. Header with "Incident Management" title and "New Incident" button
2. Filter card with:
   - Status multi-select dropdown
   - Priority dropdown
   - Assignment Group text input
   - Clear Filters button
3. Data table with columns:
   - Number (clickable, opens detail)
   - Short Description
   - Priority (color-coded chip)
   - Status (color-coded chip)
   - Assignment Group
   - Created At
   - Actions (View, Edit, Delete icons)
4. Pagination controls

### Create/Edit Incident Dialog

**Fields:**
- Short Description (required, text input)
- Description (optional, multiline textarea)
- Category (dropdown)
- Impact (dropdown)
- Urgency (dropdown)
- Priority (auto-calculated, displayed as read-only chip)
- Source (dropdown)
- Assignment Group (text input)
- Related Service (text input)

**Actions:**
- Cancel button
- Save button (disabled if required fields empty)

### View Incident Dialog/Drawer

Displays all incident details in a read-only format with:
- Status badge
- Priority badge
- Timeline of status changes
- Edit and Close buttons

## Test Strategy

### Unit Tests (Service)

| Category | Test Scenario |
|----------|---------------|
| createIncident | Creates new incident with auto-generated number |
| createIncident | Calculates priority from impact/urgency matrix |
| createIncident | Records audit log on creation |
| updateIncident | Updates an existing incident |
| updateIncident | Returns null when updating non-existent incident |
| updateIncident | Does not update incident from different tenant |
| softDeleteIncident | Soft deletes an incident |
| softDeleteIncident | Returns false for non-existent incident |
| findOneActiveForTenant | Returns incident when found and not deleted |
| findOneActiveForTenant | Returns null when incident not found |
| findAllActiveForTenant | Returns all active incidents for tenant |
| findWithFilters | Filters by status |
| findWithFilters | Filters by priority |
| findWithFilters | Filters by assignmentGroup |
| findWithFilters | Supports pagination |
| findWithFilters | Supports search |
| resolveIncident | Sets status to resolved and resolvedAt timestamp |
| closeIncident | Sets status to closed |
| closeIncident | Fails if incident not resolved first |
| getStatistics | Returns correct counts by status and priority |
| tenant isolation | Does not return incidents from different tenant |

### E2E Tests (Controller)

| Operation | Test Scenario |
|-----------|---------------|
| GET (list) | Returns list with valid auth and tenant ID |
| GET (list) | Returns 401 without token |
| GET (list) | Returns 400 without x-tenant-id header |
| POST | Creates new incident with valid data |
| POST | Returns 400 without required fields |
| POST | Auto-generates incident number |
| GET (by ID) | Returns specific incident by ID |
| GET (by ID) | Returns 404 for non-existent incident |
| PATCH | Updates existing incident |
| PATCH | Returns 404 for non-existent incident |
| DELETE | Soft deletes incident |
| DELETE | Deleted incident not returned in list |
| POST resolve | Resolves incident and sets timestamp |
| POST close | Closes resolved incident |
| GET statistics | Returns statistics for tenant |
| Tenant isolation | Returns 403 when accessing with fake tenant ID |

## Permissions

New permissions added to `permission.enum.ts`:

```typescript
// ITSM Incident permissions
ITSM_INCIDENT_READ = 'itsm:incident:read',
ITSM_INCIDENT_WRITE = 'itsm:incident:write',
ITSM_STATISTICS_READ = 'itsm:statistics:read',
```

Permission mapping (to be added to PermissionService):
- `admin` role: All ITSM permissions
- `manager` role: All ITSM permissions
- `user` role: ITSM_INCIDENT_READ only

## File Structure

```
backend-nest/src/itsm/
├── incident/
│   ├── incident.entity.ts
│   ├── incident.service.ts
│   ├── incident.service.spec.ts
│   ├── incident.controller.ts
│   └── dto/
│       ├── create-incident.dto.ts
│       ├── update-incident.dto.ts
│       ├── incident-filter.dto.ts
│       └── index.ts
├── enums/
│   └── index.ts
├── itsm.module.ts
└── index.ts

frontend/src/
├── pages/
│   └── IncidentManagement.tsx
└── services/
    └── api.ts (updated with incident methods)
```

## Migration Notes

1. Create new `itsm_incidents` table with all columns and indexes
2. Add new enum types to PostgreSQL if not using string enums
3. No data migration required (new module)

## Future Enhancements

1. **Problem Management** - Link multiple incidents to a problem record
2. **Change Management** - Create change requests from incidents
3. **SLA Management** - Track response and resolution SLAs
4. **Knowledge Base** - Link incidents to KB articles
5. **Email Integration** - Auto-create incidents from emails
6. **Notifications** - Alert assignees on new/updated incidents
7. **Incident History** - Track all changes in a history table (like GrcRiskHistory)
