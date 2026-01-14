import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GrcIssue } from '../entities/grc-issue.entity';
import { GrcCapa } from '../entities/grc-capa.entity';
import { GrcTestResult } from '../entities/grc-test-result.entity';
import { GrcEvidence } from '../entities/grc-evidence.entity';
import { GrcControlEvidence } from '../entities/grc-control-evidence.entity';
import { IssueStatus, CapaStatus, TestResultOutcome } from '../enums';

/**
 * GRC Insights Overview Response
 */
export interface GrcInsightsOverview {
  openIssuesBySeverity: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  overdueCAPAsCount: number;
  recentFailTestResults: Array<{
    id: string;
    name: string;
    testedAt: Date | null;
    controlTestName: string | null;
  }>;
  evidenceStats: {
    linked: number;
    unlinked: number;
    total: number;
  };
  summary: {
    totalOpenIssues: number;
    totalOverdueCAPAs: number;
    totalFailedTests: number;
  };
}

/**
 * GRC Insights Service
 *
 * Provides aggregated GRC metrics and insights for dashboards.
 * Part of Sprint 1E: Lite Reporting feature.
 */
@Injectable()
export class GrcInsightsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get GRC Insights Overview
   * Returns aggregated metrics for the tenant
   */
  async getOverview(tenantId: string): Promise<GrcInsightsOverview> {
    const [
      openIssuesBySeverity,
      overdueCAPAsCount,
      recentFailTestResults,
      evidenceStats,
    ] = await Promise.all([
      this.getOpenIssuesBySeverity(tenantId),
      this.getOverdueCAPAsCount(tenantId),
      this.getRecentFailTestResults(tenantId, 10),
      this.getEvidenceStats(tenantId),
    ]);

    const totalOpenIssues = Object.values(openIssuesBySeverity).reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      openIssuesBySeverity,
      overdueCAPAsCount,
      recentFailTestResults,
      evidenceStats,
      summary: {
        totalOpenIssues,
        totalOverdueCAPAs: overdueCAPAsCount,
        totalFailedTests: recentFailTestResults.length,
      },
    };
  }

  /**
   * Get count of open issues grouped by severity
   */
  private async getOpenIssuesBySeverity(
    tenantId: string,
  ): Promise<GrcInsightsOverview['openIssuesBySeverity']> {
    const issueRepo = this.dataSource.getRepository(GrcIssue);

    const openStatuses = [IssueStatus.OPEN, IssueStatus.IN_PROGRESS];

    const results = await issueRepo
      .createQueryBuilder('issue')
      .select('issue.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('issue.tenantId = :tenantId', { tenantId })
      .andWhere('issue.status IN (:...statuses)', { statuses: openStatuses })
      .andWhere('issue.isDeleted = false')
      .groupBy('issue.severity')
      .getRawMany();

    const severityCounts: GrcInsightsOverview['openIssuesBySeverity'] = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    for (const row of results as Array<{ severity: string; count: string }>) {
      const severity = row.severity;
      const count = parseInt(row.count, 10);
      if (severity in severityCounts) {
        severityCounts[severity as keyof typeof severityCounts] = count;
      }
    }

    return severityCounts;
  }

  /**
   * Get count of overdue CAPAs
   * Overdue = dueDate < today AND status not CLOSED/CANCELLED
   */
  private async getOverdueCAPAsCount(tenantId: string): Promise<number> {
    const capaRepo = this.dataSource.getRepository(GrcCapa);

    const closedStatuses = [CapaStatus.CLOSED, CapaStatus.CANCELLED];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await capaRepo
      .createQueryBuilder('capa')
      .where('capa.tenantId = :tenantId', { tenantId })
      .andWhere('capa.dueDate < :today', { today })
      .andWhere('capa.status NOT IN (:...closedStatuses)', { closedStatuses })
      .andWhere('capa.isDeleted = false')
      .getCount();

    return count;
  }

  /**
   * Get recent FAIL test results
   */
  private async getRecentFailTestResults(
    tenantId: string,
    limit: number,
  ): Promise<GrcInsightsOverview['recentFailTestResults']> {
    const testResultRepo = this.dataSource.getRepository(GrcTestResult);

    const results = await testResultRepo
      .createQueryBuilder('tr')
      .leftJoinAndSelect('tr.controlTest', 'ct')
      .where('tr.tenantId = :tenantId', { tenantId })
      .andWhere('tr.result = :failResult', {
        failResult: TestResultOutcome.FAIL,
      })
      .andWhere('tr.isDeleted = false')
      .orderBy('tr.testedAt', 'DESC')
      .take(limit)
      .getMany();

    return results.map((tr) => ({
      id: tr.id,
      name: tr.controlTest?.name ?? `Test Result ${tr.id.slice(0, 8)}`,
      testedAt: tr.createdAt ?? null,
      controlTestName: tr.controlTest?.name ?? null,
    }));
  }

  /**
   * Get evidence statistics (linked vs unlinked)
   */
  private async getEvidenceStats(
    tenantId: string,
  ): Promise<GrcInsightsOverview['evidenceStats']> {
    const evidenceRepo = this.dataSource.getRepository(GrcEvidence);
    const controlEvidenceRepo =
      this.dataSource.getRepository(GrcControlEvidence);

    const totalEvidence = await evidenceRepo.count({
      where: { tenantId, isDeleted: false },
    });

    const linkedEvidenceIds = await controlEvidenceRepo
      .createQueryBuilder('ce')
      .select('DISTINCT ce.evidenceId', 'evidenceId')
      .where('ce.tenantId = :tenantId', { tenantId })
      .getRawMany();

    const linkedCount = linkedEvidenceIds.length;
    const unlinkedCount = totalEvidence - linkedCount;

    return {
      linked: linkedCount,
      unlinked: Math.max(0, unlinkedCount),
      total: totalEvidence,
    };
  }
}
