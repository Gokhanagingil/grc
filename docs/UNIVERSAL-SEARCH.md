# Universal Search Framework

This document explains how to enable Universal Search for new entities and tables in the GRC Platform.

## Overview

Universal Search is a platform-level feature that provides consistent search functionality across all list endpoints. It uses case-insensitive ILIKE queries to search across configured columns for each entity.

## Backend Implementation

### Step 1: Define the List Configuration

Create a configuration object that defines searchable columns, sortable fields, and filters for your entity:

```typescript
import { UniversalListConfig } from '../../common';

const MY_ENTITY_LIST_CONFIG: UniversalListConfig = {
  searchableColumns: [
    { column: 'name' },
    { column: 'code' },
    { column: 'description' },
  ],
  sortableFields: [
    { field: 'createdAt' },
    { field: 'updatedAt' },
    { field: 'name' },
  ],
  filters: [
    {
      field: 'status',
      type: 'enum',
      enumValues: ['active', 'inactive', 'archived'],
      caseInsensitive: true,
    },
    { field: 'category', type: 'string' },
    { field: 'ownerUserId', type: 'uuid' },
  ],
  defaultSort: { field: 'createdAt', direction: 'DESC' },
};
```

### Step 2: Inject UniversalListService

Add the `UniversalListService` to your service or controller:

```typescript
import { UniversalListService, ListQueryDto, ListResponse } from '../../common';

@Injectable()
export class MyEntityService {
  constructor(
    @InjectRepository(MyEntity)
    private readonly repository: Repository<MyEntity>,
    private readonly universalListService: UniversalListService,
  ) {}
}
```

### Step 3: Implement the List Method

Use the `UniversalListService` to execute list queries:

```typescript
async findWithFilters(
  tenantId: string,
  query: ListQueryDto,
  filters?: Record<string, unknown>,
): Promise<ListResponse<MyEntity>> {
  const alias = 'entity';
  const qb = this.repository.createQueryBuilder(alias);

  // Apply tenant isolation
  this.universalListService.applyTenantFilter(qb, tenantId, alias);

  // Apply soft delete filter
  this.universalListService.applySoftDeleteFilter(qb, alias);

  // Execute the list query with search, pagination, sorting, and filtering
  return this.universalListService.executeListQuery(
    qb,
    query,
    MY_ENTITY_LIST_CONFIG,
    alias,
    filters,
  );
}
```

### Step 4: Create the Controller Endpoint

Create a controller endpoint that accepts `ListQueryDto`:

```typescript
import { ListQueryDto, ListResponse, createListResponse } from '../../common';

@Controller('grc/my-entities')
export class MyEntityController {
  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  async list(
    @Headers('x-tenant-id') tenantId: string,
    @Query() query: ListQueryDto,
  ): Promise<{ success: boolean; data: ListResponse<MyEntity> }> {
    const result = await this.myEntityService.findWithFilters(tenantId, query);
    return { success: true, data: result };
  }
}
```

## Configuration Options

### UniversalListConfig

| Property | Type | Description |
|----------|------|-------------|
| `searchableColumns` | `SearchableColumn[]` | Columns to search across with ILIKE |
| `sortableFields` | `SortableField[]` | Fields that can be sorted |
| `filters` | `FilterConfig[]` | Entity-specific filter definitions |
| `defaultSort` | `{ field: string; direction: 'ASC' \| 'DESC' }` | Default sort when none specified |

### SearchableColumn

| Property | Type | Description |
|----------|------|-------------|
| `column` | `string` | Column name in the entity |
| `alias` | `string` (optional) | Custom alias for joined tables |

### FilterConfig

| Property | Type | Description |
|----------|------|-------------|
| `field` | `string` | Field name to filter on |
| `type` | `'string' \| 'enum' \| 'uuid' \| 'boolean' \| 'number' \| 'date'` | Filter type |
| `enumValues` | `string[]` (optional) | Allowed values for enum filters |
| `caseInsensitive` | `boolean` (optional) | Whether to match case-insensitively |

