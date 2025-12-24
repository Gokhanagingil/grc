# Staging Operations Runbook

## Overview

This runbook provides operational guidance for the GRC Platform staging environment, including observability, monitoring, and troubleshooting procedures.

## Observability Baseline

### Request Logging

All requests are logged with structured context including:

- `correlationId` - Unique request identifier (from `x-correlation-id` header or auto-generated)
- `tenantId` - Tenant scope (from `x-tenant-id` header)
- `userId` - Authenticated user ID (from JWT)
- `method` - HTTP method
- `path` - Request path
- `statusCode` - Response status code
- `latencyMs` - Request duration in milliseconds

#### Correlation ID Header

The platform uses `x-correlation-id` header for request tracing:

1. If the header is present in the request, it's used as-is
2. If not present, a new UUID is generated
3. The correlation ID is included in the response header
4. All logs for the request include the correlation ID

**Example:**
```bash
# Request with correlation ID
curl -H "x-correlation-id: my-trace-123" http://localhost:3002/health/live

# Response includes the header
x-correlation-id: my-trace-123
```

### Metrics Endpoints

#### GET /metrics

Returns Prometheus-compatible metrics in plain text format.

```bash
curl http://localhost:3002/metrics
```

**Output:**
```
# HELP uptime_seconds The number of seconds the application has been running
# TYPE uptime_seconds gauge
uptime_seconds 3600

# HELP memory_usage_mb Current heap memory usage in megabytes
# TYPE memory_usage_mb gauge
memory_usage_mb 128.5

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total 1500

# HELP http_errors_total Total number of HTTP errors (4xx and 5xx)
# TYPE http_errors_total counter
http_errors_total 25

# HELP http_request_latency_ms_avg Average request latency in milliseconds
# TYPE http_request_latency_ms_avg gauge
http_request_latency_ms_avg 45.2
```

#### GET /metrics/json

Returns metrics as JSON for debugging or custom dashboards.

```bash
curl http://localhost:3002/metrics/json
```

**Output:**
```json
{
  "uptime_seconds": 3600,
  "memory_usage_mb": 128.5,
  "active_handles_count": 15,
  "total_requests": 1500,
  "total_errors": 25,
  "avg_latency_ms": 45.2,
  "routes": {
    "GET /health/live": {
      "count": 500,
      "avgLatencyMs": 5.2,
      "maxLatencyMs": 50,
      "minLatencyMs": 1,
      "errorCount": 0
    }
  }
}
```

#### GET /metrics/basic

Returns basic metrics including entity counts for lightweight monitoring.

```bash
curl http://localhost:3002/metrics/basic
```

**Output:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime_seconds": 3600,
  "memory_usage_mb": 128.5,
  "entity_counts": {
    "risks": 150,
    "policies": 45,
    "requirements": 200,
    "incidents": 30
  },
  "http_stats": {
    "total_requests": 1500,
    "total_errors": 25,
    "avg_latency_ms": 45.2
  }
}
```

### Health Endpoints

#### GET /health/live

Basic liveness check.

```bash
curl http://localhost:3002/health/live
```

#### GET /health/db

Database connectivity check.

```bash
curl http://localhost:3002/health/db
```

#### GET /health/auth

Authentication service check.

```bash
curl http://localhost:3002/health/auth
```

#### GET /health/detailed

Comprehensive health check with uptime and environment info.

```bash
curl http://localhost:3002/health/detailed
```

## Platform Validation

### Running Platform Validation

The platform includes validation scripts to verify environment, database, and migrations.

```bash
# Human-readable output
npm run platform:validate

# JSON output for CI
npm run platform:validate -- --json

# Skip smoke tests (faster)
npm run platform:validate -- --skip-smoke
```

### Environment Validation

```bash
# Human-readable output
npm run validate:env

# JSON output for CI
npm run validate:env -- --json
```

### Background Jobs

The platform includes a background jobs system with a nightly platform self-check job.

#### Viewing Job Status

```bash
# Via API (requires authentication)
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     http://localhost:3002/admin/jobs/status
```

#### Manually Triggering Jobs

```bash
# Trigger platform self-check
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     http://localhost:3002/admin/jobs/trigger/platform-self-check
```

#### Viewing Platform Validation Results

```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     http://localhost:3002/admin/jobs/platform-validation
```

## Notifications

### Viewing Notification Status

```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     http://localhost:3002/admin/notifications/status
```

### Testing Notifications

```bash
# Test email notification
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{"provider": "email"}' \
     http://localhost:3002/admin/notifications/test

# Test webhook notification
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{"provider": "webhook"}' \
     http://localhost:3002/admin/notifications/test
```

### Viewing Notification Logs

```bash
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT_ID" \
     http://localhost:3002/admin/notifications/logs
```

## Troubleshooting

### High Latency

1. Check `/metrics/json` for routes with high `avgLatencyMs`
2. Check database connectivity with `/health/db`
3. Review recent logs for slow queries

### High Error Rate

1. Check `/metrics/json` for routes with high `errorCount`
2. Review application logs filtered by correlation ID
3. Check `/health/detailed` for service status

### Memory Issues

1. Check `/metrics/basic` for `memory_usage_mb`
2. Monitor trend over time
3. Consider restarting if memory grows unbounded

### Database Issues

1. Check `/health/db` endpoint
2. Verify database credentials in environment
3. Check database server status and connections

### Notification Failures

1. Check `/admin/notifications/status` for provider status
2. Review `/admin/notifications/logs` for error details
3. Verify SMTP/Webhook configuration in environment variables

### Job Failures

1. Check `/admin/jobs/status` for job status
2. Review job run history for error messages
3. Manually trigger job to reproduce issue

## Staging Restart Procedure

```bash
# Stop the application
pm2 stop grc-backend

# Clear any stale state
pm2 delete grc-backend

# Start fresh
pm2 start npm --name grc-backend -- run start:prod

# Verify health
curl http://localhost:3002/health/live
```

## Log Analysis

### Finding Requests by Correlation ID

```bash
# Search logs for specific correlation ID
grep "correlation-id-here" /var/log/grc/backend.log
```

### Finding Requests by Tenant

```bash
# Search logs for specific tenant
grep "tenant-id-here" /var/log/grc/backend.log
```

### Finding Errors

```bash
# Search for error logs
grep -i "error" /var/log/grc/backend.log | tail -100
```

## Monitoring Checklist

Daily monitoring tasks:

1. Check `/health/live` returns 200
2. Check `/health/db` returns 200
3. Review `/metrics/basic` for anomalies
4. Check `/admin/jobs/status` for failed jobs
5. Review `/admin/notifications/status` for notification failures

Weekly monitoring tasks:

1. Review error trends in `/metrics/json`
2. Check memory usage trends
3. Review platform validation results
4. Audit notification logs for patterns
