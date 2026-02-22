import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { AnalyticsService } from './analytics.service';
import { ItsmProblem } from '../problem/problem.entity';
import { ItsmKnownError } from '../known-error/known-error.entity';
import { ItsmMajorIncident } from '../major-incident/major-incident.entity';
import { ItsmPir } from '../pir/pir.entity';
import { ItsmPirAction } from '../pir/pir-action.entity';
import { ItsmKnowledgeCandidate } from '../pir/knowledge-candidate.entity';
import { AnalyticsFilterDto } from './dto';
import {
  ProblemState,
  ProblemPriority,
  ProblemCategory,
  ProblemImpact,
  ProblemUrgency,
} from '../enums';
import { MajorIncidentStatus, MajorIncidentSeverity } from '../major-incident/major-incident.enums';
import { PirStatus, PirActionStatus, PirActionPriority, KnowledgeCandidateStatus, KnowledgeCandidateSourceType } from '../pir/pir.enums';

// ============================================================================
// Constants
// ============================================================================

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const TENANT_B = '00000000-0000-0000-0000-000000000099';
const ADMIN_ID = '00000000-0000-0000-0000-000000000002';
const EMPTY_FILTER: AnalyticsFilterDto = {};

// ============================================================================
// Mock QueryBuilder Factory
// ============================================================================

function createMockQueryBuilder(overrides: Partial<Record<string, jest.Mock>> = {}): Record<string, jest.Mock> {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  return qb;
}

// ============================================================================
// Fixtures
// ============================================================================

const now = new Date();
const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

function makeProblem(partial: Partial<ItsmProblem> = {}): Partial<ItsmProblem> {
  return {
    id: '00000000-0000-0000-0000-000000000101',
    tenantId: TENANT_A,
    number: 'PRB000001',
    shortDescription: 'Test Problem',
    category: ProblemCategory.SOFTWARE,
    state: ProblemState.NEW,
    priority: ProblemPriority.P2,
    impact: ProblemImpact.HIGH,
    urgency: ProblemUrgency.MEDIUM,
    knownError: false,
    isDeleted: false,
    reopenCount: 0,
    assignedTo: ADMIN_ID,
    createdAt: thirtyDaysAgo,
    updatedAt: now,
    ...partial,
  };
}

