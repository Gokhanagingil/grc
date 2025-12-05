import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/**
 * Metrics Controller
 *
 * Exposes Prometheus-compatible metrics endpoint at /metrics.
 * Also provides a JSON endpoint for debugging.
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
}
