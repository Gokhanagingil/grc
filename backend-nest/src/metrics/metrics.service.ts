import { Injectable } from '@nestjs/common';

/**
 * Route metrics data structure
 */
interface RouteMetrics {
  count: number;
  totalLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  errorCount: number;
  statusCodes: Record<number, number>;
}

/**
 * Metrics Service
 *
 * Collects and stores in-memory metrics for request counts, latencies, and errors.
 * Provides data for the /metrics endpoint in Prometheus format.
 */
@Injectable()
export class MetricsService {
  private readonly startTime: number = Date.now();
  private readonly routeMetrics: Map<string, RouteMetrics> = new Map();
  private totalRequests: number = 0;
  private totalErrors: number = 0;

  /**
   * Record a request with its latency and status code
   */
  recordRequest(
    method: string,
    path: string,
    statusCode: number,
    latencyMs: number,
  ): void {
    const routeKey = `${method} ${path}`;

    let metrics = this.routeMetrics.get(routeKey);
    if (!metrics) {
      metrics = {
        count: 0,
        totalLatencyMs: 0,
        maxLatencyMs: 0,
        minLatencyMs: Infinity,
        errorCount: 0,
        statusCodes: {},
      };
      this.routeMetrics.set(routeKey, metrics);
    }

    metrics.count++;
    metrics.totalLatencyMs += latencyMs;
    metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, latencyMs);
    metrics.minLatencyMs = Math.min(metrics.minLatencyMs, latencyMs);
    metrics.statusCodes[statusCode] =
      (metrics.statusCodes[statusCode] || 0) + 1;

