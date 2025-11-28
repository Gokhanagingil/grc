import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLifecycleService } from './audit-lifecycle.service';
import { AuditLifecycleController } from './audit-lifecycle.controller';
import { AuditEntity } from './audit.entity';
import {
  AuditPlanEntity,
  AuditEngagementEntity,
  AuditTestEntity,
  AuditEvidenceEntity,
  AuditFindingEntity,
  CorrectiveActionEntity,
  ProcessEntity,
  ProcessControlEntity,
} from '../../entities/app';
// RealtimeModule temporarily removed for SQLite stability
// import { RealtimeModule } from '../realtime/realtime.module';
import { MetricsModule } from '../metrics/metrics.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditEntity,
      AuditPlanEntity,
      AuditEngagementEntity,
      AuditTestEntity,
      AuditEvidenceEntity,
      AuditFindingEntity,
      CorrectiveActionEntity,
      ProcessEntity,
      ProcessControlEntity,
    ]),
    // RealtimeModule temporarily removed for SQLite stability
    MetricsModule,
    CalendarModule,
  ],
  providers: [AuditService, AuditLifecycleService],
  controllers: [AuditLifecycleController],
  exports: [AuditService, AuditLifecycleService],
})
export class AuditModule {}
