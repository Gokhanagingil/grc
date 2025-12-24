/**
 * Jobs Service
 *
 * Lightweight in-process job runner with:
 * - Job registry for managing registered jobs
 * - Schedule interval support
 * - Manual trigger capability
 * - Job run history tracking
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  Job,
  JobResult,
  JobStatus,
  JobRegistryEntry,
  JobRunSummary,
} from './interfaces/job.interface';
import { JobRun } from './entities/job-run.entity';
import { StructuredLoggerService } from '../common/logger';

export interface JobsStatusSummary {
  registeredJobs: {
    name: string;
    description: string;
    enabled: boolean;
    scheduleIntervalMs: number | null;
    lastRun: JobRunSummary | null;
    nextRunAt: string | null;
    runCount: number;
    successCount: number;
    failureCount: number;
  }[];
  totalJobs: number;
  enabledJobs: number;
  recentRuns: JobRunSummary[];
}

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: StructuredLoggerService;
  private readonly registry: Map<string, JobRegistryEntry> = new Map();
  private readonly scheduledIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isShuttingDown = false;

  constructor(
    @InjectRepository(JobRun)
    private readonly jobRunRepository: Repository<JobRun>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('JobsService');
  }

  onModuleInit(): void {
    this.logger.log('Jobs service initialized', {
      registeredJobs: this.registry.size,
    });

    for (const [name, entry] of this.registry) {
      if (entry.job.config.runOnStartup && entry.job.config.enabled) {
        this.logger.log(`Running job on startup: ${name}`);
        this.triggerJob(name).catch((error) => {
          this.logger.error(`Failed to run startup job: ${name}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }

      if (entry.job.config.scheduleIntervalMs && entry.job.config.enabled) {
        this.scheduleJob(name, entry.job.config.scheduleIntervalMs);
      }
    }
  }

  onModuleDestroy(): void {
    this.isShuttingDown = true;
    this.logger.log('Shutting down jobs service');

    for (const [name, interval] of this.scheduledIntervals) {
      clearInterval(interval);
      this.logger.debug(`Cleared scheduled interval for job: ${name}`);
    }
    this.scheduledIntervals.clear();
  }

  registerJob(job: Job): void {
    const name = job.config.name;

    if (this.registry.has(name)) {
      this.logger.warn(`Job already registered, skipping: ${name}`);
      return;
    }

    this.registry.set(name, {
      job,
      lastRun: null,
      nextRunAt: null,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
    });

    this.logger.log(`Job registered: ${name}`, {
      description: job.config.description,
      enabled: job.config.enabled,
      scheduleIntervalMs: job.config.scheduleIntervalMs,
    });
  }

  private scheduleJob(name: string, intervalMs: number): void {
    if (this.scheduledIntervals.has(name)) {
      clearInterval(this.scheduledIntervals.get(name));
    }

    const entry = this.registry.get(name);
    if (entry) {
      entry.nextRunAt = new Date(Date.now() + intervalMs);
    }

    const interval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.triggerJob(name).catch((error) => {
          this.logger.error(`Scheduled job failed: ${name}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }
    }, intervalMs);

    this.scheduledIntervals.set(name, interval);

    this.logger.log(`Job scheduled: ${name}`, {
      intervalMs,
      nextRunAt: entry?.nextRunAt?.toISOString(),
    });
  }

  async triggerJob(name: string): Promise<JobResult> {
    const entry = this.registry.get(name);

    if (!entry) {
      return {
        jobId: randomUUID(),
        jobName: name,
        status: JobStatus.FAILED,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        messageCode: 'JOB_NOT_FOUND',
        error: {
          code: 'NOT_FOUND',
          message: `Job not found: ${name}`,
        },
      };
    }

    if (!entry.job.config.enabled) {
      return {
        jobId: randomUUID(),
        jobName: name,
        status: JobStatus.SKIPPED,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        messageCode: 'JOB_DISABLED',
        summary: `Job is disabled: ${name}`,
      };
    }

    this.logger.log(`Triggering job: ${name}`);

    const startTime = Date.now();
    let result: JobResult;

    try {
      result = await entry.job.execute();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result = {
        jobId: randomUUID(),
        jobName: name,
        status: JobStatus.FAILED,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        messageCode: 'JOB_EXECUTION_ERROR',
        error: {
          code: 'EXECUTION_ERROR',
          message: errorMessage,
        },
      };
    }

    entry.lastRun = result;
    entry.runCount++;

    if (result.status === JobStatus.SUCCESS) {
      entry.successCount++;
    } else if (result.status === JobStatus.FAILED) {
      entry.failureCount++;
    }

    if (entry.job.config.scheduleIntervalMs) {
      entry.nextRunAt = new Date(Date.now() + entry.job.config.scheduleIntervalMs);
    }

    await this.saveJobRun(result);

    this.logger.log(`Job completed: ${name}`, {
      status: result.status,
      durationMs: result.durationMs,
      messageCode: result.messageCode,
    });

    return result;
  }

  async getJobsStatus(): Promise<JobsStatusSummary> {
    const registeredJobs = Array.from(this.registry.entries()).map(
      ([name, entry]) => ({
        name,
        description: entry.job.config.description,
        enabled: entry.job.config.enabled,
        scheduleIntervalMs: entry.job.config.scheduleIntervalMs || null,
        lastRun: entry.lastRun
          ? {
              jobId: entry.lastRun.jobId,
              jobName: entry.lastRun.jobName,
              status: entry.lastRun.status,
              startedAt: entry.lastRun.startedAt,
              completedAt: entry.lastRun.completedAt,
              durationMs: entry.lastRun.durationMs,
              summary: entry.lastRun.summary,
            }
          : null,
        nextRunAt: entry.nextRunAt?.toISOString() || null,
        runCount: entry.runCount,
        successCount: entry.successCount,
        failureCount: entry.failureCount,
      }),
    );

    const recentRuns = await this.jobRunRepository.find({
      order: { startedAt: 'DESC' },
      take: 10,
    });

    return {
      registeredJobs,
      totalJobs: this.registry.size,
      enabledJobs: Array.from(this.registry.values()).filter(
        (e) => e.job.config.enabled,
      ).length,
      recentRuns: recentRuns.map((run) => ({
        jobId: run.id,
        jobName: run.jobName,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() || '',
        durationMs: run.durationMs,
        summary: run.summary || undefined,
      })),
    };
  }

  async getRecentRuns(limit: number = 10): Promise<JobRun[]> {
    return this.jobRunRepository.find({
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  async getLastRunForJob(jobName: string): Promise<JobRun | null> {
    return this.jobRunRepository.findOne({
      where: { jobName },
      order: { startedAt: 'DESC' },
    });
  }

  private async saveJobRun(result: JobResult): Promise<void> {
    try {
      const jobRun = this.jobRunRepository.create({
        jobName: result.jobName,
        status: result.status,
        messageCode: result.messageCode,
        summary: result.summary || null,
        details: result.details || null,
        errorCode: result.error?.code || null,
        errorMessage: result.error?.message || null,
        durationMs: result.durationMs,
        startedAt: new Date(result.startedAt),
        completedAt: new Date(result.completedAt),
      });

      await this.jobRunRepository.save(jobRun);
    } catch (error) {
      this.logger.error('Failed to save job run', {
        jobName: result.jobName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
