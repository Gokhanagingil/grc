# Unified List Framework v1

This document describes the unified list framework for GRC frontend list pages. The framework provides a consistent mechanism for pagination, sorting, search, filtering, and URL state synchronization across all list pages.

## Overview

The unified list framework consists of:

1. **Query/State Utilities** (`src/utils/listQueryUtils.ts`) - Core functions for parsing, building, and normalizing list query parameters
2. **React Hooks** (`src/hooks/useListQueryState.ts`, `src/hooks/useUniversalList.ts`) - Hooks for managing list state with URL synchronization
3. **UI Components** (`src/components/common/ListToolbar.tsx`, `src/components/common/FilterBuilderBasic.tsx`) - Reusable toolbar and filter builder components
4. **Saved Views** (`src/components/common/SavedViewsDropdown.tsx`) - Component for managing saved list views

## Canonical Query Parameters

All list pages use these standardized URL query parameters:

| Parameter | Format | Example | Description |
|-----------|--------|---------|-------------|
| `page` | number | `page=2` | Current page number (1-based) |
| `pageSize` | number | `pageSize=25` | Items per page |
| `search` | string | `search=test` | Quick search query |
| `sort` | `field:ASC\|DESC` | `sort=createdAt:DESC` | Sort field and direction |
| `filter` | JSON | `filter={"and":[...]}` | Advanced filter tree |

## Filter Tree Schema

The filter tree uses a recursive structure supporting AND/OR groups:

```typescript
// Single condition
interface FilterCondition {
  field: string;      // Field name to filter on
  op: FilterOperator; // Operator (see below)
  value?: string;     // Value to compare (optional for is_empty/is_not_empty)
}

// Filter tree (AND or OR group)
type FilterTree = 
  | { and: (FilterCondition | FilterTree)[] }
  | { or: (FilterCondition | FilterTree)[] };
```

### Supported Operators

| Operator | Description | Requires Value |
|----------|-------------|----------------|
| `contains` | String contains value | Yes |
| `not_contains` | String does not contain value | Yes |
| `is` | Exact match (equals) | Yes |
| `is_not` | Not equal | Yes |
| `is_empty` | Field is empty/null | No |
| `is_not_empty` | Field is not empty/null | No |
| `starts_with` | String starts with value | Yes |
| `ends_with` | String ends with value | Yes |
| `gt` | Greater than (numbers) | Yes |
| `gte` | Greater than or equal | Yes |
| `lt` | Less than | Yes |
| `lte` | Less than or equal | Yes |
| `after` | Date is after value | Yes |
| `before` | Date is before value | Yes |

### Filter Examples

Simple filter (single condition wrapped in AND):
```json
{
  "and": [
    { "field": "status", "op": "is", "value": "active" }
  ]
}
```

Multiple conditions with AND:
```json
{
  "and": [
    { "field": "status", "op": "is", "value": "active" },
    { "field": "name", "op": "contains", "value": "test" }
  ]
}
```

OR conditions:
```json
{
  "or": [
    { "field": "status", "op": "is", "value": "draft" },
    { "field": "status", "op": "is", "value": "pending" }
  ]
}
```

## Adopting the Framework for a New List Page

### Step 1: Define Filter Configuration

Create a filter configuration for your entity:

```typescript
import { FilterConfig } from '../components/common';

const MY_ENTITY_FILTER_CONFIG: FilterConfig = {
  fields: [
    { name: 'name', label: 'Name', type: 'string' },
    { name: 'status', label: 'Status', type: 'enum', 
      enumValues: ['draft', 'active', 'closed'],
      enumLabels: { draft: 'Draft', active: 'Active', closed: 'Closed' }
    },
    { name: 'createdAt', label: 'Created Date', type: 'date' },
  ],
  maxConditions: 30,
};
```

### Step 2: Define Sort Options

```typescript
import { SortOption } from '../components/common';

const MY_ENTITY_SORT_OPTIONS: SortOption[] = [
  { field: 'createdAt', label: 'Created Date' },
  { field: 'name', label: 'Name' },
  { field: 'status', label: 'Status' },
];
```

### Step 3: Use the useUniversalList Hook

