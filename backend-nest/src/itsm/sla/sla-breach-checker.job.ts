import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  Job,
  JobConfig,
  JobResult,
  JobStatus,
} from '../../jobs/interfaces/job.interface';
import { SlaInstance, SlaInstanceStatus } from './sla-instance.entity';
import { SlaEngineService } from './sla-engine.service';
import { RuntimeLoggerService } from '../diagnostics/runtime-logger.service';
import { TenantsService } from '../../tenants/tenants.service';

@Injectable()
export class SlaBreachCheckerJob implements Job {
  readonly config: JobConfig = {
    name: 'sla-breach-checker',
    description:
      'Periodic SLA breach computation across all tenants. Detects newly breached SLA instances.',
    scheduleIntervalMs: 60 * 1000,
    enabled: true,
    runOnStartup: false,
  };

  constructor(
    @InjectRepository(SlaInstance)
    private readonly instanceRepository: Repository<SlaInstance>,
    private readonly tenantsService: TenantsService,
    private readonly engine: SlaEngineService,
    private readonly runtimeLogger: RuntimeLoggerService,
  ) {}

  async execute(): Promise<JobResult> {
    const jobId = randomUUID();
    const startedAt = new Date();

    try {
      const allTenants = await this.tenantsService.findAll();
      const tenants = allTenants.filter((t) => t.isActive);

      let totalChecked = 0;
      let totalBreached = 0;
      const perTenant: Record<string, { checked: number; breached: number }> =
        {};

      for (const tenant of tenants) {
        const result = await this.checkBreachesForTenant(tenant.id, startedAt);
        totalChecked += result.checked;
        totalBreached += result.breached;
        if (result.checked > 0) {
          perTenant[tenant.id] = result;
        }
      }

      const completedAt = new Date();
      return {
        jobId,
        jobName: this.config.name,
        status: JobStatus.SUCCESS,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        messageCode: 'SLA_BREACH_CHECK_COMPLETE',
        summary: `Checked ${totalChecked} active SLA instances, ${totalBreached} newly breached`,
        details: { totalChecked, totalBreached, tenantCount: tenants.length },
      };
    } catch (error) {
      const completedAt = new Date();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        jobId,
        jobName: this.config.name,
        status: JobStatus.FAILED,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        messageCode: 'SLA_BREACH_CHECK_ERROR',
        error: { code: 'EXECUTION_ERROR', message: errorMessage },
      };
    }
  }

  private async checkBreachesForTenant(
    tenantId: string,
    now: Date,
  ): Promise<{ checked: number; breached: number }> {
    const activeInstances = await this.instanceRepository.find({
      where: {
        tenantId,
        status: In([SlaInstanceStatus.IN_PROGRESS]),
        isDeleted: false,
      },
      relations: ['definition'],
    });

    let breached = 0;
    for (const instance of activeInstances) {
      const def = instance.definition;
      if (!def) continue;

      const elapsed = this.engine.computeElapsedSeconds(
        def,
        instance.startAt,
        now,
        instance.pausedDurationSeconds,
      );

      if (this.engine.isBreached(def, elapsed)) {
        instance.elapsedSeconds = elapsed;
        instance.remainingSeconds = 0;
        instance.breached = true;
        instance.status = SlaInstanceStatus.BREACHED;
        instance.stopAt = now;
        await this.instanceRepository.save(instance);
        breached++;

        this.runtimeLogger.logSlaEvent({
          tenantId,
          definitionName: def.name,
          recordType: instance.recordType,
          recordId: instance.recordId,
          event: 'breached',
          elapsedSeconds: elapsed,
        });
      } else {
        instance.elapsedSeconds = elapsed;
        instance.remainingSeconds = this.engine.computeRemainingSeconds(
          def,
          elapsed,
        );
        await this.instanceRepository.save(instance);
      }
    }

    return { checked: activeInstances.length, breached };
  }
}
