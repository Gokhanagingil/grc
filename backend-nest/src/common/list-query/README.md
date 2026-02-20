# Universal List Query System

A platform-level capability for advanced filtering and quick search across all list endpoints.

## Overview

The list-query system provides:
- **Quick Search**: Row-level text search across configurable columns
- **Advanced Filter Builder**: Complex filter conditions with AND/OR groups
- **Type-safe validation**: Operator-type compatibility enforcement
- **Security**: Strict allowlists, parameter binding, no dynamic SQL

## Query Parameters

### Quick Search (`q`)
Simple text search across searchable columns (name, code, description).

```bash
# Search for controls containing "access"
curl -H "x-tenant-id: <tenant-id>" \
     -H "Authorization: Bearer <token>" \
     "http://localhost:3002/grc/controls?q=access"
```

**Constraints:**
- Maximum length: 120 characters
- Case-insensitive ILIKE matching
- Searches across configured searchable columns

### Advanced Filter (`filter`)
URI-encoded JSON filter tree for complex conditions.

**Filter JSON Schema:**
```json
// Single condition
{ "field": "status", "op": "is", "value": "draft" }

// AND group
{
  "and": [
    { "field": "status", "op": "is", "value": "implemented" },
    { "field": "name", "op": "contains", "value": "access" }
  ]
}

// OR group
{
  "or": [
    { "field": "status", "op": "is", "value": "draft" },
    { "field": "status", "op": "is", "value": "in_design" }
  ]
}

// Nested groups
{
  "and": [
    { "field": "type", "op": "is", "value": "preventive" },
    {
      "or": [
        { "field": "status", "op": "is", "value": "draft" },
        { "field": "status", "op": "is", "value": "implemented" }
      ]
    }
  ]
}
```

**Example Requests:**

```bash
# Filter by status
curl -H "x-tenant-id: <tenant-id>" \
     -H "Authorization: Bearer <token>" \
     "http://localhost:3002/grc/controls?filter=%7B%22field%22%3A%22status%22%2C%22op%22%3A%22is%22%2C%22value%22%3A%22implemented%22%7D"

# Filter by date (controls created after 2024-01-01)
curl -H "x-tenant-id: <tenant-id>" \
     -H "Authorization: Bearer <token>" \
     "http://localhost:3002/grc/controls?filter=%7B%22field%22%3A%22createdAt%22%2C%22op%22%3A%22after%22%2C%22value%22%3A%222024-01-01%22%7D"

# Combined quick search and filter
curl -H "x-tenant-id: <tenant-id>" \
     -H "Authorization: Bearer <token>" \
     "http://localhost:3002/grc/controls?q=access&filter=%7B%22field%22%3A%22status%22%2C%22op%22%3A%22is%22%2C%22value%22%3A%22implemented%22%7D"

# Multiple conditions with AND
curl -H "x-tenant-id: <tenant-id>" \
     -H "Authorization: Bearer <token>" \
     "http://localhost:3002/grc/controls?filter=%7B%22and%22%3A%5B%7B%22field%22%3A%22status%22%2C%22op%22%3A%22is%22%2C%22value%22%3A%22implemented%22%7D%2C%7B%22field%22%3A%22type%22%2C%22op%22%3A%22is%22%2C%22value%22%3A%22preventive%22%7D%5D%7D"

# Filter for empty description
curl -H "x-tenant-id: <tenant-id>" \
     -H "Authorization: Bearer <token>" \
     "http://localhost:3002/grc/controls?filter=%7B%22field%22%3A%22description%22%2C%22op%22%3A%22is_empty%22%7D"
```

## Supported Operators

| Operator | Description | Supported Types |
|----------|-------------|-----------------|
| `is` | Equals | string, number, date, enum, boolean, uuid |
| `is_not` | Not equals | string, number, date, enum, boolean, uuid |
| `is_empty` | Is null or empty string | string, number, date, enum, uuid |
| `is_not_empty` | Is not null and not empty | string, number, date, enum, uuid |
| `contains` | Contains substring (case-insensitive) | string |
| `not_contains` | Does not contain substring | string |
| `after` | Greater than (for dates) | date |
| `before` | Less than (for dates) | date |
| `gt` | Greater than | number, date |
| `lt` | Less than | number, date |
| `gte` | Greater than or equal | number, date |
| `lte` | Less than or equal | number, date |

## Controls Endpoint Fields

The following fields are available for filtering on the Controls list endpoint:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Control name |
| `code` | string | Control code |
| `description` | string | Control description |
| `status` | enum | draft, in_design, implemented, inoperative, retired |
| `type` | enum | preventive, detective, corrective |
| `implementationType` | enum | manual, automated, it_dependent |
| `frequency` | enum | continuous, daily, weekly, monthly, quarterly, annual |
| `createdAt` | date | Creation timestamp |
| `updatedAt` | date | Last update timestamp |
| `effectiveDate` | date | Effective date |
| `lastTestedDate` | date | Last test date |
| `nextTestDate` | date | Next scheduled test date |
| `ownerUserId` | uuid | Owner user ID |
| `lastTestResult` | string | Last test result |

## Security Constraints

- **Max filter length**: 4000 characters
- **Max filter depth**: 5 levels of nesting
- **Max conditions**: 30 conditions per filter
- **Max quick search length**: 120 characters
- **Field allowlist**: Only explicitly allowed fields can be filtered
- **Operator validation**: Operators must be compatible with field types
- **Enum validation**: Enum values are validated against allowed values
- **Parameter binding**: All values use TypeORM parameter binding (no SQL injection)

## Error Responses

Invalid filters return HTTP 400 with a descriptive error message:

```json
{
  "statusCode": 400,
  "message": "Invalid filter: Unknown field 'invalidField'. Allowed fields: name, code, status, ...",
  "error": "Bad Request"
}
```

## Adding to Other Entities

To add advanced filtering to another entity:

1. Create an allowlist in `list-query.allowlist.ts`:
```typescript
export const MY_ENTITY_ALLOWLIST = createAllowlist(
  'MyEntity',
  [
    { name: 'name', type: 'string' },
    { name: 'status', type: 'enum', enumValues: ['active', 'inactive'], caseInsensitive: true },
    { name: 'createdAt', type: 'date' },
  ],
  [], // Optional dot-walk paths
);
```

2. Update the controller to accept the `filter` parameter and apply it:
```typescript
import { parseFilterJson, validateFilterAgainstAllowlist, applyFilterTree, MY_ENTITY_ALLOWLIST } from '../../common';

@Get()
async findAll(@Query('filter') filterJson?: string) {
  // ... existing code ...
  
  if (filterJson) {
    const decodedFilter = decodeURIComponent(filterJson);
    const parsedFilter = parseFilterJson(decodedFilter);
    validateFilterAgainstAllowlist(parsedFilter.tree, MY_ENTITY_ALLOWLIST);
    applyFilterTree(queryBuilder, parsedFilter.tree, MY_ENTITY_ALLOWLIST, 'alias');
  }
  
  // ... rest of query execution ...
}
```

3. Create a frontend filter config and wire up the AdvancedFilterBuilder component.
