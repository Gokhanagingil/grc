/**
 * Unit tests for SuggestedTaskPackService
 *
 * Tests topology-driven operational task generation including:
 * - Task generation based on topology impact metrics
 * - Risk level classification
 * - Category-specific task rules (VALIDATION, ROLLBACK_READINESS, etc.)
 * - Fail-open behavior when topology analysis is unavailable
 * - Empty/minimal impact scenarios
 */
import { SuggestedTaskPackService } from './suggested-task-pack.service';
import { TopologyImpactAnalysisService } from './topology-impact-analysis.service';
import { TopologyImpactResponse } from './dto/topology-impact.dto';
import {
  ItsmChange,
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from '../../change.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ============================================================================
// Helpers
// ============================================================================

function makeChange(overrides: Partial<ItsmChange> = {}): ItsmChange {
  const change = new ItsmChange();
  change.id = 'change-1';
  change.tenantId = TENANT_ID;
  change.number = 'CHG000001';
  change.title = 'Test Change';
  change.description = null;
  change.type = ChangeType.NORMAL;
  change.state = ChangeState.DRAFT;
  change.risk = ChangeRisk.MEDIUM;
  change.approvalStatus = ChangeApprovalStatus.NOT_REQUESTED;
  change.requesterId = null;
  change.requester = null;
  change.assigneeId = null;
  change.assignee = null;
  change.serviceId = 'svc-1';
  change.cmdbService = null;
  change.offeringId = null;
  change.offering = null;
  change.plannedStartAt = new Date();
  change.plannedEndAt = new Date();
  change.actualStartAt = null;
  change.actualEndAt = null;
  change.implementationPlan = null;
  change.backoutPlan = null;
  change.justification = null;
  change.metadata = null;
  change.createdAt = new Date();
  change.updatedAt = new Date();
  change.createdBy = 'user-1';
  change.updatedBy = null;
  change.isDeleted = false;
  Object.assign(change, overrides);
  return change;
}

function makeImpact(
  overrides: Partial<TopologyImpactResponse> = {},
): TopologyImpactResponse {
  return {
    changeId: 'change-1',
    rootNodeIds: ['ci-root'],
    metrics: {
      totalImpactedNodes: 5,
      impactedByDepth: { 0: 1, 1: 4 },
      impactedServiceCount: 2,
      impactedOfferingCount: 0,
      impactedCiCount: 3,
      criticalCiCount: 1,
      maxChainDepth: 1,
      crossServicePropagation: false,
      crossServiceCount: 1,
    },
    impactedNodes: [],
    topPaths: [],
    fragilitySignals: [],
    topologyRiskScore: 45,
    riskExplanation: 'Moderate topology risk',
    computedAt: new Date().toISOString(),
    warnings: [],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SuggestedTaskPackService', () => {
  let service: SuggestedTaskPackService;
  let mockTopologyAnalysis: Partial<TopologyImpactAnalysisService>;
  let mockChangeRepo: {
    findOne: jest.Mock;
  };

  beforeEach(() => {
    mockTopologyAnalysis = {
      calculateTopologyImpact: jest.fn(),
    };
    mockChangeRepo = {
      findOne: jest.fn(),
    };
    service = new SuggestedTaskPackService(
      mockTopologyAnalysis as TopologyImpactAnalysisService,
      mockChangeRepo as never,
    );
  });

  // ==========================================================================
  // Fail-open behavior
  // ==========================================================================

  describe('fail-open behavior', () => {
    it('should return empty pack when topology analysis service is not available', async () => {
      const noTopoService = new SuggestedTaskPackService(
        undefined,
        mockChangeRepo as never,
      );

      const result = await noTopoService.generateTaskPack(
        TENANT_ID,
        'change-1',
      );

      expect(result.changeId).toBe('change-1');
      expect(result.riskLevel).toBe('UNKNOWN');
      expect(result.tasks).toEqual([]);
      expect(result.totalTasks).toBe(0);
      expect(result.warnings).toContain(
        'Topology analysis service not available.',
      );
    });

    it('should return empty pack when change is not found', async () => {
      mockChangeRepo.findOne.mockResolvedValue(null);

      const result = await service.generateTaskPack(TENANT_ID, 'nonexistent');

      expect(result.changeId).toBe('nonexistent');
      expect(result.riskLevel).toBe('UNKNOWN');
      expect(result.tasks).toEqual([]);
      expect(result.warnings).toContain('Change not found.');
    });

    it('should return empty pack when topology calculation throws', async () => {
      const change = makeChange();
      mockChangeRepo.findOne.mockResolvedValue(change);
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockRejectedValue(new Error('Topology service timeout'));

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      expect(result.changeId).toBe('change-1');
      expect(result.riskLevel).toBe('UNKNOWN');
      expect(result.tasks).toEqual([]);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Topology impact calculation failed'),
      );
    });
  });

  // ==========================================================================
  // Task generation
  // ==========================================================================

  describe('task generation', () => {
    it('should always include a scope validation task', async () => {
      const change = makeChange();
      const impact = makeImpact({ topologyRiskScore: 20 });
      mockChangeRepo.findOne.mockResolvedValue(change);
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
      const scopeTask = result.tasks.find(
        (t) => t.templateKey === 'validate_change_scope',
      );
      expect(scopeTask).toBeDefined();
      expect(scopeTask!.category).toBe('VALIDATION');
      expect(scopeTask!.recommended).toBe(true);
    });

    it('should add cross-service validation when cross-service propagation detected', async () => {
      const impact = makeImpact({
        topologyRiskScore: 50,
        metrics: {
          ...makeImpact().metrics,
          crossServicePropagation: true,
          crossServiceCount: 3,
          impactedServiceCount: 3,
        },
      });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      const crossSvcTask = result.tasks.find(
        (t) => t.templateKey === 'validate_cross_service_impact',
      );
      expect(crossSvcTask).toBeDefined();
      expect(crossSvcTask!.priority).toBe('HIGH');
      expect(crossSvcTask!.recommended).toBe(true);
    });

    it('should add extended blast radius validation when nodes >= 10', async () => {
      const impact = makeImpact({
        topologyRiskScore: 60,
        metrics: {
          ...makeImpact().metrics,
          totalImpactedNodes: 15,
        },
      });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      const blastTask = result.tasks.find(
        (t) => t.templateKey === 'validate_blast_radius_coverage',
      );
      expect(blastTask).toBeDefined();
      expect(blastTask!.priority).toBe('HIGH');
    });

    it('should set CRITICAL priority for blast radius >= 25 nodes', async () => {
      const impact = makeImpact({
        topologyRiskScore: 80,
        metrics: {
          ...makeImpact().metrics,
          totalImpactedNodes: 30,
        },
      });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      const blastTask = result.tasks.find(
        (t) => t.templateKey === 'validate_blast_radius_coverage',
      );
      expect(blastTask).toBeDefined();
      expect(blastTask!.priority).toBe('CRITICAL');
    });

    it('should add rollback readiness task when score >= 30', async () => {
      const impact = makeImpact({ topologyRiskScore: 35 });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      const rollbackTask = result.tasks.find(
        (t) => t.templateKey === 'prepare_rollback_plan',
      );
      expect(rollbackTask).toBeDefined();
      expect(rollbackTask!.category).toBe('ROLLBACK_READINESS');
    });

    it('should add SPOF rollback mitigation when SPOFs detected', async () => {
      const impact = makeImpact({
        topologyRiskScore: 60,
        fragilitySignals: [
          {
            type: 'single_point_of_failure',
            nodeId: 'ci-hub',
            nodeLabel: 'Hub Server',
            reason: 'Single point of failure',
            severity: 80,
          },
        ],
      });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      const spofTask = result.tasks.find(
        (t) => t.templateKey === 'rollback_spof_mitigation',
      );
      expect(spofTask).toBeDefined();
      expect(spofTask!.category).toBe('ROLLBACK_READINESS');
      expect(spofTask!.priority).toBe('HIGH');
      expect(spofTask!.description).toContain('Hub Server');
    });

    it('should add monitoring task when score >= 30', async () => {
      const impact = makeImpact({ topologyRiskScore: 40 });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      const monitorTask = result.tasks.find(
        (t) => t.templateKey === 'setup_enhanced_monitoring',
      );
      expect(monitorTask).toBeDefined();
      expect(monitorTask!.category).toBe('MONITORING');
    });

    it('should add cascade monitoring when deep chains detected', async () => {
      const impact = makeImpact({
        topologyRiskScore: 50,
        metrics: {
          ...makeImpact().metrics,
          maxChainDepth: 5,
        },
        fragilitySignals: [
          {
            type: 'deep_chain',
            nodeId: 'ci-deep',
            nodeLabel: 'Deep Node',
            reason: 'Deep chain',
            severity: 60,
          },
        ],
      });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      const cascadeTask = result.tasks.find(
        (t) => t.templateKey === 'monitor_cascade_propagation',
      );
      expect(cascadeTask).toBeDefined();
      expect(cascadeTask!.category).toBe('MONITORING');
      expect(cascadeTask!.priority).toBe('HIGH');
    });

    it('should add documentation task when score >= 50', async () => {
      const impact = makeImpact({ topologyRiskScore: 55 });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      const docTask = result.tasks.find(
        (t) => t.templateKey === 'document_topology_decisions',
      );
      expect(docTask).toBeDefined();
      expect(docTask!.category).toBe('DOCUMENTATION');
      expect(docTask!.recommended).toBe(false);
    });

    it('should NOT add documentation task when score < 50', async () => {
      const impact = makeImpact({ topologyRiskScore: 30 });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      const docTask = result.tasks.find(
        (t) => t.templateKey === 'document_topology_decisions',
      );
      expect(docTask).toBeUndefined();
    });
  });

  // ==========================================================================
  // Risk level classification
  // ==========================================================================

  describe('risk level classification', () => {
    const testCases = [
      { score: 85, expected: 'CRITICAL' },
      { score: 65, expected: 'HIGH' },
      { score: 45, expected: 'MEDIUM' },
      { score: 25, expected: 'LOW' },
      { score: 10, expected: 'MINIMAL' },
    ];

    testCases.forEach(({ score, expected }) => {
      it(`should classify score ${score} as ${expected}`, async () => {
        const impact = makeImpact({ topologyRiskScore: score });
        mockChangeRepo.findOne.mockResolvedValue(makeChange());
        (
          mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
        ).mockResolvedValue(impact);

        const result = await service.generateTaskPack(TENANT_ID, 'change-1');

        expect(result.riskLevel).toBe(expected);
      });
    });
  });

  // ==========================================================================
  // Response shape
  // ==========================================================================

  describe('response shape', () => {
    it('should include all required fields', async () => {
      const impact = makeImpact({ topologyRiskScore: 50 });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result = await service.generateTaskPack(TENANT_ID, 'change-1');

      expect(result).toHaveProperty('changeId');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('topologyRiskScore');
      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('totalTasks');
      expect(result).toHaveProperty('recommendedCount');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('warnings');
      expect(result.totalTasks).toBe(result.tasks.length);
      expect(result.recommendedCount).toBeLessThanOrEqual(result.totalTasks);
    });

    it('should return deterministic results for same input', async () => {
      const impact = makeImpact({ topologyRiskScore: 60 });
      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result1 = await service.generateTaskPack(TENANT_ID, 'change-1');

      mockChangeRepo.findOne.mockResolvedValue(makeChange());
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(impact);

      const result2 = await service.generateTaskPack(TENANT_ID, 'change-1');

      expect(result1.tasks.map((t) => t.templateKey)).toEqual(
        result2.tasks.map((t) => t.templateKey),
      );
      expect(result1.riskLevel).toBe(result2.riskLevel);
      expect(result1.totalTasks).toBe(result2.totalTasks);
    });
  });

  // ==========================================================================
  // Tenant isolation
  // ==========================================================================

  describe('tenant isolation', () => {
    it('should pass tenantId to change repository query', async () => {
      mockChangeRepo.findOne.mockResolvedValue(null);

      await service.generateTaskPack(TENANT_ID, 'change-1');

      expect(mockChangeRepo.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      });
    });

    it('should pass tenantId to topology analysis', async () => {
      const change = makeChange();
      mockChangeRepo.findOne.mockResolvedValue(change);
      (
        mockTopologyAnalysis.calculateTopologyImpact as jest.Mock
      ).mockResolvedValue(makeImpact());

      await service.generateTaskPack(TENANT_ID, 'change-1');

      expect(mockTopologyAnalysis.calculateTopologyImpact).toHaveBeenCalledWith(
        TENANT_ID,
        change,
      );
    });
  });
});
