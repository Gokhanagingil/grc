import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@Controller({ path: 'metrics', version: '2' })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({
    summary: 'Prometheus metrics',
    description: 'Get Prometheus metrics endpoint (if enabled)',
  })
  @ApiOkResponse({ description: 'Prometheus metrics in text format' })
  async getMetrics() {
    return this.metricsService.getMetrics();
  }
}
