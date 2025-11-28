import { Module, Global } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { MetricsModule } from '../metrics/metrics.module';
import { MetricsService } from '../metrics/metrics.service';

@Global()
@Module({
  imports: [MetricsModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly metricsService: MetricsService,
  ) {
    // Inject MetricsService into gateway after construction
    gateway.setMetricsService(metricsService);
  }
}
