# Metadata Engine

The Metadata Engine provides a platform-wide system for creating custom metadata types, values, and tagging objects across the GRC platform. It enables flexible categorization and classification of requirements, policies, risks, findings, evidence, services, and audits.

## Overview

The Metadata Engine consists of three main components:
1. **Metadata Types** - Categories of metadata (e.g., "Priority", "Compliance Domain", "Risk Category")
2. **Metadata Values** - Specific values within a type (e.g., "High", "Medium", "Low" for Priority)
3. **Object Metadata** - Assignments linking metadata values to platform objects

## Database Schema

### metadata_types

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| name | string | Unique type name |
| description | text | Optional description |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |

### metadata_values

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| type_id | uuid | Foreign key to metadata_types |
| value | string | The metadata value |
| color | string | Optional hex color code for UI display |
| description | text | Optional description |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |

### object_metadata

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| object_type | enum | Type of object (requirement, policy, risk, finding, evidence, service, audit) |
| object_id | uuid | ID of the tagged object |
| metadata_value_id | uuid | Foreign key to metadata_values |
| created_at | timestamp | Creation timestamp |

Unique constraint on (object_type, object_id, metadata_value_id) prevents duplicate assignments.

## API Endpoints

### Metadata Types

#### List Types
```
GET /api/platform/metadata/types
```

#### Get Type by ID
```
GET /api/platform/metadata/types/:id
```

#### Create Type (Admin only)
```
POST /api/platform/metadata/types
Content-Type: application/json

{
  "name": "Priority",
  "description": "Task priority level"
}
```

#### Update Type (Admin only)
```
PUT /api/platform/metadata/types/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

#### Delete Type (Admin only)
```
DELETE /api/platform/metadata/types/:id
```

### Metadata Values

#### List All Values
```
GET /api/platform/metadata/values
```

#### List Values for Type
```
GET /api/platform/metadata/types/:typeId/values
```

#### Create Value (Admin only)
```
POST /api/platform/metadata/types/:typeId/values
Content-Type: application/json

{
  "value": "High",
  "color": "#ff0000",
  "description": "High priority items"
}
```

#### Update Value (Admin only)
```
PUT /api/platform/metadata/values/:id
Content-Type: application/json

{
  "value": "Critical",
  "color": "#cc0000"
}
```

#### Delete Value (Admin only)
```
DELETE /api/platform/metadata/values/:id
```

### Object Metadata Assignments

#### Assign Metadata (Admin/Manager)
```
POST /api/platform/metadata/assign
Content-Type: application/json

{
  "objectType": "requirement",
  "objectId": "uuid-of-requirement",
  "metadataValueId": "uuid-of-metadata-value"
}
```

#### Get Assigned Metadata
```
GET /api/platform/metadata/assigned/:objectType/:objectId
```

#### Remove Assignment
```
DELETE /api/platform/metadata/assigned/:id
```

#### Remove by Object and Value
```
DELETE /api/platform/metadata/assigned/:objectType/:objectId/:metadataValueId
```

### Statistics

#### Get Metadata Statistics
```
GET /api/platform/metadata/stats
```

Returns counts of types, values, and assignments.

## Access Control

The Metadata Engine enforces role-based access control:

| Operation | Required Role |
|-----------|---------------|
| View types/values | Any authenticated user |
| Create/update/delete types | Admin |
| Create/update/delete values | Admin |
| Assign metadata to objects | Admin or Manager |
| Remove metadata assignments | Admin or Manager |

## Default Metadata Types

The migration script seeds the following default metadata types and values:

### Compliance Domain
- Security (blue)
- Privacy (purple)
- Quality (green)
- IT Service (orange)
- Governance (gray)

### Priority
- Critical (red)
- High (orange)
- Medium (yellow)
- Low (green)

### Status Tag
- Active
- Deprecated
- Under Review
- Archived

## Service Layer

The `MetadataService` (`/backend/services/MetadataService.js`) provides business logic:

```javascript
const MetadataService = require('./services/MetadataService');

// Get all types
const types = await MetadataService.getTypes();

// Create a new type
const newType = await MetadataService.createType({
  name: 'Custom Type',
  description: 'My custom metadata type'
});

// Assign metadata to an object
await MetadataService.assignMetadata(
  'requirement',
  'requirement-uuid',
  'metadata-value-uuid'
);

// Get metadata for an object
const metadata = await MetadataService.getAssignedMetadata(
  'requirement',
  'requirement-uuid'
);
```

## Frontend Integration

The Metadata Engine integrates with the frontend through:

1. **Admin Panel** - Manage metadata types and values
2. **Object Detail Pages** - View and assign metadata tags
3. **Filter Components** - Filter lists by metadata values

### API Client

```typescript
import { platformMetadataApi } from '../services/grcClient';

// Get all types
const types = await platformMetadataApi.getTypes();

// Create a value
await platformMetadataApi.createValue(typeId, {
  value: 'New Value',
  color: '#0000ff'
});

// Assign to object
await platformMetadataApi.assignMetadata(
  'requirement',
  requirementId,
  metadataValueId
);
```

## Best Practices

1. **Consistent Naming** - Use clear, descriptive names for types and values
2. **Color Coding** - Assign meaningful colors for visual identification
3. **Avoid Duplication** - Check for existing types before creating new ones
4. **Regular Cleanup** - Remove unused metadata values periodically
5. **Documentation** - Add descriptions to types and values for clarity

## Integration Points

The Metadata Engine integrates with:
- **Standards Library** - Tag requirements with compliance domains
- **Risk Management** - Categorize risks by type and priority
- **Policy Management** - Classify policies by domain
- **Audit Management** - Tag audits and findings
- **Metrics Dashboard** - Aggregate statistics by metadata tags
