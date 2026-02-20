import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PlatformHealthRun,
  HealthRunStatus,
  HealthSuite,
} from './platform-health-run.entity';
import {
  PlatformHealthCheck,
  CheckStatus,
} from './platform-health-check.entity';
import { StructuredLoggerService } from '../common/logger';

export interface IngestPayload {
  suite: string;
  triggeredBy?: string;
  gitSha?: string;
  gitRef?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  tenantId?: string;
  checks: {
    module: string;
    checkName: string;
    status: string;
    durationMs: number;
    httpStatus?: number;
    errorMessage?: string;
    requestUrl?: string;
    responseSnippet?: Record<string, unknown>;
  }[];
}

export interface HealthBadge {
  status: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN';
  suite: string;
  passRate: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  lastRunAt: string | null;
  lastRunId: string | null;
}

@Injectable()
export class PlatformHealthService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(PlatformHealthRun)
    private readonly runRepo: Repository<PlatformHealthRun>,
    @InjectRepository(PlatformHealthCheck)
    private readonly checkRepo: Repository<PlatformHealthCheck>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('PlatformHealthService');
  }

  async ingest(payload: IngestPayload): Promise<PlatformHealthRun> {
    const suite = this.parseSuite(payload.suite);
    const checks = payload.checks || [];

    const passedChecks = checks.filter(
      (c) => c.status.toUpperCase() === 'PASSED',
    ).length;
    const failedChecks = checks.filter(
      (c) => c.status.toUpperCase() === 'FAILED',
    ).length;
    const skippedChecks = checks.filter(
      (c) => c.status.toUpperCase() === 'SKIPPED',
    ).length;

    const runStatus =
      failedChecks > 0 ? HealthRunStatus.FAILED : HealthRunStatus.PASSED;

    const tenantId = payload.tenantId || null;

    const run = this.runRepo.create({
      suite,
      status: runStatus,
      triggeredBy: payload.triggeredBy || 'ci',
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      skippedChecks,
      durationMs: payload.durationMs || 0,
      gitSha: payload.gitSha || null,
      gitRef: payload.gitRef || null,
      startedAt: new Date(payload.startedAt),
      finishedAt: payload.finishedAt ? new Date(payload.finishedAt) : null,
      tenantId,
      checks: checks.map((c) =>
        this.checkRepo.create({
          module: c.module,
          checkName: c.checkName,
          status: this.parseCheckStatus(c.status),
          durationMs: c.durationMs || 0,
          httpStatus: c.httpStatus || null,
          errorMessage: c.errorMessage || null,
          requestUrl: c.requestUrl || null,
          responseSnippet: c.responseSnippet || null,
          tenantId,
        }),
      ),
    });

    const saved = await this.runRepo.save(run);

    this.logger.log('Platform health run ingested', {
      runId: saved.id,
      suite,
      status: runStatus,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
    });

    return saved;
  }

  async listRuns(
    limit: number = 20,
    suite?: string,
    tenantId?: string,
  ): Promise<PlatformHealthRun[]> {
    const qb = this.runRepo
      .createQueryBuilder('run')
      .orderBy('run.startedAt', 'DESC')
      .take(limit);

    if (suite) {
      qb.where('run.suite = :suite', { suite: suite.toUpperCase() });
    }

    if (tenantId) {
      qb.andWhere('run.tenantId = :tenantId', { tenantId });
    } else {
      qb.andWhere('run.tenantId IS NULL');
    }

    return qb.getMany();
  }

  async getRunWithChecks(
    runId: string,
    tenantId?: string,
  ): Promise<PlatformHealthRun | null> {
    const where: Record<string, unknown> = { id: runId };
    if (tenantId) {
      where.tenantId = tenantId;
    }
    return this.runRepo.findOne({
      where,
      relations: ['checks'],
    });
  }

  async getBadge(
    suite: string = 'TIER1',
    tenantId?: string,
  ): Promise<HealthBadge> {
    const where: Record<string, unknown> = { suite: this.parseSuite(suite) };
    if (tenantId) {
      where.tenantId = tenantId;
    }
    const latestRun = await this.runRepo.findOne({
      where,
      order: { startedAt: 'DESC' },
    });

    if (!latestRun) {
      return {
        status: 'UNKNOWN',
        suite,
        passRate: 0,
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        lastRunAt: null,
        lastRunId: null,
      };
    }

    const passRate =
      latestRun.totalChecks > 0
        ? Math.round((latestRun.passedChecks / latestRun.totalChecks) * 100)
        : 0;

    let status: 'GREEN' | 'AMBER' | 'RED';
    if (latestRun.failedChecks === 0) {
      status = 'GREEN';
    } else if (passRate >= 80) {
      status = 'AMBER';
    } else {
      status = 'RED';
    }

    return {
      status,
      suite,
      passRate,
      totalChecks: latestRun.totalChecks,
      passedChecks: latestRun.passedChecks,
      failedChecks: latestRun.failedChecks,
      lastRunAt: latestRun.startedAt.toISOString(),
      lastRunId: latestRun.id,
    };
  }

  private parseSuite(suite: string): HealthSuite {
    const upper = suite.toUpperCase();
    if (upper === 'TIER1') return HealthSuite.TIER1;
    if (upper === 'NIGHTLY') return HealthSuite.NIGHTLY;
    return HealthSuite.MANUAL;
  }

  private parseCheckStatus(status: string): CheckStatus {
    const upper = status.toUpperCase();
    if (upper === 'PASSED') return CheckStatus.PASSED;
    if (upper === 'FAILED') return CheckStatus.FAILED;
    return CheckStatus.SKIPPED;
  }
}
