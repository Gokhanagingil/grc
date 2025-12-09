# Metadata Dictionary Design

## Overview

The Metadata Dictionary system provides a comprehensive field-level classification framework for data governance. It enables organizations to tag database fields with classification labels like "Personal Data", "Sensitive", or "Confidential", supporting compliance with regulations like GDPR, HIPAA, and internal data governance policies.

## Entity Model

### GrcFieldMetadata

Represents metadata for a database field.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tableName | string | Database table name |
| fieldName | string | Database field/column name |
| label | string | Human-readable label |
| description | text | Field description |
| dataType | string | Data type (optional) |
| tags | relation | Many-to-many with ClassificationTag |
| createdAt | timestamp | Creation timestamp |
| updatedAt | timestamp | Last update timestamp |
| tenantId | UUID | Multi-tenant isolation |
| isDeleted | boolean | Soft delete flag |

### GrcClassificationTag

Represents a classification tag that can be applied to fields.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | string | Tag name |
| tagType | enum | Tag category (privacy, security, compliance) |
| description | text | Tag description |
| color | string | Display color (hex) |
| createdAt | timestamp | Creation timestamp |
| updatedAt | timestamp | Last update timestamp |
| tenantId | UUID | Multi-tenant isolation |
| isDeleted | boolean | Soft delete flag |

### GrcFieldMetadataTag

Join table for many-to-many relationship.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| fieldMetadataId | UUID | Reference to FieldMetadata |
| tagId | UUID | Reference to ClassificationTag |
| createdAt | timestamp | Creation timestamp |
| tenantId | UUID | Multi-tenant isolation |

## Tag Types

```typescript
enum ClassificationTagType {
  PRIVACY = 'privacy',
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
}
```

### Privacy Tags
- Personal Data
- Sensitive Personal Data
- PII (Personally Identifiable Information)
- PHI (Protected Health Information)

### Security Tags
- Confidential
- Internal
- Public
- Restricted

### Compliance Tags
- GDPR Relevant
- HIPAA Relevant
- PCI-DSS Scope
- SOX Relevant

## Default Tags

The system can seed default classification tags:

```typescript
const defaultTags = [
  { name: 'Personal Data', tagType: 'privacy', description: 'Contains personal information' },
  { name: 'Sensitive Personal Data', tagType: 'privacy', description: 'Special category personal data' },
  { name: 'Confidential', tagType: 'security', description: 'Confidential business information' },
  { name: 'Critical Asset Identifier', tagType: 'security', description: 'Identifies critical assets' },
  { name: 'GDPR Relevant', tagType: 'compliance', description: 'Subject to GDPR requirements' },
  { name: 'HIPAA Relevant', tagType: 'compliance', description: 'Subject to HIPAA requirements' },
];
```

## API Endpoints

### Field Metadata

#### List Fields
```
GET /metadata/fields
Query: ?tableName=&page=&pageSize=
```

#### Get Field
```
GET /metadata/fields/:id
```

#### Create Field
```
POST /metadata/fields
Body: { tableName, fieldName, label, description? }
```

#### Update Field
```
PATCH /metadata/fields/:id
Body: { label?, description? }
```

#### Delete Field
```
DELETE /metadata/fields/:id
```

#### Get Tables
```
GET /metadata/fields/tables
```
Returns list of distinct table names.

#### Get Field Tags
```
GET /metadata/fields/:id/tags
```

#### Assign Tag
```
POST /metadata/fields/:id/tags
Body: { tagId }
```

#### Remove Tag
```
DELETE /metadata/fields/:id/tags/:tagId
```

### Classification Tags

#### List Tags
```
GET /metadata/tags
Query: ?tagType=&page=&pageSize=
```

#### Get Tag
```
GET /metadata/tags/:id
```

#### Create Tag
```
POST /metadata/tags
Body: { name, tagType, description?, color? }
```

#### Update Tag
```
PATCH /metadata/tags/:id
Body: { name?, tagType?, description?, color? }
```

#### Delete Tag
```
DELETE /metadata/tags/:id
```

#### Get Fields by Tag
```
GET /metadata/tags/:id/fields
```

#### Seed Default Tags
```
POST /metadata/seed
```

## Service Layer

### MetadataService

Key methods:

```typescript
class MetadataService {
  // Field Metadata
  getFieldMetadata(tenantId, options): Promise<PaginatedResult<FieldMetadata>>
  createFieldMetadata(tenantId, data): Promise<FieldMetadata>
  updateFieldMetadata(tenantId, id, data): Promise<FieldMetadata>
  deleteFieldMetadata(tenantId, id): Promise<void>
  
  // Tags
  getTags(tenantId, options): Promise<PaginatedResult<ClassificationTag>>
  createTag(tenantId, data): Promise<ClassificationTag>
  updateTag(tenantId, id, data): Promise<ClassificationTag>
  deleteTag(tenantId, id): Promise<void>
  
  // Tag Assignment
  assignTag(tenantId, fieldId, tagId): Promise<void>
  removeTag(tenantId, fieldId, tagId): Promise<void>
  
  // Seeding
  seedDefaultTags(tenantId): Promise<ClassificationTag[]>
}
```

## Frontend Integration

### AdminMetadata Component

The `AdminMetadata` component provides:

- Two tabs: Field Metadata and Classification Tags
- Field list with table, field name, label, and assigned tags
- Tag management with create, edit, delete
- Tag assignment dialog with multi-select
- Seed Default Tags button

### Integration with Admin Panel

The Metadata management is accessible via a new "Metadata" tab in the Admin Panel.

## Use Cases

### Data Discovery
1. Import field metadata from database schema
2. Review fields and add descriptions
3. Assign classification tags based on data content

### Compliance Reporting
1. Query fields by tag (e.g., all "Personal Data" fields)
2. Generate data inventory reports
3. Support DPIA (Data Protection Impact Assessment)

### Access Control Integration (Future)
1. Use tags to determine field-level access
2. Mask sensitive fields based on user role
3. Audit access to classified data

## Security

- All endpoints require authentication
- GRC_ADMIN permission required for all operations
- Multi-tenant isolation via tenantId

## Future Enhancements

- Automatic schema discovery from database
- Data lineage tracking
- Field-level encryption based on tags
- Integration with data masking
- Compliance report generation
- Data retention policies based on classification
- API for external tools integration