```typescript
import { useUniversalList } from '../hooks/useUniversalList';
import { parseListQuery, serializeFilterTree, countFilterConditions } from '../utils/listQueryUtils';

const MyListPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = user?.tenantId || '';

  // Parse URL query params
  const parsedQuery = useMemo(() => parseListQuery(searchParams, {
    pageSize: 10,
    sort: 'createdAt:DESC',
  }), [searchParams]);

  const advancedFilter = parsedQuery.filterTree;

  // Build additional filters
  const additionalFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (advancedFilter) {
      const serialized = serializeFilterTree(advancedFilter);
      if (serialized) filters.filter = serialized;
    }
    return filters;
  }, [advancedFilter]);

  // Fetch function
  const fetchItems = useCallback((params: Record<string, unknown>) => {
    return myApi.list(tenantId, params);
  }, [tenantId]);

  // Use the hook
  const {
    items,
    total,
    page,
    pageSize,
    search,
    isLoading,
    error,
    setPage,
    setPageSize,
    setSearch,
    refetch,
  } = useUniversalList<MyEntity>({
    fetchFn: fetchItems,
    defaultPageSize: 10,
    defaultSort: 'createdAt:DESC',
    syncToUrl: true,
    enabled: !!tenantId,
    additionalFilters,
  });

  // ... rest of component
};
```

### Step 4: Add Filter Handlers

```typescript
const handleAdvancedFilterApply = useCallback((filter: FilterTree | null) => {
  const newParams = new URLSearchParams(searchParams);
  if (filter) {
    const serialized = serializeFilterTree(filter);
    if (serialized) {
      newParams.set('filter', serialized);
    }
  } else {
    newParams.delete('filter');
  }
  newParams.set('page', '1');
  setSearchParams(newParams, { replace: true });
}, [searchParams, setSearchParams]);

const handleAdvancedFilterClear = useCallback(() => {
  const newParams = new URLSearchParams(searchParams);
  newParams.delete('filter');
  newParams.set('page', '1');
  setSearchParams(newParams, { replace: true });
}, [searchParams, setSearchParams]);

const activeFilterCount = advancedFilter ? countFilterConditions(advancedFilter) : 0;
```

### Step 5: Use ListToolbar Component

```tsx
import { ListToolbar, FilterBuilderBasic } from '../components/common';

<ListToolbar
  search={search}
  onSearchChange={setSearch}
  searchPlaceholder="Search items..."
  filters={getActiveFilters()}
  onFilterRemove={handleFilterRemove}
  onClearFilters={handleClearAllFilters}
  activeFilterCount={activeFilterCount}
  onRefresh={refetch}
  loading={isLoading}
  filterButton={
    <FilterBuilderBasic
      config={MY_ENTITY_FILTER_CONFIG}
      initialFilter={advancedFilter}
      onApply={handleAdvancedFilterApply}
      onClear={handleAdvancedFilterClear}
      activeFilterCount={activeFilterCount}
    />
  }
  sortOptions={MY_ENTITY_SORT_OPTIONS}
  sort={parsedQuery.sort}
  onSortChange={handleSortChange}
  pageSize={pageSize}
  onPageSizeChange={setPageSize}
/>
```

## URL State Synchronization

The framework ensures URL query parameters are the single source of truth:

1. **Reading State**: Use `parseListQuery(searchParams)` to read current state from URL
2. **Writing State**: Update URL params directly using `setSearchParams()` from react-router-dom
3. **Backward Compatibility**: `parseListQuery()` handles both single and double-encoded filters

### Important: Single Encoding

The framework ensures filters are encoded exactly once via URLSearchParams. The `buildListQueryParams()` function handles this automatically. Never manually encode the filter JSON before passing it to URLSearchParams.

```typescript
// CORRECT: Let URLSearchParams handle encoding
const params = buildListQueryParams({ filterTree: myFilter });

// WRONG: Don't double-encode
const params = new URLSearchParams();
params.set('filter', encodeURIComponent(JSON.stringify(myFilter))); // DON'T DO THIS
```

## Saved Views Integration

The SavedViewsDropdown component integrates with the backend list-views API:

```tsx
import { SavedViewsDropdown } from '../components/common';

<SavedViewsDropdown
  tableName="grc_controls"
  currentColumns={visibleColumns}
  currentSort={parsedQuery.sort}
  currentFilter={serializeFilterTree(advancedFilter)}
  onViewApply={handleViewApply}
/>
```

## Testing

Unit tests for the utilities are located in `src/utils/__tests__/listQueryUtils.test.ts`. Key test cases include:

- `normalizeFilter()` - Wrapping conditions in AND groups
- `buildListQueryParams()` - Ensuring no double-encoding (%257B)
- `parseListQuery()` - Handling single/double encoded filters for backward compatibility

## Migration Guide

To migrate an existing list page to the unified framework:

1. Replace manual state management with `useUniversalList` hook
2. Replace custom toolbar with `ListToolbar` component
3. Replace custom filter UI with `FilterBuilderBasic` component
4. Update URL param handling to use `parseListQuery()` and `setSearchParams()`
5. Ensure filter tree is serialized using `serializeFilterTree()` (not manual JSON.stringify + encode)

## Reference Implementation

See these pages for reference implementations:

- `src/pages/ControlList.tsx` - Controls list with full framework integration
- `src/pages/RiskManagement.tsx` - Risks list with full framework integration
