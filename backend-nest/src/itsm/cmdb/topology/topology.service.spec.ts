import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TopologyService } from './topology.service';
import { TopologyQueryDto, TopologyDirection } from './dto/topology-query.dto';
import { CmdbCi } from '../ci/ci.entity';
import { CmdbCiRel } from '../ci-rel/ci-rel.entity';
import { CmdbService } from '../service/cmdb-service.entity';
import { CmdbServiceOffering } from '../service-offering/cmdb-service-offering.entity';
import { CmdbServiceCi } from '../service-ci/cmdb-service-ci.entity';
import { CmdbRelationshipType } from '../relationship-type/relationship-type.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ---- Helpers to build mock entities ----

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
  id: string,
  sourceId: string,
  targetId: string,
  type = 'depends_on',
): CmdbCiRel {
  return {
    id,
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

function makeService(id: string, name: string): CmdbService {
  return {
    id,
    tenantId: TENANT_ID,
    name,
    description: null,
    type: 'business_service',
    status: 'live',
    tier: 'tier_1',
    criticality: 'high',
    ownerUserId: null,
    ownerEmail: 'owner@test.com',
    offerings: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: false,
    tenant: {} as never,
  } as CmdbService;
}

function makeOffering(
  id: string,
  serviceId: string,
  name: string,
): CmdbServiceOffering {
  return {
    id,
    tenantId: TENANT_ID,
    serviceId,
    name,
    status: 'live',
    supportHours: '24x7',
    defaultSlaProfileId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: false,
    service: makeService(serviceId, 'svc'),
    tenant: {} as never,
  } as CmdbServiceOffering;
}

function makeServiceCi(
  id: string,
  serviceId: string,
  ciId: string,
  relType = 'depends_on',
): CmdbServiceCi {
  return {
    id,
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
    service: makeService(serviceId, 'Test Service'),
    ci: makeCi(ciId, `CI-${ciId}`),
    tenant: {} as never,
  } as CmdbServiceCi;
}

// ---- Mock Repository Factory ----

function createMockRepo() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  };
}

