# Observability and Health Checks

This document describes the observability features, health endpoints, and metrics available in the NestJS GRC backend for monitoring and operational purposes.

## Log Format

All logs are output as JSON for easy parsing by log aggregation tools (ELK, Splunk, CloudWatch, Datadog, etc.).

### Standard Log Entry Structure

```json
{
  "timestamp": "2025-12-08T10:30:00.000Z",
  "level": "info",
  "message": "request.completed",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "path": "/grc/risks",
  "method": "GET",
  "latencyMs": 45,
  "statusCode": 200,
  "context": "RequestTimingInterceptor"
}
```

### Log Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 string | When the log entry was created |
| `level` | string | Log level: error, warn, info, debug, verbose |
| `message` | string | Log message or event name |
| `correlationId` | UUID | Unique request identifier for tracing |
| `tenantId` | UUID | Tenant ID from `x-tenant-id` header |
| `userId` | UUID | User ID from JWT token (if authenticated) |
| `path` | string | Request URL path |
| `method` | string | HTTP method (GET, POST, etc.) |
| `latencyMs` | number | Request duration in milliseconds |
| `statusCode` | number | HTTP response status code |
| `context` | string | Logger context (module/class name) |
| `metadata` | object | Additional contextual data |
| `error` | object | Error details (name, message, stack) |

### Error Log Entry Example

```json
{
  "timestamp": "2025-12-08T10:30:00.000Z",
  "level": "error",
  "message": "request.failed",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "path": "/grc/risks/invalid-id",
  "method": "GET",
  "context": "RequestTimingInterceptor",
  "metadata": {
    "statusCode": 404,
    "latencyMs": 12,
    "route": "/grc/risks/:id"
  },
  "error": {
    "name": "NotFoundException",
    "message": "Risk not found"
  }
}
```

## Request Tracing

### How requestId/correlationId is Propagated

1. **Incoming Request**: The `CorrelationIdMiddleware` checks for an `x-correlation-id` header
2. **ID Generation**: If not present, a new UUID v4 is generated
3. **Context Propagation**: The ID is attached to the request object and set in the global logger context
4. **Response Header**: The ID is returned in the `x-correlation-id` response header
5. **Audit Logging**: The ID is stored with all audit log entries

### Using Correlation ID

```bash
# Provide your own correlation ID
curl -H "x-correlation-id: my-trace-123" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     http://localhost:3002/grc/risks

# Response includes the correlation ID
# x-correlation-id: my-trace-123

# Or let the server generate one
curl -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     http://localhost:3002/grc/risks
# x-correlation-id: 550e8400-e29b-41d4-a716-446655440000
```

### tenantId Propagation

The tenant ID is extracted from the `x-tenant-id` request header and included in all log entries for multi-tenant filtering.

### userId Propagation

The user ID is extracted from the JWT token after authentication and included in log entries for authenticated requests.

## Health Endpoints

The health endpoints are designed for use by load balancers, Kubernetes probes, and monitoring systems.

### GET /health/live

Simple liveness check - returns 200 if the application process is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-08T10:30:00.000Z",
  "uptime": 3600.5,
  "service": "grc-platform-nest"
}
```

**Use Case:** Kubernetes liveness probe, load balancer health check

### GET /health/ready

Readiness check - verifies the application can serve traffic by checking database connectivity.

**Response (healthy):**
```json
{
  "status": "ok",
  "timestamp": "2025-12-08T10:30:00.000Z",
  "service": "grc-platform-nest",
  "checks": {
    "database": {
      "status": "healthy",
      "timestamp": "2025-12-08T10:30:00.000Z",
      "details": {
        "connected": true,
        "migrationStatus": {
          "pending": 0,
          "executed": 15,
          "lastMigration": "CreateGrcTables1733000000000"
        },
        "lastBackupTimestamp": null,
        "responseTimeMs": 5
      }
    }
  }
}
```

**Response (degraded):**
```json
{
  "status": "degraded",
  "timestamp": "2025-12-08T10:30:00.000Z",
  "service": "grc-platform-nest",
  "checks": {
    "database": {
      "status": "unhealthy",
      "details": {
        "connected": false,
        "responseTimeMs": 5000
      }
    }
  }
}
```

**Use Case:** Kubernetes readiness probe, traffic routing decisions

### GET /health

Overall health status combining all health checks.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-08T10:30:00.000Z",
  "checks": {
    "db": { "status": "healthy", ... },
    "auth": { "status": "healthy", ... },
    "dotWalking": { "status": "healthy", ... }
  }
}
```

### GET /health/db

Detailed database health check including migration status and backup information.

### GET /health/auth

Authentication configuration health check - verifies JWT and refresh token configuration.

### GET /health/dotwalking

Dot-walking resolver health check - verifies the path resolution functionality.

## Metrics Endpoints

### GET /metrics

Returns metrics in Prometheus plain text exposition format for scraping by Prometheus or compatible tools.

