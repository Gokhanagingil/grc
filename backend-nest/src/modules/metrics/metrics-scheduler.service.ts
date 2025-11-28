import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MetricsService } from './metrics.service';
import {
  AuditFindingEntity,
  CorrectiveActionEntity,
  BIAProcessEntity,
  BCPPlanEntity,
  BCPExerciseEntity,
} from '../../entities/app';
import { AuditFindingStatus } from '../../entities/app/audit-finding.entity';
import { CorrectiveActionStatus } from '../../entities/app/corrective-action.entity';
import { tenantWhere } from '../../common/tenant/tenant-query.util';

@Injectable()
export class MetricsSchedulerService {
  private readonly logger = new Logger(MetricsSchedulerService.name);

  constructor(
    @InjectRepository(AuditFindingEntity)
    private readonly findingRepo: Repository<AuditFindingEntity>,
    @InjectRepository(CorrectiveActionEntity)
    private readonly capRepo: Repository<CorrectiveActionEntity>,
    @InjectRepository(BIAProcessEntity)
    private readonly biaProcessRepo: Repository<BIAProcessEntity>,
    @InjectRepository(BCPPlanEntity)
    private readonly bcpPlanRepo: Repository<BCPPlanEntity>,
    @InjectRepository(BCPExerciseEntity)
    private readonly bcpExerciseRepo: Repository<BCPExerciseEntity>,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Refresh all gauge metrics every 60 seconds
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async refreshGauges() {
    if (!this.metricsService || !this.metricsService.isEnabled()) {
      return;
    }

    try {
      // Get all unique tenant IDs from findings
      const tenants = await this.findingRepo
        .createQueryBuilder('finding')
        .select('DISTINCT finding.tenant_id', 'tenant_id')
        .getRawMany();

      for (const row of tenants) {
        const tenantId = row.tenant_id as string;
        if (!tenantId) continue;

        // Audit findings open count
        const openFindingsCount = await this.findingRepo.count({
          where: {
            status: AuditFindingStatus.OPEN,
            ...tenantWhere(tenantId),
          },
        });
        const findingsGauge = this.metricsService.getGauge(
          'audit_findings_open_total',
        );
        if (findingsGauge) {
          findingsGauge.set({ tenant_id: tenantId }, openFindingsCount);
        }

        // Audit CAPs open count (OPEN + IN_PROGRESS)
        const tenantWhereClause = tenantWhere(tenantId);
        const openCapsCount = await this.capRepo
          .createQueryBuilder('cap')
          .where('cap.tenant_id = :tenantId', { tenantId })
          .andWhere(
            '(cap.status = :open OR cap.status = :inProgress)',
            {
              open: CorrectiveActionStatus.OPEN,
              inProgress: CorrectiveActionStatus.IN_PROGRESS,
            },
          )
          .getCount();
        const capsGauge = this.metricsService.getGauge('audit_caps_open_total');
        if (capsGauge) {
          capsGauge.set({ tenant_id: tenantId }, openCapsCount);
        }

        // BCM process count
        const biaProcessCount = await this.biaProcessRepo.count({
          where: tenantWhere(tenantId),
        });
        const processGauge = this.metricsService.getGauge('bcm_process_count');
        if (processGauge) {
          processGauge.set({ tenant_id: tenantId }, biaProcessCount);
        }

        // BCM plan count
        const bcpPlanCount = await this.bcpPlanRepo.count({
          where: tenantWhere(tenantId),
        });
        const planGauge = this.metricsService.getGauge('bcm_plan_count');
        if (planGauge) {
          planGauge.set({ tenant_id: tenantId }, bcpPlanCount);
        }

        // BCM exercise count
        const bcpExerciseCount = await this.bcpExerciseRepo.count({
          where: tenantWhere(tenantId),
        });
        const exerciseGauge = this.metricsService.getGauge(
          'bcm_exercise_count',
        );
        if (exerciseGauge) {
          exerciseGauge.set({ tenant_id: tenantId }, bcpExerciseCount);
        }
      }

      this.logger.debug('Metrics gauges refreshed');
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.warn('Error refreshing metrics gauges:', error.message);
      }
    }
  }
}

