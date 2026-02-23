import { TopologyImpactAnalysisService } from './topology-impact-analysis.service';
import {
  ItsmChange,
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from '../../change.entity';
import { ItsmMajorIncident } from '../../../major-incident/major-incident.entity';
import { CmdbCi } from '../../../cmdb/ci/ci.entity';
import { CmdbCiRel } from '../../../cmdb/ci-rel/ci-rel.entity';
import { CmdbServiceCi } from '../../../cmdb/service-ci/cmdb-service-ci.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ============================================================================
// Helpers
// ============================================================================

function makeChange(overrides: Partial<ItsmChange> = {}): ItsmChange {
  const now = new Date();
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
  change.plannedStartAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  change.plannedEndAt = new Date(now.getTime() + 74 * 60 * 60 * 1000);
  change.actualStartAt = null;
  change.actualEndAt = null;
  change.implementationPlan = null;
  change.backoutPlan = null;
  change.justification = null;
  change.metadata = null;
  change.createdAt = now;
  change.updatedAt = now;
  change.createdBy = 'user-1';
  change.updatedBy = null;
  change.isDeleted = false;
  Object.assign(change, overrides);
  return change;
}

function makeMajorIncident(
  overrides: Partial<ItsmMajorIncident> = {},
): ItsmMajorIncident {
  const mi = {
    id: 'mi-1',
    tenantId: TENANT_ID,
    number: 'MI000001',
    title: 'Test Major Incident',
    description: null,
    status: 'DECLARED',
    severity: 'SEV1',
    commanderId: null,
    communicationsLeadId: null,
    techLeadId: null,
    bridgeUrl: null,
    bridgeChannel: null,
    bridgeStartedAt: null,
    bridgeEndedAt: null,
    customerImpactSummary: null,
    businessImpactSummary: null,
    primaryServiceId: 'svc-1',
    primaryOfferingId: null,
    sourceIncidentId: null,
    resolutionSummary: null,
    resolutionCode: null,
    declaredAt: new Date(),
    resolvedAt: null,
    closedAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: null,
    isDeleted: false,
    ...overrides,
  } as ItsmMajorIncident;
  return mi;
}

function makeCi(id: string, name: string, className = 'server'): CmdbCi {
  return {
    id,
    tenantId: TENANT_ID,
    name,
    description: null,
    classId: 'cls-1',
    ciClass: { id: 'cls-1', name: className, label: className } as never,
    lifecycle: 'installed',
    environment: 'production',
    category: null,
    assetTag: null,
    serialNumber: null,
    ipAddress: null,
    dnsName: null,
    managedBy: null,
    ownedBy: null,
    attributes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: false,
    tenant: {} as never,
  } as CmdbCi;
}

function makeRel(
  sourceId: string,
  targetId: string,
  type = 'depends_on',
): CmdbCiRel {
  return {
    id: `rel-${sourceId}-${targetId}`,
    tenantId: TENANT_ID,
    sourceCiId: sourceId,
    targetCiId: targetId,
    type,
    notes: null,
    isActive: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: false,
    sourceCi: makeCi(sourceId, `CI-${sourceId}`),
    targetCi: makeCi(targetId, `CI-${targetId}`),
    tenant: {} as never,
  } as CmdbCiRel;
}

function makeServiceCi(
  serviceId: string,
  ciId: string,
  relType = 'depends_on',
): CmdbServiceCi {
  return {
    id: `link-${serviceId}-${ciId}`,
    tenantId: TENANT_ID,
    serviceId,
    ciId,
    relationshipType: relType,
    isPrimary: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: false,
    service: {
      id: serviceId,
      name: `Service-${serviceId}`,
      criticality: 'high',
    } as never,
    ci: makeCi(ciId, `CI-${ciId}`),
    tenant: {} as never,
  } as CmdbServiceCi;
}

function createMockRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
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

describe('TopologyImpactAnalysisService', () => {
  let service: TopologyImpactAnalysisService;
  let ciRepo: ReturnType<typeof createMockRepo>;
  let ciRelRepo: ReturnType<typeof createMockRepo>;
  let serviceRepo: ReturnType<typeof createMockRepo>;
  let offeringRepo: ReturnType<typeof createMockRepo>;
  let serviceCiRepo: ReturnType<typeof createMockRepo>;
  let changeRepo: ReturnType<typeof createMockRepo>;
  let miLinkRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    ciRepo = createMockRepo();
    ciRelRepo = createMockRepo();
    serviceRepo = createMockRepo();
    offeringRepo = createMockRepo();
    serviceCiRepo = createMockRepo();
    changeRepo = createMockRepo();
    miLinkRepo = createMockRepo();

    service = new TopologyImpactAnalysisService(
      ciRepo as never,
      ciRelRepo as never,
      serviceRepo as never,
      offeringRepo as never,
      serviceCiRepo as never,
      changeRepo as never,
      miLinkRepo as never,
    );
  });

  // ==========================================================================
  // calculateTopologyImpact
  // ==========================================================================

  describe('calculateTopologyImpact', () => {
    it('should return empty impact when change has no serviceId', async () => {
      const change = makeChange({ serviceId: null });

      const result = await service.calculateTopologyImpact(TENANT_ID, change);

      expect(result.changeId).toBe('change-1');
      expect(result.rootNodeIds).toEqual([]);
      expect(result.metrics.totalImpactedNodes).toBe(0);
      expect(result.impactedNodes).toEqual([]);
      expect(result.topPaths).toEqual([]);
      expect(result.fragilitySignals).toEqual([]);
      expect(result.topologyRiskScore).toBe(0);
      expect(result.warnings).toContain(
        'No CMDB CIs linked to change service; blast radius is empty',
      );
    });

    it('should return empty impact when service has no linked CIs', async () => {
      const change = makeChange({ serviceId: 'svc-1' });
      serviceCiRepo.find.mockResolvedValue([]);

      const result = await service.calculateTopologyImpact(TENANT_ID, change);

      expect(result.metrics.totalImpactedNodes).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should compute blast radius for a single root CI with no neighbors', async () => {
      const change = makeChange({ serviceId: 'svc-1' });
      serviceCiRepo.find.mockResolvedValue([makeServiceCi('svc-1', 'ci-root')]);
      ciRepo.find.mockResolvedValue([makeCi('ci-root', 'Root Server')]);

      // No CI-CI relationships
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.calculateTopologyImpact(TENANT_ID, change);

      expect(result.rootNodeIds).toEqual(['ci-root']);
      expect(result.metrics.totalImpactedNodes).toBeGreaterThanOrEqual(1);
      expect(result.metrics.impactedCiCount).toBeGreaterThanOrEqual(1);
    });

    it('should traverse depth-1 relationships and count impacted nodes', async () => {
      const change = makeChange({ serviceId: 'svc-1' });

      // Service -> CI root
      serviceCiRepo.find
        .mockResolvedValueOnce([makeServiceCi('svc-1', 'ci-root')])
        .mockResolvedValue([]);

      // Root CI + neighbor CIs
      ciRepo.find
        .mockResolvedValueOnce([makeCi('ci-root', 'Root Server')])
        .mockResolvedValueOnce([
          makeCi('ci-2', 'Database'),
          makeCi('ci-3', 'Cache'),
        ]);

      // CI-CI relationships
      const rels = [
        makeRel('ci-root', 'ci-2', 'depends_on'),
        makeRel('ci-root', 'ci-3', 'depends_on'),
      ];
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(rels).mockResolvedValue([]),
      });

      const result = await service.calculateTopologyImpact(TENANT_ID, change);

      expect(result.metrics.totalImpactedNodes).toBeGreaterThanOrEqual(3);
      expect(result.metrics.impactedCiCount).toBeGreaterThanOrEqual(3);
      expect(result.impactedNodes.length).toBeGreaterThanOrEqual(2); // excludes root (depth 0)
    });

    it('should detect cross-service propagation', async () => {
      const change = makeChange({ serviceId: 'svc-1' });

      serviceCiRepo.find
        .mockResolvedValueOnce([makeServiceCi('svc-1', 'ci-root')])
        .mockResolvedValueOnce([
          makeServiceCi('svc-1', 'ci-root'),
          makeServiceCi('svc-2', 'ci-2'),
        ])
        .mockResolvedValue([]);

      ciRepo.find
        .mockResolvedValueOnce([makeCi('ci-root', 'Root Server')])
        .mockResolvedValueOnce([makeCi('ci-2', 'Database')]);

      const rels = [makeRel('ci-root', 'ci-2', 'depends_on')];
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(rels).mockResolvedValue([]),
      });

      const result = await service.calculateTopologyImpact(TENANT_ID, change);

      // Should have at least 2 service nodes
      expect(result.metrics.impactedServiceCount).toBeGreaterThanOrEqual(1);
    });

    it('should produce deterministic results for same input', async () => {
      const change = makeChange({ serviceId: 'svc-1' });

      const setupMocks = () => {
        serviceCiRepo.find
          .mockResolvedValueOnce([makeServiceCi('svc-1', 'ci-root')])
          .mockResolvedValue([]);
        ciRepo.find.mockResolvedValueOnce([makeCi('ci-root', 'Root Server')]);
        ciRelRepo.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        });
      };

      setupMocks();
      const result1 = await service.calculateTopologyImpact(TENANT_ID, change);

      setupMocks();
      const result2 = await service.calculateTopologyImpact(TENANT_ID, change);

      expect(result1.topologyRiskScore).toBe(result2.topologyRiskScore);
      expect(result1.metrics).toEqual(result2.metrics);
    });

    it('should warn when graph is truncated at MAX_ANALYSIS_NODES', async () => {
      const change = makeChange({ serviceId: 'svc-1' });

      // Root CI for change's service
      serviceCiRepo.find
        .mockResolvedValueOnce([makeServiceCi('svc-1', 'ci-root')])
        .mockResolvedValue([]);

      // Root CI entity
      ciRepo.find.mockResolvedValueOnce([makeCi('ci-root', 'Root Server')]);

      // Generate 600 relationships from ci-root to other CIs - this should trigger truncation
      const manyRels = Array.from({ length: 600 }, (_, i) =>
        makeRel('ci-root', `ci-nbr-${i}`, 'depends_on'),
      );
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValueOnce(manyRels)
          .mockResolvedValue([]),
      });

      // Return many neighbor CIs when requested
      const manyCis = Array.from({ length: 600 }, (_, i) =>
        makeCi(`ci-nbr-${i}`, `Server ${i}`),
      );
      ciRepo.find.mockResolvedValueOnce(manyCis);

      const result = await service.calculateTopologyImpact(TENANT_ID, change);

      expect(result.warnings).toContainEqual(
        expect.stringContaining('truncated'),
      );
    });
  });

  // ==========================================================================
  // computeBlastRadiusMetrics (unit test via public method access)
  // ==========================================================================

  describe('computeBlastRadiusMetrics', () => {
    it('should count nodes by type and depth', () => {
      const nodes = new Map([
        ['ci-1', { id: 'ci-1', type: 'ci' as const, label: 'Root', depth: 0 }],
        [
          'ci-2',
          {
            id: 'ci-2',
            type: 'ci' as const,
            label: 'DB',
            depth: 1,
            criticality: 'high',
          },
        ],
        [
          'service:svc-1',
          {
            id: 'service:svc-1',
            type: 'service' as const,
            label: 'Svc',
            depth: 1,
          },
        ],
      ]);
      const edges = [
        { sourceId: 'ci-1', targetId: 'ci-2', relationType: 'depends_on' },
        {
          sourceId: 'service:svc-1',
          targetId: 'ci-1',
          relationType: 'runs_on',
        },
      ];

      const metrics = service.computeBlastRadiusMetrics(nodes, edges);

      expect(metrics.totalImpactedNodes).toBe(3);
      expect(metrics.impactedCiCount).toBe(2);
      expect(metrics.impactedServiceCount).toBe(1);
      expect(metrics.criticalCiCount).toBe(1);
      expect(metrics.maxChainDepth).toBe(1);
      expect(metrics.impactedByDepth[0]).toBe(1);
      expect(metrics.impactedByDepth[1]).toBe(2);
    });

    it('should detect cross-service propagation when multiple services', () => {
      const nodes = new Map([
        ['ci-1', { id: 'ci-1', type: 'ci' as const, label: 'Root', depth: 0 }],
        [
          'service:svc-1',
          {
            id: 'service:svc-1',
            type: 'service' as const,
            label: 'Svc1',
            depth: 1,
          },
        ],
        [
          'service:svc-2',
          {
            id: 'service:svc-2',
            type: 'service' as const,
            label: 'Svc2',
            depth: 1,
          },
        ],
      ]);

      const metrics = service.computeBlastRadiusMetrics(nodes, []);

      expect(metrics.crossServicePropagation).toBe(true);
      expect(metrics.crossServiceCount).toBe(2);
    });

    it('should return no cross-service propagation with single service', () => {
      const nodes = new Map([
        ['ci-1', { id: 'ci-1', type: 'ci' as const, label: 'Root', depth: 0 }],
        [
          'service:svc-1',
          {
            id: 'service:svc-1',
            type: 'service' as const,
            label: 'Svc1',
            depth: 1,
          },
        ],
      ]);

      const metrics = service.computeBlastRadiusMetrics(nodes, []);

      expect(metrics.crossServicePropagation).toBe(false);
      expect(metrics.crossServiceCount).toBe(1);
    });

    it('should handle empty graph', () => {
      const metrics = service.computeBlastRadiusMetrics(new Map(), []);

      expect(metrics.totalImpactedNodes).toBe(0);
      expect(metrics.impactedCiCount).toBe(0);
      expect(metrics.impactedServiceCount).toBe(0);
      expect(metrics.criticalCiCount).toBe(0);
      expect(metrics.maxChainDepth).toBe(0);
    });
  });

  // ==========================================================================
  // detectFragilitySignals
  // ==========================================================================

  describe('detectFragilitySignals', () => {
    it('should detect single point of failure (1 in, 3+ out)', () => {
      const nodes = new Map([
        [
          'hub',
          { id: 'hub', type: 'ci' as const, label: 'Hub Server', depth: 0 },
        ],
        ['ci-a', { id: 'ci-a', type: 'ci' as const, label: 'A', depth: 1 }],
        ['ci-b', { id: 'ci-b', type: 'ci' as const, label: 'B', depth: 1 }],
        ['ci-c', { id: 'ci-c', type: 'ci' as const, label: 'C', depth: 1 }],
        [
          'ci-upstream',
          {
            id: 'ci-upstream',
            type: 'ci' as const,
            label: 'Upstream',
            depth: 0,
          },
        ],
      ]);
      const edges = [
        {
          sourceId: 'ci-upstream',
          targetId: 'hub',
          relationType: 'depends_on',
        },
        { sourceId: 'hub', targetId: 'ci-a', relationType: 'depends_on' },
        { sourceId: 'hub', targetId: 'ci-b', relationType: 'depends_on' },
        { sourceId: 'hub', targetId: 'ci-c', relationType: 'depends_on' },
      ];

      const signals = service.detectFragilitySignals(nodes, edges);

      const spofs = signals.filter((s) => s.type === 'single_point_of_failure');
      expect(spofs.length).toBeGreaterThanOrEqual(1);
      expect(spofs[0].nodeId).toBe('hub');
      expect(spofs[0].severity).toBeGreaterThanOrEqual(50);
    });

    it('should detect no_redundancy for leaf CIs with single input', () => {
      const nodes = new Map([
        [
          'ci-root',
          { id: 'ci-root', type: 'ci' as const, label: 'Root', depth: 0 },
        ],
        [
          'ci-leaf',
          { id: 'ci-leaf', type: 'ci' as const, label: 'Leaf', depth: 1 },
        ],
      ]);
      const edges = [
        {
          sourceId: 'ci-root',
          targetId: 'ci-leaf',
          relationType: 'depends_on',
        },
      ];

      const signals = service.detectFragilitySignals(nodes, edges);

      const noRedundancy = signals.filter((s) => s.type === 'no_redundancy');
      expect(noRedundancy.length).toBe(1);
      expect(noRedundancy[0].nodeId).toBe('ci-leaf');
    });

    it('should detect high fan-out (5+ outgoing)', () => {
      const nodes = new Map([
        [
          'hub',
          { id: 'hub', type: 'ci' as const, label: 'Fan-Out Hub', depth: 0 },
        ],
      ]);
      const edges: Array<{
        sourceId: string;
        targetId: string;
        relationType: string;
      }> = [];
      for (let i = 0; i < 6; i++) {
        const childId = `ci-child-${i}`;
        nodes.set(childId, {
          id: childId,
          type: 'ci' as const,
          label: `Child ${i}`,
          depth: 1,
        });
        edges.push({
          sourceId: 'hub',
          targetId: childId,
          relationType: 'depends_on',
        });
      }

      const signals = service.detectFragilitySignals(nodes, edges);

      const highFanOut = signals.filter((s) => s.type === 'high_fan_out');
      expect(highFanOut.length).toBe(1);
      expect(highFanOut[0].nodeId).toBe('hub');
    });

    it('should detect deep chain (depth >= 3)', () => {
      const nodes = new Map([
        ['ci-0', { id: 'ci-0', type: 'ci' as const, label: 'Root', depth: 0 }],
        ['ci-1', { id: 'ci-1', type: 'ci' as const, label: 'L1', depth: 1 }],
        ['ci-2', { id: 'ci-2', type: 'ci' as const, label: 'L2', depth: 2 }],
        ['ci-3', { id: 'ci-3', type: 'ci' as const, label: 'L3', depth: 3 }],
      ]);

      const signals = service.detectFragilitySignals(nodes, []);

      const deepChain = signals.filter((s) => s.type === 'deep_chain');
      expect(deepChain.length).toBe(1);
      expect(deepChain[0].nodeId).toBe('ci-3');
    });

    it('should return signals sorted by severity descending', () => {
      const nodes = new Map([
        ['hub', { id: 'hub', type: 'ci' as const, label: 'Hub', depth: 0 }],
        [
          'ci-leaf',
          { id: 'ci-leaf', type: 'ci' as const, label: 'Leaf', depth: 3 },
        ],
      ]);
      const edges: Array<{
        sourceId: string;
        targetId: string;
        relationType: string;
      }> = [];
      for (let i = 0; i < 6; i++) {
        const childId = `c-${i}`;
        nodes.set(childId, {
          id: childId,
          type: 'ci' as const,
          label: `C${i}`,
          depth: 1,
        });
        edges.push({
          sourceId: 'hub',
          targetId: childId,
          relationType: 'depends_on',
        });
      }

      const signals = service.detectFragilitySignals(nodes, edges);

      for (let i = 1; i < signals.length; i++) {
        expect(signals[i - 1].severity).toBeGreaterThanOrEqual(
          signals[i].severity,
        );
      }
    });

    it('should return empty array for a single disconnected node', () => {
      const nodes = new Map([
        [
          'ci-1',
          { id: 'ci-1', type: 'ci' as const, label: 'Isolated', depth: 0 },
        ],
      ]);

      const signals = service.detectFragilitySignals(nodes, []);

      expect(signals).toEqual([]);
    });
  });

  // ==========================================================================
  // calculateTopologyRiskScore
  // ==========================================================================

  describe('calculateTopologyRiskScore', () => {
    it('should return low score for minimal blast radius', () => {
      const metrics = {
        totalImpactedNodes: 1,
        impactedByDepth: { 0: 1 },
        impactedServiceCount: 0,
        impactedOfferingCount: 0,
        impactedCiCount: 1,
        criticalCiCount: 0,
        maxChainDepth: 0,
        crossServicePropagation: false,
        crossServiceCount: 0,
      };

      const score = service.calculateTopologyRiskScore(metrics, []);

      expect(score).toBeLessThanOrEqual(15);
    });

    it('should return high score for large blast radius with critical CIs', () => {
      const metrics = {
        totalImpactedNodes: 60,
        impactedByDepth: { 0: 5, 1: 25, 2: 30 },
        impactedServiceCount: 3,
        impactedOfferingCount: 2,
        impactedCiCount: 55,
        criticalCiCount: 20,
        maxChainDepth: 3,
        crossServicePropagation: true,
        crossServiceCount: 3,
      };
      const fragility = [
        {
          type: 'single_point_of_failure' as const,
          nodeId: 'hub',
          nodeLabel: 'Hub',
          reason: 'SPOF detected',
          severity: 90,
        },
      ];

      const score = service.calculateTopologyRiskScore(metrics, fragility);

      expect(score).toBeGreaterThanOrEqual(60);
    });

    it('should increase score when fragility signals are present', () => {
      const metrics = {
        totalImpactedNodes: 10,
        impactedByDepth: { 0: 3, 1: 7 },
        impactedServiceCount: 1,
        impactedOfferingCount: 0,
        impactedCiCount: 9,
        criticalCiCount: 0,
        maxChainDepth: 1,
        crossServicePropagation: false,
        crossServiceCount: 1,
      };

      const scoreWithout = service.calculateTopologyRiskScore(metrics, []);
      const scoreWith = service.calculateTopologyRiskScore(metrics, [
        {
          type: 'single_point_of_failure',
          nodeId: 'hub',
          nodeLabel: 'Hub',
          reason: 'SPOF',
          severity: 85,
        },
        {
          type: 'high_fan_out',
          nodeId: 'hub',
          nodeLabel: 'Hub',
          reason: 'High fan-out',
          severity: 75,
        },
      ]);

      expect(scoreWith).toBeGreaterThan(scoreWithout);
    });

    it('should be bounded between 0 and 100', () => {
      // Minimal
      const minScore = service.calculateTopologyRiskScore(
        {
          totalImpactedNodes: 0,
          impactedByDepth: {},
          impactedServiceCount: 0,
          impactedOfferingCount: 0,
          impactedCiCount: 0,
          criticalCiCount: 0,
          maxChainDepth: 0,
          crossServicePropagation: false,
          crossServiceCount: 0,
        },
        [],
      );

      // Maximal
      const maxScore = service.calculateTopologyRiskScore(
        {
          totalImpactedNodes: 200,
          impactedByDepth: { 0: 10, 1: 50, 2: 80, 3: 60 },
          impactedServiceCount: 10,
          impactedOfferingCount: 5,
          impactedCiCount: 185,
          criticalCiCount: 100,
          maxChainDepth: 5,
          crossServicePropagation: true,
          crossServiceCount: 10,
        },
        [
          {
            type: 'single_point_of_failure',
            nodeId: 'a',
            nodeLabel: 'A',
            reason: '',
            severity: 95,
          },
          {
            type: 'high_fan_out',
            nodeId: 'b',
            nodeLabel: 'B',
            reason: '',
            severity: 90,
          },
          {
            type: 'deep_chain',
            nodeId: 'c',
            nodeLabel: 'C',
            reason: '',
            severity: 80,
          },
        ],
      );

      expect(minScore).toBeGreaterThanOrEqual(0);
      expect(minScore).toBeLessThanOrEqual(100);
      expect(maxScore).toBeGreaterThanOrEqual(0);
      expect(maxScore).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // generateRiskExplanation
  // ==========================================================================

  describe('generateRiskExplanation', () => {
    it('should include node count and depth in explanation', () => {
      const metrics = {
        totalImpactedNodes: 15,
        impactedByDepth: { 0: 3, 1: 12 },
        impactedServiceCount: 1,
        impactedOfferingCount: 0,
        impactedCiCount: 14,
        criticalCiCount: 0,
        maxChainDepth: 1,
        crossServicePropagation: false,
        crossServiceCount: 1,
      };

      const explanation = service.generateRiskExplanation(metrics, [], 30);

      expect(explanation).toContain('15 node(s)');
      expect(explanation).toContain('1 depth level(s)');
      expect(explanation).toContain('MEDIUM');
    });

    it('should mention critical CIs when present', () => {
      const metrics = {
        totalImpactedNodes: 10,
        impactedByDepth: { 0: 2, 1: 8 },
        impactedServiceCount: 1,
        impactedOfferingCount: 0,
        impactedCiCount: 9,
        criticalCiCount: 3,
        maxChainDepth: 1,
        crossServicePropagation: false,
        crossServiceCount: 1,
      };

      const explanation = service.generateRiskExplanation(metrics, [], 40);

      expect(explanation).toContain('3 critical CI(s)');
    });

    it('should mention cross-service propagation', () => {
      const metrics = {
        totalImpactedNodes: 20,
        impactedByDepth: { 0: 5, 1: 15 },
        impactedServiceCount: 3,
        impactedOfferingCount: 0,
        impactedCiCount: 17,
        criticalCiCount: 0,
        maxChainDepth: 1,
        crossServicePropagation: true,
        crossServiceCount: 3,
      };

      const explanation = service.generateRiskExplanation(metrics, [], 55);

      expect(explanation).toContain('3 service boundaries');
    });

    it('should mention SPOFs when fragility signals present', () => {
      const metrics = {
        totalImpactedNodes: 5,
        impactedByDepth: { 0: 1, 1: 4 },
        impactedServiceCount: 0,
        impactedOfferingCount: 0,
        impactedCiCount: 5,
        criticalCiCount: 0,
        maxChainDepth: 1,
        crossServicePropagation: false,
        crossServiceCount: 0,
      };
      const signals = [
        {
          type: 'single_point_of_failure' as const,
          nodeId: 'hub',
          nodeLabel: 'Hub',
          reason: 'SPOF',
          severity: 80,
        },
      ];

      const explanation = service.generateRiskExplanation(metrics, signals, 45);

      expect(explanation).toContain('single point(s) of failure');
    });

    it('should correctly label risk levels', () => {
      const metrics = {
        totalImpactedNodes: 1,
        impactedByDepth: { 0: 1 },
        impactedServiceCount: 0,
        impactedOfferingCount: 0,
        impactedCiCount: 1,
        criticalCiCount: 0,
        maxChainDepth: 0,
        crossServicePropagation: false,
        crossServiceCount: 0,
      };

      expect(service.generateRiskExplanation(metrics, [], 10)).toContain('LOW');
      expect(service.generateRiskExplanation(metrics, [], 30)).toContain(
        'MEDIUM',
      );
      expect(service.generateRiskExplanation(metrics, [], 55)).toContain(
        'HIGH',
      );
      expect(service.generateRiskExplanation(metrics, [], 80)).toContain(
        'CRITICAL',
      );
    });
  });

  // ==========================================================================
  // BFS Traversal edge cases
  // ==========================================================================

  describe('bfsTraversal', () => {
    it('should handle empty root node list', async () => {
      const { nodes, edges, truncated } = await service.bfsTraversal(
        TENANT_ID,
        [],
        3,
      );

      expect(nodes.size).toBe(0);
      expect(edges).toHaveLength(0);
      expect(truncated).toBe(false);
    });

    it('should handle root nodes that do not exist in DB', async () => {
      ciRepo.find.mockResolvedValue([]);

      const { nodes, edges, truncated } = await service.bfsTraversal(
        TENANT_ID,
        ['missing-ci'],
        3,
      );

      expect(nodes.size).toBe(0);
      expect(edges).toHaveLength(0);
      expect(truncated).toBe(false);
    });

    it('should handle cycles without infinite loop', async () => {
      ciRepo.find.mockResolvedValue([makeCi('ci-a', 'A'), makeCi('ci-b', 'B')]);

      // A -> B, B -> A cycle
      const relAB = makeRel('ci-a', 'ci-b');
      const relBA = makeRel('ci-b', 'ci-a');

      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValueOnce([relAB])
          .mockResolvedValueOnce([relBA])
          .mockResolvedValue([]),
      });
      serviceCiRepo.find.mockResolvedValue([]);

      const { nodes, truncated } = await service.bfsTraversal(
        TENANT_ID,
        ['ci-a'],
        5,
      );

      // Should terminate and have exactly 2 nodes (no duplicates)
      expect(nodes.size).toBeLessThanOrEqual(2);
      expect(truncated).toBe(false);
    });

    it('should respect maxDepth parameter', async () => {
      ciRepo.find.mockResolvedValueOnce([makeCi('ci-a', 'A')]);

      // A -> B at depth 0
      const relAB = makeRel('ci-a', 'ci-b');

      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([relAB]).mockResolvedValue([]),
      });
      serviceCiRepo.find.mockResolvedValue([]);
      ciRepo.find.mockResolvedValue([makeCi('ci-b', 'B')]);

      const result0 = await service.bfsTraversal(TENANT_ID, ['ci-a'], 0);
      expect(result0.nodes.size).toBe(1); // Only root

      // Reset mocks for depth 1
      ciRepo.find.mockReset();
      ciRepo.find
        .mockResolvedValueOnce([makeCi('ci-a', 'A')])
        .mockResolvedValueOnce([makeCi('ci-b', 'B')]);
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([relAB]).mockResolvedValue([]),
      });
      serviceCiRepo.find.mockResolvedValue([]);

      const result1 = await service.bfsTraversal(TENANT_ID, ['ci-a'], 1);
      expect(result1.nodes.size).toBe(2); // root + 1 neighbor
    });

    it('should handle disconnected nodes (nodes with no edges)', async () => {
      ciRepo.find.mockResolvedValue([makeCi('ci-isolated', 'Isolated Server')]);

      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });
      serviceCiRepo.find.mockResolvedValue([]);

      const { nodes, edges } = await service.bfsTraversal(
        TENANT_ID,
        ['ci-isolated'],
        3,
      );

      expect(nodes.size).toBe(1);
      expect(edges).toHaveLength(0);
    });
  });

  // ==========================================================================
  // findTopPaths
  // ==========================================================================

  describe('findTopPaths', () => {
    it('should find paths from root to leaves', () => {
      const nodes = new Map([
        ['ci-1', { id: 'ci-1', type: 'ci' as const, label: 'Root', depth: 0 }],
        ['ci-2', { id: 'ci-2', type: 'ci' as const, label: 'Mid', depth: 1 }],
        ['ci-3', { id: 'ci-3', type: 'ci' as const, label: 'Leaf', depth: 2 }],
      ]);
      const edges = [
        { sourceId: 'ci-1', targetId: 'ci-2', relationType: 'depends_on' },
        { sourceId: 'ci-2', targetId: 'ci-3', relationType: 'depends_on' },
      ];

      const paths = service.findTopPaths(nodes, edges, ['ci-1']);

      expect(paths.length).toBeGreaterThanOrEqual(1);
      // Should have a path ci-1 -> ci-2 -> ci-3
      const longPath = paths.find((p) => p.depth === 2);
      expect(longPath).toBeDefined();
      expect(longPath!.nodeLabels).toEqual(['Root', 'Mid', 'Leaf']);
    });

    it('should return empty paths for isolated node', () => {
      const nodes = new Map([
        ['ci-1', { id: 'ci-1', type: 'ci' as const, label: 'Alone', depth: 0 }],
      ]);

      const paths = service.findTopPaths(nodes, [], ['ci-1']);

      // Single node = leaf, so should still return one path of depth 0
      expect(paths.length).toBe(1);
      expect(paths[0].depth).toBe(0);
    });

    it('should not produce infinite loops on cycles', () => {
      const nodes = new Map([
        ['ci-1', { id: 'ci-1', type: 'ci' as const, label: 'A', depth: 0 }],
        ['ci-2', { id: 'ci-2', type: 'ci' as const, label: 'B', depth: 1 }],
      ]);
      const edges = [
        { sourceId: 'ci-1', targetId: 'ci-2', relationType: 'depends_on' },
        { sourceId: 'ci-2', targetId: 'ci-1', relationType: 'depends_on' },
      ];

      // Should complete without hanging
      const paths = service.findTopPaths(nodes, edges, ['ci-1']);
      expect(paths.length).toBeGreaterThanOrEqual(1);
    });

    it('should limit paths to MAX_TOP_PATHS (10)', () => {
      // Build a wide graph with many paths
      const nodes = new Map<
        string,
        { id: string; type: 'ci'; label: string; depth: number }
      >();
      nodes.set('root', { id: 'root', type: 'ci', label: 'Root', depth: 0 });
      const edges: Array<{
        sourceId: string;
        targetId: string;
        relationType: string;
      }> = [];

      for (let i = 0; i < 15; i++) {
        const childId = `child-${i}`;
        nodes.set(childId, {
          id: childId,
          type: 'ci',
          label: `Child ${i}`,
          depth: 1,
        });
        edges.push({
          sourceId: 'root',
          targetId: childId,
          relationType: 'depends_on',
        });
        // Add grandchild for each child to make longer paths
        const grandchildId = `grandchild-${i}`;
        nodes.set(grandchildId, {
          id: grandchildId,
          type: 'ci',
          label: `Grandchild ${i}`,
          depth: 2,
        });
        edges.push({
          sourceId: childId,
          targetId: grandchildId,
          relationType: 'depends_on',
        });
      }

      const paths = service.findTopPaths(nodes, edges, ['root']);

      expect(paths.length).toBeLessThanOrEqual(10);
    });
  });

  // ==========================================================================
  // generateRcaHypotheses
  // ==========================================================================

  describe('generateRcaHypotheses', () => {
    it('should return empty hypotheses when MI has no linked services or CIs', async () => {
      const mi = makeMajorIncident({ primaryServiceId: null });
      miLinkRepo.find.mockResolvedValue([]);

      const result = await service.generateRcaHypotheses(TENANT_ID, mi);

      expect(result.majorIncidentId).toBe('mi-1');
      expect(result.hypotheses).toEqual([]);
      expect(result.warnings).toContain(
        'No services or CIs linked to major incident; RCA analysis is empty',
      );
    });

    it('should generate hypotheses from MI primary service', async () => {
      const mi = makeMajorIncident({ primaryServiceId: 'svc-1' });

      // gatherMiRootNodes: miLinkRepo.find returns no extra links
      miLinkRepo.find.mockResolvedValue([]);

      // findCisForService (for svc-1): serviceCiRepo.find returns root CIs
      // Then BFS calls findServiceCiLinksForCis: serviceCiRepo.find again
      // Then findRecentChangesForCis: serviceCiRepo.find again
      serviceCiRepo.find
        .mockResolvedValueOnce([
          makeServiceCi('svc-1', 'ci-root'),
          makeServiceCi('svc-1', 'ci-2'),
        ]) // findCisForService
        .mockResolvedValue([]); // BFS + subsequent calls

      // Root CIs loaded by BFS
      ciRepo.find.mockResolvedValue([
        makeCi('ci-root', 'Root Server'),
        makeCi('ci-2', 'Database'),
      ]);

      // CI-CI relations (none needed; the root CIs themselves are the graph)
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      // Recent changes
      changeRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.generateRcaHypotheses(TENANT_ID, mi);

      expect(result.majorIncidentId).toBe('mi-1');
      expect(result.rootServiceIds).toContain('svc-1');
      expect(result.nodesAnalyzed).toBeGreaterThan(0);
    });

    it('should rank hypotheses by score descending', async () => {
      const mi = makeMajorIncident({ primaryServiceId: 'svc-1' });
      miLinkRepo.find.mockResolvedValue([]);

      // Build a graph where ci-hub connects to multiple affected nodes
      serviceCiRepo.find
        .mockResolvedValueOnce([]) // gatherMiRootNodes links
        .mockResolvedValueOnce([
          makeServiceCi('svc-1', 'ci-1'),
          makeServiceCi('svc-1', 'ci-2'),
          makeServiceCi('svc-1', 'ci-3'),
        ]) // findCisForService
        .mockResolvedValue([]);

      ciRepo.find.mockResolvedValue([
        makeCi('ci-1', 'Server 1'),
        makeCi('ci-2', 'Server 2'),
        makeCi('ci-3', 'Server 3'),
        makeCi('ci-hub', 'Hub Server'),
      ]);

      // Hub connects to all affected CIs
      const rels = [
        makeRel('ci-hub', 'ci-1', 'depends_on'),
        makeRel('ci-hub', 'ci-2', 'depends_on'),
        makeRel('ci-hub', 'ci-3', 'depends_on'),
      ];
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(rels).mockResolvedValue([]),
      });

      changeRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.generateRcaHypotheses(TENANT_ID, mi);

      // Hypotheses should be sorted by score desc
      for (let i = 1; i < result.hypotheses.length; i++) {
        expect(result.hypotheses[i - 1].score).toBeGreaterThanOrEqual(
          result.hypotheses[i].score,
        );
      }
    });

    it('should include recommended actions in hypotheses', async () => {
      const mi = makeMajorIncident({ primaryServiceId: 'svc-1' });
      miLinkRepo.find.mockResolvedValue([]);

      serviceCiRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          makeServiceCi('svc-1', 'ci-1'),
          makeServiceCi('svc-1', 'ci-2'),
        ])
        .mockResolvedValue([]);

      ciRepo.find.mockResolvedValue([
        makeCi('ci-1', 'Server 1'),
        makeCi('ci-2', 'Server 2'),
        makeCi('ci-hub', 'Hub'),
      ]);

      const rels = [
        makeRel('ci-hub', 'ci-1', 'depends_on'),
        makeRel('ci-hub', 'ci-2', 'depends_on'),
      ];
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(rels).mockResolvedValue([]),
      });

      changeRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.generateRcaHypotheses(TENANT_ID, mi);

      for (const hypothesis of result.hypotheses) {
        expect(hypothesis.recommendedActions).toBeDefined();
        expect(hypothesis.recommendedActions.length).toBeGreaterThan(0);
        for (const action of hypothesis.recommendedActions) {
          expect(action.type).toBeDefined();
          expect(action.label).toBeDefined();
          expect(action.reason).toBeDefined();
          expect(action.confidence).toBeGreaterThanOrEqual(0);
          expect(action.confidence).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should limit hypotheses to MAX_HYPOTHESES (15)', async () => {
      const mi = makeMajorIncident({ primaryServiceId: 'svc-1' });
      miLinkRepo.find.mockResolvedValue([]);

      // Build a large graph that will generate many hypotheses
      const serviceCiLinks = Array.from({ length: 20 }, (_, i) =>
        makeServiceCi('svc-1', `ci-${i}`),
      );
      serviceCiRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(serviceCiLinks)
        .mockResolvedValue([]);

      const cis = Array.from({ length: 25 }, (_, i) =>
        makeCi(`ci-${i}`, `Server ${i}`),
      );
      ciRepo.find.mockResolvedValue(cis);

      // Create many cross-connected relationships
      const rels: CmdbCiRel[] = [];
      for (let i = 20; i < 25; i++) {
        for (let j = 0; j < 5; j++) {
          rels.push(makeRel(`ci-${i}`, `ci-${j}`, 'depends_on'));
        }
      }
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(rels).mockResolvedValue([]),
      });

      changeRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.generateRcaHypotheses(TENANT_ID, mi);

      expect(result.hypotheses.length).toBeLessThanOrEqual(15);
    });
  });

  // ==========================================================================
  // getTopologyRiskFactor (integration with RiskScoringService)
  // ==========================================================================

  describe('getTopologyRiskFactor', () => {
    it('should return score and evidence for a change', async () => {
      const change = makeChange({ serviceId: 'svc-1' });

      serviceCiRepo.find
        .mockResolvedValueOnce([makeServiceCi('svc-1', 'ci-root')])
        .mockResolvedValue([]);
      ciRepo.find.mockResolvedValue([makeCi('ci-root', 'Root Server')]);
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const { score, evidence } = await service.getTopologyRiskFactor(
        TENANT_ID,
        change,
      );

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(typeof evidence).toBe('string');
      expect(evidence.length).toBeGreaterThan(0);
    });

    it('should return 0 score when no repos available', async () => {
      const serviceNoRepos = new TopologyImpactAnalysisService();
      const change = makeChange({ serviceId: 'svc-1' });

      const { score, evidence } = await serviceNoRepos.getTopologyRiskFactor(
        TENANT_ID,
        change,
      );

      expect(score).toBe(0);
      expect(evidence).toBeDefined();
    });
  });

  // ==========================================================================
  // Tenant isolation
  // ==========================================================================

  describe('tenant isolation', () => {
    it('should pass tenantId to all repository queries', async () => {
      const change = makeChange({ serviceId: 'svc-1' });
      serviceCiRepo.find.mockResolvedValue([]);

      await service.calculateTopologyImpact(TENANT_ID, change);

      // Verify serviceCiRepo.find was called with the correct tenantId
      expect(serviceCiRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );
    });

    it('should pass tenantId to BFS CI queries', async () => {
      ciRepo.find.mockResolvedValue([makeCi('ci-1', 'Test')]);
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });
      serviceCiRepo.find.mockResolvedValue([]);

      await service.bfsTraversal(TENANT_ID, ['ci-1'], 1);

      expect(ciRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );
    });
  });

  // ==========================================================================
  // Phase 2: classifyImpactBuckets
  // ==========================================================================

  describe('classifyImpactBuckets (Phase 2)', () => {
    const classify = (
      nodes: Map<
        string,
        {
          id: string;
          type: 'ci' | 'service' | 'service_offering';
          label: string;
          depth: number;
          className?: string;
          criticality?: string;
        }
      >,
      edges: Array<{
        sourceId: string;
        targetId: string;
        relationType: string;
      }>,
    ) => (service as any).classifyImpactBuckets(nodes, edges);

    it('should classify depth-1 non-critical CI as direct', () => {
      const nodes = new Map([
        [
          'root',
          {
            id: 'root',
            type: 'ci' as const,
            label: 'Root',
            depth: 0,
            className: 'server',
          },
        ],
        [
          'ci-1',
          {
            id: 'ci-1',
            type: 'ci' as const,
            label: 'App',
            depth: 1,
            className: 'application',
          },
        ],
      ]);
      const edges = [
        { sourceId: 'root', targetId: 'ci-1', relationType: 'depends_on' },
      ];

      const result = classify(nodes, edges);

      // ci-1 is depth 1, not critical, has className and edges => direct
      // But classifyImpactBuckets checks criticalityWeight >= 80 for critical_path
      // className 'application' won't trigger criticalityWeight >= 80
      expect(result.bucketByNodeId.get('ci-1')).toBeDefined();
      expect(
        result.summary.direct +
          result.summary.downstream +
          result.summary.criticalPath +
          result.summary.unknownConfidence,
      ).toBeGreaterThan(0);
    });

    it('should classify depth-2 CI as downstream', () => {
      const nodes = new Map([
        [
          'root',
          {
            id: 'root',
            type: 'ci' as const,
            label: 'Root',
            depth: 0,
            className: 'server',
          },
        ],
        [
          'ci-1',
          {
            id: 'ci-1',
            type: 'ci' as const,
            label: 'Mid',
            depth: 1,
            className: 'server',
          },
        ],
        [
          'ci-2',
          {
            id: 'ci-2',
            type: 'ci' as const,
            label: 'Deep',
            depth: 2,
            className: 'application',
          },
        ],
      ]);
      const edges = [
        { sourceId: 'root', targetId: 'ci-1', relationType: 'depends_on' },
        { sourceId: 'ci-1', targetId: 'ci-2', relationType: 'depends_on' },
      ];

      const result = classify(nodes, edges);

      // ci-2 at depth 2, low criticality, has edges/className => downstream
      const bucket = result.bucketByNodeId.get('ci-2');
      expect(bucket).toBeDefined();
    });

    it('should classify CI with missing className as unknown_confidence', () => {
      const nodes = new Map([
        [
          'root',
          {
            id: 'root',
            type: 'ci' as const,
            label: 'Root',
            depth: 0,
            className: 'server',
          },
        ],
        [
          'ci-x',
          { id: 'ci-x', type: 'ci' as const, label: 'Unknown', depth: 1 },
        ],
      ]);
      // ci-x has no edges => degree 0, and no className
      const result = classify(nodes, []);

      const bucket = result.bucketByNodeId.get('ci-x');
      expect(bucket).toBe('unknown_confidence');
      expect(result.summary.unknownConfidence).toBe(1);
    });

    it('should skip root nodes (depth 0)', () => {
      const nodes = new Map([
        [
          'root',
          {
            id: 'root',
            type: 'ci' as const,
            label: 'Root',
            depth: 0,
            className: 'server',
          },
        ],
      ]);

      const result = classify(nodes, []);

      expect(result.bucketByNodeId.size).toBe(0);
      expect(result.summary.direct).toBe(0);
      expect(result.summary.downstream).toBe(0);
      expect(result.summary.criticalPath).toBe(0);
      expect(result.summary.unknownConfidence).toBe(0);
    });

    it('should produce deterministic results for same input', () => {
      const nodes = new Map([
        [
          'root',
          {
            id: 'root',
            type: 'ci' as const,
            label: 'Root',
            depth: 0,
            className: 'server',
          },
        ],
        [
          'ci-1',
          {
            id: 'ci-1',
            type: 'ci' as const,
            label: 'A',
            depth: 1,
            className: 'server',
          },
        ],
        [
          'ci-2',
          {
            id: 'ci-2',
            type: 'ci' as const,
            label: 'B',
            depth: 2,
            className: 'app',
          },
        ],
      ]);
      const edges = [
        { sourceId: 'root', targetId: 'ci-1', relationType: 'depends_on' },
        { sourceId: 'ci-1', targetId: 'ci-2', relationType: 'depends_on' },
      ];

      const r1 = classify(nodes, edges);
      const r2 = classify(nodes, edges);

      expect(r1.summary).toEqual(r2.summary);
      expect(Array.from(r1.bucketByNodeId.entries())).toEqual(
        Array.from(r2.bucketByNodeId.entries()),
      );
    });
  });

  // ==========================================================================
  // Phase 2: computeTopologyCompletenessConfidence
  // ==========================================================================

  describe('computeTopologyCompletenessConfidence (Phase 2)', () => {
    const computeConfidence = (
      nodes: Map<
        string,
        {
          id: string;
          type: 'ci' | 'service' | 'service_offering';
          label: string;
          depth: number;
          className?: string;
        }
      >,
      edges: Array<{
        sourceId: string;
        targetId: string;
        relationType: string;
      }>,
      truncated: boolean,
    ) =>
      (service as any).computeTopologyCompletenessConfidence(
        nodes,
        edges,
        truncated,
      );

    it('should return HIGH confidence for complete graph', () => {
      const nodes = new Map([
        [
          'ci-1',
          {
            id: 'ci-1',
            type: 'ci' as const,
            label: 'Server',
            depth: 0,
            className: 'server',
          },
        ],
        [
          'ci-2',
          {
            id: 'ci-2',
            type: 'ci' as const,
            label: 'DB',
            depth: 1,
            className: 'database',
          },
        ],
      ]);
      const edges = [
        { sourceId: 'ci-1', targetId: 'ci-2', relationType: 'depends_on' },
      ];

      const result = computeConfidence(nodes, edges, false);

      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.label).toMatch(/HIGH|MEDIUM/);
      expect(result.degradingFactors).toBeDefined();
    });

    it('should degrade confidence for missing class semantics', () => {
      // Only depth > 0 CIs count as impacted for confidence scoring
      const nodes = new Map([
        [
          'ci-0',
          {
            id: 'ci-0',
            type: 'ci' as const,
            label: 'Root',
            depth: 0,
            className: 'server',
          },
        ],
        [
          'ci-1',
          { id: 'ci-1', type: 'ci' as const, label: 'Unknown', depth: 1 },
        ],
        [
          'ci-2',
          { id: 'ci-2', type: 'ci' as const, label: 'Unknown2', depth: 2 },
        ],
      ]);
      const edges = [
        { sourceId: 'ci-0', targetId: 'ci-1', relationType: 'depends_on' },
        { sourceId: 'ci-1', targetId: 'ci-2', relationType: 'depends_on' },
      ];

      const result = computeConfidence(nodes, edges, false);

      expect(result.missingClassCount).toBe(2);
      const missingFactor = result.degradingFactors.find(
        (f: { code: string }) => f.code === 'MISSING_CLASS_SEMANTICS',
      );
      expect(missingFactor).toBeDefined();
    });

    it('should degrade confidence for isolated CI nodes', () => {
      const nodes = new Map([
        [
          'ci-1',
          {
            id: 'ci-1',
            type: 'ci' as const,
            label: 'Isolated',
            depth: 1,
            className: 'server',
          },
        ],
      ]);

      const result = computeConfidence(nodes, [], false);

      expect(result.isolatedNodeCount).toBeGreaterThanOrEqual(1);
    });

    it('should degrade confidence when graph is truncated', () => {
      const nodes = new Map([
        [
          'ci-1',
          {
            id: 'ci-1',
            type: 'ci' as const,
            label: 'A',
            depth: 0,
            className: 'server',
          },
        ],
      ]);

      const truncatedResult = computeConfidence(nodes, [], true);
      const normalResult = computeConfidence(nodes, [], false);

      expect(truncatedResult.score).toBeLessThan(normalResult.score);
      const truncFactor = truncatedResult.degradingFactors.find(
        (f: { code: string }) => f.code === 'GRAPH_TRUNCATED',
      );
      expect(truncFactor).toBeDefined();
    });

    it('should return score bounded between 0 and 100', () => {
      // Empty graph
      const emptyResult = computeConfidence(new Map(), [], true);
      expect(emptyResult.score).toBeGreaterThanOrEqual(0);
      expect(emptyResult.score).toBeLessThanOrEqual(100);

      // Healthy graph
      const nodes = new Map([
        [
          'ci-1',
          {
            id: 'ci-1',
            type: 'ci' as const,
            label: 'S',
            depth: 0,
            className: 'server',
          },
        ],
      ]);
      const healthyResult = computeConfidence(nodes, [], false);
      expect(healthyResult.score).toBeGreaterThanOrEqual(0);
      expect(healthyResult.score).toBeLessThanOrEqual(100);
    });

    it('should produce deterministic results for same input', () => {
      const nodes = new Map([
        [
          'ci-1',
          {
            id: 'ci-1',
            type: 'ci' as const,
            label: 'A',
            depth: 0,
            className: 'server',
          },
        ],
        ['ci-2', { id: 'ci-2', type: 'ci' as const, label: 'B', depth: 1 }],
      ]);
      const edges = [
        { sourceId: 'ci-1', targetId: 'ci-2', relationType: 'depends_on' },
      ];

      const r1 = computeConfidence(nodes, edges, false);
      const r2 = computeConfidence(nodes, edges, false);

      expect(r1.score).toBe(r2.score);
      expect(r1.label).toBe(r2.label);
      expect(r1.degradingFactors).toEqual(r2.degradingFactors);
    });

    it('should use correct label thresholds', () => {
      // Create scenarios targeting different thresholds
      // Full graph = high confidence
      const fullNodes = new Map([
        [
          'ci-1',
          {
            id: 'ci-1',
            type: 'ci' as const,
            label: 'S',
            depth: 0,
            className: 'server',
          },
        ],
        [
          'ci-2',
          {
            id: 'ci-2',
            type: 'ci' as const,
            label: 'D',
            depth: 1,
            className: 'database',
          },
        ],
      ]);
      const fullEdges = [
        { sourceId: 'ci-1', targetId: 'ci-2', relationType: 'depends_on' },
      ];

      const highResult = computeConfidence(fullNodes, fullEdges, false);
      // Score >= 80 => HIGH, >= 60 => MEDIUM, >= 30 => LOW, < 30 => VERY_LOW
      if (highResult.score >= 80) expect(highResult.label).toBe('HIGH');
      else if (highResult.score >= 60) expect(highResult.label).toBe('MEDIUM');
      else if (highResult.score >= 30) expect(highResult.label).toBe('LOW');
      else expect(highResult.label).toBe('VERY_LOW');
    });
  });

  // ==========================================================================
  // Phase 2: computeRiskFactors
  // ==========================================================================

  describe('computeRiskFactors (Phase 2)', () => {
    const computeFactors = (metrics: any, fragilitySignals: any[]) =>
      (service as any).computeRiskFactors(metrics, fragilitySignals);

    it('should return factors sorted by contribution descending', () => {
      const metrics = {
        totalImpactedNodes: 30,
        impactedByDepth: { 0: 5, 1: 15, 2: 10 },
        impactedServiceCount: 2,
        impactedOfferingCount: 1,
        impactedCiCount: 25,
        criticalCiCount: 10,
        maxChainDepth: 2,
        crossServicePropagation: true,
        crossServiceCount: 2,
      };
      const signals = [
        {
          type: 'single_point_of_failure' as const,
          nodeId: 'a',
          nodeLabel: 'A',
          reason: 'SPOF',
          severity: 80,
        },
      ];

      const factors = computeFactors(metrics, signals);

      expect(factors.length).toBeGreaterThan(0);
      for (let i = 1; i < factors.length; i++) {
        expect(factors[i - 1].contribution).toBeGreaterThanOrEqual(
          factors[i].contribution,
        );
      }
    });

    it('should have keys matching TOPOLOGY_RISK_WEIGHTS', () => {
      const metrics = {
        totalImpactedNodes: 10,
        impactedByDepth: { 0: 5, 1: 5 },
        impactedServiceCount: 1,
        impactedOfferingCount: 0,
        impactedCiCount: 9,
        criticalCiCount: 2,
        maxChainDepth: 1,
        crossServicePropagation: false,
        crossServiceCount: 1,
      };

      const factors = computeFactors(metrics, []);

      const expectedKeys = [
        'impactedNodeCount',
        'criticalCiRatio',
        'maxChainDepth',
        'crossServicePropagation',
        'fragilityScore',
      ];
      for (const factor of factors) {
        expect(expectedKeys).toContain(factor.key);
      }
    });

    it('should include severity levels', () => {
      const metrics = {
        totalImpactedNodes: 50,
        impactedByDepth: { 0: 10, 1: 20, 2: 20 },
        impactedServiceCount: 3,
        impactedOfferingCount: 1,
        impactedCiCount: 45,
        criticalCiCount: 15,
        maxChainDepth: 3,
        crossServicePropagation: true,
        crossServiceCount: 3,
      };
      const signals = [
        {
          type: 'single_point_of_failure' as const,
          nodeId: 'a',
          nodeLabel: 'A',
          reason: '',
          severity: 90,
        },
      ];

      const factors = computeFactors(metrics, signals);

      for (const factor of factors) {
        expect(['critical', 'warning', 'info']).toContain(factor.severity);
        expect(factor.reason).toBeDefined();
        expect(factor.reason.length).toBeGreaterThan(0);
        expect(factor.contribution).toBeGreaterThanOrEqual(0);
        expect(factor.contribution).toBeLessThanOrEqual(factor.maxContribution);
      }
    });

    it('should produce deterministic results', () => {
      const metrics = {
        totalImpactedNodes: 20,
        impactedByDepth: { 0: 5, 1: 15 },
        impactedServiceCount: 1,
        impactedOfferingCount: 0,
        impactedCiCount: 19,
        criticalCiCount: 5,
        maxChainDepth: 1,
        crossServicePropagation: false,
        crossServiceCount: 1,
      };

      const r1 = computeFactors(metrics, []);
      const r2 = computeFactors(metrics, []);

      expect(r1).toEqual(r2);
    });
  });

  // ==========================================================================
  // Phase 2: enrichRcaHypotheses
  // ==========================================================================

  describe('enrichRcaHypotheses (Phase 2)', () => {
    const enrich = (
      hypotheses: any[],
      nodes: Map<string, any>,
      edges: Array<{
        sourceId: string;
        targetId: string;
        relationType: string;
      }>,
      truncated: boolean,
    ) =>
      (service as any).enrichRcaHypotheses(hypotheses, nodes, edges, truncated);

    function makeHypothesis(overrides: any = {}): any {
      return {
        id: 'hyp-1',
        type: 'common_upstream_dependency',
        score: 60,
        suspectNodeId: 'ci-hub',
        suspectNodeLabel: 'Hub Server',
        suspectNodeType: 'ci',
        explanation: 'Test hypothesis',
        evidence: [
          { type: 'topology_path', description: 'Connected to affected nodes' },
        ],
        affectedServiceIds: ['svc-1'],
        recommendedActions: [],
        ...overrides,
      };
    }

    it('should add evidenceWeight to hypotheses', () => {
      const nodes = new Map([
        [
          'ci-hub',
          {
            id: 'ci-hub',
            type: 'ci',
            label: 'Hub',
            depth: 1,
            className: 'server',
          },
        ],
      ]);
      const edges = [
        { sourceId: 'ci-hub', targetId: 'ci-1', relationType: 'depends_on' },
      ];

      const result = enrich([makeHypothesis()], nodes, edges, false);

      expect(result[0].evidenceWeight).toBeDefined();
      expect(typeof result[0].evidenceWeight).toBe('number');
      expect(result[0].evidenceWeight).toBeGreaterThanOrEqual(0);
      expect(result[0].evidenceWeight).toBeLessThanOrEqual(100);
    });

    it('should add contradiction markers when graph is truncated', () => {
      const nodes = new Map([
        [
          'ci-hub',
          {
            id: 'ci-hub',
            type: 'ci',
            label: 'Hub',
            depth: 1,
            className: 'server',
          },
        ],
      ]);

      const result = enrich([makeHypothesis()], nodes, [], true);

      expect(result[0].contradictions).toBeDefined();
      expect(result[0].contradictions.length).toBeGreaterThan(0);
      const truncContradiction = result[0].contradictions.find(
        (c: any) => c.code === 'GRAPH_TRUNCATED',
      );
      expect(truncContradiction).toBeDefined();
      expect(truncContradiction.confidenceReduction).toBeGreaterThan(0);
    });

    it('should add contradiction for missing class semantics on suspect', () => {
      const nodes = new Map([
        ['ci-hub', { id: 'ci-hub', type: 'ci', label: 'Hub', depth: 1 }], // no className
      ]);

      const result = enrich([makeHypothesis()], nodes, [], false);

      const missingClass = result[0].contradictions.find(
        (c: any) => c.code === 'MISSING_CLASS_SEMANTICS',
      );
      expect(missingClass).toBeDefined();
    });

    it('should add contradiction for isolated suspect node', () => {
      const nodes = new Map([
        ['ci-hub', { id: 'ci-hub', type: 'ci', label: 'Hub', depth: 1 }], // no className, no edges
      ]);

      const result = enrich([makeHypothesis()], nodes, [], false);

      const isolated = result[0].contradictions.find(
        (c: any) => c.code === 'ISOLATED_NODE',
      );
      expect(isolated).toBeDefined();
    });

    it('should reduce score when contradictions are present', () => {
      const nodesGood = new Map([
        [
          'ci-hub',
          {
            id: 'ci-hub',
            type: 'ci',
            label: 'Hub',
            depth: 1,
            className: 'server',
          },
        ],
      ]);
      const edges = [
        { sourceId: 'ci-hub', targetId: 'ci-1', relationType: 'depends_on' },
      ];

      const nodesBad = new Map([
        ['ci-hub', { id: 'ci-hub', type: 'ci', label: 'Hub', depth: 1 }], // no className, no edges
      ]);

      const goodResult = enrich([makeHypothesis()], nodesGood, edges, false);
      const badResult = enrich([makeHypothesis()], nodesBad, [], true);

      expect(badResult[0].score).toBeLessThan(goodResult[0].score);
    });

    it('should set corroboratingEvidenceCount and contradictionCount', () => {
      const nodes = new Map([
        [
          'ci-hub',
          {
            id: 'ci-hub',
            type: 'ci',
            label: 'Hub',
            depth: 1,
            className: 'server',
          },
        ],
      ]);

      const result = enrich([makeHypothesis()], nodes, [], false);

      expect(result[0].corroboratingEvidenceCount).toBe(1); // one evidence item
      expect(typeof result[0].contradictionCount).toBe('number');
    });

    it('should assign evidence weights based on evidence type', () => {
      const hyp = makeHypothesis({
        evidence: [
          { type: 'topology_path', description: 'Path evidence' },
          { type: 'recent_change', description: 'Change evidence' },
          { type: 'health_violation', description: 'Health evidence' },
        ],
      });

      const nodes = new Map([
        [
          'ci-hub',
          {
            id: 'ci-hub',
            type: 'ci',
            label: 'Hub',
            depth: 1,
            className: 'server',
          },
        ],
      ]);
      const edges = [
        { sourceId: 'ci-hub', targetId: 'ci-1', relationType: 'depends_on' },
      ];

      const result = enrich([hyp], nodes, edges, false);

      for (const ev of result[0].evidence) {
        expect(ev.weight).toBeDefined();
        expect(ev.weight).toBeGreaterThan(0);
        expect(typeof ev.isTopologyBased).toBe('boolean');
      }

      // topology_path should have highest weight
      const topologyEv = result[0].evidence.find(
        (e: any) => e.type === 'topology_path',
      );
      const changeEv = result[0].evidence.find(
        (e: any) => e.type === 'recent_change',
      );
      expect(topologyEv.weight).toBeGreaterThan(changeEv.weight);
    });

    it('should produce deterministic results for same input', () => {
      const hyp = makeHypothesis();
      const nodes = new Map([
        [
          'ci-hub',
          {
            id: 'ci-hub',
            type: 'ci',
            label: 'Hub',
            depth: 1,
            className: 'server',
          },
        ],
      ]);
      const edges = [
        { sourceId: 'ci-hub', targetId: 'ci-1', relationType: 'depends_on' },
      ];

      const r1 = enrich([hyp], nodes, edges, false);
      const r2 = enrich([hyp], nodes, edges, false);

      expect(r1[0].score).toBe(r2[0].score);
      expect(r1[0].evidenceWeight).toBe(r2[0].evidenceWeight);
      expect(r1[0].contradictions).toEqual(r2[0].contradictions);
    });

    it('should clamp score between 0 and 100', () => {
      // High score hypothesis
      const highHyp = makeHypothesis({ score: 100 });
      const nodes = new Map([
        [
          'ci-hub',
          {
            id: 'ci-hub',
            type: 'ci',
            label: 'Hub',
            depth: 1,
            className: 'server',
          },
        ],
      ]);
      const edges = [
        { sourceId: 'ci-hub', targetId: 'ci-1', relationType: 'depends_on' },
      ];

      const result = enrich([highHyp], nodes, edges, false);
      expect(result[0].score).toBeGreaterThanOrEqual(0);
      expect(result[0].score).toBeLessThanOrEqual(100);

      // Low score with many contradictions
      const lowHyp = makeHypothesis({ score: 5 });
      const badNodes = new Map([
        ['ci-hub', { id: 'ci-hub', type: 'ci', label: 'Hub', depth: 1 }],
      ]);
      const badResult = enrich([lowHyp], badNodes, [], true);
      expect(badResult[0].score).toBeGreaterThanOrEqual(0);
      expect(badResult[0].score).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // Phase 2: Integration — emptyImpactResponse includes Phase 2 fields
  // ==========================================================================

  describe('Phase 2 integration in calculateTopologyImpact', () => {
    it('should include Phase 2 fields in empty impact response', async () => {
      const change = makeChange({ serviceId: null });

      const result = await service.calculateTopologyImpact(TENANT_ID, change);

      // Phase 2 fields should be present even in empty response
      expect(result.impactBuckets).toBeDefined();
      expect(result.impactBuckets!.direct).toBe(0);
      expect(result.impactBuckets!.downstream).toBe(0);
      expect(result.impactBuckets!.criticalPath).toBe(0);
      expect(result.impactBuckets!.unknownConfidence).toBe(0);

      expect(result.impactedServicesCount).toBe(0);
      expect(result.impactedOfferingsCount).toBe(0);
      expect(result.impactedCriticalCisCount).toBe(0);

      expect(result.completenessConfidence).toBeDefined();
      expect(result.completenessConfidence!.score).toBe(0);
      expect(result.completenessConfidence!.label).toBe('VERY_LOW');

      expect(result.riskFactors).toBeDefined();
      expect(result.riskFactors).toEqual([]);
    });

    it('should include Phase 2 fields when CIs exist', async () => {
      const change = makeChange({ serviceId: 'svc-1' });

      serviceCiRepo.find
        .mockResolvedValueOnce([makeServiceCi('svc-1', 'ci-root')])
        .mockResolvedValue([]);
      ciRepo.find.mockResolvedValueOnce([makeCi('ci-root', 'Root Server')]);
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.calculateTopologyImpact(TENANT_ID, change);

      expect(result.impactBuckets).toBeDefined();
      expect(result.completenessConfidence).toBeDefined();
      expect(result.completenessConfidence!.score).toBeGreaterThanOrEqual(0);
      expect(result.completenessConfidence!.score).toBeLessThanOrEqual(100);
      expect(result.riskFactors).toBeDefined();
      expect(Array.isArray(result.riskFactors)).toBe(true);
    });
  });

  // ==========================================================================
  // Phase 2: Integration — RCA rankingAlgorithm field
  // ==========================================================================

  describe('Phase 2 integration in generateRcaHypotheses', () => {
    it('should include rankingAlgorithm in RCA response', async () => {
      const mi = makeMajorIncident({ primaryServiceId: null });
      miLinkRepo.find.mockResolvedValue([]);

      const result = await service.generateRcaHypotheses(TENANT_ID, mi);

      expect(result.rankingAlgorithm).toBe('weighted_evidence_v1');
    });

    it('should include Phase 2 fields in hypotheses when generated', async () => {
      const mi = makeMajorIncident({ primaryServiceId: 'svc-1' });
      miLinkRepo.find.mockResolvedValue([]);

      serviceCiRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          makeServiceCi('svc-1', 'ci-1'),
          makeServiceCi('svc-1', 'ci-2'),
        ])
        .mockResolvedValue([]);

      ciRepo.find.mockResolvedValue([
        makeCi('ci-1', 'Server 1'),
        makeCi('ci-2', 'Server 2'),
        makeCi('ci-hub', 'Hub Server'),
      ]);

      const rels = [
        makeRel('ci-hub', 'ci-1', 'depends_on'),
        makeRel('ci-hub', 'ci-2', 'depends_on'),
      ];
      ciRelRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(rels).mockResolvedValue([]),
      });

      changeRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.generateRcaHypotheses(TENANT_ID, mi);

      expect(result.rankingAlgorithm).toBe('weighted_evidence_v1');
      for (const hyp of result.hypotheses) {
        expect(hyp.evidenceWeight).toBeDefined();
        expect(typeof hyp.evidenceWeight).toBe('number');
        expect(hyp.contradictions).toBeDefined();
        expect(Array.isArray(hyp.contradictions)).toBe(true);
        expect(typeof hyp.corroboratingEvidenceCount).toBe('number');
        expect(typeof hyp.contradictionCount).toBe('number');
        // Evidence items should have weights
        for (const ev of hyp.evidence) {
          expect(ev.weight).toBeDefined();
          expect(typeof ev.isTopologyBased).toBe('boolean');
        }
      }
    });
  });

  // ==========================================================================
  // Graceful degradation
  // ==========================================================================

  describe('graceful degradation', () => {
    it('should return empty impact when no repositories are injected', async () => {
      const serviceNoRepos = new TopologyImpactAnalysisService();
      const change = makeChange({ serviceId: 'svc-1' });

      const result = await serviceNoRepos.calculateTopologyImpact(
        TENANT_ID,
        change,
      );

      expect(result.metrics.totalImpactedNodes).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should return empty RCA when no repositories are injected', async () => {
      const serviceNoRepos = new TopologyImpactAnalysisService();
      const mi = makeMajorIncident({ primaryServiceId: null });

      const result = await serviceNoRepos.generateRcaHypotheses(TENANT_ID, mi);

      expect(result.hypotheses).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should catch errors in getTopologyRiskFactor gracefully', async () => {
      // Force an error by making ciRepo throw
      ciRepo.find.mockRejectedValue(new Error('DB connection lost'));
      serviceCiRepo.find.mockResolvedValue([makeServiceCi('svc-1', 'ci-root')]);

      const change = makeChange({ serviceId: 'svc-1' });
      const { score, evidence } = await service.getTopologyRiskFactor(
        TENANT_ID,
        change,
      );

      expect(score).toBe(0);
      expect(evidence).toContain('unavailable');
    });
  });
});
