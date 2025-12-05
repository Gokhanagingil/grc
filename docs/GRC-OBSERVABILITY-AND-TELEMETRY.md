# GRC Backend - Observability, Telemetry & Correlation Architecture

This document describes the enterprise-grade observability features implemented in the NestJS GRC backend during the "Enterprise Observability & Operational Excellence Sprint".

## Overview

The sprint focused on adding comprehensive observability capabilities to the NestJS GRC backend, including structured logging, request correlation, tenant-aware diagnostics, performance telemetry, and Prometheus-compatible metrics.

## 1. Structured Logging

All logs are output as JSON for easy parsing by log aggregation tools (ELK, Splunk, CloudWatch, etc.).

### Log Entry Format

```json
{
  "timestamp": "2025-12-05T07:45:00.000Z",
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

### Log Levels

| Level | Usage |
|-------|-------|
| `error` | Exceptions, failed operations, system errors |
| `warn` | Degraded performance, retries, non-critical issues |
| `info` | Request completion, business events, audit entries |
| `debug` | Detailed debugging information |
| `verbose` | Very detailed tracing information |

### StructuredLoggerService

The `StructuredLoggerService` replaces NestJS's default logger and provides:

- JSON-formatted output to stdout/stderr
- Automatic context enrichment (correlationId, tenantId, userId, path, method)
- Child logger creation for module-specific logging
- Request completion logging with latency metrics

```typescript
// Usage in services/controllers
import { StructuredLoggerService } from '../common/logger';

@Injectable()
export class MyService {
  private readonly logger = new StructuredLoggerService();

  constructor() {
    this.logger.setContext('MyService');
  }

  doSomething() {
    this.logger.log('Operation started', { operationId: '123' });
  }
}
```

## 2. Correlation ID Middleware

Every request is assigned a unique correlation ID that flows through all services and logs.

### How It Works

1. **Incoming Request**: Middleware checks for `x-correlation-id` header
2. **ID Generation**: If not present, generates a new UUID v4
3. **Context Propagation**: ID is attached to request object and logger context
4. **Response Header**: ID is returned in `x-correlation-id` response header
5. **Audit Logging**: ID is stored with audit log entries

### Request Flow Diagram

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Client    │────▶│ CorrelationIdMiddleware │────▶│   Controller    │
│             │     │                      │     │                 │
│ x-correlation-id  │  Generate/Extract ID │     │  Process Request│
│ (optional)  │     │  Set Logger Context  │     │                 │
└─────────────┘     └──────────────────────┘     └─────────────────┘
                              │                          │
                              ▼                          ▼
                    ┌──────────────────┐       ┌─────────────────┐
                    │ StructuredLogger │       │  AuditService   │
                    │                  │       │                 │
                    │ Log with         │       │ Store with      │
                    │ correlationId    │       │ correlationId   │
                    └──────────────────┘       └─────────────────┘
```

### Usage

```bash
# Client can provide correlation ID
curl -H "x-correlation-id: my-trace-123" http://localhost:3002/grc/risks

# Response includes correlation ID
# x-correlation-id: my-trace-123

# Or let the server generate one
curl http://localhost:3002/grc/risks
# x-correlation-id: 550e8400-e29b-41d4-a716-446655440000
```

## 3. Tenant-Aware Request Context

The `RequestContextService` provides request-scoped context accessible via dependency injection.

### Context Properties

| Property | Type | Description |
|----------|------|-------------|
| `correlationId` | string | Unique request identifier |
| `tenantId` | string | Tenant ID from `x-tenant-id` header |
| `userId` | string | User ID from JWT token |
| `path` | string | Request path |
| `method` | string | HTTP method |
| `startTime` | number | Request start timestamp |
| `userAgent` | string | Client user agent |
| `ip` | string | Client IP address |

### Usage

```typescript
import { RequestContextService } from '../common/context';

@Injectable()
export class MyService {
  constructor(private readonly context: RequestContextService) {}

  doSomething() {
    console.log(`Tenant: ${this.context.tenantId}`);
    console.log(`User: ${this.context.userId}`);
    console.log(`Correlation: ${this.context.correlationId}`);
    console.log(`Elapsed: ${this.context.getElapsedMs()}ms`);
  }
}
```

## 4. Request Latency Metrics

The `RequestTimingInterceptor` measures request latency and logs structured completion events.

### Metrics Collected

- Request count per route
- Average latency per route
- Maximum latency per route
- Minimum latency per route
- Error count per route
- Status code distribution

### Sample Log Output

```json
{
  "timestamp": "2025-12-05T07:45:00.000Z",
  "level": "info",
  "message": "request.completed",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "path": "/grc/risks",
  "method": "GET",
  "latencyMs": 45,
  "statusCode": 200,
  "metadata": {
    "route": "/grc/risks",
    "contentLength": "1234"
  }
}
```

## 5. Prometheus Metrics Endpoint

The `/metrics` endpoint exposes metrics in Prometheus plain text exposition format.

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `uptime_seconds` | gauge | Application uptime |
| `memory_usage_mb` | gauge | Heap memory usage |
| `active_handles_count` | gauge | Event loop handles |
| `http_requests_total` | counter | Total HTTP requests |
| `http_errors_total` | counter | Total HTTP errors |
| `http_request_latency_ms_avg` | gauge | Average latency |
| `http_request_count{method,route}` | counter | Requests per route |
| `http_request_latency_ms_max{method,route}` | gauge | Max latency per route |
| `http_error_count{method,route}` | counter | Errors per route |

