# SOA API Reference

## Overview

The SOA (Statement of Applicability) API provides endpoints for managing SOA profiles and items. All endpoints require authentication and the `x-tenant-id` header.

## Base URL

All endpoints are prefixed with `/api/grc/soa`.

## Authentication

All requests require:
- Bearer token in Authorization header
- `x-tenant-id` header with valid tenant UUID

## Permissions

- **Read operations**: `GRC_REQUIREMENT_READ`
- **Write operations**: `GRC_REQUIREMENT_WRITE`

---

## SOA Profiles

### List Profiles

```
GET /api/grc/soa/profiles
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| pageSize | number | Items per page (default: 20, max: 100) |
| search | string | Search by name |
| status | string | Filter by status (DRAFT, PUBLISHED, ARCHIVED) |
| standardId | string | Filter by standard UUID |
| sort | string | Sort field and direction (e.g., "createdAt:DESC") |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "ISO 27001:2022 - Demo SOA",
        "description": "Description text",
        "scopeText": "Scope statement",
        "status": "DRAFT",
        "version": 1,
        "publishedAt": null,
        "standardId": "uuid",
        "standard": {
          "id": "uuid",
          "name": "ISO 27001:2022"
        },
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3002/grc/soa/profiles?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

### Get Profile

```
GET /api/grc/soa/profiles/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "ISO 27001:2022 - Demo SOA",
    "description": "Description text",
    "scopeText": "Scope statement",
    "status": "DRAFT",
    "version": 1,
    "publishedAt": null,
    "standardId": "uuid",
    "standard": {
      "id": "uuid",
      "name": "ISO 27001:2022"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Create Profile

```
POST /api/grc/soa/profiles
```

**Request Body:**
```json
{
  "name": "ISO 27001:2022 - Production",
  "standardId": "uuid",
  "description": "SOA for production environment",
  "scopeText": "Covers all production systems and processes"
}
```

**Response:** Returns the created profile.

### Update Profile

```
PATCH /api/grc/soa/profiles/:id
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "scopeText": "Updated scope"
}
```

**Response:** Returns the updated profile.

### Delete Profile (Soft Delete)

```
DELETE /api/grc/soa/profiles/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Profile deleted successfully"
}
```

### Publish Profile

```
POST /api/grc/soa/profiles/:id/publish
```

Sets the profile status to PUBLISHED, records the publish timestamp, and increments the version.

**Response:** Returns the updated profile.

### Initialize Items

```
POST /api/grc/soa/profiles/:id/initialize-items
```

Creates SOA items for all clauses in the profile's standard. This operation is idempotent - existing items are not duplicated.

**Response:**
```json
{
  "success": true,
  "data": {
    "created": 114,
    "existing": 0,
    "total": 114
  }
}
```

### Export CSV

```
GET /api/grc/soa/profiles/:id/export?format=csv
```

Returns a CSV file with all SOA items.

**Response Headers:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="soa-export.csv"
```

**CSV Columns:**
- clauseCode
- clauseTitle
- applicability
- justification
- implementationStatus
- targetDate
- ownerUserId
- controlsCount
- evidenceCount

**Example:**
```bash
curl -X GET "http://localhost:3002/grc/soa/profiles/$PROFILE_ID/export?format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -o soa-export.csv
```

---

## SOA Items

### List Items

```
GET /api/grc/soa/items
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| profileId | string | Yes | Profile UUID |
| page | number | No | Page number (default: 1) |
| pageSize | number | No | Items per page (default: 20) |
| search | string | No | Search in clause code/title/description |
| applicability | string | No | Filter by applicability |
| implementationStatus | string | No | Filter by implementation status |
| hasEvidence | boolean | No | Filter items with/without evidence |
| sort | string | No | Sort field and direction |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "profileId": "uuid",
        "clauseId": "uuid",
        "applicability": "APPLICABLE",
        "justification": null,
        "implementationStatus": "IMPLEMENTED",
        "targetDate": null,
        "ownerUserId": null,
        "notes": null,
        "clause": {
          "id": "uuid",
          "code": "A.5.1",
          "title": "Policies for information security",
          "description": "..."
        },
        "controlsCount": 2,
        "evidenceCount": 1,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 114,
    "page": 1,
    "pageSize": 20,
    "totalPages": 6
  }
}
```

### Get Item

```
GET /api/grc/soa/items/:id
```

**Response:** Returns the item with clause details and linked controls/evidence.

### Update Item

```
PATCH /api/grc/soa/items/:id
```

**Request Body:**
```json
{
  "applicability": "APPLICABLE",
  "justification": "This clause applies to our data center operations",
  "implementationStatus": "IMPLEMENTED",
  "targetDate": "2024-06-30",
  "notes": "Reviewed by security team"
}
```

**Response:** Returns the updated item.

---

## Control Linking

### Link Control to Item

```
POST /api/grc/soa/items/:itemId/controls/:controlId
```

**Response:**
```json
{
  "success": true,
  "message": "Control linked successfully"
}
```

### Unlink Control from Item

```
DELETE /api/grc/soa/items/:itemId/controls/:controlId
```

**Response:**
```json
{
  "success": true,
  "message": "Control unlinked successfully"
}
```

---

## Evidence Linking

### Link Evidence to Item

```
POST /api/grc/soa/items/:itemId/evidence/:evidenceId
```

**Response:**
```json
{
  "success": true,
  "message": "Evidence linked successfully"
}
```

### Unlink Evidence from Item

```
DELETE /api/grc/soa/items/:itemId/evidence/:evidenceId
```

**Response:**
```json
{
  "success": true,
  "message": "Evidence unlinked successfully"
}
```

---

## Enums

### SoaProfileStatus
- `DRAFT` - Profile is being edited
- `PUBLISHED` - Profile is finalized
- `ARCHIVED` - Profile is no longer active

### SoaApplicability
- `APPLICABLE` - Clause applies to the organization
- `NOT_APPLICABLE` - Clause does not apply
- `UNDECIDED` - Not yet determined

### SoaImplementationStatus
- `IMPLEMENTED` - Fully implemented
- `PARTIALLY_IMPLEMENTED` - Partially implemented
- `PLANNED` - Implementation planned
- `NOT_IMPLEMENTED` - Not implemented

---

## Error Responses

All errors follow the standard format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

Common error codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate link)
