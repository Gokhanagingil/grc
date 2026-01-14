# Universal Views v1

Universal Views is a platform-wide feature that makes list views dynamic and reusable across all GRC modules. It enables users to customize which columns are visible, reorder columns, and apply per-column filters with type-aware operators.

## Features

### Column Selection and Reordering

Users can customize their list views by:
- Adding or removing columns from the visible set
- Reordering columns via drag-and-drop
- Resetting to default column configuration

### Per-Column Filters

Each visible column can have a type-aware filter applied:
- String fields: contains, equals, starts with, ends with, is null, is not null
- Number fields: equals, greater than or equal, less than or equal, between
- Date fields: after, before, between
- Enum fields: dropdown selection from allowed values
- Boolean fields: yes/no selection

### View Persistence

User preferences are automatically saved and restored:
- Visible columns and their order
- Applied filters
- Sort field and direction
- Page size

Preferences are scoped by (tenantId, userId, tableName) for complete isolation.

## Architecture

### Backend Components

**TableSchemaRegistry** (`backend-nest/src/common/services/table-schema.registry.ts`)
- Maintains allowlist of filterable/sortable fields per table
- Provides schema metadata for frontend rendering
- Enforces security by preventing access to non-allowlisted fields

**ViewPreferenceService** (`backend-nest/src/common/services/view-preference.service.ts`)
- Manages CRUD operations for user view preferences
- Ensures tenant and user isolation
- Returns default preferences based on schema when no saved preference exists

**PlatformController** (`backend-nest/src/grc/controllers/platform.controller.ts`)
- `GET /grc/platform/tables/:tableName/schema` - Returns table schema metadata
- `GET /grc/platform/views/:tableName` - Returns saved view preference
- `PUT /grc/platform/views/:tableName` - Saves view preference

**UniversalListService** (`backend-nest/src/common/services/universal-list.service.ts`)
- Extended with `applyColumnFilters()` method for filter DSL support
- Type-aware filter application with allowlist enforcement

### Frontend Components

**ColumnPickerDialog** (`frontend/src/components/common/ColumnPickerDialog.tsx`)
- Material-UI dialog for column selection
- Drag-and-drop reordering
- Select all/none and reset to default buttons

**ColumnFilterRow** (`frontend/src/components/common/ColumnFilterRow.tsx`)
- Renders type-aware filter inputs for visible columns
- Supports all filter operators per data type
- Clear button for each filter

**useViewPreferences** (`frontend/src/hooks/useViewPreferences.ts`)
- React hook for managing view preferences state
- Fetches schema and saved preferences on mount
- Debounced auto-save on preference changes

### Database

**UserViewPreference Entity** (`backend-nest/src/common/entities/user-view-preference.entity.ts`)
- Stores user preferences with JSON columns for flexibility
- Unique constraint on (tenantId, userId, tableName)
- Soft delete support

## Quick Enable Checklist

When adding Universal Views support to a new table, follow these steps:

### Backend (4 steps)

1. **Register table schema** in `table-schema.registry.ts`:
```typescript
TABLE_SCHEMAS.set('your_table', {
  tableName: 'your_table',
  fields: [
    {
      name: 'name',
      label: 'Name',
      dataType: 'string',
      searchable: true,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'status',
      label: 'Status',
      dataType: 'enum',
      enumValues: ['active', 'inactive'],
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    // ... add all fields
  ],
});
ALLOWED_TABLES.add('your_table');
```

2. **Add table to ALLOWED_TABLES set** (done in step 1)

3. **Use applyColumnFilters in your service**:
```typescript
// In your list method
if (columnFilters && Object.keys(columnFilters).length > 0) {
  this.universalListService.applyColumnFilters(
    qb,
    'your_table',
    columnFilters,
    'alias',
  );
}
```

4. **Accept columnFilters in your DTO/controller**:
```typescript
@Query('columnFilters') columnFilters?: string // JSON string
// Parse and pass to service
```

### Frontend (3 steps)