function makeMajorIncident(partial: Partial<ItsmMajorIncident> = {}): Partial<ItsmMajorIncident> {
  return {
    id: '00000000-0000-0000-0000-000000000201',
    tenantId: TENANT_A,
    number: 'MI000001',
    title: 'Test Major Incident',
    status: MajorIncidentStatus.DECLARED,
    severity: MajorIncidentSeverity.SEV1,
    isDeleted: false,
    declaredAt: thirtyDaysAgo,
    resolvedAt: null,
    closedAt: null,
    bridgeStartedAt: null,
    bridgeEndedAt: null,
    createdAt: thirtyDaysAgo,
    updatedAt: now,
    ...partial,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let problemRepo: jest.Mocked<Repository<ItsmProblem>>;
  let knownErrorRepo: jest.Mocked<Repository<ItsmKnownError>>;
  let majorIncidentRepo: jest.Mocked<Repository<ItsmMajorIncident>>;
  let pirRepo: jest.Mocked<Repository<ItsmPir>>;
  let pirActionRepo: jest.Mocked<Repository<ItsmPirAction>>;
  let knowledgeCandidateRepo: jest.Mocked<Repository<ItsmKnowledgeCandidate>>;

  // Track all QBs created per repo alias to allow per-call overrides
  let qbCallIndex: Record<string, number>;
  let qbOverrides: Record<string, Array<Partial<Record<string, jest.Mock>>>>;

  function setQbOverrides(repoName: string, overridesPerCall: Array<Partial<Record<string, jest.Mock>>>) {
    qbOverrides[repoName] = overridesPerCall;
    qbCallIndex[repoName] = 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setupCreateQueryBuilder(repo: any, repoName: string) {
    repo.createQueryBuilder = jest.fn().mockImplementation(() => {
      const idx = qbCallIndex[repoName] || 0;
      const overrides = qbOverrides[repoName]?.[idx] || {};
      qbCallIndex[repoName] = idx + 1;
      return createMockQueryBuilder(overrides);
    });
  }

  beforeEach(async () => {
    qbCallIndex = {};
    qbOverrides = {};

    const mockRepo = () => ({
      createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder()),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(ItsmProblem), useValue: mockRepo() },
        { provide: getRepositoryToken(ItsmKnownError), useValue: mockRepo() },
        { provide: getRepositoryToken(ItsmMajorIncident), useValue: mockRepo() },
        { provide: getRepositoryToken(ItsmPir), useValue: mockRepo() },
        { provide: getRepositoryToken(ItsmPirAction), useValue: mockRepo() },
        { provide: getRepositoryToken(ItsmKnowledgeCandidate), useValue: mockRepo() },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    problemRepo = module.get(getRepositoryToken(ItsmProblem));
    knownErrorRepo = module.get(getRepositoryToken(ItsmKnownError));
    majorIncidentRepo = module.get(getRepositoryToken(ItsmMajorIncident));
    pirRepo = module.get(getRepositoryToken(ItsmPir));
    pirActionRepo = module.get(getRepositoryToken(ItsmPirAction));
    knowledgeCandidateRepo = module.get(getRepositoryToken(ItsmKnowledgeCandidate));

    // Wire up createQueryBuilder with override support for each repo
    setupCreateQueryBuilder(problemRepo, 'problem');
    setupCreateQueryBuilder(knownErrorRepo, 'knownError');
    setupCreateQueryBuilder(majorIncidentRepo, 'majorIncident');
    setupCreateQueryBuilder(pirRepo, 'pir');
    setupCreateQueryBuilder(pirActionRepo, 'pirAction');
    setupCreateQueryBuilder(knowledgeCandidateRepo, 'kc');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================================
  // 1. Executive Summary
  // ============================================================================

  describe('getExecutiveSummary', () => {
    it('should return correct shape with KPI fields and trends', async () => {
      // Problem repo is called multiple times: countProblems (total), countProblems (open states),
      // countReopenedProblems, getProblemTrendData (3 calls), getClosureStats (2 calls), 
      // plus additional internal calls
      // We set up all problem QBs to return specific counts
      const problemQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      // countProblems (total) -> 5
      problemQbs.push({ getCount: jest.fn().mockResolvedValue(5) });
      // countProblems (open states) -> 3
      problemQbs.push({ getCount: jest.fn().mockResolvedValue(3) });
      // countReopenedProblems -> 1
      problemQbs.push({ getCount: jest.fn().mockResolvedValue(1) });
      // getProblemTrendData: 3 QBs (opened, closed, resolved)
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', opened: '2' }]) });
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', closed: '1' }]) });
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', resolved: '1' }]) });
      // getClosureStats: countProblems (total) -> 5, countProblems (closed) -> 2
      problemQbs.push({ getCount: jest.fn().mockResolvedValue(5) });
      problemQbs.push({ getCount: jest.fn().mockResolvedValue(2) });
      // getAvgDaysToCloseProblem
      problemQbs.push({ getRawOne: jest.fn().mockResolvedValue({ avg: '7.5' }) });
      setQbOverrides('problem', problemQbs);

      // MI repo: countMajorIncidents (open) -> 2, getMajorIncidentSeverityDistribution, getMajorIncidentTrendData (3)
      const miQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      miQbs.push({ getCount: jest.fn().mockResolvedValue(2) });
      miQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ label: 'SEV1', count: '2' }]) });
      // MI trend: opened, closed, resolved
      miQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', opened: '1' }]) });
      miQbs.push({ getRawMany: jest.fn().mockResolvedValue([]) });
      miQbs.push({ getRawMany: jest.fn().mockResolvedValue([]) });
      setQbOverrides('majorIncident', miQbs);

      // PIR repo: getPirCompletionStats (total, closed)
      const pirQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      pirQbs.push({ getCount: jest.fn().mockResolvedValue(4) });
      pirQbs.push({ getCount: jest.fn().mockResolvedValue(2) });
      setQbOverrides('pir', pirQbs);

      // PIR Action repo: countOverdueActions -> 1, getActionCompletionRate (total, completed), getAvgDaysToCompleteAction
      const actionQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      actionQbs.push({ getCount: jest.fn().mockResolvedValue(1) }); // overdue
      actionQbs.push({ getCount: jest.fn().mockResolvedValue(6) }); // action total
      actionQbs.push({ getCount: jest.fn().mockResolvedValue(4) }); // action completed
      actionQbs.push({ getRawOne: jest.fn().mockResolvedValue({ avg: '5.0' }) }); // avg days
      setQbOverrides('pirAction', actionQbs);

      // KE repo: countKnownErrors (published) -> 3
      const keQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      keQbs.push({ getCount: jest.fn().mockResolvedValue(3) });
      setQbOverrides('knownError', keQbs);

      // KC repo: countKnowledgeCandidates -> 2
      const kcQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      kcQbs.push({ getCount: jest.fn().mockResolvedValue(2) });
      setQbOverrides('kc', kcQbs);

      const result = await service.getExecutiveSummary(TENANT_A, EMPTY_FILTER);

      // Assert top-level shape
      expect(result).toHaveProperty('kpis');
      expect(result).toHaveProperty('problemTrend');
      expect(result).toHaveProperty('majorIncidentTrend');
      expect(result).toHaveProperty('closureEffectiveness');
      expect(result).toHaveProperty('severityDistribution');
      expect(result).toHaveProperty('generatedAt');

      // Assert KPI fields
      expect(result.kpis).toHaveProperty('totalProblems');
      expect(result.kpis).toHaveProperty('openProblems');
      expect(result.kpis).toHaveProperty('openMajorIncidents');
      expect(result.kpis).toHaveProperty('pirCompletionPct');
      expect(result.kpis).toHaveProperty('actionOverdueCount');
      expect(result.kpis).toHaveProperty('knownErrorsPublished');
      expect(result.kpis).toHaveProperty('knowledgeCandidatesGenerated');
      expect(result.kpis).toHaveProperty('problemReopenRate');

      // Assert closure effectiveness shape
      expect(result.closureEffectiveness).toHaveProperty('problemClosureRate');
      expect(result.closureEffectiveness).toHaveProperty('actionClosureRate');
      expect(result.closureEffectiveness).toHaveProperty('avgDaysToCloseProblem');
      expect(result.closureEffectiveness).toHaveProperty('avgDaysToCloseAction');

      // Assert arrays
      expect(Array.isArray(result.problemTrend)).toBe(true);
      expect(Array.isArray(result.majorIncidentTrend)).toBe(true);
      expect(Array.isArray(result.severityDistribution)).toBe(true);

      // Assert generatedAt is ISO string
      expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt);
    });

    it('should scope all queries to the provided tenantId (tenant isolation)', async () => {
      await service.getExecutiveSummary(TENANT_B, EMPTY_FILTER);

      // Every createQueryBuilder call should have .where with tenantId = TENANT_B
      for (const repo of [problemRepo, knownErrorRepo, majorIncidentRepo, pirRepo, pirActionRepo, knowledgeCandidateRepo]) {
        const calls = (repo.createQueryBuilder as jest.Mock).mock.results;
        for (const call of calls) {
          const qb = call.value;
          const whereCalls = qb.where.mock.calls;
          if (whereCalls.length > 0) {
            // First where call should contain tenantId
            const [clause, params] = whereCalls[0];
            expect(clause).toContain('tenantId');
            expect(params).toEqual(expect.objectContaining({ tenantId: TENANT_B }));
          }
        }
      }
    });
  });

  // ============================================================================
  // 2. Problem Trends
  // ============================================================================

  describe('getProblemTrends', () => {
    it('should return correct shape with distributions, trend, aging, and reopenedCount', async () => {
      // QB creation order with Promise.all + sequential awaits inside getProblemTrendData:
      // 1) stateDistrib, 2) priorityDistrib, 3) categoryDistrib,
      // 4) trendOpened (first QB in getProblemTrendData),
      // 5) agingBuckets, 6) reopenedCount, 7) avgDaysOpen,
      // then after microtask: 8) trendClosed, 9) trendResolved
      const problemQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      // #1 getProblemStateDistribution
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: ProblemState.NEW, count: '3' },
        { label: ProblemState.UNDER_INVESTIGATION, count: '2' },
      ]) });
      // #2 getProblemPriorityDistribution
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: 'P1', count: '1' },
        { label: 'P2', count: '2' },
        { label: 'P3', count: '2' },
      ]) });
      // #3 getProblemCategoryDistribution
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: 'SOFTWARE', count: '3' },
        { label: 'HARDWARE', count: '2' },
      ]) });
      // #4 getProblemTrendData -> openedQb
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', opened: '3' }]) });
      // #5 getProblemAgingBuckets
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { bucket: '0-7 days', count: '2' },
        { bucket: '8-30 days', count: '3' },
      ]) });
      // #6 countReopenedProblems -> 1
      problemQbs.push({ getCount: jest.fn().mockResolvedValue(1) });
      // #7 getAvgDaysOpenProblems
      problemQbs.push({ getRawOne: jest.fn().mockResolvedValue({ avg: '15.3' }) });
      // #8 getProblemTrendData -> closedQb (after first await resolves)
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', closed: '1' }]) });
      // #9 getProblemTrendData -> resolvedQb
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([]) });
      setQbOverrides('problem', problemQbs);

      const result = await service.getProblemTrends(TENANT_A, EMPTY_FILTER);

      // Shape assertions
      expect(result).toHaveProperty('stateDistribution');
      expect(result).toHaveProperty('priorityDistribution');
      expect(result).toHaveProperty('categoryDistribution');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('aging');
      expect(result).toHaveProperty('reopenedCount');
      expect(result).toHaveProperty('avgDaysOpen');
      expect(result).toHaveProperty('generatedAt');

      // Array checks
      expect(Array.isArray(result.stateDistribution)).toBe(true);
      expect(Array.isArray(result.priorityDistribution)).toBe(true);
      expect(Array.isArray(result.categoryDistribution)).toBe(true);
      expect(Array.isArray(result.trend)).toBe(true);
      expect(Array.isArray(result.aging)).toBe(true);

      // CountByLabel shape
      for (const item of result.stateDistribution) {
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('count');
        expect(typeof item.count).toBe('number');
      }

      // AgingBucket shape
      for (const item of result.aging) {
        expect(item).toHaveProperty('bucket');
        expect(item).toHaveProperty('count');
      }

      expect(typeof result.reopenedCount).toBe('number');
      expect(typeof result.avgDaysOpen).toBe('number');
    });

    it('should scope all queries to the provided tenantId (tenant isolation)', async () => {
      await service.getProblemTrends(TENANT_B, EMPTY_FILTER);

      const calls = (problemRepo.createQueryBuilder as jest.Mock).mock.results;
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        const qb = call.value;
        const whereCalls = qb.where.mock.calls;
        if (whereCalls.length > 0) {
          expect(whereCalls[0][1]).toEqual(expect.objectContaining({ tenantId: TENANT_B }));
        }
      }
    });
  });

  // ============================================================================
  // 3. Major Incident Metrics
  // ============================================================================

  describe('getMajorIncidentMetrics', () => {
    it('should return correct shape with counts, MTTR, bridge duration, PIR rate, and trend', async () => {
      const miQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      // countMajorIncidents (total) -> 4
      miQbs.push({ getCount: jest.fn().mockResolvedValue(4) });
      // getMajorIncidentStatusDistribution
      miQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: MajorIncidentStatus.DECLARED, count: '1' },
        { label: MajorIncidentStatus.RESOLVED, count: '2' },
        { label: MajorIncidentStatus.CLOSED, count: '1' },
      ]) });
      // getMajorIncidentSeverityDistribution
      miQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: 'SEV1', count: '2' },
        { label: 'SEV2', count: '2' },
      ]) });
      // getMttrHours
      miQbs.push({ getRawOne: jest.fn().mockResolvedValue({ avg: '4.5' }) });
      // getAvgBridgeDuration
      miQbs.push({ getRawOne: jest.fn().mockResolvedValue({ avg: '2.3' }) });
      // getPirCompletionRateForMI: totalMi count, then PIR subquery
      miQbs.push({ getCount: jest.fn().mockResolvedValue(3) });
      // trend: opened, closed, resolved
      miQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', opened: '2' }]) });
      miQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', closed: '1' }]) });
      miQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', resolved: '1' }]) });
      setQbOverrides('majorIncident', miQbs);

      // PIR repo for getPirCompletionRateForMI
      const pirQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      pirQbs.push({ getRawOne: jest.fn().mockResolvedValue({ cnt: '2' }) });
      setQbOverrides('pir', pirQbs);

      const result = await service.getMajorIncidentMetrics(TENANT_A, EMPTY_FILTER);

      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('bySeverity');
      expect(result).toHaveProperty('mttrHours');
      expect(result).toHaveProperty('avgBridgeDurationHours');
      expect(result).toHaveProperty('pirCompletionRate');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('generatedAt');

      expect(typeof result.totalCount).toBe('number');
      expect(Array.isArray(result.byStatus)).toBe(true);
      expect(Array.isArray(result.bySeverity)).toBe(true);
      expect(Array.isArray(result.trend)).toBe(true);

      // TrendPoint shape
      if (result.trend.length > 0) {
        expect(result.trend[0]).toHaveProperty('period');
        expect(result.trend[0]).toHaveProperty('opened');
        expect(result.trend[0]).toHaveProperty('closed');
        expect(result.trend[0]).toHaveProperty('resolved');
      }
    });

    it('should scope all queries to the provided tenantId (tenant isolation)', async () => {
      await service.getMajorIncidentMetrics(TENANT_B, EMPTY_FILTER);

      for (const repo of [majorIncidentRepo, pirRepo]) {
        const calls = (repo.createQueryBuilder as jest.Mock).mock.results;
        for (const call of calls) {
          const qb = call.value;
          const whereCalls = qb.where.mock.calls;
          if (whereCalls.length > 0) {
            expect(whereCalls[0][1]).toEqual(expect.objectContaining({ tenantId: TENANT_B }));
          }
        }
      }
    });
  });

  // ============================================================================
  // 4. PIR Effectiveness
  // ============================================================================

  describe('getPirEffectiveness', () => {
    it('should return correct shape with completion rates and knowledge candidate counts', async () => {
      // PIR repo: countPirs, getPirStatusDistribution
      const pirQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      pirQbs.push({ getCount: jest.fn().mockResolvedValue(5) });
      pirQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: PirStatus.DRAFT, count: '1' },
        { label: PirStatus.APPROVED, count: '2' },
        { label: PirStatus.CLOSED, count: '2' },
      ]) });
      setQbOverrides('pir', pirQbs);

      // PIR Action: getActionCompletionRate (total, completed), countOverdueActions, getAvgDaysToCompleteAction
      const actionQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      actionQbs.push({ getCount: jest.fn().mockResolvedValue(10) }); // total
      actionQbs.push({ getCount: jest.fn().mockResolvedValue(7) });  // completed
      actionQbs.push({ getCount: jest.fn().mockResolvedValue(2) });  // overdue
      actionQbs.push({ getRawOne: jest.fn().mockResolvedValue({ avg: '3.5' }) }); // avg days
      setQbOverrides('pirAction', actionQbs);

      // KC: countKnowledgeCandidates, getKnowledgeCandidateStatusDistribution
      const kcQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      kcQbs.push({ getCount: jest.fn().mockResolvedValue(4) });
      kcQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: KnowledgeCandidateStatus.DRAFT, count: '2' },
        { label: KnowledgeCandidateStatus.PUBLISHED, count: '2' },
      ]) });
      setQbOverrides('kc', kcQbs);

      const result = await service.getPirEffectiveness(TENANT_A, EMPTY_FILTER);

      expect(result).toHaveProperty('totalPirs');
      expect(result).toHaveProperty('statusDistribution');
      expect(result).toHaveProperty('actionCompletionRate');
      expect(result).toHaveProperty('actionOverdueCount');
      expect(result).toHaveProperty('avgDaysToCompleteAction');
      expect(result).toHaveProperty('knowledgeCandidateCount');
      expect(result).toHaveProperty('knowledgeCandidatesByStatus');
      expect(result).toHaveProperty('generatedAt');

      expect(typeof result.totalPirs).toBe('number');
      expect(Array.isArray(result.statusDistribution)).toBe(true);
      expect(Array.isArray(result.knowledgeCandidatesByStatus)).toBe(true);
      expect(typeof result.actionCompletionRate).toBe('number');
      expect(typeof result.actionOverdueCount).toBe('number');
    });

    it('should scope all queries to the provided tenantId (tenant isolation)', async () => {
      await service.getPirEffectiveness(TENANT_B, EMPTY_FILTER);

      for (const repo of [pirRepo, pirActionRepo, knowledgeCandidateRepo]) {
        const calls = (repo.createQueryBuilder as jest.Mock).mock.results;
        for (const call of calls) {
          const qb = call.value;
          const whereCalls = qb.where.mock.calls;
          if (whereCalls.length > 0) {
            expect(whereCalls[0][1]).toEqual(expect.objectContaining({ tenantId: TENANT_B }));
          }
        }
      }
    });
  });

  // ============================================================================
  // 5. Known Error Lifecycle
  // ============================================================================

  describe('getKnownErrorLifecycle', () => {
    it('should return correct shape with state distribution, rates, and conversion rate', async () => {
      const keQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      // countKnownErrors (total) -> 6
      keQbs.push({ getCount: jest.fn().mockResolvedValue(6) });
      // getKnownErrorStateDistribution
      keQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: 'DRAFT', count: '2' },
        { label: 'PUBLISHED', count: '3' },
        { label: 'RETIRED', count: '1' },
      ]) });
      // getKnownErrorFixStatusDistribution
      keQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: 'NONE', count: '2' },
        { label: 'WORKAROUND_AVAILABLE', count: '3' },
        { label: 'FIX_DEPLOYED', count: '1' },
      ]) });
      // countKnownErrors (published) -> 3
      keQbs.push({ getCount: jest.fn().mockResolvedValue(3) });
      // countKnownErrors (retired) -> 1
      keQbs.push({ getCount: jest.fn().mockResolvedValue(1) });
      // countKnownErrorsWithProblem -> 4
      keQbs.push({ getCount: jest.fn().mockResolvedValue(4) });
      setQbOverrides('knownError', keQbs);

      // countProblems (for conversion rate) -> 8
      const problemQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      problemQbs.push({ getCount: jest.fn().mockResolvedValue(8) });
      setQbOverrides('problem', problemQbs);

      const result = await service.getKnownErrorLifecycle(TENANT_A, EMPTY_FILTER);

      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('stateDistribution');
      expect(result).toHaveProperty('fixStatusDistribution');
      expect(result).toHaveProperty('publicationRate');
      expect(result).toHaveProperty('retirementRate');
      expect(result).toHaveProperty('problemToKeConversionRate');
      expect(result).toHaveProperty('generatedAt');

      expect(typeof result.totalCount).toBe('number');
      expect(result.totalCount).toBe(6);
      expect(Array.isArray(result.stateDistribution)).toBe(true);
      expect(Array.isArray(result.fixStatusDistribution)).toBe(true);

      // Verify rate calculations
      expect(result.publicationRate).toBe(50); // 3/6 * 100
      expect(result.retirementRate).toBe(17); // Math.round(1/6 * 100) = 17
      expect(result.problemToKeConversionRate).toBe(50); // 4/8 * 100
    });

    it('should scope all queries to the provided tenantId (tenant isolation)', async () => {
      await service.getKnownErrorLifecycle(TENANT_B, EMPTY_FILTER);

      for (const repo of [knownErrorRepo, problemRepo]) {
        const calls = (repo.createQueryBuilder as jest.Mock).mock.results;
        for (const call of calls) {
          const qb = call.value;
          const whereCalls = qb.where.mock.calls;
          if (whereCalls.length > 0) {
            expect(whereCalls[0][1]).toEqual(expect.objectContaining({ tenantId: TENANT_B }));
          }
        }
      }
    });
  });

  // ============================================================================
  // 6. Closure Effectiveness
  // ============================================================================

  describe('getClosureEffectiveness', () => {
    it('should return correct shape with closure trends, reopen rates, and avg days', async () => {
      const problemQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      // getProblemClosureTrend -> getProblemTrendData (opened, closed, resolved)
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', opened: '3' }]) });
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', closed: '2' }]) });
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([{ period: '2026-01', resolved: '1' }]) });
      // countReopenedProblems -> 2
      problemQbs.push({ getCount: jest.fn().mockResolvedValue(2) });
      // countProblems (total) -> 10
      problemQbs.push({ getCount: jest.fn().mockResolvedValue(10) });
      // getAvgDaysToCloseProblem
      problemQbs.push({ getRawOne: jest.fn().mockResolvedValue({ avg: '12.0' }) });
      setQbOverrides('problem', problemQbs);

      // PIR Action: getActionCompletionRate (total, completed), getAvgDaysToCompleteAction
      const actionQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      actionQbs.push({ getCount: jest.fn().mockResolvedValue(8) }); // total
      actionQbs.push({ getCount: jest.fn().mockResolvedValue(6) }); // completed
      actionQbs.push({ getRawOne: jest.fn().mockResolvedValue({ avg: '4.0' }) }); // avg days
      setQbOverrides('pirAction', actionQbs);

      // PIR: getPirClosureRate (total, closed)
      const pirQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      pirQbs.push({ getCount: jest.fn().mockResolvedValue(5) }); // total
      pirQbs.push({ getCount: jest.fn().mockResolvedValue(3) }); // closed
      setQbOverrides('pir', pirQbs);

      const result = await service.getClosureEffectiveness(TENANT_A, EMPTY_FILTER);

      expect(result).toHaveProperty('problemClosureRateTrend');
      expect(result).toHaveProperty('reopenedProblemRate');
      expect(result).toHaveProperty('reopenedProblems');
      expect(result).toHaveProperty('actionClosureRate');
      expect(result).toHaveProperty('avgDaysToCloseProblem');
      expect(result).toHaveProperty('avgDaysToCloseAction');
      expect(result).toHaveProperty('pirClosureRate');
      expect(result).toHaveProperty('generatedAt');

      expect(Array.isArray(result.problemClosureRateTrend)).toBe(true);
      expect(typeof result.reopenedProblemRate).toBe('number');
      expect(typeof result.reopenedProblems).toBe('number');
      expect(typeof result.actionClosureRate).toBe('number');
      expect(typeof result.pirClosureRate).toBe('number');
    });

    it('should scope all queries to the provided tenantId (tenant isolation)', async () => {
      await service.getClosureEffectiveness(TENANT_B, EMPTY_FILTER);

      for (const repo of [problemRepo, pirActionRepo, pirRepo]) {
        const calls = (repo.createQueryBuilder as jest.Mock).mock.results;
        for (const call of calls) {
          const qb = call.value;
          const whereCalls = qb.where.mock.calls;
          if (whereCalls.length > 0) {
            expect(whereCalls[0][1]).toEqual(expect.objectContaining({ tenantId: TENANT_B }));
          }
        }
      }
    });
  });

  // ============================================================================
  // 7. Backlog
  // ============================================================================

  describe('getBacklog', () => {
    it('should return correct shape with priority distributions, overdue, stale, and items', async () => {
      const problemQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      // getOpenProblemsByPriority
      problemQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: 'P1', count: '1' },
        { label: 'P2', count: '2' },
      ]) });
      // countStaleItems: staleProblems
      problemQbs.push({ getCount: jest.fn().mockResolvedValue(1) });
      // getBacklogItems: open problems
      const mockProblems = [
        makeProblem({ id: 'p1', priority: ProblemPriority.P1, state: ProblemState.NEW }),
        makeProblem({ id: 'p2', priority: ProblemPriority.P2, state: ProblemState.UNDER_INVESTIGATION }),
      ];
      problemQbs.push({ getMany: jest.fn().mockResolvedValue(mockProblems) });
      setQbOverrides('problem', problemQbs);

      // PIR Action: getOpenActionsByPriority, countOverdueActions, countStaleItems (staleActions), getBacklogItems (actions)
      const actionQbs: Array<Partial<Record<string, jest.Mock>>> = [];
      actionQbs.push({ getRawMany: jest.fn().mockResolvedValue([
        { label: 'HIGH', count: '1' },
        { label: 'MEDIUM', count: '2' },
      ]) });
      actionQbs.push({ getCount: jest.fn().mockResolvedValue(1) }); // overdue
      actionQbs.push({ getCount: jest.fn().mockResolvedValue(0) }); // stale actions
      actionQbs.push({ getMany: jest.fn().mockResolvedValue([]) }); // backlog actions
      setQbOverrides('pirAction', actionQbs);

      const result = await service.getBacklog(TENANT_A, EMPTY_FILTER);

      expect(result).toHaveProperty('openProblemsByPriority');
      expect(result).toHaveProperty('openActionsByPriority');
      expect(result).toHaveProperty('overdueActions');
      expect(result).toHaveProperty('staleItems');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('generatedAt');

      expect(Array.isArray(result.openProblemsByPriority)).toBe(true);
      expect(Array.isArray(result.openActionsByPriority)).toBe(true);
      expect(Array.isArray(result.items)).toBe(true);
      expect(typeof result.overdueActions).toBe('number');
      expect(typeof result.staleItems).toBe('number');

      // BacklogItem shape
      if (result.items.length > 0) {
        const item = result.items[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('priority');
        expect(item).toHaveProperty('state');
        expect(item).toHaveProperty('ageDays');
        expect(item).toHaveProperty('lastUpdated');
        expect(item).toHaveProperty('assignee');
        expect(['PROBLEM', 'ACTION', 'PIR']).toContain(item.type);
      }
    });

    it('should scope all queries to the provided tenantId (tenant isolation)', async () => {
      await service.getBacklog(TENANT_B, EMPTY_FILTER);

      for (const repo of [problemRepo, pirActionRepo]) {
        const calls = (repo.createQueryBuilder as jest.Mock).mock.results;
        for (const call of calls) {
          const qb = call.value;
          const whereCalls = qb.where.mock.calls;
          if (whereCalls.length > 0) {
            expect(whereCalls[0][1]).toEqual(expect.objectContaining({ tenantId: TENANT_B }));
          }
        }
      }
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle zero-division safely in executive summary when no problems exist', async () => {
      // All repos return 0/empty
      const result = await service.getExecutiveSummary(TENANT_A, EMPTY_FILTER);

      expect(result.kpis.problemReopenRate).toBe(0);
      expect(result.closureEffectiveness.problemClosureRate).toBe(0);
    });

    it('should handle empty filter DTO correctly', async () => {
      const result = await service.getBacklog(TENANT_A, {});
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('generatedAt');
    });
  });
});
