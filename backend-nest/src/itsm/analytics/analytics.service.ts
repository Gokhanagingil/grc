import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { ItsmProblem } from '../problem/problem.entity';
import { ItsmKnownError } from '../known-error/known-error.entity';
import { ItsmMajorIncident } from '../major-incident/major-incident.entity';
import { ItsmPir } from '../pir/pir.entity';
import { ItsmPirAction } from '../pir/pir-action.entity';
import { ItsmKnowledgeCandidate } from '../pir/knowledge-candidate.entity';
import { AnalyticsFilterDto } from './dto';
import { KnownErrorState, ProblemState } from '../enums';
import { MajorIncidentStatus } from '../major-incident/major-incident.enums';
import { PirActionStatus, PirStatus } from '../pir/pir.enums';

// ============================================================================
// Response Interfaces
// ============================================================================

export interface ExecutiveSummary {
  kpis: {
    totalProblems: number;
    openProblems: number;
    openMajorIncidents: number;
    pirCompletionPct: number;
    actionOverdueCount: number;
    knownErrorsPublished: number;
    knowledgeCandidatesGenerated: number;
    problemReopenRate: number;
  };
  problemTrend: TrendPoint[];
  majorIncidentTrend: TrendPoint[];
  closureEffectiveness: {
    problemClosureRate: number;
    actionClosureRate: number;
    avgDaysToCloseProblem: number;
    avgDaysToCloseAction: number;
  };
  severityDistribution: CountByLabel[];
  generatedAt: string;
}

export interface TrendPoint {
  period: string;
  opened: number;
  closed: number;
  resolved: number;
}

export interface CountByLabel {
  label: string;
  count: number;
}

export interface ProblemTrends {
  stateDistribution: CountByLabel[];
  priorityDistribution: CountByLabel[];
  categoryDistribution: CountByLabel[];
  trend: TrendPoint[];
  aging: AgingBucket[];
  reopenedCount: number;
  avgDaysOpen: number;
  generatedAt: string;
}

export interface AgingBucket {
  bucket: string;
  count: number;
}

export interface MajorIncidentMetrics {
  totalCount: number;
  byStatus: CountByLabel[];
  bySeverity: CountByLabel[];
  mttrHours: number | null;
  avgBridgeDurationHours: number | null;
  pirCompletionRate: number;
  trend: TrendPoint[];
  generatedAt: string;
}

export interface PirEffectiveness {
  totalPirs: number;
  statusDistribution: CountByLabel[];
  actionCompletionRate: number;
  actionOverdueCount: number;
  avgDaysToCompleteAction: number | null;
  knowledgeCandidateCount: number;
  knowledgeCandidatesByStatus: CountByLabel[];
  generatedAt: string;
}

export interface KnownErrorLifecycle {
  totalCount: number;
  stateDistribution: CountByLabel[];
  fixStatusDistribution: CountByLabel[];
  publicationRate: number;
  retirementRate: number;
  problemToKeConversionRate: number;
  generatedAt: string;
}

export interface ClosureEffectiveness {
  problemClosureRateTrend: TrendPoint[];
  reopenedProblemRate: number;
  reopenedProblems: number;
  actionClosureRate: number;
  avgDaysToCloseProblem: number | null;
  avgDaysToCloseAction: number | null;
  pirClosureRate: number;
  generatedAt: string;
}

export interface BacklogItem {
  id: string;
  type: 'PROBLEM' | 'ACTION' | 'PIR';
  title: string;
  priority: string;
  state: string;
  ageDays: number;
  lastUpdated: string;
  assignee: string | null;
}

