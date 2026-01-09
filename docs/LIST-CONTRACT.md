# List Contract Specification

This document defines the standard contract for list endpoints in the GRC Platform. All list endpoints should follow this contract to ensure consistency across the platform and enable reuse for future list pages and admin-created tables.

## Query Parameters

### Pagination

All list endpoints support pagination with the following parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `limit` | number | 20 | Number of items per page |
| `pageSize` | number | 20 | Alias for `limit` (for backward compatibility) |

### Sorting

Sorting can be specified in two ways:

**Standard format (preferred):**
| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `sort` | string | `createdAt:DESC` | Field and direction in `field:dir` format |

**Legacy format (supported for backward compatibility):**
| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `sortBy` | string | `createdAt` | Field to sort by |
| `sortOrder` | string | `DESC` | Sort direction (`ASC` or `DESC`) |

### Text Search

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Text search across relevant fields (name, code, description, etc.) |
| `q` | string | Legacy alias for `search` (deprecated, use `search` instead) |

### Entity-Specific Filters

Each endpoint may define additional whitelisted filters specific to the entity type. These filters should:

1. Accept case-insensitive input (e.g., `IMPLEMENTED` and `implemented` are equivalent)
2. Return HTTP 400 with a helpful message listing allowed values if an invalid value is provided

## Response Format

All list endpoints return a standardized response envelope:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `items` | array | Array of entity objects |
| `total` | number | Total number of items matching the query (before pagination) |
| `page` | number | Current page number |
| `pageSize` | number | Number of items per page |
| `totalPages` | number | Total number of pages |

## Error Responses

### Invalid Filter Value (HTTP 400)

When an invalid filter value is provided:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid status value: 'invalid'. Allowed values: draft, in_design, implemented, inoperative, retired"
  }
}
```

### Unauthorized (HTTP 401)

When authentication is missing or invalid:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Missing Tenant (HTTP 400)

When the `x-tenant-id` header is missing:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "x-tenant-id header is required"
  }
}
```

## Reference Implementation: Controls Endpoint

The `/grc/controls` endpoint serves as the reference implementation for the List Contract.

### Endpoint

```
GET /api/grc/controls
```

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token for authentication |
| `x-tenant-id` | Yes | Tenant UUID for multi-tenant isolation |

### Query Parameters

Standard List Contract parameters plus:

| Parameter | Type | Allowed Values | Description |
|-----------|------|----------------|-------------|
| `status` | string | `draft`, `in_design`, `implemented`, `inoperative`, `retired` | Filter by control status |
| `type` | string | `preventive`, `detective`, `corrective` | Filter by control type |
| `requirementId` | UUID | - | Filter controls linked to a specific requirement |
| `processId` | UUID | - | Filter controls linked to a specific process |
| `unlinked` | string | `true` | Return only controls with no requirement or process links |

### Example Requests

**Basic list with pagination:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     "http://localhost/api/grc/controls?page=1&limit=10"
```

**With status filter (case-insensitive):**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     "http://localhost/api/grc/controls?status=IMPLEMENTED"
# Also works: ?status=implemented
```

**With text search:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     "http://localhost/api/grc/controls?search=access"
```

**With sorting:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     "http://localhost/api/grc/controls?sort=name:ASC"
```

### Example Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "tenantId": "00000000-0000-0000-0000-000000000001",
        "name": "Access Control Review",
        "code": "CTRL-001",
        "description": "Quarterly review of access controls",
        "type": "detective",
        "implementationType": "manual",
        "status": "implemented",
        "frequency": "quarterly",
        "ownerUserId": "...",
        "owner": { "id": "...", "email": "admin@example.com" },
        "effectiveDate": "2024-01-01",
        "lastTestedDate": "2024-10-15",
        "nextTestDate": "2025-01-15",
        "lastTestResult": "PASS",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-10-15T00:00:00.000Z",
        "isDeleted": false
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

## Frontend Implementation Guidelines

### Using the Search Input

All list pages should include a search input that uses the `search` query parameter:

```typescript
const params: Record<string, unknown> = {
  page: page + 1,
  pageSize: rowsPerPage,
};

if (searchQuery) {
  params.search = searchQuery;  // Use 'search', not 'q'
}

const response = await controlApi.list(tenantId, params);
```

### Handling Auth State

List pages must wait for authentication to be ready before making API calls:

```typescript
const { user, loading: authLoading } = useAuth();
const tenantId = user?.tenantId || '';

const fetchData = useCallback(async () => {
  // Wait for auth to be ready before making API calls
  if (authLoading || !tenantId) {
    return;
  }
  
  // ... fetch data
}, [authLoading, tenantId, /* other deps */]);
```

### Filter Validation

When implementing filters, use the enum values defined in the frontend:

```typescript
export enum ControlStatus {
  DRAFT = 'draft',
  IN_DESIGN = 'in_design',
  IMPLEMENTED = 'implemented',
  INOPERATIVE = 'inoperative',
  RETIRED = 'retired',
}
```

The backend accepts both lowercase and uppercase values and normalizes them automatically.

## Extending to New Endpoints

When creating a new list endpoint:

1. Accept all standard List Contract parameters (`page`, `limit`, `sort`, `search`)
2. Define entity-specific filters with case-insensitive validation
3. Return the standard response envelope with pagination metadata
4. Document allowed filter values in the endpoint's JSDoc comments
5. Add the endpoint to this document's "Compliant Endpoints" section

## Compliant Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /grc/controls` | Reference Implementation | Full List Contract support with UniversalListService |
| `GET /grc/risks` | Compliant | Full List Contract support |
| `GET /grc/policies` | Compliant | Full List Contract support |
| `GET /grc/requirements` | Compliant | Full List Contract support |

## Backend Framework

The List Contract is implemented using the `UniversalListService` and `ListQueryDto` classes in the backend:

- `ListQueryDto`: Shared DTO for parsing and validating list query parameters
- `UniversalListService`: Shared service for applying search, pagination, sorting, filtering, tenant isolation, and soft-delete exclusion
- `createListResponse()`: Helper function to create LIST-CONTRACT compliant responses

See `docs/UNIVERSAL-SEARCH.md` for details on how to enable search for new entities.

## Frontend Framework

The frontend provides reusable components for consuming LIST-CONTRACT endpoints:

- `useUniversalList` hook: Manages list state, pagination, search, and sorting with URL sync
- `GenericListPage` component: Reusable list page with search, pagination, and table rendering

## Quick Enable Checklist

When adding a new list page with Universal Search, follow these steps:

### Backend (3 steps)

1. **Define UniversalListConfig** - Create a config object with `searchableColumns`, `sortableFields`, `filters`, and `defaultSort`
2. **Use UniversalListService** - Inject the service and call `executeListQuery()` with tenant isolation and soft-delete filters
3. **Return LIST-CONTRACT format** - Ensure response is `{ success: true, data: { items, total, page, pageSize, totalPages } }`

### Frontend (3 steps)

1. **Use useUniversalList hook** - Pass `fetchFn`, `enabled: !!tenantId`, and `syncToUrl: true`
2. **Use GenericListPage component** - Pass all list state from the hook plus column definitions
3. **Handle filters via URL** - Read filters from `useSearchParams()` and pass as `additionalFilters` to the hook

### Validation

- `GET /api/grc/{entity}` returns 200 with LIST-CONTRACT format
- `GET /api/grc/{entity}?status=INVALID` returns 400 with allowed values
- Unauthenticated request returns 401 (not 404)
- Search box visible by default on the list page
- URL sync works (refresh preserves filters/search/pagination)

---

*Last updated: January 2026*
