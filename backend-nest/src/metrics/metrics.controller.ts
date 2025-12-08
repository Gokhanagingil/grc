import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService, BasicMetrics } from './metrics.service';

/**
 * Metrics Controller
 *
 * Exposes Prometheus-compatible metrics endpoint at /metrics.
 * Also provides JSON endpoints for debugging and basic monitoring.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * GET /metrics
   *
   * Returns metrics in Prometheus plain text exposition format.
   * This endpoint can be scraped by Prometheus or other monitoring tools.
   */
  @Get()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  getMetrics(): string {
    return this.metricsService.toPrometheusFormat();
  }

  /**
   * GET /metrics/json
   *
   * Returns metrics as JSON for debugging or custom dashboards.
   */
  @Get('json')
  getMetricsJson(): Record<string, unknown> {
    return this.metricsService.toJson();
  }

  /**
   * GET /metrics/basic
   *
   * Returns basic metrics including entity counts for monitoring.
   * This lightweight endpoint is designed to be polled by external monitoring tools.
   *
   * Response includes:
   * - timestamp: ISO 8601 timestamp
   * - uptime_seconds: Application uptime
   * - memory_usage_mb: Current heap memory usage
   * - entity_counts: Counts of risks, policies, requirements, incidents
   * - http_stats: Total requests, errors, and average latency
   */
  @Get('basic')
  async getBasicMetrics(): Promise<BasicMetrics> {
    return this.metricsService.getBasicMetrics();
  }
}
