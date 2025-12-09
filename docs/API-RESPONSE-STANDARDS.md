# API Response Standards

This document defines the standard API response format used across all endpoints in the GRC Platform backend. Following these standards ensures consistency, predictability, and ease of integration for frontend applications and API consumers.

## Response Envelope

All API responses follow a standard envelope format that clearly indicates success or failure and provides structured data.

### Success Response Format

All successful responses (2xx status codes) follow this format:

```json
{
  "success": true,
  "data": <response_data>,
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5,
    "limit": 20,
    "offset": 0
  }
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful responses |
| `data` | any | The response payload (object, array, or null) |
| `meta` | object | Optional metadata, primarily used for pagination |

### Error Response Format

All error responses (4xx and 5xx status codes) follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... },
    "fieldErrors": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `false` for error responses |
| `error.code` | string | Machine-readable error code (e.g., `VALIDATION_ERROR`, `NOT_FOUND`) |
| `error.message` | string | Human-readable error description |
| `error.details` | object | Optional additional error context |
| `error.fieldErrors` | array | Optional field-specific validation errors |

## HTTP Status Codes and Error Codes

The following table maps HTTP status codes to their corresponding error codes:

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `BAD_REQUEST` | Invalid request parameters or missing required fields |
| 400 | `VALIDATION_ERROR` | Request body validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `FORBIDDEN` | Authenticated but not authorized for this action |
| 404 | `NOT_FOUND` | Requested resource does not exist |
| 409 | `CONFLICT` | Resource conflict (e.g., duplicate entry) |
| 422 | `VALIDATION_ERROR` | Unprocessable entity due to validation |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

## Examples

### Successful List Response (Paginated)

**Request:**
```http
GET /grc/risks?page=1&pageSize=20
Authorization: Bearer <token>
x-tenant-id: <tenant-uuid>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Data Breach Risk",
      "severity": "high",
      "status": "identified",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "Compliance Gap",
      "severity": "medium",
      "status": "mitigated",
      "createdAt": "2024-01-14T09:00:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3,
    "limit": 20,
    "offset": 0
  }
}
```

### Successful Single Resource Response

**Request:**
```http
GET /grc/risks/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
x-tenant-id: <tenant-uuid>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Data Breach Risk",
    "description": "Risk of unauthorized data access",
    "severity": "high",
    "likelihood": "possible",
    "status": "identified",
    "category": "Security",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Successful Create Response

**Request:**
```http
POST /grc/risks
Authorization: Bearer <token>
x-tenant-id: <tenant-uuid>
Content-Type: application/json

{
  "title": "New Security Risk",
  "description": "Potential vulnerability in authentication",
  "severity": "high",
  "likelihood": "likely",
  "status": "identified"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "title": "New Security Risk",
    "description": "Potential vulnerability in authentication",
    "severity": "high",
    "likelihood": "likely",
    "status": "identified",
    "tenantId": "tenant-uuid",
    "createdAt": "2024-01-16T14:00:00Z",
    "updatedAt": "2024-01-16T14:00:00Z",
    "isDeleted": false
  }
}
```

### Validation Error Response

**Request:**
```http
POST /grc/risks
Authorization: Bearer <token>
x-tenant-id: <tenant-uuid>
Content-Type: application/json

{
  "description": "Missing required title field"
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed",
    "fieldErrors": [
      {
        "field": "title",
        "message": "title should not be empty"
      }
    ]
  }
}
```

### Not Found Error Response

**Request:**
```http
GET /grc/risks/00000000-0000-0000-0000-000000000000
Authorization: Bearer <token>
x-tenant-id: <tenant-uuid>
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Risk with ID 00000000-0000-0000-0000-000000000000 not found"
  }
}
```

### Unauthorized Error Response

**Request:**
```http
GET /grc/risks
x-tenant-id: <tenant-uuid>
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized"
  }
}
```

### Forbidden Error Response

**Request:**
```http
GET /grc/risks/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
x-tenant-id: <different-tenant-uuid>
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied to this resource"
  }
}
```

## Pagination Rules

All list endpoints support pagination with the following parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `pageSize` | integer | 20 | 100 | Number of items per page |
| `limit` | integer | 20 | 100 | Alias for pageSize |
| `offset` | integer | 0 | - | Number of items to skip |

**Notes:**
- Both `page/pageSize` and `limit/offset` styles are supported
- The response `meta` object includes both styles for compatibility
- Requesting a `pageSize` or `limit` greater than 100 will result in a 400 error
- Requesting a negative `offset` will result in a 400 error

## Implementation Details

### Global Exception Filter

The `GlobalExceptionFilter` class handles all exceptions and transforms them into the standard error response format. It is registered globally in the `AppModule`.

Location: `src/common/filters/global-exception.filter.ts`

### Response Transform Interceptor

The `ResponseTransformInterceptor` class wraps all successful responses in the standard envelope format. It automatically detects paginated responses and includes the appropriate metadata.

Location: `src/common/interceptors/response-transform.interceptor.ts`

### Skipping Transformation

In rare cases where you need to return a raw response (e.g., file downloads), you can use the `@SkipTransform()` decorator:

```typescript
import { SetMetadata } from '@nestjs/common';
import { SKIP_TRANSFORM_KEY } from '../common/interceptors';

export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
```

## Frontend Integration

When consuming the API from the frontend, check the `success` field to determine how to handle the response:

```typescript
try {
  const response = await api.get('/grc/risks');
  
  if (response.data.success) {
    // Handle success
    const risks = response.data.data;
    const pagination = response.data.meta;
  }
} catch (error) {
  if (error.response?.data?.success === false) {
    // Handle API error
    const errorCode = error.response.data.error.code;
    const errorMessage = error.response.data.error.message;
    const fieldErrors = error.response.data.error.fieldErrors;
  }
}
```

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2024-12-07 | 1.0.0 | Initial API response standards implementation |
