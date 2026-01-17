# List Query Contract

This document describes the platform-wide standard for list endpoints, including query parameters, filter tree JSON schema, encoding rules, and response envelope format.

## Query Parameters

All list endpoints accept the following query parameters consistently:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `pageSize` | number | 10 | Number of items per page |
| `sort` | string | `createdAt:DESC` | Sort field and direction (format: `field:ASC\|DESC`) |
| `q` | string | - | Quick search string (searches across entity-specific fields) |
| `filter` | string | - | Advanced filter tree in JSON format (single-encoded in URL) |

### Example Request

```
GET /api/grc/issues?page=1&pageSize=10&sort=createdAt:DESC&q=security&filter=%7B%22and%22%3A%5B%7B%22field%22%3A%22status%22%2C%22op%22%3A%22is%22%2C%22value%22%3A%22open%22%7D%5D%7D
```

## Filter Tree JSON Schema

The filter parameter accepts a JSON tree structure supporting AND/OR groups with conditions.

### Canonical Format (Recommended)

The canonical format uses `and` and `or` keys directly:

```json
{ "and": [...] }
{ "or": [...] }
```

### Legacy Format (Backward Compatible)

For backward compatibility, the following legacy format is also accepted:

```json
{ "op": "and", "children": [...] }
{ "op": "or", "children": [...] }
```

The backend automatically normalizes legacy format to canonical format before validation.

### Filter Condition

A single filter condition has the following structure:

```typescript
interface FilterCondition {
  field: string;    // Field name (must be in entity allowlist)
  op: FilterOperator;  // Operator
  value?: string | number | boolean;  // Value (optional for is_empty/is_not_empty)
}
```

### Filter Tree

Filter conditions can be combined using AND/OR groups:

```typescript
type FilterTree = 
  | FilterCondition
  | { and: FilterTree[] }
  | { or: FilterTree[] };
```

### Supported Operators

| Operator | Description | Applicable Types |
|----------|-------------|------------------|
| `is` | Exact match | string, enum, boolean, number, uuid |
| `is_not` | Not equal | string, enum, boolean, number, uuid |
| `is_empty` | Field is null/empty | all types |
| `is_not_empty` | Field is not null/empty | all types |
| `contains` | Contains substring (case-insensitive) | string |
| `not_contains` | Does not contain substring | string |
| `after` | Date is after | date |
| `before` | Date is before | date |
| `gt` | Greater than | number, date |
| `lt` | Less than | number, date |
| `gte` | Greater than or equal | number, date |
| `lte` | Less than or equal | number, date |

### Filter Examples

**Single condition:**
```json
{
  "field": "status",
  "op": "is",
  "value": "open"
}
```

**Multiple conditions (AND):**
```json
{
  "and": [
    { "field": "status", "op": "is", "value": "open" },
    { "field": "severity", "op": "is", "value": "high" }
  ]
}
```

**Multiple conditions (OR):**
```json
{
  "or": [
    { "field": "status", "op": "is", "value": "open" },
    { "field": "status", "op": "is", "value": "in_progress" }
  ]
}
```

**Nested groups:**
```json
{
  "and": [
    { "field": "severity", "op": "is", "value": "critical" },
    {
      "or": [
        { "field": "status", "op": "is", "value": "open" },
        { "field": "status", "op": "is", "value": "in_progress" }
      ]
    }
  ]
}
```

**Empty check:**
```json
{
  "field": "dueDate",
  "op": "is_empty"
}
```

**Date range:**
```json
{
  "and": [
    { "field": "createdAt", "op": "after", "value": "2024-01-01" },
    { "field": "createdAt", "op": "before", "value": "2024-12-31" }
  ]
}
```

## Encoding Rules

### Single-Encode Rule

The filter JSON must be single-encoded in the URL. Do NOT double-encode.

**Correct (single-encoded):**
```
filter=%7B%22field%22%3A%22status%22%7D
```

**Incorrect (double-encoded):**
```
filter=%257B%2522field%2522%253A%2522status%2522%257D
```

### Frontend Implementation

When using axios or fetch, pass the filter as a params object and let the library handle encoding:

```typescript
// Correct - let axios handle encoding
const params = {
  page: 1,
  pageSize: 10,
  filter: JSON.stringify(filterTree)
};
axios.get('/api/grc/issues', { params });

// Incorrect - manual encoding causes double-encode
const params = {
  filter: encodeURIComponent(JSON.stringify(filterTree))
};
```

### URL State Synchronization

When syncing filter state to URL:

