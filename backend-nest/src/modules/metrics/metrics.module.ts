import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsSchedulerService } from './metrics-scheduler.service';
import { METRICS_PORT } from '../../common/services/metrics.tokens';
import {
  AuditFindingEntity,
  CorrectiveActionEntity,
  BIAProcessEntity,
  BCPPlanEntity,
  BCPExerciseEntity,
} from '../../entities/app';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      AuditFindingEntity,
      CorrectiveActionEntity,
      BIAProcessEntity,
      BCPPlanEntity,
      BCPExerciseEntity,
    ]),
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsSchedulerService,
    { provide: METRICS_PORT, useExisting: MetricsService }, // Port bind
  ],
  exports: [
    MetricsService,
    { provide: METRICS_PORT, useExisting: MetricsService }, // Port export
  ],
})
export class MetricsModule {}
