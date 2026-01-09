# Unified Control Library - Process Controls & Coverage

## Overview

The Unified Control Library extends the GRC platform to support controls that can be linked to both compliance requirements AND business processes. This enables organizations to:

- Maintain a centralized control library
- Link controls to compliance requirements (existing functionality)
- Link controls to business processes (new functionality)
- Track coverage metrics for both requirements and processes
- Identify unlinked controls that need attention

## Key Concepts

### Process Controls

A "process control" is a GRC control that is linked to a business process rather than (or in addition to) a compliance requirement. This allows organizations to:

- Define controls that support operational processes
- Track process compliance separately from regulatory compliance
- Create "process-only controls" that are not tied to any compliance requirement

### Control-Process M2M Relationship

The `grc_control_processes` table provides a many-to-many relationship between controls and processes:

```
GrcControl (1) ----< (N) GrcControlProcess (N) >---- (1) Process
```

Each link includes:
- `controlId`: Reference to the GRC control
- `processId`: Reference to the business process
- `tenantId`: Tenant isolation
- `notes`: Optional notes about the relationship
- `createdAt`: Timestamp of link creation

### Coverage Metrics

The Coverage API provides three key metrics:

1. **Requirement Coverage**: Percentage of requirements that have at least one linked control
2. **Process Coverage**: Percentage of processes that have at least one linked control
3. **Unlinked Controls Count**: Number of controls not linked to any requirement or process

## API Endpoints

### Control Endpoints

```
GET  /grc/controls                              - List controls with filters
GET  /grc/controls?requirementId={id}           - Filter by requirement
GET  /grc/controls?processId={id}               - Filter by process
GET  /grc/controls?unlinked=true                - Get unlinked controls only
GET  /grc/controls/:id                          - Get control details
POST /grc/controls/:controlId/processes/:processId   - Link control to process
DELETE /grc/controls/:controlId/processes/:processId - Unlink control from process
```

### Coverage Endpoints

```
GET /grc/coverage                    - Get coverage summary
GET /grc/coverage/requirements       - Get requirement coverage details
GET /grc/coverage/processes          - Get process coverage details
```

### Process Endpoints

```
GET    /grc/processes                - List processes
GET    /grc/processes/:id            - Get process details
POST   /grc/processes                - Create process
PATCH  /grc/processes/:id            - Update process
DELETE /grc/processes/:id            - Soft delete process
```

## RBAC Permissions

| Permission | USER | MANAGER | ADMIN |
|------------|------|---------|-------|
| Read processes | Yes | Yes | Yes |
| Read control-process links | Yes | Yes | Yes |
| Read coverage metrics | Yes | Yes | Yes |
| Create/update processes | No | Yes | Yes |
| Link/unlink controls | No | Yes | Yes |

## Routing Rule (CRITICAL)

**Backend controllers must use `@Controller('grc/...')` paths WITHOUT the 'api/' prefix.**

- Frontend/Nginx exposes routes under `/api/*` and strips the `/api/` prefix before forwarding to the backend
- External clients call `/api/grc/...` but the backend serves `/grc/...` directly
- This routing rule is critical for all controller definitions

Example:
```typescript
// CORRECT
@Controller('grc/controls')
export class GrcControlController { ... }

// INCORRECT - DO NOT USE
@Controller('api/grc/controls')
export class GrcControlController { ... }
```

## Data Model

### GrcControlProcess Entity

```typescript
@Entity('grc_control_processes')
@Index(['tenantId', 'controlId', 'processId'], { unique: true })
export class GrcControlProcess extends MappingEntityBase {
  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string;

  @Column({ name: 'process_id', type: 'uuid' })
  processId: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
```

### Unique Constraint

The combination of `(tenantId, controlId, processId)` must be unique. This ensures:
- A control can only be linked to a process once per tenant
- Tenant isolation is maintained
- Duplicate links are prevented

## Seed Data

The golden flow seed includes a "process-only control" example:

- **Process**: "Sales Order Management" (PRC-SALES-001)
- **Control**: "Sales Approval Control" (CTL-SALES-001)
- **Link**: Control linked to process only (no requirement link)

This demonstrates the ability to create controls that support operational processes without being tied to compliance requirements.

## Validation Commands

After deployment, validate the feature with:

```bash
# Start services
docker compose -f docker-compose.staging.yml up -d --build backend frontend

# Login and get token
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@grc-platform.local","password":"TestPassword123!"}'

# Test processes endpoint
curl http://localhost:3002/grc/processes \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-id: {tenantId}"

# Test controls with processId filter
curl "http://localhost:3002/grc/controls?processId={processId}" \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-id: {tenantId}"

# Test coverage endpoint
curl http://localhost:3002/grc/coverage \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-id: {tenantId}"

# Run seed twice to verify idempotency
npm run seed:grc
npm run seed:grc
```

## UI Components

### Coverage Dashboard

The Coverage page (`/coverage`) displays:
- Requirement coverage percentage with progress bar
- Process coverage percentage with progress bar
- Unlinked controls count with warning/success indicator
- Tabbed view of requirements and processes with coverage status

### Menu Structure

GRC menu entries:
- Controls (Control Library)
- Requirements
- Processes
- Evidence
- Tests/Results
- Issues
- CAPA
- Status History
- Coverage

## Migration

The `1736400000000-CreateGrcControlProcessesTable` migration creates:
- `grc_control_processes` table
- Unique index on `(tenant_id, control_id, process_id)`
- Individual indexes on `control_id` and `process_id`
- Foreign key constraints to `grc_controls` and `processes` tables
