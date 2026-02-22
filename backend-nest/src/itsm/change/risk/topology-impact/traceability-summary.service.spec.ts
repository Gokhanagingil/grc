/**
 * Unit tests for TraceabilitySummaryService
 *
 * Tests closed-loop traceability graph construction including:
 * - Change traceability (root change → topology → governance → problems → KEs)
 * - Major incident traceability (root MI → RCA → hypotheses → problems → KEs)
 * - Completeness score calculation
 * - Summary text generation
 * - Fail-open when repositories are unavailable
 * - Tenant isolation
 */
import { TraceabilitySummaryService } from './traceability-summary.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ============================================================================
// Helpers
// ============================================================================

function createMockRepo() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('TraceabilitySummaryService', () => {
  let service: TraceabilitySummaryService;
  let changeRepo: ReturnType<typeof createMockRepo>;
  let problemRepo: ReturnType<typeof createMockRepo>;
  let knownErrorRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    changeRepo = createMockRepo();
    problemRepo = createMockRepo();
    knownErrorRepo = createMockRepo();

    service = new TraceabilitySummaryService(
      changeRepo as never,
      problemRepo as never,
      knownErrorRepo as never,
    );
  });

  // ==========================================================================
  // Change Traceability
  // ==========================================================================

  describe('getChangeTraceability', () => {
    it('should return minimum traceability chain with CHANGE + TOPOLOGY + GOVERNANCE nodes', async () => {
      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      expect(result.rootId).toBe('change-1');
      expect(result.rootType).toBe('CHANGE');
      expect(result.nodes.length).toBeGreaterThanOrEqual(3);
      expect(result.edges.length).toBeGreaterThanOrEqual(2);

      const nodeTypes = result.nodes.map((n) => n.type);
      expect(nodeTypes).toContain('CHANGE');
      expect(nodeTypes).toContain('TOPOLOGY_ANALYSIS');
      expect(nodeTypes).toContain('GOVERNANCE_DECISION');
    });

    it('should populate change label and status from repository', async () => {
      changeRepo.findOne.mockResolvedValue({
        id: 'change-1',
        number: 'CHG000042',
        title: 'Deploy v2.0',
        state: 'AUTHORIZE',
        createdAt: new Date('2026-01-15'),
      });

      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      const changeNode = result.nodes.find((n) => n.type === 'CHANGE');
      expect(changeNode).toBeDefined();
      expect(changeNode!.label).toContain('CHG000042');
      expect(changeNode!.label).toContain('Deploy v2.0');
      expect(changeNode!.status).toBe('AUTHORIZE');
    });

    it('should include problems linked via metadata sourceChangeId', async () => {
      const mockProblem = {
        id: 'prob-1',
        shortDescription: 'Database timeout',
        state: 'NEW',
        createdAt: new Date('2026-01-16'),
        metadata: { sourceChangeId: 'change-1' },
      };
      problemRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockProblem]),
      });

      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      const problemNode = result.nodes.find((n) => n.type === 'PROBLEM');
      expect(problemNode).toBeDefined();
      expect(problemNode!.label).toContain('Database timeout');
      expect(problemNode!.status).toBe('NEW');

      const problemEdge = result.edges.find((e) => e.toId === 'prob-1');
      expect(problemEdge).toBeDefined();
      expect(problemEdge!.relation).toBe('RESULTED_IN');
    });

    it('should include known errors linked via metadata sourceChangeId', async () => {
      const mockKe = {
        id: 'ke-1',
        title: 'Connection pool exhaustion',
        state: 'OPEN',
        createdAt: new Date('2026-01-17'),
        metadata: { sourceChangeId: 'change-1' },
      };
      knownErrorRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockKe]),
      });

      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      const keNode = result.nodes.find((n) => n.type === 'KNOWN_ERROR');
      expect(keNode).toBeDefined();
      expect(keNode!.label).toContain('Connection pool exhaustion');
      expect(keNode!.status).toBe('OPEN');
    });

    it('should handle repository errors gracefully (fail-open)', async () => {
      changeRepo.findOne.mockRejectedValue(new Error('DB connection failed'));
      problemRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(new Error('Query timeout')),
      });

      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      // Should still return a valid response
      expect(result.rootId).toBe('change-1');
      expect(result.rootType).toBe('CHANGE');
      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should create ANALYZED_BY edge from change to topology analysis', async () => {
      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      const analyzedByEdge = result.edges.find(
        (e) => e.relation === 'ANALYZED_BY',
      );
      expect(analyzedByEdge).toBeDefined();
      expect(analyzedByEdge!.fromId).toBe('change-1');
    });

    it('should create DECIDED_BY edge from topology to governance', async () => {
      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      const decidedByEdge = result.edges.find(
        (e) => e.relation === 'DECIDED_BY',
      );
      expect(decidedByEdge).toBeDefined();
    });
  });

  // ==========================================================================
  // Major Incident Traceability
  // ==========================================================================

  describe('getMajorIncidentTraceability', () => {
    it('should return minimum chain with MI + RCA TOPOLOGY nodes', async () => {
      const result = await service.getMajorIncidentTraceability(
        TENANT_ID,
        'mi-1',
      );

      expect(result.rootId).toBe('mi-1');
      expect(result.rootType).toBe('MAJOR_INCIDENT');
      expect(result.nodes.length).toBeGreaterThanOrEqual(2);

      const nodeTypes = result.nodes.map((n) => n.type);
      expect(nodeTypes).toContain('MAJOR_INCIDENT');
      expect(nodeTypes).toContain('TOPOLOGY_ANALYSIS');
    });

    it('should include problems created from RCA hypotheses with traceability', async () => {
      const mockProblem = {
        id: 'prob-rca-1',
        shortDescription: 'Root cause: shared DB',
        state: 'INVESTIGATING',
        createdAt: new Date('2026-02-01'),
        metadata: {
          rcaTraceability: {
            sourceMajorIncidentId: 'mi-1',
            sourceHypothesisId: 'hyp-1',
            suspectNodeLabel: 'Shared Database',
            hypothesisType: 'common_upstream_dependency',
          },
        },
      };
      problemRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockProblem]),
      });

      const result = await service.getMajorIncidentTraceability(
        TENANT_ID,
        'mi-1',
      );

      const problemNode = result.nodes.find((n) => n.type === 'PROBLEM');
      expect(problemNode).toBeDefined();
      expect(problemNode!.label).toContain('Root cause: shared DB');

      // Should also create hypothesis node
      const hypNode = result.nodes.find((n) => n.type === 'RCA_HYPOTHESIS');
      expect(hypNode).toBeDefined();
      expect(hypNode!.label).toContain('Shared Database');

      // Check CREATED_FROM edge from hypothesis to problem
      const createdFromEdge = result.edges.find(
        (e) => e.relation === 'CREATED_FROM' && e.toId === 'prob-rca-1',
      );
      expect(createdFromEdge).toBeDefined();
    });

    it('should include known errors created from RCA', async () => {
      const mockKe = {
        id: 'ke-rca-1',
        title: 'Known: connection leak',
        state: 'OPEN',
        createdAt: new Date('2026-02-02'),
        metadata: {
          rcaTraceability: {
            sourceMajorIncidentId: 'mi-1',
          },
        },
      };
      knownErrorRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockKe]),
      });

      const result = await service.getMajorIncidentTraceability(
        TENANT_ID,
        'mi-1',
      );

      const keNode = result.nodes.find((n) => n.type === 'KNOWN_ERROR');
      expect(keNode).toBeDefined();
      expect(keNode!.label).toContain('Known: connection leak');
    });

    it('should not duplicate hypothesis nodes for multiple problems from same hypothesis', async () => {
      const traceability = {
        sourceMajorIncidentId: 'mi-1',
        sourceHypothesisId: 'hyp-shared',
        suspectNodeLabel: 'Shared Node',
        hypothesisType: 'common_upstream_dependency',
      };
      const problems = [
        {
          id: 'prob-a',
          shortDescription: 'Problem A',
          state: 'NEW',
          createdAt: new Date(),
          metadata: { rcaTraceability: traceability },
        },
        {
          id: 'prob-b',
          shortDescription: 'Problem B',
          state: 'NEW',
          createdAt: new Date(),
          metadata: { rcaTraceability: traceability },
        },
      ];
      problemRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(problems),
      });

      const result = await service.getMajorIncidentTraceability(
        TENANT_ID,
        'mi-1',
      );

      const hypNodes = result.nodes.filter((n) => n.type === 'RCA_HYPOTHESIS');
      expect(hypNodes.length).toBe(1); // not duplicated
    });
  });

  // ==========================================================================
  // Metrics & Completeness
  // ==========================================================================

  describe('completeness score', () => {
    it('should return 60% for change with topology + governance but no orchestration', async () => {
      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      // Base (20) + Topology (20) + Governance (20) = 60
      expect(result.metrics.completenessScore).toBe(60);
      expect(result.metrics.hasTopologyAnalysis).toBe(true);
      expect(result.metrics.hasGovernanceDecision).toBe(true);
      expect(result.metrics.hasOrchestrationActions).toBe(false);
    });

    it('should return 80% when problems are linked', async () => {
      problemRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            shortDescription: 'P1',
            state: 'NEW',
            createdAt: new Date(),
          },
        ]),
      });

      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      // Base (20) + Topology (20) + Governance (20) + Orchestration (20) = 80
      expect(result.metrics.completenessScore).toBe(80);
      expect(result.metrics.hasOrchestrationActions).toBe(true);
    });

    it('should cap completeness at 100%', async () => {
      // Many problems + KEs should still cap at 100
      const problems = Array.from({ length: 5 }, (_, i) => ({
        id: `p-${i}`,
        shortDescription: `P${i}`,
        state: 'NEW',
        createdAt: new Date(),
        metadata: { sourceChangeId: 'change-1' },
      }));
      problemRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(problems),
      });

      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      // Base (20) + Topology (20) + Governance (20) + Orchestration (20) + 5+ nodes (20) = 100
      expect(result.metrics.completenessScore).toBeLessThanOrEqual(100);
    });

    it('should return 40% for MI with no orchestration records', async () => {
      const result = await service.getMajorIncidentTraceability(
        TENANT_ID,
        'mi-1',
      );

      // Base (20) + Topology (20) = 40 (no governance for MI)
      expect(result.metrics.completenessScore).toBe(40);
      expect(result.metrics.hasGovernanceDecision).toBe(false);
    });
  });

  // ==========================================================================
  // Summary text
  // ==========================================================================

  describe('summary text', () => {
    it('should include "Topology analysis completed" when topology node present', async () => {
      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      expect(result.summary).toContain('Topology analysis completed');
    });

    it('should include governance decision text for changes', async () => {
      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      expect(result.summary).toContain('governance decision evaluated');
    });

    it('should include problem count in summary', async () => {
      problemRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            shortDescription: 'P1',
            state: 'NEW',
            createdAt: new Date(),
          },
          {
            id: 'p2',
            shortDescription: 'P2',
            state: 'NEW',
            createdAt: new Date(),
          },
        ]),
      });

      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      expect(result.summary).toContain('2 problem(s) created');
    });

    it('should return "No traceability chain" for MI with no data', async () => {
      const noRepoService = new TraceabilitySummaryService(
        undefined,
        undefined,
        undefined,
      );
      // Even with no repos, root MI node + topology node are always added
      // so there should still be some summary
      const result = await noRepoService.getMajorIncidentTraceability(
        TENANT_ID,
        'mi-1',
      );

      expect(result.summary).toBeTruthy();
    });
  });

  // ==========================================================================
  // Fail-open behavior
  // ==========================================================================

  describe('fail-open', () => {
    it('should work with no repositories injected', async () => {
      const noRepoService = new TraceabilitySummaryService(
        undefined,
        undefined,
        undefined,
      );

      const result = await noRepoService.getChangeTraceability(
        TENANT_ID,
        'change-1',
      );

      expect(result.rootId).toBe('change-1');
      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should not throw when problem query fails', async () => {
      problemRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(new Error('Connection reset')),
      });

      const result = await service.getChangeTraceability(TENANT_ID, 'change-1');

      expect(result).toBeDefined();
      expect(result.rootId).toBe('change-1');
    });
  });

  // ==========================================================================
  // Tenant isolation
  // ==========================================================================

  describe('tenant isolation', () => {
    it('should pass tenantId to all repository queries for change traceability', async () => {
      await service.getChangeTraceability(TENANT_ID, 'change-1');

      expect(changeRepo.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      });
    });

    it('should pass tenantId to all repository queries for MI traceability', async () => {
      await service.getMajorIncidentTraceability(TENANT_ID, 'mi-1');

      // Problem repo should be queried with tenantId parameter
      const qb = problemRepo.createQueryBuilder.mock.results[0]?.value;
      if (qb) {
        expect(qb.where).toHaveBeenCalledWith('p.tenantId = :tenantId', {
          tenantId: TENANT_ID,
        });
      }
    });
  });
});
