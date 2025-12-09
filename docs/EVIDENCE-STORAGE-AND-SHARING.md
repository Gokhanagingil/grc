# Evidence Storage & Secure Transfer (Phase 6)

This document describes the design, security considerations, and configuration for the Evidence Storage and Secure Transfer feature implemented in Platform Core Phase 6.

## Overview

The Evidence Storage subsystem provides secure file storage, sharing, and access control for evidence files linked to Findings and Audits. It features a pluggable storage adapter architecture, secure sharing via expiring links, RBAC/ACL enforcement, and comprehensive access logging.

## Architecture

### Storage Adapter Pattern

The system uses a pluggable storage adapter pattern to support multiple storage backends:

```
EvidenceStorageAdapter (Interface)
├── LocalEvidenceStorageAdapter (Implemented)
├── S3EvidenceStorageAdapter (Future)
├── AzureEvidenceStorageAdapter (Future)
└── MinIOEvidenceStorageAdapter (Future)
```

The adapter interface defines the following methods:

- `saveFile(fileBuffer, fileName, mimeType, context)` - Save a file and return storage path, checksum, and file size
- `getFileStream(storagePath)` - Get a readable stream for downloading
- `deleteFile(storagePath)` - Delete a file from storage
- `fileExists(storagePath)` - Check if a file exists
- `getFileMetadata(storagePath)` - Get file metadata without downloading

### Local Storage Implementation

The `LocalEvidenceStorageAdapter` stores files on the local filesystem with the following structure:

```
storage/evidence/<year>/<month>/<uuid>_<sanitized_filename>
```

Features:
- Year/month directory organization for scalability
- UUID prefix for uniqueness
- Filename sanitization to prevent path traversal
- SHA-256 checksum computation for integrity verification

### Database Schema

Phase 6 extends the existing `evidence` table and adds two new tables:

**Evidence Table Extensions:**
- `file_name` - Original filename
- `mime_type` - MIME type of the file
- `file_size` - File size in bytes
- `storage_backend` - Storage backend type (local, s3, azure, minio)
- `storage_path` - Relative path or key in storage
- `checksum` - SHA-256 checksum
- `retention_policy` - Retention policy identifier
- `deleted_at` - Soft delete timestamp

**evidence_shares Table:**
- `id` - Primary key
- `evidence_id` - Foreign key to evidence
- `token` - Unique cryptographic token (64 characters)
- `expires_at` - Expiration timestamp
- `created_by` - User who created the share
- `created_at` - Creation timestamp
- `max_downloads` - Maximum download count (nullable for unlimited)
- `download_count` - Current download count

**evidence_access_logs Table:**
- `id` - Primary key
- `evidence_id` - Foreign key to evidence
- `access_type` - Type of access (upload, download, share_download, delete, share_create)
- `user_id` - User ID (nullable for anonymous share downloads)
- `share_id` - Share ID (for share-related access)
- `ip_address` - Client IP address
- `user_agent` - Client user agent
- `created_at` - Timestamp

## API Endpoints

### Evidence File Operations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/grc/evidence/upload` | Create evidence with file upload | JWT |
| POST | `/api/grc/evidence/:id/upload` | Upload file to existing evidence | JWT |
| GET | `/api/grc/evidence/:id/download` | Download evidence file | JWT |
| DELETE | `/api/grc/evidence/:id/soft` | Soft delete evidence | JWT |
| POST | `/api/grc/evidence/:id/restore` | Restore soft-deleted evidence | JWT |

### Secure Sharing

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/grc/evidence/:id/share` | Create share link | JWT |
| GET | `/api/grc/evidence/:id/shares` | List shares for evidence | JWT |
| GET | `/api/grc/evidence/share/:token` | Download via share token | Token |

### Access Logs & Statistics

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/grc/evidence/:id/access-logs` | Get access logs | JWT |
| GET | `/api/grc/evidence/:id/stats` | Get download/share statistics | JWT |

## Security Considerations

### Path Traversal Protection

The storage adapter implements multiple layers of protection against path traversal attacks:

1. **Filename Sanitization**: Removes path separators, null bytes, and leading dots from filenames
2. **Path Validation**: Validates that resolved paths are within the storage root directory
3. **UUID Prefixing**: Uses UUID prefixes to ensure unique, unpredictable file paths

### Secure Token Generation

Share tokens are generated using Node.js `crypto.randomBytes()` with 32 bytes of entropy, resulting in 64-character hex strings. This provides approximately 256 bits of entropy, making brute-force attacks computationally infeasible.

### Access Control

All evidence operations are protected by:

1. **JWT Authentication**: Required for all authenticated endpoints
2. **Tenant Isolation**: Evidence is scoped to tenants
3. **ACL Enforcement**: Uses the existing ACL engine for permission decisions
4. **Share Token Validation**: Validates expiration, download limits, and evidence status

### Audit Trail

All access events are logged to `evidence_access_logs`:
- Upload events
- Authenticated downloads
- Share link creation
- Share token downloads
- Soft deletes

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EVIDENCE_STORAGE_BACKEND` | Storage backend type | `local` |
| `EVIDENCE_STORAGE_PATH` | Path for local storage | `./storage/evidence` |

### File Upload Limits

The default configuration allows:
- Maximum file size: 50MB
- Allowed MIME types: PDF, Office documents, images, text files, JSON, XML, ZIP

### Share Link Defaults

- Default expiration: 7 days (configurable per share)
- Download limits: Optional, unlimited by default

## Frontend Integration

### FindingDetail Evidence Section

The Evidence tab in FindingDetail provides:
- **Add Evidence** button to upload new files
- Evidence list with file name, type, size, uploader, and upload date
- **Download** action for files with storage paths
- **Get Share Link** action to create expiring share links
- **Delete** action for soft deletion

### Get Share Link Modal

The share link modal allows users to:
- Set expiration date/time (default: 7 days from now)
- Set optional maximum download count
- Copy the generated share URL to clipboard

## Running the Migration

To apply the Phase 6 migration:

```bash
cd backend
npm run migrate:phase6
```

This will:
1. Add new columns to the `evidence` table
2. Create the `evidence_shares` table
3. Create the `evidence_access_logs` table
4. Add Phase 6 permissions and ACL rules

## Testing

### Unit Tests

Run the evidence storage tests:

```bash
cd backend
npm test -- --testPathPattern=evidence-storage
```

### Smoke Test Scenario

1. Create an audit and finding
2. Upload evidence to the finding
3. Download the evidence as an authenticated user
4. Generate a share link with expiration
5. Download via the share token
6. Verify access logs are written

## Future Enhancements

- S3/Azure/MinIO storage adapter implementations
- Virus scanning integration
- File preview generation
- Share link management UI
- Evidence aggregation on AuditDetail
- Retention policy enforcement
- Bulk upload/download operations