    this.totalRequests++;
  }

  /**
   * Record an error for a route
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- statusCode reserved for future error categorization
  recordError(method: string, path: string, _statusCode: number): void {
    const routeKey = `${method} ${path}`;

    const metrics = this.routeMetrics.get(routeKey);
    if (metrics) {
      metrics.errorCount++;
    }

    this.totalErrors++;
  }

  /**
   * Get uptime in seconds
   */
  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get memory usage in MB
   */
  getMemoryUsageMb(): number {
    const usage = process.memoryUsage();
    return Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100;
  }

  /**
   * Get active handles count
   */
  getActiveHandlesCount(): number {
    // @ts-expect-error - _getActiveHandles is a private Node.js API not in type definitions
    const handles = process._getActiveHandles?.() as unknown[] | undefined;
    return handles?.length || 0;
  }

  /**
   * Get total request count
   */
  getTotalRequests(): number {
    return this.totalRequests;
  }

  /**
   * Get total error count
   */
  getTotalErrors(): number {
    return this.totalErrors;
  }

  /**
   * Get average latency across all routes
   */
  getAverageLatencyMs(): number {
    if (this.totalRequests === 0) return 0;

    let totalLatency = 0;
    for (const metrics of this.routeMetrics.values()) {
      totalLatency += metrics.totalLatencyMs;
    }

    return Math.round((totalLatency / this.totalRequests) * 100) / 100;
  }

  /**
   * Get metrics for a specific route
   */
  getRouteMetrics(method: string, path: string): RouteMetrics | undefined {
    return this.routeMetrics.get(`${method} ${path}`);
  }

  /**
   * Get all route metrics
   */
  getAllRouteMetrics(): Map<string, RouteMetrics> {
    return this.routeMetrics;
  }

  /**
   * Generate Prometheus-compatible metrics output
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    // Uptime
    lines.push(
      '# HELP uptime_seconds The number of seconds the application has been running',
    );
    lines.push('# TYPE uptime_seconds gauge');
    lines.push(`uptime_seconds ${this.getUptimeSeconds()}`);
    lines.push('');

    // Memory usage
    lines.push('# HELP memory_usage_mb Current heap memory usage in megabytes');
    lines.push('# TYPE memory_usage_mb gauge');
    lines.push(`memory_usage_mb ${this.getMemoryUsageMb()}`);
    lines.push('');

    // Active handles
    lines.push(
      '# HELP active_handles_count Number of active handles in the event loop',
    );
    lines.push('# TYPE active_handles_count gauge');
    lines.push(`active_handles_count ${this.getActiveHandlesCount()}`);
    lines.push('');

    // Total requests
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${this.totalRequests}`);
    lines.push('');

    // Total errors
    lines.push(
      '# HELP http_errors_total Total number of HTTP errors (4xx and 5xx)',
    );
    lines.push('# TYPE http_errors_total counter');
    lines.push(`http_errors_total ${this.totalErrors}`);
    lines.push('');

    // Average latency
    lines.push(
      '# HELP http_request_latency_ms_avg Average request latency in milliseconds',
    );
    lines.push('# TYPE http_request_latency_ms_avg gauge');
    lines.push(`http_request_latency_ms_avg ${this.getAverageLatencyMs()}`);
    lines.push('');

    // Per-route metrics
    lines.push('# HELP http_request_count Request count per route');
    lines.push('# TYPE http_request_count counter');
    for (const [route, metrics] of this.routeMetrics) {
      const [method, path] = route.split(' ');
      const sanitizedPath = path.replace(/"/g, '\\"');
      lines.push(
        `http_request_count{method="${method}",route="${sanitizedPath}"} ${metrics.count}`,
      );
    }
    lines.push('');

    lines.push(
      '# HELP http_request_latency_ms_max Maximum request latency per route in milliseconds',
    );
    lines.push('# TYPE http_request_latency_ms_max gauge');
    for (const [route, metrics] of this.routeMetrics) {
      const [method, path] = route.split(' ');
      const sanitizedPath = path.replace(/"/g, '\\"');
      lines.push(
        `http_request_latency_ms_max{method="${method}",route="${sanitizedPath}"} ${metrics.maxLatencyMs}`,
      );
    }
    lines.push('');

    lines.push(
      '# HELP http_request_latency_ms_avg Average request latency per route in milliseconds',
    );
    lines.push('# TYPE http_request_latency_ms_avg gauge');
    for (const [route, metrics] of this.routeMetrics) {
      const [method, path] = route.split(' ');
      const sanitizedPath = path.replace(/"/g, '\\"');
      const avgLatency =
        metrics.count > 0
          ? Math.round((metrics.totalLatencyMs / metrics.count) * 100) / 100
          : 0;
      lines.push(
        `http_request_latency_ms_avg{method="${method}",route="${sanitizedPath}"} ${avgLatency}`,
      );
    }
    lines.push('');

    lines.push('# HELP http_error_count Error count per route');
    lines.push('# TYPE http_error_count counter');
    for (const [route, metrics] of this.routeMetrics) {
      const [method, path] = route.split(' ');
      const sanitizedPath = path.replace(/"/g, '\\"');
      lines.push(
        `http_error_count{method="${method}",route="${sanitizedPath}"} ${metrics.errorCount}`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Get metrics as JSON (for debugging/API)
   */
  toJson(): Record<string, unknown> {
    const routes: Record<string, unknown> = {};

    for (const [route, metrics] of this.routeMetrics) {
      routes[route] = {
        count: metrics.count,
        avgLatencyMs:
          metrics.count > 0
            ? Math.round((metrics.totalLatencyMs / metrics.count) * 100) / 100
            : 0,
        maxLatencyMs: metrics.maxLatencyMs,
        minLatencyMs:
          metrics.minLatencyMs === Infinity ? 0 : metrics.minLatencyMs,
        errorCount: metrics.errorCount,
        statusCodes: metrics.statusCodes,
      };
    }

    return {
      uptime_seconds: this.getUptimeSeconds(),
      memory_usage_mb: this.getMemoryUsageMb(),
      active_handles_count: this.getActiveHandlesCount(),
      total_requests: this.totalRequests,
      total_errors: this.totalErrors,
      avg_latency_ms: this.getAverageLatencyMs(),
      routes,
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.routeMetrics.clear();
    this.totalRequests = 0;
    this.totalErrors = 0;
  }
}