```typescript
// Correct - single encode
const url = new URL(window.location.href);
url.searchParams.set('filter', JSON.stringify(filterTree));

// Reading from URL - decode once
const filterStr = url.searchParams.get('filter');
const filterTree = filterStr ? JSON.parse(filterStr) : null;
```

## Response Envelope

All list endpoints return responses in the platform envelope format:

```typescript
interface ListResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-1",
        "title": "Security Issue",
        "status": "open",
        "severity": "high",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 10,
    "totalPages": 5
  }
}
```

## Error Handling

### Invalid Sort Field

Returns 400 Bad Request:

```json
{
  "success": false,
  "error": {
    "message": "Invalid sort field: invalidField",
    "code": "INVALID_SORT_FIELD"
  }
}
```

### Invalid Filter JSON

Returns 400 Bad Request:

```json
{
  "success": false,
  "error": {
    "message": "Invalid filter JSON",
    "details": "Unexpected token at position 5"
  }
}
```

### Invalid Filter Field

Returns 400 Bad Request:

```json
{
  "success": false,
  "error": {
    "message": "Invalid filter",
    "errors": [
      "Field 'invalidField' is not allowed for filtering"
    ]
  }
}
```

## Security

### Field Allowlists

Each entity has a defined allowlist of fields that can be used for sorting and filtering. This prevents SQL injection and unauthorized data access.

**Issue Allowlist:**
- title, description, status, severity, type, dueDate, createdAt, updatedAt

**CAPA Allowlist:**
- title, description, status, priority, dueDate, createdAt, updatedAt

**Evidence Allowlist:**
- name, description, type, sourceType, status, createdAt, updatedAt

### Tenant Isolation

All list queries are automatically scoped to the current tenant using the `x-tenant-id` header. Cross-tenant data access is prevented at the query level.

## Frontend Framework Adoption Guide

### Step 1: Import the useListData Hook

```typescript
import { useListData } from '../hooks/useListData';
```

### Step 2: Define Filter Configuration

```typescript
import { FilterConfig } from '../components/common/AdvancedFilter/types';

const ENTITY_FILTER_CONFIG: FilterConfig = {
  fields: [
    { name: 'title', label: 'Title', type: 'string' },
    { 
      name: 'status', 
      label: 'Status', 
      type: 'enum',
      enumValues: ['open', 'closed'],
      enumLabels: { open: 'Open', closed: 'Closed' }
    },
    { name: 'createdAt', label: 'Created At', type: 'date' },
  ],
  maxConditions: 10,
};
```

### Step 3: Use the Hook in Your Component

```typescript
const {
  items,
  total,
  state,
  isLoading,
  error,
  setPage,
  setPageSize,
  setSearch,
  setFilterTree,
  refetch,
  hasActiveFilter,
  filterConditionCount,
  clearFilterWithNotification,
} = useListData<YourEntityType>({
  fetchFn: (params) => yourApi.list(tenantId, params),
  defaultPageSize: 10,
  defaultSort: 'createdAt:DESC',
  syncToUrl: true,
  enabled: isAuthReady,
  entityName: 'your-entities',
});
```

### Step 4: Add the AdvancedFilterBuilder to Your Toolbar

```typescript
import { AdvancedFilterBuilder } from '../components/common/AdvancedFilter/AdvancedFilterBuilder';

const toolbarActions = (
  <Box display="flex" gap={1}>
    <AdvancedFilterBuilder
      config={ENTITY_FILTER_CONFIG}
      initialFilter={state.filterTree}
      onApply={setFilterTree}
      onClear={clearFilterWithNotification}
      activeFilterCount={filterConditionCount}
    />
    {/* Other toolbar actions */}
  </Box>
);
```

### Step 5: Pass State to GenericListPage

```typescript
<GenericListPage
  items={items}
  total={total}
  page={state.page}
  pageSize={state.pageSize}
  search={state.q}
  isLoading={isLoading}
  error={error}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
  onSearchChange={setSearch}
  onRefresh={refetch}
  toolbarActions={toolbarActions}
  // ... other props
/>
```

## Verification Checklist

When implementing or testing list functionality:

1. Login to the application
2. Navigate to the list page (e.g., Issues, CAPAs)
3. Verify search works with debounce (300-500ms)
4. Verify filter builder opens and allows adding conditions
5. Apply a filter and verify URL contains single-encoded filter JSON
6. Refresh the page and verify filter persists from URL
7. Verify invalid filter shows toast notification and clears filter
8. Verify pagination works correctly
9. Verify sort by clicking column headers or using dropdown
10. Verify empty state shows appropriate message