export interface BacklogSummary {
  openProblemsByPriority: CountByLabel[];
  openActionsByPriority: CountByLabel[];
  overdueActions: number;
  staleItems: number;
  items: BacklogItem[];
  generatedAt: string;
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(ItsmProblem)
    private readonly problemRepo: Repository<ItsmProblem>,
    @InjectRepository(ItsmKnownError)
    private readonly knownErrorRepo: Repository<ItsmKnownError>,
    @InjectRepository(ItsmMajorIncident)
    private readonly majorIncidentRepo: Repository<ItsmMajorIncident>,
    @InjectRepository(ItsmPir)
    private readonly pirRepo: Repository<ItsmPir>,
    @InjectRepository(ItsmPirAction)
    private readonly pirActionRepo: Repository<ItsmPirAction>,
    @InjectRepository(ItsmKnowledgeCandidate)
    private readonly knowledgeCandidateRepo: Repository<ItsmKnowledgeCandidate>,
  ) {}

  // ============================================================================
  // Executive Summary
  // ============================================================================

  async getExecutiveSummary(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<ExecutiveSummary> {
    const [
      totalProblems,
      openProblems,
      reopenedProblems,
      openMajorIncidents,
      pirStats,
      overdueActions,
      publishedKEs,
      kcCount,
      problemTrend,
      miTrend,
      closureStats,
      severityDist,
    ] = await Promise.all([
      this.countProblems(tenantId, filter),
      this.countProblems(tenantId, filter, [
        ProblemState.NEW,
        ProblemState.UNDER_INVESTIGATION,
        ProblemState.KNOWN_ERROR,
      ]),
      this.countReopenedProblems(tenantId, filter),
      this.countMajorIncidents(tenantId, filter, [
        MajorIncidentStatus.DECLARED,
        MajorIncidentStatus.INVESTIGATING,
        MajorIncidentStatus.MITIGATING,
        MajorIncidentStatus.MONITORING,
      ]),
      this.getPirCompletionStats(tenantId, filter),
      this.countOverdueActions(tenantId, filter),
      this.countKnownErrors(tenantId, filter, [KnownErrorState.PUBLISHED]),
      this.countKnowledgeCandidates(tenantId, filter),
      this.getProblemTrendData(tenantId, filter),
      this.getMajorIncidentTrendData(tenantId, filter),
      this.getClosureStats(tenantId, filter),
      this.getMajorIncidentSeverityDistribution(tenantId, filter),
    ]);

    const reopenRate = totalProblems > 0
      ? Math.round((reopenedProblems / totalProblems) * 100)
      : 0;

    return {
      kpis: {
        totalProblems,
        openProblems,
        openMajorIncidents,
        pirCompletionPct: pirStats.completionPct,
        actionOverdueCount: overdueActions,
        knownErrorsPublished: publishedKEs,
        knowledgeCandidatesGenerated: kcCount,
        problemReopenRate: reopenRate,
      },
      problemTrend,
      majorIncidentTrend: miTrend,
      closureEffectiveness: closureStats,
      severityDistribution: severityDist,
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Problem Trends
  // ============================================================================

  async getProblemTrends(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<ProblemTrends> {
    const [stateDist, priorityDist, categoryDist, trend, aging, reopenedCount, avgDaysOpen] =
      await Promise.all([
        this.getProblemStateDistribution(tenantId, filter),
        this.getProblemPriorityDistribution(tenantId, filter),
        this.getProblemCategoryDistribution(tenantId, filter),
        this.getProblemTrendData(tenantId, filter),
        this.getProblemAgingBuckets(tenantId, filter),
        this.countReopenedProblems(tenantId, filter),
        this.getAvgDaysOpenProblems(tenantId, filter),
      ]);

    return {
      stateDistribution: stateDist,
      priorityDistribution: priorityDist,
      categoryDistribution: categoryDist,
      trend,
      aging,
      reopenedCount,
      avgDaysOpen,
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Major Incident Metrics
  // ============================================================================

  async getMajorIncidentMetrics(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<MajorIncidentMetrics> {
    const [totalCount, byStatus, bySeverity, mttr, avgBridge, pirRate, trend] =
      await Promise.all([
        this.countMajorIncidents(tenantId, filter),
        this.getMajorIncidentStatusDistribution(tenantId, filter),
        this.getMajorIncidentSeverityDistribution(tenantId, filter),
        this.getMttrHours(tenantId, filter),
        this.getAvgBridgeDuration(tenantId, filter),
        this.getPirCompletionRateForMI(tenantId, filter),
        this.getMajorIncidentTrendData(tenantId, filter),
      ]);

    return {
      totalCount,
      byStatus,
      bySeverity,
      mttrHours: mttr,
      avgBridgeDurationHours: avgBridge,
      pirCompletionRate: pirRate,
      trend,
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // PIR Effectiveness
  // ============================================================================

  async getPirEffectiveness(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<PirEffectiveness> {
    const [totalPirs, statusDist, actionRate, overdueCount, avgDays, kcCount, kcByStatus] =
      await Promise.all([
        this.countPirs(tenantId, filter),
        this.getPirStatusDistribution(tenantId, filter),
        this.getActionCompletionRate(tenantId, filter),
        this.countOverdueActions(tenantId, filter),
        this.getAvgDaysToCompleteAction(tenantId, filter),
        this.countKnowledgeCandidates(tenantId, filter),
        this.getKnowledgeCandidateStatusDistribution(tenantId, filter),
      ]);

    return {
      totalPirs,
      statusDistribution: statusDist,
      actionCompletionRate: actionRate,
      actionOverdueCount: overdueCount,
      avgDaysToCompleteAction: avgDays,
      knowledgeCandidateCount: kcCount,
      knowledgeCandidatesByStatus: kcByStatus,
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Known Error Lifecycle
  // ============================================================================

  async getKnownErrorLifecycle(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<KnownErrorLifecycle> {
    const [totalCount, stateDist, fixDist, publishedCount, retiredCount, problemCount, keFromProblemCount] =
      await Promise.all([
        this.countKnownErrors(tenantId, filter),
        this.getKnownErrorStateDistribution(tenantId, filter),
        this.getKnownErrorFixStatusDistribution(tenantId, filter),
        this.countKnownErrors(tenantId, filter, [KnownErrorState.PUBLISHED]),
        this.countKnownErrors(tenantId, filter, [KnownErrorState.RETIRED]),
        this.countProblems(tenantId, filter),
        this.countKnownErrorsWithProblem(tenantId, filter),
      ]);

    return {
      totalCount,
      stateDistribution: stateDist,
      fixStatusDistribution: fixDist,
      publicationRate: totalCount > 0 ? Math.round((publishedCount / totalCount) * 100) : 0,
      retirementRate: totalCount > 0 ? Math.round((retiredCount / totalCount) * 100) : 0,
      problemToKeConversionRate: problemCount > 0
        ? Math.round((keFromProblemCount / problemCount) * 100)
        : 0,
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Closure Effectiveness
  // ============================================================================

  async getClosureEffectiveness(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<ClosureEffectiveness> {
    const [closureTrend, reopenedCount, totalProblems, actionRate, avgProblemDays, avgActionDays, pirRate] =
      await Promise.all([
        this.getProblemClosureTrend(tenantId, filter),
        this.countReopenedProblems(tenantId, filter),
        this.countProblems(tenantId, filter),
        this.getActionCompletionRate(tenantId, filter),
        this.getAvgDaysToCloseProblem(tenantId, filter),
        this.getAvgDaysToCompleteAction(tenantId, filter),
        this.getPirClosureRate(tenantId, filter),
      ]);

    return {
      problemClosureRateTrend: closureTrend,
      reopenedProblemRate: totalProblems > 0
        ? Math.round((reopenedCount / totalProblems) * 100)
        : 0,
      reopenedProblems: reopenedCount,
      actionClosureRate: actionRate,
      avgDaysToCloseProblem: avgProblemDays,
      avgDaysToCloseAction: avgActionDays,
      pirClosureRate: pirRate,
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Backlog
  // ============================================================================

  async getBacklog(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<BacklogSummary> {
    const [problemsByPriority, actionsByPriority, overdueCount, staleCount, items] =
      await Promise.all([
        this.getOpenProblemsByPriority(tenantId, filter),
        this.getOpenActionsByPriority(tenantId, filter),
        this.countOverdueActions(tenantId, filter),
        this.countStaleItems(tenantId, filter),
        this.getBacklogItems(tenantId, filter),
      ]);

    return {
      openProblemsByPriority: problemsByPriority,
      openActionsByPriority: actionsByPriority,
      overdueActions: overdueCount,
      staleItems: staleCount,
      items,
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Private Helpers — Counts
  // ============================================================================

  private applyDateFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    filter: AnalyticsFilterDto,
    dateField = 'createdAt',
  ): void {
    if (filter.dateFrom) {
      qb.andWhere(`${alias}.${dateField} >= :dateFrom`, { dateFrom: filter.dateFrom });
    }
    if (filter.dateTo) {
      qb.andWhere(`${alias}.${dateField} <= :dateTo`, { dateTo: filter.dateTo });
    }
  }

  private applyProblemFilters(
    qb: SelectQueryBuilder<ItsmProblem>,
    alias: string,
    filter: AnalyticsFilterDto,
  ): void {
    this.applyDateFilter(qb, alias, filter);
    if (filter.serviceId) {
      qb.andWhere(`${alias}.serviceId = :serviceId`, { serviceId: filter.serviceId });
    }
    if (filter.priority) {
      qb.andWhere(`${alias}.priority = :priority`, { priority: filter.priority });
    }
    if (filter.category) {
      qb.andWhere(`${alias}.category = :category`, { category: filter.category });
    }
    if (filter.team) {
      qb.andWhere(`${alias}.assignmentGroup = :team`, { team: filter.team });
    }
  }

  private applyMajorIncidentFilters(
    qb: SelectQueryBuilder<ItsmMajorIncident>,
    alias: string,
    filter: AnalyticsFilterDto,
  ): void {
    this.applyDateFilter(qb, alias, filter);
    if (filter.serviceId) {
      qb.andWhere(`${alias}.primaryServiceId = :serviceId`, { serviceId: filter.serviceId });
    }
    if (filter.severity) {
      qb.andWhere(`${alias}.severity = :severity`, { severity: filter.severity });
    }
  }

  private async countProblems(
    tenantId: string,
    filter: AnalyticsFilterDto,
    states?: string[],
  ): Promise<number> {
    const qb = this.problemRepo.createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false');
    this.applyProblemFilters(qb, 'p', filter);
    if (states && states.length > 0) {
      qb.andWhere('p.state IN (:...states)', { states });
    }
    return qb.getCount();
  }

  private async countReopenedProblems(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number> {
    const qb = this.problemRepo.createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .andWhere('p.reopenCount > 0');
    this.applyProblemFilters(qb, 'p', filter);
    return qb.getCount();
  }

  private async countMajorIncidents(
    tenantId: string,
    filter: AnalyticsFilterDto,
    statuses?: string[],
  ): Promise<number> {
    const qb = this.majorIncidentRepo.createQueryBuilder('mi')
      .where('mi.tenantId = :tenantId', { tenantId })
      .andWhere('mi.isDeleted = false');
    this.applyMajorIncidentFilters(qb, 'mi', filter);
    if (statuses && statuses.length > 0) {
      qb.andWhere('mi.status IN (:...statuses)', { statuses });
    }
    return qb.getCount();
  }

  private async countKnownErrors(
    tenantId: string,
    filter: AnalyticsFilterDto,
    states?: string[],
  ): Promise<number> {
    const qb = this.knownErrorRepo.createQueryBuilder('ke')
      .where('ke.tenantId = :tenantId', { tenantId })
      .andWhere('ke.isDeleted = false');
    this.applyDateFilter(qb, 'ke', filter);
    if (states && states.length > 0) {
      qb.andWhere('ke.state IN (:...states)', { states });
    }
    return qb.getCount();
  }

  private async countKnownErrorsWithProblem(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number> {
    const qb = this.knownErrorRepo.createQueryBuilder('ke')
      .where('ke.tenantId = :tenantId', { tenantId })
      .andWhere('ke.isDeleted = false')
      .andWhere('ke.problemId IS NOT NULL');
    this.applyDateFilter(qb, 'ke', filter);
    return qb.getCount();
  }

  private async countPirs(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number> {
    const qb = this.pirRepo.createQueryBuilder('pir')
      .where('pir.tenantId = :tenantId', { tenantId })
      .andWhere('pir.isDeleted = false');
    this.applyDateFilter(qb, 'pir', filter);
    return qb.getCount();
  }

  private async countOverdueActions(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number> {
    const qb = this.pirActionRepo.createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.isDeleted = false')
      .andWhere(
        new Brackets((whereQb) => {
          whereQb
            .where('a.status = :overdueStatus', {
              overdueStatus: PirActionStatus.OVERDUE,
            })
            .orWhere(
              new Brackets((subQb) => {
                subQb
                  .where('a.status IN (:...openStatuses)', {
                    openStatuses: [
                      PirActionStatus.OPEN,
                      PirActionStatus.IN_PROGRESS,
                    ],
                  })
                  .andWhere('a.dueDate IS NOT NULL')
                  .andWhere('a.dueDate < CURRENT_DATE');
              }),
            );
        }),
      );
    this.applyDateFilter(qb, 'a', filter);
    return qb.getCount();
  }

  private async countKnowledgeCandidates(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number> {
    const qb = this.knowledgeCandidateRepo.createQueryBuilder('kc')
      .where('kc.tenantId = :tenantId', { tenantId })
      .andWhere('kc.isDeleted = false');
    this.applyDateFilter(qb, 'kc', filter);
    return qb.getCount();
  }

  private async countStaleItems(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number> {
    // filter param reserved for future date-range scoping of stale items
    void filter;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [staleProblems, staleActions] = await Promise.all([
      this.problemRepo.createQueryBuilder('p')
        .where('p.tenantId = :tenantId', { tenantId })
        .andWhere('p.isDeleted = false')
        .andWhere('p.state IN (:...openStates)', {
          openStates: [
            ProblemState.NEW,
            ProblemState.UNDER_INVESTIGATION,
            ProblemState.KNOWN_ERROR,
          ],
        })
        .andWhere('p.updatedAt < :staleDate', { staleDate: thirtyDaysAgo })
        .getCount(),
      this.pirActionRepo.createQueryBuilder('a')
        .where('a.tenantId = :tenantId', { tenantId })
        .andWhere('a.isDeleted = false')
        .andWhere('a.status IN (:...openStatuses)', {
          openStatuses: [
            PirActionStatus.OPEN,
            PirActionStatus.IN_PROGRESS,
            PirActionStatus.OVERDUE,
          ],
        })
        .andWhere('a.updatedAt < :staleDate', { staleDate: thirtyDaysAgo })
        .getCount(),
    ]);

    return staleProblems + staleActions;
  }

  // ============================================================================
  // Private Helpers — Distributions
  // ============================================================================

  private async getProblemStateDistribution(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.problemRepo.createQueryBuilder('p')
      .select('p.state', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .groupBy('p.state');
    this.applyProblemFilters(qb, 'p', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  private async getProblemPriorityDistribution(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.problemRepo.createQueryBuilder('p')
      .select('p.priority', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .groupBy('p.priority');
    this.applyProblemFilters(qb, 'p', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  private async getProblemCategoryDistribution(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.problemRepo.createQueryBuilder('p')
      .select('p.category', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .groupBy('p.category');
    this.applyProblemFilters(qb, 'p', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  private async getMajorIncidentStatusDistribution(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.majorIncidentRepo.createQueryBuilder('mi')
      .select('mi.status', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('mi.tenantId = :tenantId', { tenantId })
      .andWhere('mi.isDeleted = false')
      .groupBy('mi.status');
    this.applyMajorIncidentFilters(qb, 'mi', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  private async getMajorIncidentSeverityDistribution(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.majorIncidentRepo.createQueryBuilder('mi')
      .select('mi.severity', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('mi.tenantId = :tenantId', { tenantId })
      .andWhere('mi.isDeleted = false')
      .groupBy('mi.severity');
    this.applyMajorIncidentFilters(qb, 'mi', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  private async getPirStatusDistribution(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.pirRepo.createQueryBuilder('pir')
      .select('pir.status', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('pir.tenantId = :tenantId', { tenantId })
      .groupBy('pir.status');
    this.applyDateFilter(qb, 'pir', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  private async getKnownErrorStateDistribution(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.knownErrorRepo.createQueryBuilder('ke')
      .select('ke.state', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('ke.tenantId = :tenantId', { tenantId })
      .andWhere('ke.isDeleted = false')
      .groupBy('ke.state');
    this.applyDateFilter(qb, 'ke', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  private async getKnownErrorFixStatusDistribution(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.knownErrorRepo.createQueryBuilder('ke')
      .select('ke.permanentFixStatus', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('ke.tenantId = :tenantId', { tenantId })
      .andWhere('ke.isDeleted = false')
      .groupBy('ke.permanentFixStatus');
    this.applyDateFilter(qb, 'ke', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  private async getKnowledgeCandidateStatusDistribution(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.knowledgeCandidateRepo.createQueryBuilder('kc')
      .select('kc.status', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('kc.tenantId = :tenantId', { tenantId })
      .groupBy('kc.status');
    this.applyDateFilter(qb, 'kc', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  // ============================================================================
  // Private Helpers — Trends
  // ============================================================================

  private async getProblemTrendData(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<TrendPoint[]> {
    // Opened per month
    const openedQb = this.problemRepo.createQueryBuilder('p')
      .select("TO_CHAR(p.created_at, 'YYYY-MM')", 'period')
      .addSelect('COUNT(*)', 'opened')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .groupBy("TO_CHAR(p.created_at, 'YYYY-MM')")
      .orderBy('period', 'ASC');
    this.applyProblemFilters(openedQb, 'p', filter);
    const openedRaw = await openedQb.getRawMany<{ period: string; opened: string }>();

    // Closed per month
    const closedQb = this.problemRepo.createQueryBuilder('p')
      .select("TO_CHAR(p.closed_at, 'YYYY-MM')", 'period')
      .addSelect('COUNT(*)', 'closed')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .andWhere('p.closedAt IS NOT NULL')
      .groupBy("TO_CHAR(p.closed_at, 'YYYY-MM')")
      .orderBy('period', 'ASC');
    this.applyProblemFilters(closedQb, 'p', filter);
    const closedRaw = await closedQb.getRawMany<{ period: string; closed: string }>();

    // Resolved per month
    const resolvedQb = this.problemRepo.createQueryBuilder('p')
      .select("TO_CHAR(p.resolved_at, 'YYYY-MM')", 'period')
      .addSelect('COUNT(*)', 'resolved')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .andWhere('p.resolvedAt IS NOT NULL')
      .groupBy("TO_CHAR(p.resolved_at, 'YYYY-MM')")
      .orderBy('period', 'ASC');
    this.applyProblemFilters(resolvedQb, 'p', filter);
    const resolvedRaw = await resolvedQb.getRawMany<{ period: string; resolved: string }>();

    return this.mergeTrendData(openedRaw, closedRaw, resolvedRaw);
  }

  private async getMajorIncidentTrendData(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<TrendPoint[]> {
    const openedQb = this.majorIncidentRepo.createQueryBuilder('mi')
      .select("TO_CHAR(mi.created_at, 'YYYY-MM')", 'period')
      .addSelect('COUNT(*)', 'opened')
      .where('mi.tenantId = :tenantId', { tenantId })
      .andWhere('mi.isDeleted = false')
      .groupBy("TO_CHAR(mi.created_at, 'YYYY-MM')")
      .orderBy('period', 'ASC');
    this.applyMajorIncidentFilters(openedQb, 'mi', filter);
    const openedRaw = await openedQb.getRawMany<{ period: string; opened: string }>();

    const closedQb = this.majorIncidentRepo.createQueryBuilder('mi')
      .select("TO_CHAR(mi.closed_at, 'YYYY-MM')", 'period')
      .addSelect('COUNT(*)', 'closed')
      .where('mi.tenantId = :tenantId', { tenantId })
      .andWhere('mi.isDeleted = false')
      .andWhere('mi.closedAt IS NOT NULL')
      .groupBy("TO_CHAR(mi.closed_at, 'YYYY-MM')")
      .orderBy('period', 'ASC');
    this.applyMajorIncidentFilters(closedQb, 'mi', filter);
    const closedRaw = await closedQb.getRawMany<{ period: string; closed: string }>();

    const resolvedQb = this.majorIncidentRepo.createQueryBuilder('mi')
      .select("TO_CHAR(mi.resolved_at, 'YYYY-MM')", 'period')
      .addSelect('COUNT(*)', 'resolved')
      .where('mi.tenantId = :tenantId', { tenantId })
      .andWhere('mi.isDeleted = false')
      .andWhere('mi.resolvedAt IS NOT NULL')
      .groupBy("TO_CHAR(mi.resolved_at, 'YYYY-MM')")
      .orderBy('period', 'ASC');
    this.applyMajorIncidentFilters(resolvedQb, 'mi', filter);
    const resolvedRaw = await resolvedQb.getRawMany<{ period: string; resolved: string }>();

    return this.mergeTrendData(openedRaw, closedRaw, resolvedRaw);
  }

  private async getProblemClosureTrend(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<TrendPoint[]> {
    return this.getProblemTrendData(tenantId, filter);
  }

  private mergeTrendData(
    openedRaw: Array<{ period: string; opened: string }>,
    closedRaw: Array<{ period: string; closed: string }>,
    resolvedRaw: Array<{ period: string; resolved: string }>,
  ): TrendPoint[] {
    const periods = new Set<string>();
    openedRaw.forEach(r => periods.add(r.period));
    closedRaw.forEach(r => periods.add(r.period));
    resolvedRaw.forEach(r => periods.add(r.period));

    const openedMap = new Map(openedRaw.map(r => [r.period, parseInt(r.opened, 10)]));
    const closedMap = new Map(closedRaw.map(r => [r.period, parseInt(r.closed, 10)]));
    const resolvedMap = new Map(resolvedRaw.map(r => [r.period, parseInt(r.resolved, 10)]));

    return Array.from(periods)
      .sort()
      .map(period => ({
        period,
        opened: openedMap.get(period) || 0,
        closed: closedMap.get(period) || 0,
        resolved: resolvedMap.get(period) || 0,
      }));
  }

  // ============================================================================
  // Private Helpers — Aging
  // ============================================================================

  private async getProblemAgingBuckets(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<AgingBucket[]> {
    const qb = this.problemRepo.createQueryBuilder('p')
      .select(`
        CASE
          WHEN EXTRACT(DAY FROM NOW() - p.created_at) <= 7 THEN '0-7 days'
          WHEN EXTRACT(DAY FROM NOW() - p.created_at) <= 30 THEN '8-30 days'
          WHEN EXTRACT(DAY FROM NOW() - p.created_at) <= 90 THEN '31-90 days'
          ELSE '90+ days'
        END
      `, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .andWhere('p.state IN (:...openStates)', {
        openStates: [
          ProblemState.NEW,
          ProblemState.UNDER_INVESTIGATION,
          ProblemState.KNOWN_ERROR,
        ],
      })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC');
    this.applyProblemFilters(qb, 'p', filter);
    const raw = await qb.getRawMany<{ bucket: string; count: string }>();
    return raw.map(r => ({ bucket: r.bucket.trim(), count: parseInt(r.count, 10) }));
  }

  private async getAvgDaysOpenProblems(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number> {
    const qb = this.problemRepo.createQueryBuilder('p')
      .select('AVG(EXTRACT(DAY FROM NOW() - p.created_at))', 'avg')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .andWhere('p.state IN (:...openStates)', {
        openStates: [
          ProblemState.NEW,
          ProblemState.UNDER_INVESTIGATION,
          ProblemState.KNOWN_ERROR,
        ],
      });
    this.applyProblemFilters(qb, 'p', filter);
    const result = await qb.getRawOne<{ avg: string | null }>();
    return result?.avg ? Math.round(parseFloat(result.avg)) : 0;
  }

  // ============================================================================
  // Private Helpers — Rates & Averages
  // ============================================================================

  private async getPirCompletionStats(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<{ completionPct: number }> {
    const totalQb = this.pirRepo.createQueryBuilder('pir')
      .where('pir.tenantId = :tenantId', { tenantId });
    this.applyDateFilter(totalQb, 'pir', filter);
    const total = await totalQb.getCount();

    if (total === 0) return { completionPct: 0 };

    const closedQb = this.pirRepo.createQueryBuilder('pir')
      .where('pir.tenantId = :tenantId', { tenantId })
      .andWhere('pir.isDeleted = false')
      .andWhere('pir.status IN (:...closedStatuses)', {
        closedStatuses: [PirStatus.APPROVED, PirStatus.CLOSED],
      });
    this.applyDateFilter(closedQb, 'pir', filter);
    const closed = await closedQb.getCount();

    return { completionPct: Math.round((closed / total) * 100) };
  }

  private async getActionCompletionRate(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number> {
    const totalQb = this.pirActionRepo.createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.isDeleted = false');
    this.applyDateFilter(totalQb, 'a', filter);
    const total = await totalQb.getCount();

    if (total === 0) return 0;

    const completedQb = this.pirActionRepo.createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.isDeleted = false')
      .andWhere('a.status = :completed', { completed: PirActionStatus.COMPLETED });
    this.applyDateFilter(completedQb, 'a', filter);
    const completed = await completedQb.getCount();

    return Math.round((completed / total) * 100);
  }

  private async getAvgDaysToCompleteAction(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number | null> {
    const qb = this.pirActionRepo.createQueryBuilder('a')
      .select('AVG(EXTRACT(DAY FROM a.completed_at - a.created_at))', 'avg')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.isDeleted = false')
      .andWhere('a.status = :completed', { completed: PirActionStatus.COMPLETED })
      .andWhere('a.completedAt IS NOT NULL');
    this.applyDateFilter(qb, 'a', filter);
    const result = await qb.getRawOne<{ avg: string | null }>();
    return result?.avg ? Math.round(parseFloat(result.avg)) : null;
  }

  private async getAvgDaysToCloseProblem(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number | null> {
    const qb = this.problemRepo.createQueryBuilder('p')
      .select('AVG(EXTRACT(DAY FROM p.closed_at - p.created_at))', 'avg')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .andWhere('p.closedAt IS NOT NULL');
    this.applyProblemFilters(qb, 'p', filter);
    const result = await qb.getRawOne<{ avg: string | null }>();
    return result?.avg ? Math.round(parseFloat(result.avg)) : null;
  }

  private async getClosureStats(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<{
    problemClosureRate: number;
    actionClosureRate: number;
    avgDaysToCloseProblem: number;
    avgDaysToCloseAction: number;
  }> {
    const [totalProblems, closedProblems, actionRate, avgProblemDays, avgActionDays] =
      await Promise.all([
        this.countProblems(tenantId, filter),
        this.countProblems(tenantId, filter, [ProblemState.CLOSED]),
        this.getActionCompletionRate(tenantId, filter),
        this.getAvgDaysToCloseProblem(tenantId, filter),
        this.getAvgDaysToCompleteAction(tenantId, filter),
      ]);

    return {
      problemClosureRate: totalProblems > 0
        ? Math.round((closedProblems / totalProblems) * 100)
        : 0,
      actionClosureRate: actionRate,
      avgDaysToCloseProblem: avgProblemDays ?? 0,
      avgDaysToCloseAction: avgActionDays ?? 0,
    };
  }

  private async getMttrHours(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number | null> {
    const qb = this.majorIncidentRepo.createQueryBuilder('mi')
      .select('AVG(EXTRACT(EPOCH FROM mi.resolved_at - mi.declared_at) / 3600)', 'avg')
      .where('mi.tenantId = :tenantId', { tenantId })
      .andWhere('mi.isDeleted = false')
      .andWhere('mi.resolvedAt IS NOT NULL')
      .andWhere('mi.declaredAt IS NOT NULL');
    this.applyMajorIncidentFilters(qb, 'mi', filter);
    const result = await qb.getRawOne<{ avg: string | null }>();
    return result?.avg ? Math.round(parseFloat(result.avg) * 10) / 10 : null;
  }

  private async getAvgBridgeDuration(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number | null> {
    const qb = this.majorIncidentRepo.createQueryBuilder('mi')
      .select('AVG(EXTRACT(EPOCH FROM mi.bridge_ended_at - mi.bridge_started_at) / 3600)', 'avg')
      .where('mi.tenantId = :tenantId', { tenantId })
      .andWhere('mi.isDeleted = false')
      .andWhere('mi.bridgeStartedAt IS NOT NULL')
      .andWhere('mi.bridgeEndedAt IS NOT NULL');
    this.applyMajorIncidentFilters(qb, 'mi', filter);
    const result = await qb.getRawOne<{ avg: string | null }>();
    return result?.avg ? Math.round(parseFloat(result.avg) * 10) / 10 : null;
  }

  private async getPirCompletionRateForMI(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number> {
    // Count MI that have at least one PIR in APPROVED/CLOSED
    const totalMiQb = this.majorIncidentRepo.createQueryBuilder('mi')
      .where('mi.tenantId = :tenantId', { tenantId })
      .andWhere('mi.isDeleted = false')
      .andWhere('mi.status IN (:...resolvedStatuses)', {
        resolvedStatuses: [
          MajorIncidentStatus.RESOLVED,
          MajorIncidentStatus.PIR_PENDING,
          MajorIncidentStatus.CLOSED,
        ],
      });
    this.applyMajorIncidentFilters(totalMiQb, 'mi', filter);
    const totalMi = await totalMiQb.getCount();

    if (totalMi === 0) return 0;

    // MI that have at least one completed PIR
    const withPirQb = this.pirRepo.createQueryBuilder('pir')
      .select('COUNT(DISTINCT pir.majorIncidentId)', 'cnt')
      .where('pir.tenantId = :tenantId', { tenantId })
      .andWhere('pir.isDeleted = false')
      .andWhere('pir.status IN (:...completedStatuses)', {
        completedStatuses: [PirStatus.APPROVED, PirStatus.CLOSED],
      });
    this.applyDateFilter(withPirQb, 'pir', filter);
    const result = await withPirQb.getRawOne<{ cnt: string }>();
    const withPirCount = parseInt(result?.cnt || '0', 10);

    return Math.round((withPirCount / totalMi) * 100);
  }

  private async getPirClosureRate(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<number> {
    const totalQb = this.pirRepo.createQueryBuilder('pir')
      .where('pir.tenantId = :tenantId', { tenantId })
      .andWhere('pir.isDeleted = false');
    this.applyDateFilter(totalQb, 'pir', filter);
    const total = await totalQb.getCount();

    if (total === 0) return 0;

    const closedQb = this.pirRepo.createQueryBuilder('pir')
      .where('pir.tenantId = :tenantId', { tenantId })
      .andWhere('pir.isDeleted = false')
      .andWhere('pir.status = :closed', { closed: PirStatus.CLOSED });
    this.applyDateFilter(closedQb, 'pir', filter);
    const closed = await closedQb.getCount();

    return Math.round((closed / total) * 100);
  }

  // ============================================================================
  // Private Helpers — Backlog
  // ============================================================================

  private async getOpenProblemsByPriority(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.problemRepo.createQueryBuilder('p')
      .select('p.priority', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .andWhere('p.state IN (:...openStates)', {
        openStates: [
          ProblemState.NEW,
          ProblemState.UNDER_INVESTIGATION,
          ProblemState.KNOWN_ERROR,
        ],
      })
      .groupBy('p.priority')
      .orderBy('p.priority', 'ASC');
    this.applyProblemFilters(qb, 'p', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  private async getOpenActionsByPriority(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<CountByLabel[]> {
    const qb = this.pirActionRepo.createQueryBuilder('a')
      .select('a.priority', 'label')
      .addSelect('COUNT(*)', 'count')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.isDeleted = false')
      .andWhere('a.status IN (:...openStatuses)', {
        openStatuses: [
          PirActionStatus.OPEN,
          PirActionStatus.IN_PROGRESS,
        ],
      })
      .groupBy('a.priority')
      .orderBy('a.priority', 'ASC');
    this.applyDateFilter(qb, 'a', filter);
    const raw = await qb.getRawMany<{ label: string; count: string }>();
    return raw.map(r => ({ label: r.label, count: parseInt(r.count, 10) }));
  }

  private async getBacklogItems(
    tenantId: string,
    filter: AnalyticsFilterDto,
  ): Promise<BacklogItem[]> {
    const items: BacklogItem[] = [];

    // Open problems
    const problemQb = this.problemRepo.createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .andWhere('p.state IN (:...openStates)', {
        openStates: [
          ProblemState.NEW,
          ProblemState.UNDER_INVESTIGATION,
          ProblemState.KNOWN_ERROR,
        ],
      })
      .orderBy('p.priority', 'ASC')
      .addOrderBy('p.createdAt', 'ASC')
      .limit(50);
    this.applyProblemFilters(problemQb, 'p', filter);
    const problems = await problemQb.getMany();

    const now = new Date();
    for (const p of problems) {
      items.push({
        id: p.id,
        type: 'PROBLEM',
        title: p.shortDescription || '',
        priority: p.priority,
        state: p.state,
        ageDays: Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        lastUpdated: p.updatedAt.toISOString(),
        assignee: p.assignedTo,
      });
    }

    // Open actions
    const actionQb = this.pirActionRepo.createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.isDeleted = false')
      .andWhere('a.status IN (:...openStatuses)', {
        openStatuses: [
          PirActionStatus.OPEN,
          PirActionStatus.IN_PROGRESS,
          PirActionStatus.OVERDUE,
        ],
      })
      .orderBy('a.priority', 'ASC')
      .addOrderBy('a.createdAt', 'ASC')
      .limit(50);
    this.applyDateFilter(actionQb, 'a', filter);
    const actions = await actionQb.getMany();

    for (const a of actions) {
      items.push({
        id: a.id,
        type: 'ACTION',
        title: a.title || '',
        priority: a.priority,
        state: a.status,
        ageDays: Math.floor((now.getTime() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        lastUpdated: a.updatedAt.toISOString(),
        assignee: a.ownerId,
      });
    }

    // Sort by priority then age
    items.sort((a, b) => {
      const priorityOrder: Record<string, number> = { P1: 0, CRITICAL: 0, P2: 1, HIGH: 1, P3: 2, MEDIUM: 2, P4: 3, LOW: 3 };
      const aPri = priorityOrder[a.priority] ?? 9;
      const bPri = priorityOrder[b.priority] ?? 9;
      if (aPri !== bPri) return aPri - bPri;
      return b.ageDays - a.ageDays;
    });

    return items.slice(0, 100);
  }
}
