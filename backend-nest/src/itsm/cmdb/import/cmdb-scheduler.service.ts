import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { CmdbImportSource } from './cmdb-import-source.entity';
import { CmdbImportJob, ImportJobStatus } from './cmdb-import-job.entity';
import { EventBusService } from '../../../event-bus/event-bus.service';
import { StructuredLoggerService } from '../../../common/logger';
import { getNextRunDate, isValidCron } from './engine/cron-utils';

@Injectable()
export class CmdbSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: StructuredLoggerService;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private readonly TICK_MS = 60_000;
  private processing = false;

  constructor(
    @InjectRepository(CmdbImportSource)
    private readonly sourceRepo: Repository<CmdbImportSource>,
    @InjectRepository(CmdbImportJob)
    private readonly jobRepo: Repository<CmdbImportJob>,
    private readonly eventBus: EventBusService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('CmdbSchedulerService');
  }

  onModuleInit(): void {
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'test') {
      this.logger.log('Scheduler disabled in test environment');
      return;
    }
    this.tickInterval = setInterval(() => {
      void this.tick();
    }, this.TICK_MS);
    this.logger.log('Scheduler started with 60s tick interval');
  }

  onModuleDestroy(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.logger.log('Scheduler stopped');
  }

  async tick(): Promise<void> {
    if (this.processing) {
      this.logger.debug('Tick skipped: previous tick still processing');
      return;
    }
    this.processing = true;
    try {
      await this.processDueSources();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Scheduler tick error: ${msg}`);
    } finally {
      this.processing = false;
    }
  }

  async processDueSources(): Promise<number> {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const dueSources = await this.sourceRepo.find({
      where: {
        scheduleEnabled: true,
        enabled: true,
        isDeleted: false,
        nextRunAt: LessThanOrEqual(now),
      },
      order: { nextRunAt: 'ASC' },
      take: 50,
    });

    let triggered = 0;
    for (const source of dueSources) {
      try {
        const created = await this.triggerSourceRun(source, todayStr);
        if (created) triggered++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(
          `Failed to trigger run for source ${source.id}: ${msg}`,
        );
      }
    }

    if (triggered > 0) {
      this.logger.log(`Triggered ${triggered} scheduled import runs`);
    }
    return triggered;
  }

  async triggerSourceRun(
    source: CmdbImportSource,
    todayStr: string,
  ): Promise<CmdbImportJob | null> {
    if (source.runCountResetDate !== todayStr) {
      await this.sourceRepo.update(source.id, {
        runCountToday: 0,
        runCountResetDate: todayStr,
      });
      source.runCountToday = 0;
      source.runCountResetDate = todayStr;
    }

    if (source.runCountToday >= source.maxRunsPerDay) {
      this.logger.warn(
        `Source ${source.id} hit maxRunsPerDay (${source.maxRunsPerDay})`,
      );
      const nextRun = this.computeNextRun(source);
      await this.sourceRepo.update(source.id, { nextRunAt: nextRun });
      return null;
    }

    const runningJob = await this.jobRepo.findOne({
      where: {
        sourceId: source.id,
        tenantId: source.tenantId,
        isDeleted: false,
        status: ImportJobStatus.PENDING,
      },
    });
    if (runningJob) {
      this.logger.debug(
        `Source ${source.id} already has a PENDING job, skipping`,
      );
      return null;
    }

    const parsingJob = await this.jobRepo.findOne({
      where: {
        sourceId: source.id,
        tenantId: source.tenantId,
        isDeleted: false,
        status: ImportJobStatus.PARSING,
      },
    });
    if (parsingJob) {
      this.logger.debug(
        `Source ${source.id} already has a PARSING job, skipping`,
      );
      return null;
    }

    const reconcilingJob = await this.jobRepo.findOne({
      where: {
        sourceId: source.id,
        tenantId: source.tenantId,
        isDeleted: false,
        status: ImportJobStatus.RECONCILING,
      },
    });
    if (reconcilingJob) {
      this.logger.debug(
        `Source ${source.id} already has a RECONCILING job, skipping`,
      );
      return null;
    }

    const job = this.jobRepo.create({
      tenantId: source.tenantId,
      sourceId: source.id,
      status: ImportJobStatus.PENDING,
      dryRun: source.dryRunByDefault,
      totalRows: 0,
      isDeleted: false,
    });

    const saved = await this.jobRepo.save(job);

    const nextRun = this.computeNextRun(source);
    await this.sourceRepo.update(source.id, {
      lastRunAt: new Date(),
      nextRunAt: nextRun,
      runCountToday: source.runCountToday + 1,
    });

    await this.eventBus.emit({
      tenantId: source.tenantId,
      source: 'cmdb-scheduler',
      eventName: 'import.job.started',
      tableName: 'cmdb_import_job',
      recordId: saved.id,
      payload: {
        jobId: saved.id,
        sourceId: source.id,
        sourceName: source.name,
        dryRun: saved.dryRun,
        triggeredBy: 'scheduler',
      },
    });

    this.logger.log(`Created scheduled job ${saved.id} for source ${source.id}`);
    return saved;
  }

  computeNextRun(source: CmdbImportSource): Date | null {
    if (!source.cronExpr || !isValidCron(source.cronExpr)) {
      return null;
    }
    try {
      return getNextRunDate(source.cronExpr, new Date());
    } catch {
      return null;
    }
  }

  async emitJobFinished(
    tenantId: string,
    job: CmdbImportJob,
    duration: number,
  ): Promise<void> {
    await this.eventBus.emit({
      tenantId,
      source: 'cmdb-import',
      eventName: 'import.job.finished',
      tableName: 'cmdb_import_job',
      recordId: job.id,
      payload: {
        jobId: job.id,
        sourceId: job.sourceId,
        status: job.status,
        totalRows: job.totalRows,
        createdCount: job.createdCount,
        updatedCount: job.updatedCount,
        conflictCount: job.conflictCount,
        errorCount: job.errorCount,
        durationMs: duration,
      },
    });
  }

  async emitJobFailed(
    tenantId: string,
    jobId: string,
    error: string,
  ): Promise<void> {
    await this.eventBus.emit({
      tenantId,
      source: 'cmdb-import',
      eventName: 'import.job.failed',
      tableName: 'cmdb_import_job',
      recordId: jobId,
      payload: {
        jobId,
        error,
      },
    });
  }
}