describe('TopologyService', () => {
  let service: TopologyService;
  let ciRepo: ReturnType<typeof createMockRepo>;
  let ciRelRepo: ReturnType<typeof createMockRepo>;
  let serviceRepo: ReturnType<typeof createMockRepo>;
  let offeringRepo: ReturnType<typeof createMockRepo>;
  let serviceCiRepo: ReturnType<typeof createMockRepo>;

  beforeEach(async () => {
    ciRepo = createMockRepo();
    ciRelRepo = createMockRepo();
    serviceRepo = createMockRepo();
    offeringRepo = createMockRepo();
    serviceCiRepo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopologyService,
        { provide: getRepositoryToken(CmdbCi), useValue: ciRepo },
        { provide: getRepositoryToken(CmdbCiRel), useValue: ciRelRepo },
        { provide: getRepositoryToken(CmdbService), useValue: serviceRepo },
        {
          provide: getRepositoryToken(CmdbServiceOffering),
          useValue: offeringRepo,
        },
        {
          provide: getRepositoryToken(CmdbServiceCi),
          useValue: serviceCiRepo,
        },
      ],
    }).compile();

    service = module.get<TopologyService>(TopologyService);
  });

  describe('getTopologyForCi', () => {
    it('should return empty response when root CI not found', async () => {
      ciRepo.findOne.mockResolvedValue(null);

      const query = new TopologyQueryDto();
      const result = await service.getTopologyForCi(
        TENANT_ID,
        'missing-id',
        query,
      );

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.meta.warnings).toContain('Root node not found');
      expect(result.meta.rootNodeId).toBe('missing-id');
    });

    it('should return single-node graph when CI has no relationships', async () => {
      const rootCi = makeCi('ci-1', 'Web Server');
      ciRepo.findOne.mockResolvedValue(rootCi);

      // No relationships found
      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      serviceCiRepo.find.mockResolvedValue([]);

      const query = new TopologyQueryDto();
      const result = await service.getTopologyForCi(TENANT_ID, 'ci-1', query);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('ci-1');
      expect(result.nodes[0].type).toBe('ci');
      expect(result.nodes[0].label).toBe('Web Server');
      expect(result.edges).toHaveLength(0);
      expect(result.meta.nodeCount).toBe(1);
      expect(result.meta.edgeCount).toBe(0);
      expect(result.meta.truncated).toBe(false);
    });

    it('should traverse depth=1 CI-CI relationships', async () => {
      const rootCi = makeCi('ci-1', 'Web Server');
      const neighborCi = makeCi('ci-2', 'Database');

      ciRepo.findOne.mockResolvedValue(rootCi);
      ciRepo.find.mockResolvedValue([neighborCi]);

      const rel = makeRel('rel-1', 'ci-1', 'ci-2', 'depends_on');
      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([rel]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      serviceCiRepo.find.mockResolvedValue([]);

      const query = new TopologyQueryDto();
      query.depth = 1;
      const result = await service.getTopologyForCi(TENANT_ID, 'ci-1', query);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].relationType).toBe('depends_on');
      expect(result.meta.nodeCount).toBe(2);
      expect(result.meta.edgeCount).toBe(1);
    });

    it('should include service nodes from Service-CI links', async () => {
      const rootCi = makeCi('ci-1', 'App Server');
      ciRepo.findOne.mockResolvedValue(rootCi);

      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);

      const svcCiLink = makeServiceCi('link-1', 'svc-1', 'ci-1', 'runs_on');
      serviceCiRepo.find.mockResolvedValue([svcCiLink]);

      const query = new TopologyQueryDto();
      const result = await service.getTopologyForCi(TENANT_ID, 'ci-1', query);

      expect(result.nodes).toHaveLength(2);
      const serviceNode = result.nodes.find((n) => n.type === 'service');
      expect(serviceNode).toBeDefined();
      expect(serviceNode?.id).toBe('service:svc-1');
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].relationType).toBe('runs_on');
    });

    it('should de-duplicate edges', async () => {
      const rootCi = makeCi('ci-1', 'Web Server');
      ciRepo.findOne.mockResolvedValue(rootCi);

      // Return same relationship twice (simulating a bug or data issue)
      const rel1 = makeRel('rel-1', 'ci-1', 'ci-2', 'depends_on');
      const rel2 = makeRel('rel-2', 'ci-1', 'ci-2', 'depends_on');
      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([rel1, rel2]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      serviceCiRepo.find.mockResolvedValue([]);
      ciRepo.find.mockResolvedValue([makeCi('ci-2', 'Database')]);

      const query = new TopologyQueryDto();
      const result = await service.getTopologyForCi(TENANT_ID, 'ci-1', query);

      // Should have only 1 edge despite 2 rels returned
      expect(result.edges).toHaveLength(1);
    });

    it('should handle cycles safely (no infinite loop)', async () => {
      const rootCi = makeCi('ci-1', 'A');
      ciRepo.findOne.mockResolvedValue(rootCi);

      // A -> B and B -> A (cycle)
      const rel1 = makeRel('rel-1', 'ci-1', 'ci-2', 'depends_on');
      const rel2 = makeRel('rel-2', 'ci-2', 'ci-1', 'depends_on');

      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValueOnce([rel1]) // depth 0: from ci-1
          .mockResolvedValueOnce([rel2]), // depth 1: from ci-2 (back to ci-1)
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      serviceCiRepo.find.mockResolvedValue([]);
      ciRepo.find.mockResolvedValue([makeCi('ci-2', 'B')]);

      const query = new TopologyQueryDto();
      query.depth = 3; // Should not loop despite cycle
      const result = await service.getTopologyForCi(TENANT_ID, 'ci-1', query);

      // Should still terminate and have exactly 2 nodes
      expect(result.nodes.length).toBeLessThanOrEqual(2);
      expect(result.meta.truncated).toBe(false);
    });

    it('should respect direction filter (downstream only)', async () => {
      const rootCi = makeCi('ci-1', 'Root');
      ciRepo.findOne.mockResolvedValue(rootCi);

      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      serviceCiRepo.find.mockResolvedValue([]);

      const query = new TopologyQueryDto();
      query.direction = TopologyDirection.DOWNSTREAM;
      await service.getTopologyForCi(TENANT_ID, 'ci-1', query);

      // Verify the query builder was called with downstream-only filter
      const andWhereCalls = qbMock.andWhere.mock.calls;
      const hasSourceFilter = andWhereCalls.some(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('rel.sourceCiId IN'),
      );
      expect(hasSourceFilter).toBe(true);
    });

    it('should respect relationTypes filter', async () => {
      const rootCi = makeCi('ci-1', 'Root');
      ciRepo.findOne.mockResolvedValue(rootCi);

      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      serviceCiRepo.find.mockResolvedValue([]);

      const query = new TopologyQueryDto();
      query.relationTypes = 'depends_on,runs_on';
      await service.getTopologyForCi(TENANT_ID, 'ci-1', query);

      const andWhereCalls = qbMock.andWhere.mock.calls;
      const hasRelTypeFilter = andWhereCalls.some(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('rel.type IN'),
      );
      expect(hasRelTypeFilter).toBe(true);
    });

    it('should return annotations extension point (empty in v1)', async () => {
      const rootCi = makeCi('ci-1', 'Web Server');
      ciRepo.findOne.mockResolvedValue(rootCi);

      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      serviceCiRepo.find.mockResolvedValue([]);

      const query = new TopologyQueryDto();
      const result = await service.getTopologyForCi(TENANT_ID, 'ci-1', query);

      expect(result.annotations).toBeDefined();
      expect(typeof result.annotations).toBe('object');
    });
  });

  describe('getTopologyForService', () => {
    it('should return empty response when service not found', async () => {
      serviceRepo.findOne.mockResolvedValue(null);

      const query = new TopologyQueryDto();
      const result = await service.getTopologyForService(
        TENANT_ID,
        'missing-svc',
        query,
      );

      expect(result.nodes).toHaveLength(0);
      expect(result.meta.warnings).toContain('Root node not found');
    });

    it('should include service, offerings, and linked CIs', async () => {
      const svc = makeService('svc-1', 'Email Service');
      serviceRepo.findOne.mockResolvedValue(svc);

      const off1 = makeOffering('off-1', 'svc-1', 'Standard Email');
      offeringRepo.find.mockResolvedValue([off1]);

      const link1 = makeServiceCi('link-1', 'svc-1', 'ci-1', 'runs_on');
      serviceCiRepo.find.mockResolvedValue([link1]);

      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);

      const query = new TopologyQueryDto();
      const result = await service.getTopologyForService(
        TENANT_ID,
        'svc-1',
        query,
      );

      expect(result.nodes.length).toBeGreaterThanOrEqual(3); // service + offering + CI
      const types = result.nodes.map((n) => n.type);
      expect(types).toContain('service');
      expect(types).toContain('service_offering');
      expect(types).toContain('ci');

      // Should have edges for has_offering and runs_on
      expect(result.edges.length).toBeGreaterThanOrEqual(2);
    });

    it('should traverse CI-CI relations at depth > 1', async () => {
      const svc = makeService('svc-1', 'Web Platform');
      serviceRepo.findOne.mockResolvedValue(svc);
      offeringRepo.find.mockResolvedValue([]);

      const link = makeServiceCi('link-1', 'svc-1', 'ci-1', 'depends_on');
      serviceCiRepo.find.mockResolvedValue([link]);

      const rel = makeRel('rel-1', 'ci-1', 'ci-2', 'depends_on');
      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([rel]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      ciRepo.find.mockResolvedValue([makeCi('ci-2', 'Database')]);

      const query = new TopologyQueryDto();
      query.depth = 2;
      const result = await service.getTopologyForService(
        TENANT_ID,
        'svc-1',
        query,
      );

      // Should have service + ci-1 + ci-2 at minimum
      expect(result.nodes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('semantics enrichment (includeSemantics=true)', () => {
    let relTypeRepo: ReturnType<typeof createMockRepo>;
    let semanticsService: TopologyService;

    beforeEach(async () => {
      const localCiRepo = createMockRepo();
      const localCiRelRepo = createMockRepo();
      const localServiceRepo = createMockRepo();
      const localOfferingRepo = createMockRepo();
      const localServiceCiRepo = createMockRepo();
      relTypeRepo = createMockRepo();

      const mod = await Test.createTestingModule({
        providers: [
          TopologyService,
          { provide: getRepositoryToken(CmdbCi), useValue: localCiRepo },
          { provide: getRepositoryToken(CmdbCiRel), useValue: localCiRelRepo },
          {
            provide: getRepositoryToken(CmdbService),
            useValue: localServiceRepo,
          },
          {
            provide: getRepositoryToken(CmdbServiceOffering),
            useValue: localOfferingRepo,
          },
          {
            provide: getRepositoryToken(CmdbServiceCi),
            useValue: localServiceCiRepo,
          },
          {
            provide: getRepositoryToken(CmdbRelationshipType),
            useValue: relTypeRepo,
          },
        ],
      }).compile();

      semanticsService = mod.get<TopologyService>(TopologyService);

      // Default: root CI exists, has one relationship
      const rootCi = makeCi('ci-1', 'Web Server');
      const neighborCi = makeCi('ci-2', 'Database');
      localCiRepo.findOne.mockResolvedValue(rootCi);
      localCiRepo.find.mockResolvedValue([neighborCi]);

      const rel = makeRel('rel-1', 'ci-1', 'ci-2', 'depends_on');
      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([rel]),
      };
      localCiRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      localServiceCiRepo.find.mockResolvedValue([]);
    });

    it('should enrich edges with relationLabel, directionality, riskPropagation when semantics found', async () => {
      relTypeRepo.find.mockResolvedValue([
        {
          name: 'depends_on',
          label: 'Depends On',
          inverseLabel: 'Depended On By',
          directionality: 'unidirectional',
          riskPropagation: 'forward',
          tenantId: TENANT_ID,
          isDeleted: false,
        },
      ]);

      const query = new TopologyQueryDto();
      query.includeSemantics = true;
      const result = await semanticsService.getTopologyForCi(
        TENANT_ID,
        'ci-1',
        query,
      );

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].relationLabel).toBe('Depends On');
      expect(result.edges[0].inverseLabel).toBe('Depended On By');
      expect(result.edges[0].directionality).toBe('unidirectional');
      expect(result.edges[0].riskPropagation).toBe('forward');
    });

    it('should include semanticsSummary in meta when includeSemantics=true', async () => {
      relTypeRepo.find.mockResolvedValue([
        {
          name: 'depends_on',
          label: 'Depends On',
          inverseLabel: null,
          directionality: 'unidirectional',
          riskPropagation: 'forward',
          tenantId: TENANT_ID,
          isDeleted: false,
        },
      ]);

      const query = new TopologyQueryDto();
      query.includeSemantics = true;
      const result = await semanticsService.getTopologyForCi(
        TENANT_ID,
        'ci-1',
        query,
      );

      expect(result.meta.semanticsSummary).toBeDefined();
      const summary = result.meta.semanticsSummary!;
      expect(summary.totalEdges).toBe(1);
      expect(summary.semanticsEnrichedEdges).toBe(1);
      expect(summary.unknownRelationTypesCount).toBe(0);
      expect(summary.unknownRelationTypes).toEqual([]);
      expect(summary.byRiskPropagation).toEqual({ forward: 1 });
      expect(summary.byDirectionality).toEqual({ unidirectional: 1 });
    });

    it('should report unknown relation types in semanticsSummary', async () => {
      // No matching type in catalog
      relTypeRepo.find.mockResolvedValue([]);

      const query = new TopologyQueryDto();
      query.includeSemantics = true;
      const result = await semanticsService.getTopologyForCi(
        TENANT_ID,
        'ci-1',
        query,
      );

      const summary = result.meta.semanticsSummary!;
      expect(summary.totalEdges).toBe(1);
      expect(summary.semanticsEnrichedEdges).toBe(0);
      expect(summary.unknownRelationTypesCount).toBe(1);
      expect(summary.unknownRelationTypes).toContain('depends_on');
      expect(summary.byRiskPropagation).toEqual({ unknown: 1 });
      expect(summary.byDirectionality).toEqual({ unknown: 1 });
    });

    it('should NOT include semanticsSummary when includeSemantics is false/absent', async () => {
      const query = new TopologyQueryDto();
      // includeSemantics defaults to false
      const result = await semanticsService.getTopologyForCi(
        TENANT_ID,
        'ci-1',
        query,
      );

      expect(result.meta.semanticsSummary).toBeUndefined();
      // Edges should NOT have enrichment fields
      for (const edge of result.edges) {
        expect(edge.relationLabel).toBeUndefined();
        expect(edge.directionality).toBeUndefined();
        expect(edge.riskPropagation).toBeUndefined();
      }
    });

    it('should handle gracefully when relTypeRepo.find throws', async () => {
      relTypeRepo.find.mockRejectedValue(new Error('Table not found'));

      const query = new TopologyQueryDto();
      query.includeSemantics = true;
      const result = await semanticsService.getTopologyForCi(
        TENANT_ID,
        'ci-1',
        query,
      );

      // Should still return valid response, just without enrichment
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].relationLabel).toBeUndefined();
      // semanticsSummary should still be present but show unknown
      expect(result.meta.semanticsSummary).toBeDefined();
      expect(result.meta.semanticsSummary!.unknownRelationTypesCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle defensive missing node refs in edges', async () => {
      const rootCi = makeCi('ci-1', 'Root');
      ciRepo.findOne.mockResolvedValue(rootCi);

      // Relationship points to ci-999 which doesn't exist
      const rel = makeRel('rel-1', 'ci-1', 'ci-999', 'depends_on');
      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([rel]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      serviceCiRepo.find.mockResolvedValue([]);
      // ci-999 not found
      ciRepo.find.mockResolvedValue([]);

      const query = new TopologyQueryDto();
      const result = await service.getTopologyForCi(TENANT_ID, 'ci-1', query);

      // Edge to missing node should be excluded
      const edgeToMissing = result.edges.find(
        (e) => e.source === 'ci-999' || e.target === 'ci-999',
      );
      expect(edgeToMissing).toBeUndefined();
    });

    it('should include meta.depth in response', async () => {
      ciRepo.findOne.mockResolvedValue(makeCi('ci-1', 'Root'));
      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      ciRelRepo.createQueryBuilder.mockReturnValue(qbMock);
      serviceCiRepo.find.mockResolvedValue([]);

      const query = new TopologyQueryDto();
      query.depth = 2;
      const result = await service.getTopologyForCi(TENANT_ID, 'ci-1', query);

      expect(result.meta.depth).toBe(2);
    });
  });
});
