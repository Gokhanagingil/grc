# Platform Core Features: Attachments, List Views, and Export

This document describes the universal platform features that work across all tables without per-table code.

## Overview

Three core features have been added to the platform:

1. **Universal Attachments**: File attachment management for any record
2. **List Views**: Persistent column management with gear icon UI
3. **Export**: CSV export with view, filter, and sort support

## Universal Attachments

### Configuration

Storage configuration is managed through environment variables:

```bash
# Storage provider (default: local)
ATTACHMENT_STORAGE_PROVIDER=local

# Local filesystem storage base path (default: ./uploads)
ATTACHMENT_STORAGE_PATH=./uploads

# Maximum file size in bytes (default: 10MB)
ATTACHMENT_MAX_FILE_SIZE=10485760
```

### Allowed MIME Types

The following MIME types are allowed by default:

- **Documents**: application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
- **Spreadsheets**: application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- **Presentations**: application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation
- **Images**: image/jpeg, image/png, image/gif, image/webp
- **Text**: text/plain, text/csv
- **Data**: application/json, application/xml
- **Archives**: application/zip

### Allowed Reference Tables

Attachments can be associated with records from these tables:

- grc_risks
- grc_policies
- grc_requirements
- grc_controls
- grc_audits
- grc_issues
- grc_capas
- grc_evidence

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/grc/attachments?refTable=&refId= | Upload attachment (multipart/form-data) |
| GET | /api/grc/attachments?refTable=&refId= | List attachments for a record |
| GET | /api/grc/attachments/:id | Get attachment metadata |
| GET | /api/grc/attachments/:id/download | Download attachment file |
| DELETE | /api/grc/attachments/:id | Soft delete attachment |

### Security

- All operations enforce tenant isolation via `x-tenant-id` header
- File names are sanitized to prevent path traversal attacks
- SHA256 hash is computed server-side for integrity verification
- Storage keys use format: `{tenantId}/{refTable}/{refId}/{timestamp}_{fileName}`

### Frontend Usage

```tsx
import { AttachmentPanel } from '@/components/common';

// In a record detail page
<AttachmentPanel 
  refTable="grc_risks" 
  refId={riskId} 
  readOnly={false} 
/>
```

## List Views

### Overview

List views allow users to customize column visibility, ordering, and width for any table. Views are persisted and can be scoped to user, role, tenant, or system level.

### Scope Precedence

When determining which view to display, the system follows this precedence:

1. **User scope**: Personal view for the current user
2. **Role scope**: View assigned to the user's role
3. **Tenant scope**: Default view for the tenant
4. **System scope**: Platform-wide default view

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/grc/list-views?tableName= | List views for a table |
| GET | /api/grc/list-views/:id | Get view details |
| POST | /api/grc/list-views | Create new view |
| PUT | /api/grc/list-views/:id | Update view metadata |
| PUT | /api/grc/list-views/:id/columns | Update column configuration |
| DELETE | /api/grc/list-views/:id | Delete view |

### Column Configuration

Each column in a view has these properties:

- `columnName`: The field name (must be in allowlist)
- `orderIndex`: Display order (0-based)
- `visible`: Whether column is shown
- `width`: Column width in pixels (optional)
- `pinned`: Pin to 'left' or 'right' (optional)

### Frontend Usage

```tsx
import { ColumnManagementModal } from '@/components/common';

const [modalOpen, setModalOpen] = useState(false);

<IconButton onClick={() => setModalOpen(true)}>
  <SettingsIcon />
</IconButton>

<ColumnManagementModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  tableName="grc_risks"
  availableColumns={[
    { name: 'title', label: 'Title' },
    { name: 'severity', label: 'Severity' },
    { name: 'status', label: 'Status' },
  ]}
  onColumnsChange={(columns) => {
    // Update table display
  }}
/>
```

## Export

### Overview

Export allows users to download table data as CSV files. The export respects the current view's column configuration, applied filters, search terms, and sort order.

### API Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/grc/export | Export data to CSV |

### Request Payload

```json
{
  "tableName": "grc_risks",
  "viewId": "optional-view-id",
  "columns": ["title", "severity", "status"],
  "filters": { "severity": "high" },
  "search": "optional search term",
  "sort": { "field": "created_at", "order": "DESC" },
  "format": "csv"
}
```

### Response

The endpoint returns a streaming CSV file with:
- Filename format: `{tableName}_{YYYYMMDD}_{HHMM}.csv`
- Content-Type: `text/csv`
- UTF-8 encoding with BOM for Excel compatibility

### Frontend Usage

```tsx
import { ExportButton } from '@/components/common';

<ExportButton
  tableName="grc_risks"
  columns={['title', 'severity', 'status']}
  filters={{ severity: 'high' }}
  search={searchTerm}
  sort={{ field: 'created_at', order: 'DESC' }}
/>
```

## Security Notes

### Allowlist Validation

All table names and column names are validated against an allowlist to prevent SQL injection:

- Table names must be in the `ALLOWED_REF_TABLES` constant
- Column names are validated against the data dictionary
- Dot-walk paths (e.g., `risk.controls.name`) are validated segment by segment

### Tenant Isolation

All operations enforce tenant isolation:

- `x-tenant-id` header is required on all requests
- TenantGuard validates header matches authenticated user's tenant
- All queries include `tenant_id` filter

### Audit Logging

The following events are logged:

- `attachment.uploaded`: File uploaded successfully
- `attachment.downloaded`: File downloaded
- `attachment.deleted`: File soft-deleted
- `attachment.blocked`: Upload blocked (invalid type/size)
- `export.created`: Data exported

## Database Schema

### nest_attachments

```sql
CREATE TABLE nest_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  ref_table VARCHAR NOT NULL,
  ref_id UUID NOT NULL,
  file_name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  storage_provider VARCHAR NOT NULL,
  storage_key VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'uploaded',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_attachments_tenant_ref ON nest_attachments(tenant_id, ref_table, ref_id);
CREATE UNIQUE INDEX idx_attachments_storage_key ON nest_attachments(tenant_id, storage_key);
```

### nest_list_views

```sql
CREATE TABLE nest_list_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  table_name VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  scope VARCHAR NOT NULL DEFAULT 'user',
  owner_user_id UUID,
  role_id UUID,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_list_views_tenant_table ON nest_list_views(tenant_id, table_name);
```

### nest_list_view_columns

```sql
CREATE TABLE nest_list_view_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_view_id UUID NOT NULL REFERENCES nest_list_views(id) ON DELETE CASCADE,
  column_name VARCHAR NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN DEFAULT TRUE,
  width INTEGER,
  pinned VARCHAR
);

CREATE INDEX idx_list_view_columns_view ON nest_list_view_columns(list_view_id);
```

## Troubleshooting

### Attachment Upload Fails

1. Check file size is under the configured limit (default 10MB)
2. Verify MIME type is in the allowlist
3. Ensure storage directory exists and is writable
4. Check tenant ID header is present and valid

### List View Not Loading

1. Verify table name is in the allowlist
2. Check user has access to the referenced table
3. Ensure column names are valid dictionary fields

### Export Returns Empty

1. Verify filters are not too restrictive
2. Check user has read access to the table
3. Ensure at least one column is specified or viewId is valid