1. **Use useViewPreferences hook**:
```typescript
const {
  schema,
  visibleColumns,
  columnOrder,
  filters,
  setVisibleColumns,
  setColumnOrder,
  setFilters,
  getVisibleFields,
} = useViewPreferences({
  tenantId,
  tableName: 'your_table',
  enabled: !!tenantId,
});
```

2. **Add ColumnPickerDialog with gear icon**:
```tsx
<IconButton onClick={() => setColumnPickerOpen(true)}>
  <SettingsIcon />
</IconButton>
<ColumnPickerDialog
  open={columnPickerOpen}
  onClose={() => setColumnPickerOpen(false)}
  fields={schema?.fields || []}
  visibleColumns={visibleColumns}
  columnOrder={columnOrder}
  onSave={(visible, order) => {
    setVisibleColumns(visible);
    setColumnOrder(order);
    setColumnPickerOpen(false);
  }}
/>
```

3. **Add ColumnFilterRow**:
```tsx
<ColumnFilterRow
  fields={getVisibleFields()}
  filters={filters}
  onFilterChange={setFilters}
/>
```

### Validation

After enabling Universal Views for a table:

1. **Schema endpoint works**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     "http://localhost/api/grc/platform/tables/your_table/schema"
```

2. **View preferences save and load**:
```bash
# Save
curl -X PUT \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{"visibleColumns":["name","status"]}' \
     "http://localhost/api/grc/platform/views/your_table"

# Load
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     "http://localhost/api/grc/platform/views/your_table"
```

3. **Column filters work**:
- Open the list page
- Click gear icon to open column picker
- Select/deselect columns and reorder
- Apply filters using the filter row
- Refresh page and verify preferences persist

4. **Allowlist enforcement**:
```bash
# Should return 400 Bad Request
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     "http://localhost/api/grc/your_table?columnFilters={\"invalidField\":{\"op\":\"eq\",\"value\":\"test\"}}"
```

## Supported Tables

| Table | Status | Notes |
|-------|--------|-------|
| `controls` | Enabled | Full schema with all fields |
| `risks` | Enabled | Full schema with all fields |
| `policies` | Planned | Coming soon |
| `requirements` | Planned | Coming soon |
| `audits` | Planned | Coming soon |

## Table Name Aliases

The Universal Views system supports table name aliases for convenience. Aliases are automatically resolved to their canonical names during all operations.

### Supported Aliases

| Alias | Canonical Name | Notes |
|-------|----------------|-------|
| `grc_controls` | `controls` | Database table name alias |
| `grc_risks` | `risks` | Database table name alias |

### Alias Resolution Behavior

The system normalizes and resolves table names as follows:

1. **Normalization**: Table names are trimmed, converted to lowercase, and hyphens are replaced with underscores
2. **Resolution**: Known aliases are mapped to their canonical names
3. **Response**: All API responses return the canonical table name (e.g., `controls` not `grc_controls`)

Examples:
- `grc_controls` → `controls`
- `GRC_CONTROLS` → `controls`
- `grc-controls` → `controls`
- ` CONTROLS ` → `controls`

### Recommended Usage

While aliases are supported for backward compatibility, we recommend using canonical table names (`controls`, `risks`) in new code for consistency. The canonical name is always returned in API responses regardless of which name was used in the request.

### View Preference Canonicalization

View preferences are stored using canonical table names. This means:
- Saving a preference via `/grc/platform/views/grc_controls` stores it under `controls`
- Retrieving via `/grc/platform/views/controls` or `/grc/platform/views/grc_controls` returns the same preference
- This prevents preference duplication when using different name variants

## Security Considerations

1. **Allowlist enforcement**: Only fields registered in the schema can be filtered/sorted
2. **Tenant isolation**: All preferences are scoped by tenantId
3. **User isolation**: Preferences are further scoped by userId
4. **Input validation**: Filter operators and values are validated before SQL generation
5. **Parameterized queries**: All filter values use parameterized queries to prevent SQL injection

## API Reference

See [LIST-CONTRACT.md](./LIST-CONTRACT.md#column-filters-and-views-universal-views-v1) for detailed API documentation.

---

*Last updated: January 2026*
