# Policy Versioning Design

## Overview

The Policy Versioning system provides a complete version management infrastructure for organizational policies. It enables tracking of policy changes over time, supports a review and approval workflow, and maintains a full audit trail of policy evolution.

## Entity Model

### GrcPolicyVersion

The `GrcPolicyVersion` entity represents a specific version of a policy document.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| policyId | UUID | Reference to parent GrcPolicy |
| versionNumber | string | Semantic version (e.g., "1.0", "1.1", "2.0") |
| content | text | Policy content (Markdown or HTML) |
| changeSummary | text | Description of changes in this version |
| effectiveDate | date | When this version becomes effective |
| status | enum | Version lifecycle status |
| createdBy | UUID | User who created this version |
| createdAt | timestamp | Creation timestamp |
| updatedAt | timestamp | Last update timestamp |
| tenantId | UUID | Multi-tenant isolation |
| isDeleted | boolean | Soft delete flag |

### Version Status Lifecycle

```
draft → in_review → approved → published → retired
```

- **draft**: Initial state, editable
- **in_review**: Submitted for review, locked for editing
- **approved**: Approved by reviewer, ready for publication
- **published**: Active and effective, visible to users
- **retired**: No longer active, archived for reference

## Version Numbering

The system supports semantic versioning with major and minor increments:

- **Minor version** (1.0 → 1.1): Small changes, clarifications, formatting
- **Major version** (1.1 → 2.0): Significant policy changes, new requirements

### Automatic Increment Logic

```typescript
function incrementVersion(currentVersion: string, type: 'major' | 'minor'): string {
  const [major, minor] = currentVersion.split('.').map(Number);
  if (type === 'major') {
    return `${major + 1}.0`;
  }
  return `${major}.${minor + 1}`;
}
```

## API Endpoints

### List Versions
```
GET /grc/policies/:policyId/versions
```
Returns paginated list of all versions for a policy.

### Get Version
```
GET /grc/policies/:policyId/versions/:versionId
```
Returns details of a specific version.

### Create Draft Version
```
POST /grc/policies/:policyId/versions
Body: { content, changeSummary, versionType: 'major' | 'minor' }
```
Creates a new draft version with auto-incremented version number.

### Update Version
```
PATCH /grc/policies/:policyId/versions/:versionId
Body: { content?, changeSummary? }
```
Updates a draft version (only drafts can be edited).

### Submit for Review
```
POST /grc/policies/:policyId/versions/:versionId/submit-for-review
```
Transitions version from draft to in_review status.

### Approve Version
```
POST /grc/policies/:policyId/versions/:versionId/approve
```
Transitions version from in_review to approved status.

### Publish Version
```
POST /grc/policies/:policyId/versions/:versionId/publish
```
Transitions version from approved to published status. Sets effectiveDate if not already set.

### Retire Version
```
POST /grc/policies/:policyId/versions/:versionId/retire
```
Transitions version from published to retired status.

### Get Latest Version
```
GET /grc/policies/:policyId/versions/latest
```
Returns the most recent version regardless of status.

### Get Published Version
```
GET /grc/policies/:policyId/versions/published
```
Returns the currently published (active) version.

## Service Layer

### GrcPolicyVersionService

Key methods:

- `createDraftVersion(policyId, data)`: Creates new draft with auto-versioning
- `publishVersion(versionId)`: Publishes approved version, retires previous published
- `getLatestVersion(policyId)`: Returns most recent version
- `getPublishedVersion(policyId)`: Returns currently active version

## Frontend Integration

### PolicyVersionsTab Component

The `PolicyVersionsTab` component provides:

- Version history table with status, date, and change summary
- Create Draft Version button with version type selection
- Status-based action buttons (Submit, Approve, Publish, Retire)
- Version detail view with content preview

### Integration with Governance Page

The version history is accessible via a History icon button on each policy row, opening a dialog with the `PolicyVersionsTab` component.

## Security

- All endpoints require authentication
- GRC_POLICY_READ permission for read operations
- GRC_POLICY_WRITE permission for write operations
- Multi-tenant isolation via tenantId

## Future Enhancements (Phase 2+)

- Rich content editor for policy content
- Diff view between versions
- Review workflow with comments
- Approval chains with multiple reviewers
- Version comparison tool
- Export to PDF/Word
