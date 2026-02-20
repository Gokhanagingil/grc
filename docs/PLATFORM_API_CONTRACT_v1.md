# Platform API Contract v1

This document defines the only valid platform API contract for the GRC Platform as of FAZ 1 Platform Stabilization.

## Canonical Contract Declaration

The NestJS backend API contract is canonical.

All API responses from the NestJS backend follow a standardized envelope format. This contract is enforced by the `ResponseTransformInterceptor` and `GlobalExceptionFilter` in the NestJS backend.

## Standard Response Envelope

### Success Response Format

All successful responses (2xx status codes) follow this format:

```json
{
  "success": true,
  "data": <response_payload>,
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

Field definitions:

- `success`: Boolean, always `true` for successful responses
- `data`: The response payload (object, array, or null)
- `meta`: Optional metadata object, primarily used for pagination

The `meta` object is included only for paginated list responses. Single resource responses omit the `meta` field.

### Error Response Format

All error responses (4xx and 5xx status codes) follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { },
    "fieldErrors": [
      {
        "field": "fieldName",
        "message": "Field-specific error message"
      }
    ]
  }
}
```

Field definitions:

- `success`: Boolean, always `false` for error responses
- `error.code`: Machine-readable error code (e.g., `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`)
- `error.message`: Human-readable error description
- `error.details`: Optional object with additional error context
- `error.fieldErrors`: Optional array of field-specific validation errors

## Error Structure

Standard error codes and their corresponding HTTP status codes:

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

## Pagination Structure

All list endpoints support pagination with the following query parameters:

| Parameter | Type | Default | Maximum | Description |
|-----------|------|---------|---------|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `pageSize` | integer | 20 | 100 | Number of items per page |
| `limit` | integer | 20 | 100 | Alias for pageSize |
| `offset` | integer | 0 | - | Number of items to skip |

Both `page/pageSize` and `limit/offset` pagination styles are supported. The response `meta` object includes both styles for compatibility.

Paginated response example:

```json
{
  "success": true,
  "data": [
    { "id": "uuid-1", "title": "Item 1" },
    { "id": "uuid-2", "title": "Item 2" }
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

## Required Headers

All authenticated API requests must include the following headers:

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token in format `Bearer <access_token>` |
| `x-tenant-id` | Yes | UUID of the tenant context |
| `Content-Type` | Yes (POST/PUT/PATCH) | `application/json` for JSON payloads |

## Authentication Endpoints

Authentication endpoints do not require the `Authorization` header:

- `POST /auth/login` - Authenticate user and receive tokens
- `POST /auth/refresh` - Refresh access token using refresh token

Login response format:

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "role": "admin",
      "tenantId": "tenant-uuid",
      "firstName": "First",
      "lastName": "Last"
    }
  }
}
```

## Implementation Reference

The API contract is implemented by the following components in the NestJS backend:

- `ResponseTransformInterceptor` (`src/common/interceptors/response-transform.interceptor.ts`): Wraps all successful responses in the standard envelope format
- `GlobalExceptionFilter` (`src/common/filters/global-exception.filter.ts`): Transforms all exceptions into the standard error response format
- `ApiSuccessResponse<T>` interface: TypeScript interface defining the success response structure
- `PaginatedServiceResponse<T>` interface: TypeScript interface for paginated responses from services

## Contract Versioning

This document defines API Contract v1. The contract version is implicit in the API design and is not exposed via headers or URL versioning.

Future contract changes will be documented in subsequent versions (v2, v3, etc.) with explicit migration guidance.

## Governance Statement

The NestJS API contract is canonical.

This document represents a governance decision that is immutable within FAZ 1. The API contract documented here is the only valid contract for the platform. Any deviation from this contract requires explicit governance approval in a subsequent phase.

No frontend refactoring is performed in FAZ 1. No backend rewriting is performed in FAZ 1. This document serves as a contract declaration only.

---

Document Version: 1.0.0
FAZ: 1 - Platform Stabilization
Date: 2024-12-23
