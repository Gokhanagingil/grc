import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { GrcRisk } from '../grc/entities/grc-risk.entity';
import { GrcPolicy } from '../grc/entities/grc-policy.entity';
import { GrcRequirement } from '../grc/entities/grc-requirement.entity';
import { ItsmIncident } from '../itsm/incident/incident.entity';

/**
 * Metrics Module
 *
 * Provides application metrics collection and exposure.
 * Marked as @Global so MetricsService can be injected anywhere.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      GrcRisk,
      GrcPolicy,
      GrcRequirement,
      ItsmIncident,
    ]),
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