### Sample Output

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

# HELP http_request_count Request count per route
# TYPE http_request_count counter
http_request_count{method="GET",route="/grc/risks"} 500
http_request_count{method="POST",route="/grc/risks"} 50
http_request_count{method="GET",route="/grc/policies"} 300
```

### Endpoints

| Endpoint | Format | Description |
|----------|--------|-------------|
| `GET /metrics` | Prometheus text | Prometheus-compatible metrics |
| `GET /metrics/json` | JSON | Metrics as JSON for debugging |

## 6. Performance Profiling

The `@Perf()` decorator enables detailed performance profiling for controller methods.

### Usage

```typescript
import { Perf } from '../common/decorators';

@Controller('grc/risks')
export class GrcRiskController {
  @Get()
  @Perf()
  async findAll() {
    // Method execution is timed and logged
  }
}
```

### Sample Log Output

```json
{
  "timestamp": "2025-12-05T07:45:00.000Z",
  "level": "info",
  "message": "perf.handler.completed",
  "context": "PerformanceInterceptor",
  "metadata": {
    "handler": "GrcRiskController.findAll",
    "durationMs": 23.45,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "path": "/grc/risks",
    "method": "GET",
    "outcome": "success",
    "responseSize": 4567
  }
}
```

### Instrumented Controllers

All GRC controllers are instrumented with `@Perf()`:

- `GrcRiskController` - All 9 endpoints
- `GrcPolicyController` - All 9 endpoints
- `GrcRequirementController` - All 8 endpoints

## 7. Audit Log Correlation

Audit logs now include correlation ID and latency metrics for complete request tracing.

### Audit Log Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Audit log ID |
| `tenantId` | UUID | Tenant ID |
| `userId` | UUID | User ID |
| `action` | string | Action performed |
| `resource` | string | Resource type |
| `resourceId` | string | Resource ID |
| `statusCode` | number | HTTP status code |
| `metadata` | JSON | Additional data |
| `ipAddress` | string | Client IP |
| `correlationId` | UUID | Request correlation ID |
| `latencyMs` | number | Request latency |
| `createdAt` | timestamp | Log creation time |

### Querying by Correlation ID

```sql
SELECT * FROM nest_audit_logs 
WHERE correlation_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at;
```

## 8. Files Created/Modified

### New Files

| File | Description |
|------|-------------|
| `src/common/logger/structured-logger.service.ts` | JSON structured logger |
| `src/common/logger/index.ts` | Logger exports |
| `src/common/context/request-context.service.ts` | Request-scoped context |
| `src/common/context/index.ts` | Context exports |
| `src/common/middleware/correlation-id.middleware.ts` | Correlation ID middleware |
| `src/common/middleware/index.ts` | Middleware exports |
| `src/common/interceptors/request-timing.interceptor.ts` | Request timing |
| `src/common/interceptors/performance.interceptor.ts` | Performance profiling |
| `src/common/interceptors/index.ts` | Interceptor exports |
| `src/common/decorators/perf.decorator.ts` | @Perf() decorator |
| `src/common/decorators/index.ts` | Decorator exports |
| `src/metrics/metrics.service.ts` | Metrics collection |
| `src/metrics/metrics.controller.ts` | /metrics endpoint |
| `src/metrics/metrics.module.ts` | Metrics module |
| `src/metrics/index.ts` | Metrics exports |
| `docs/GRC-OBSERVABILITY-AND-TELEMETRY.md` | This document |

### Modified Files

| File | Changes |
|------|---------|
| `src/app.module.ts` | Added MetricsModule, middleware, interceptors |
| `src/main.ts` | Use StructuredLoggerService |
| `src/audit/audit-log.entity.ts` | Added correlationId, latencyMs fields |
| `src/audit/audit.service.ts` | Include correlationId, latencyMs in logs |
| `src/events/domain-events.ts` | Added correlationId, latencyMs to AuditLogEvent |
| `src/grc/controllers/grc-risk.controller.ts` | Added @Perf() to all methods |
| `src/grc/controllers/grc-policy.controller.ts` | Added @Perf() to all methods |
| `src/grc/controllers/grc-requirement.controller.ts` | Added @Perf() to all methods |
| `src/common/index.ts` | Export new modules |

## 9. Recommended Kibana Dashboards

### Request Overview Dashboard

- Total requests over time (line chart)
- Error rate percentage (gauge)
- Average latency (gauge)
- Top 10 slowest endpoints (table)
- Status code distribution (pie chart)

### Tenant Activity Dashboard

- Requests per tenant (bar chart)
- Active tenants over time (line chart)
- Tenant error rates (table)
- Tenant latency comparison (bar chart)

### Correlation Trace Dashboard

- Request timeline by correlation ID (timeline)
- Related audit logs (table)
- Error details (JSON viewer)
- Performance breakdown (flame graph)

## 10. Next Steps

1. **Distributed Tracing**: Integrate with OpenTelemetry for cross-service tracing
2. **Alerting**: Set up alerts for error rate spikes and latency degradation
3. **APM Integration**: Connect to Datadog, New Relic, or similar APM tools
4. **Custom Metrics**: Add business-specific metrics (risks created, policies approved, etc.)
5. **Log Retention**: Configure log rotation and archival policies
6. **Dashboard Templates**: Create Grafana/Kibana dashboard templates