**Sample Response:**
```
# HELP uptime_seconds The number of seconds the application has been running
# TYPE uptime_seconds gauge
uptime_seconds 3600

# HELP memory_usage_mb Current heap memory usage in megabytes
# TYPE memory_usage_mb gauge
memory_usage_mb 128.45

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total 1500

# HELP http_errors_total Total number of HTTP errors (4xx and 5xx)
# TYPE http_errors_total counter
http_errors_total 25

# HELP http_request_count Request count per route
# TYPE http_request_count counter
http_request_count{method="GET",route="/grc/risks"} 500
http_request_count{method="POST",route="/grc/risks"} 50
```

### GET /metrics/json

Returns metrics as JSON for debugging or custom dashboards.

**Response:**
```json
{
  "uptime_seconds": 3600,
  "memory_usage_mb": 128.45,
  "active_handles_count": 12,
  "total_requests": 1500,
  "total_errors": 25,
  "avg_latency_ms": 45.5,
  "routes": {
    "GET /grc/risks": {
      "count": 500,
      "avgLatencyMs": 35.2,
      "maxLatencyMs": 250,
      "minLatencyMs": 5,
      "errorCount": 2,
      "statusCodes": { "200": 498, "404": 2 }
    }
  }
}
```

### GET /metrics/basic

Lightweight metrics endpoint designed for frequent polling by external monitoring tools. Includes entity counts for GRC domain objects.

**Response:**
```json
{
  "timestamp": "2025-12-08T10:30:00.000Z",
  "uptime_seconds": 3600,
  "memory_usage_mb": 128.45,
  "entity_counts": {
    "risks": 150,
    "policies": 45,
    "requirements": 200,
    "incidents": 30
  },
  "http_stats": {
    "total_requests": 1500,
    "total_errors": 25,
    "avg_latency_ms": 45.5
  }
}
```

**Use Case:** External monitoring dashboards, alerting systems, capacity planning

## Searching Logs by requestId/tenantId

### Using grep/jq

```bash
# Search by correlation ID
cat app.log | jq 'select(.correlationId == "550e8400-e29b-41d4-a716-446655440000")'

# Search by tenant ID
cat app.log | jq 'select(.tenantId == "00000000-0000-0000-0000-000000000001")'

# Search by user ID
cat app.log | jq 'select(.userId == "a1b2c3d4-e5f6-7890-abcd-ef1234567890")'

# Find all errors for a tenant
cat app.log | jq 'select(.tenantId == "00000000-0000-0000-0000-000000000001" and .level == "error")'
```

### Using Elasticsearch/Kibana

```
# Search by correlation ID
correlationId: "550e8400-e29b-41d4-a716-446655440000"

# Search by tenant ID with time range
tenantId: "00000000-0000-0000-0000-000000000001" AND @timestamp:[now-1h TO now]

# Find slow requests for a tenant
tenantId: "00000000-0000-0000-0000-000000000001" AND latencyMs:>1000
```

### Using CloudWatch Logs Insights

```sql
fields @timestamp, @message, correlationId, tenantId, userId, latencyMs
| filter correlationId = "550e8400-e29b-41d4-a716-446655440000"
| sort @timestamp asc

-- Find slow requests
fields @timestamp, path, method, latencyMs, tenantId
| filter latencyMs > 1000
| sort latencyMs desc
| limit 100
```

### Using SQL (Audit Logs Table)

```sql
-- Find all audit entries for a correlation ID
SELECT * FROM nest_audit_logs 
WHERE correlation_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at;

-- Find recent errors for a tenant
SELECT * FROM nest_audit_logs 
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND status_code >= 400
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

## Monitoring Configuration Examples

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3002
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3002
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 3
```

### Prometheus Scrape Config

```yaml
scrape_configs:
  - job_name: 'grc-platform-nest'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3002']
    metrics_path: /metrics
```

### External Monitoring (Polling /metrics/basic)

```bash
# Poll every 30 seconds and send to monitoring system
while true; do
  curl -s http://localhost:3002/metrics/basic | \
    your-monitoring-agent --stdin
  sleep 30
done
```

## Future Enhancements (TODOs)

The following enhancements are planned but not yet implemented:

1. **OpenTelemetry Integration**: Add distributed tracing with OpenTelemetry for cross-service request tracing
2. **Prometheus Histograms**: Add latency histograms for percentile calculations (p50, p95, p99)
3. **Custom Business Metrics**: Add domain-specific metrics (risks by severity, policies by status, etc.)
4. **Alerting Rules**: Define Prometheus alerting rules for error rate spikes and latency degradation
5. **Grafana Dashboards**: Create pre-built Grafana dashboard templates
6. **Log Sampling**: Implement log sampling for high-volume endpoints to reduce storage costs
7. **Trace Context Propagation**: Propagate W3C Trace Context headers for distributed tracing