## ListQueryDto Parameters

The `ListQueryDto` class handles all standard list query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `pageSize` | number | 20 | Items per page (max 100) |
| `limit` | number | - | Alias for pageSize |
| `search` | string | - | Text search across searchable columns |
| `q` | string | - | Legacy alias for search |
| `sort` | string | - | Sort in `field:direction` format |
| `sortBy` | string | - | Legacy sort field |
| `sortOrder` | string | - | Legacy sort direction |

## Frontend Implementation

### Using useUniversalList Hook

The `useUniversalList` hook provides a complete solution for list pages:

```typescript
import { useUniversalList } from '../hooks/useUniversalList';
import { myEntityApi } from '../services/grcClient';

function MyEntityList() {
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const {
    items,
    total,
    page,
    pageSize,
    totalPages,
    search,
    isLoading,
    error,
    setPage,
    setPageSize,
    setSearch,
    refetch,
  } = useUniversalList({
    fetchFn: (params) => myEntityApi.list(tenantId, params),
    defaultPageSize: 10,
    syncToUrl: true,
    enabled: !!tenantId,
  });

  // Render your list...
}
```

### Using GenericListPage Component

For a complete list page with minimal code:

```typescript
import { GenericListPage, ColumnDefinition } from '../components/common';
import { useUniversalList } from '../hooks/useUniversalList';

const columns: ColumnDefinition<MyEntity>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'status', header: 'Status', render: (item) => <Chip label={item.status} /> },
  // ... more columns
];

function MyEntityList() {
  const listState = useUniversalList({ /* ... */ });

  return (
    <GenericListPage
      title="My Entities"
      items={listState.items}
      columns={columns}
      total={listState.total}
      page={listState.page}
      pageSize={listState.pageSize}
      isLoading={listState.isLoading}
      error={listState.error}
      search={listState.search}
      onPageChange={listState.setPage}
      onPageSizeChange={listState.setPageSize}
      onSearchChange={listState.setSearch}
      onRefresh={listState.refetch}
      getRowKey={(item) => item.id}
      searchPlaceholder="Search entities..."
    />
  );
}
```

## Best Practices

1. **Always include tenant isolation**: Use `applyTenantFilter()` to ensure multi-tenant data separation
2. **Exclude soft-deleted records**: Use `applySoftDeleteFilter()` unless explicitly including deleted items
3. **Validate filter values**: Use enum filters with `enumValues` to validate input
4. **Use case-insensitive search**: The framework uses ILIKE for case-insensitive matching
5. **Define sensible defaults**: Set `defaultSort` to ensure consistent ordering
6. **Limit searchable columns**: Only include columns that make sense for text search
7. **Sync to URL**: Enable `syncToUrl` in the frontend hook for shareable URLs

## Testing

### Unit Tests

Test the `ListQueryDto` methods:

```typescript
describe('ListQueryDto', () => {
  it('should parse sort parameter', () => {
    const dto = new ListQueryDto();
    dto.sort = 'name:ASC';
    expect(dto.getEffectiveSort()).toEqual({ field: 'name', direction: 'ASC' });
  });
});
```

### E2E Tests

Test the endpoint with search and pagination:

```typescript
it('should search entities', async () => {
  const response = await request(app.getHttpServer())
    .get('/grc/my-entities?search=test')
    .set('Authorization', `Bearer ${token}`)
    .set('x-tenant-id', tenantId)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.items).toBeDefined();
});
```

## Migration Guide

To migrate an existing list endpoint to use Universal Search:

1. Create a `UniversalListConfig` for your entity
2. Inject `UniversalListService` into your service
3. Replace custom query building with `executeListQuery()`
4. Update the controller to use `ListQueryDto`
5. Ensure the response follows LIST-CONTRACT format
6. Add E2E tests for search functionality

---

*Last updated: January 2026*
