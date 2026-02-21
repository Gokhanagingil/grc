import { CustomerRiskImpactService } from './customer-risk-impact.service';
import {
  ItsmChange,
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from '../change.entity';
import { CustomerRiskCatalog } from '../../../grc/entities/customer-risk-catalog.entity';

function makeChange(overrides: Partial<ItsmChange> = {}): ItsmChange {
  const now = new Date();
  const change = new ItsmChange();
  change.id = 'change-1';
  change.tenantId = 'tenant-1';
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

function makeCatalogRisk(
  overrides: Partial<CustomerRiskCatalog> = {},
): CustomerRiskCatalog {
  const risk = new CustomerRiskCatalog();
  risk.id = 'crk-1';
  risk.tenantId = 'tenant-1';
  risk.code = 'CRK00001';
  risk.title = 'OS End-of-Support';
  risk.description = 'Operating system is past end-of-life';
  risk.category = 'OS_LIFECYCLE';
  risk.signalType = 'STATIC_FLAG';
  risk.severity = 'CRITICAL';
  risk.likelihoodWeight = 80;
  risk.impactWeight = 90;
  risk.scoreContributionModel = 'FLAT_POINTS';
  risk.scoreValue = 85;
  risk.status = 'ACTIVE';
  risk.ownerGroup = null;
  risk.owner = null;
  risk.validFrom = null;
  risk.validTo = null;
  risk.tags = null;
  risk.source = 'MANUAL';
  risk.sourceRef = null;
  risk.rationale = null;
  risk.remediationGuidance = 'Upgrade to supported OS version';
  risk.metadata = null;
  risk.bindings = [];
  risk.observations = [];
  risk.createdAt = new Date();
  risk.updatedAt = new Date();
  risk.createdBy = 'user-1';
  risk.updatedBy = null;
  risk.isDeleted = false;
  Object.assign(risk, overrides);
  return risk;
}

describe('CustomerRiskImpactService', () => {
  let service: CustomerRiskImpactService;
  let mockBindingRepo: Record<string, jest.Mock>;
  let mockObservationRepo: Record<string, jest.Mock>;
  let mockServiceCiRepo: Record<string, jest.Mock>;
  let mockCiRelRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    mockBindingRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockObservationRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockServiceCiRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockCiRelRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    service = new CustomerRiskImpactService(
      mockBindingRepo as never,
      mockObservationRepo as never,
      mockServiceCiRepo as never,
      mockCiRelRepo as never,
    );
  });

  describe('evaluateForChange', () => {
    it('should return empty result when change has no service', async () => {
      const change = makeChange({ serviceId: null, offeringId: null });
      const result = await service.evaluateForChange('tenant-1', change);

      expect(result.resolvedRisks).toHaveLength(0);
      expect(result.aggregateScore).toBe(0);
      expect(result.aggregateLabel).toBe('LOW');
      expect(result.riskFactor.name).toBe('Customer Risk Exposure');
      expect(result.riskFactor.score).toBe(0);
    });

    it('should resolve risks via service binding', async () => {
      const catalogRisk = makeCatalogRisk();
      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string } }) => {
          if (opts.where.targetType === 'CMDB_SERVICE') {
            return Promise.resolve([
              {
                id: 'bind-1',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-1',
                catalogRisk: catalogRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const change = makeChange();
      const result = await service.evaluateForChange('tenant-1', change);

      expect(result.resolvedRisks).toHaveLength(1);
      expect(result.resolvedRisks[0].catalogRiskId).toBe('crk-1');
      expect(result.resolvedRisks[0].relevancePaths).toContain(
        'service_binding',
      );
      expect(result.aggregateScore).toBeGreaterThan(0);
    });

    it('should scope binding/observation queries by tenantId', async () => {
      const catalogRisk = makeCatalogRisk();

      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string } }) => {
          if (opts.where.targetType === 'CMDB_SERVICE') {
            return Promise.resolve([
              {
                id: 'bind-1',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-1',
                catalogRisk: catalogRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      mockObservationRepo.find.mockResolvedValue([]);

      const change = makeChange();
      await service.evaluateForChange('tenant-1', change);

      expect(mockBindingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            targetType: 'CMDB_SERVICE',
            targetId: 'svc-1',
            enabled: true,
            isDeleted: false,
          }),
        }),
      );

      expect(mockObservationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            catalogRiskId: 'crk-1',
            isDeleted: false,
          }),
        }),
      );
    });

    it('should resolve risks via offering binding', async () => {
      const catalogRisk = makeCatalogRisk({
        id: 'crk-2',
        title: 'Missing Patch',
      });
      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string } }) => {
          if (opts.where.targetType === 'CMDB_OFFERING') {
            return Promise.resolve([
              {
                id: 'bind-2',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-2',
                catalogRisk: catalogRisk,
                targetType: 'CMDB_OFFERING',
                targetId: 'off-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const change = makeChange({ offeringId: 'off-1' });
      const result = await service.evaluateForChange('tenant-1', change);

      expect(result.resolvedRisks).toHaveLength(1);
      expect(result.resolvedRisks[0].relevancePaths).toContain(
        'offering_binding',
      );
    });

    it('should resolve risks via CI bindings (affected CIs)', async () => {
      const catalogRisk = makeCatalogRisk({
        id: 'crk-3',
        title: 'Long Uptime',
      });
      mockServiceCiRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', serviceId: 'svc-1', ciId: 'ci-1' },
        { tenantId: 'tenant-1', serviceId: 'svc-1', ciId: 'ci-2' },
      ]);

      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string; targetId: unknown } }) => {
          if (opts.where.targetType === 'CI') {
            return Promise.resolve([
              {
                id: 'bind-3',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-3',
                catalogRisk: catalogRisk,
                targetType: 'CI',
                targetId: 'ci-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const change = makeChange();
      const result = await service.evaluateForChange('tenant-1', change);

      expect(result.resolvedRisks).toHaveLength(1);
      expect(result.resolvedRisks[0].relevancePaths).toContain('affected_ci');
    });

    it('should resolve risks via blast radius CIs', async () => {
      const catalogRisk = makeCatalogRisk({
        id: 'crk-4',
        title: 'Unsupported DB',
      });
      mockServiceCiRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', serviceId: 'svc-1', ciId: 'ci-1' },
      ]);

      mockCiRelRepo.find.mockResolvedValue([
        {
          tenantId: 'tenant-1',
          sourceCiId: 'ci-1',
          targetCiId: 'ci-99',
          isActive: true,
        },
      ]);

      let callCount = 0;
      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string; targetId: unknown } }) => {
          if (opts.where.targetType === 'CI') {
            callCount++;
            if (callCount === 2) {
              return Promise.resolve([
                {
                  id: 'bind-4',
                  tenantId: 'tenant-1',
                  catalogRiskId: 'crk-4',
                  catalogRisk: catalogRisk,
                  targetType: 'CI',
                  targetId: 'ci-99',
                  enabled: true,
                  isDeleted: false,
                },
              ]);
            }
          }
          return Promise.resolve([]);
        },
      );

      const change = makeChange();
      const result = await service.evaluateForChange('tenant-1', change);

      expect(result.resolvedRisks).toHaveLength(1);
      expect(result.resolvedRisks[0].relevancePaths).toContain(
        'blast_radius_ci',
      );
    });

    it('should deduplicate risks found via multiple paths', async () => {
      const catalogRisk = makeCatalogRisk();

      mockServiceCiRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', serviceId: 'svc-1', ciId: 'ci-1' },
      ]);

      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string } }) => {
          if (opts.where.targetType === 'CMDB_SERVICE') {
            return Promise.resolve([
              {
                id: 'bind-s',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-1',
                catalogRisk: catalogRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          if (opts.where.targetType === 'CI') {
            return Promise.resolve([
              {
                id: 'bind-c',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-1',
                catalogRisk: catalogRisk,
                targetType: 'CI',
                targetId: 'ci-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const change = makeChange();
      const result = await service.evaluateForChange('tenant-1', change);

      expect(result.resolvedRisks).toHaveLength(1);
      expect(result.resolvedRisks[0].relevancePaths).toContain(
        'service_binding',
      );
      expect(result.resolvedRisks[0].relevancePaths).toContain('affected_ci');
    });

    it('should skip inactive/deleted catalog risks', async () => {
      const inactiveRisk = makeCatalogRisk({
        id: 'crk-inactive',
        status: 'INACTIVE',
      });
      const deletedRisk = makeCatalogRisk({
        id: 'crk-deleted',
        isDeleted: true,
      });

      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string } }) => {
          if (opts.where.targetType === 'CMDB_SERVICE') {
            return Promise.resolve([
              {
                id: 'bind-i',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-inactive',
                catalogRisk: inactiveRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
              {
                id: 'bind-d',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-deleted',
                catalogRisk: deletedRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const change = makeChange();
      const result = await service.evaluateForChange('tenant-1', change);

      expect(result.resolvedRisks).toHaveLength(0);
    });

    it('should include observation data in contribution scoring', async () => {
      const catalogRisk = makeCatalogRisk();
      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string } }) => {
          if (opts.where.targetType === 'CMDB_SERVICE') {
            return Promise.resolve([
              {
                id: 'bind-1',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-1',
                catalogRisk: catalogRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      mockObservationRepo.find.mockResolvedValue([
        { status: 'OPEN', observedAt: new Date(), isDeleted: false },
        { status: 'OPEN', observedAt: new Date(), isDeleted: false },
      ]);

      const change = makeChange();
      const result = await service.evaluateForChange('tenant-1', change);

      expect(result.resolvedRisks).toHaveLength(1);
      expect(result.resolvedRisks[0].activeObservationCount).toBe(2);
      expect(result.resolvedRisks[0].latestObservationStatus).toBe('OPEN');
      expect(result.resolvedRisks[0].contributionScore).toBeGreaterThan(0);
    });

    it('should produce deterministic results for same input', async () => {
      const catalogRisk = makeCatalogRisk();
      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string } }) => {
          if (opts.where.targetType === 'CMDB_SERVICE') {
            return Promise.resolve([
              {
                id: 'bind-1',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-1',
                catalogRisk: catalogRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const change = makeChange();
      const result1 = await service.evaluateForChange('tenant-1', change);
      const result2 = await service.evaluateForChange('tenant-1', change);

      expect(result1.aggregateScore).toBe(result2.aggregateScore);
      expect(result1.resolvedRisks[0].contributionScore).toBe(
        result2.resolvedRisks[0].contributionScore,
      );
    });

    it('should generate meaningful top reasons', async () => {
      const critRisk = makeCatalogRisk({
        id: 'crk-c',
        severity: 'CRITICAL',
        title: 'EOS Risk',
      });
      const highRisk = makeCatalogRisk({
        id: 'crk-h',
        severity: 'HIGH',
        title: 'Missing Patch',
      });

      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string } }) => {
          if (opts.where.targetType === 'CMDB_SERVICE') {
            return Promise.resolve([
              {
                id: 'bind-c',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-c',
                catalogRisk: critRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
              {
                id: 'bind-h',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-h',
                catalogRisk: highRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const change = makeChange();
      const result = await service.evaluateForChange('tenant-1', change);

      expect(result.topReasons.length).toBeGreaterThanOrEqual(2);
      expect(result.topReasons.some((r) => r.includes('CRITICAL'))).toBe(true);
      expect(result.topReasons.some((r) => r.includes('HIGH'))).toBe(true);
    });

    it('should build a proper RiskFactor for engine integration', async () => {
      const catalogRisk = makeCatalogRisk();
      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string } }) => {
          if (opts.where.targetType === 'CMDB_SERVICE') {
            return Promise.resolve([
              {
                id: 'bind-1',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-1',
                catalogRisk: catalogRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const change = makeChange();
      const result = await service.evaluateForChange('tenant-1', change);

      expect(result.riskFactor).toBeDefined();
      expect(result.riskFactor.name).toBe('Customer Risk Exposure');
      expect(result.riskFactor.weight).toBe(14);
      expect(result.riskFactor.score).toBeGreaterThan(0);
      expect(result.riskFactor.weightedScore).toBe(
        result.riskFactor.score * 14,
      );
      expect(result.riskFactor.evidence).toContain('customer risk');
    });

    it('should handle WAIVED observation reducing score', async () => {
      const catalogRisk = makeCatalogRisk({ severity: 'HIGH' });
      mockBindingRepo.find.mockImplementation(
        (opts: { where: { targetType: string } }) => {
          if (opts.where.targetType === 'CMDB_SERVICE') {
            return Promise.resolve([
              {
                id: 'bind-1',
                tenantId: 'tenant-1',
                catalogRiskId: 'crk-1',
                catalogRisk: catalogRisk,
                targetType: 'CMDB_SERVICE',
                targetId: 'svc-1',
                enabled: true,
                isDeleted: false,
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      mockObservationRepo.find.mockResolvedValue([
        { status: 'WAIVED', observedAt: new Date(), isDeleted: false },
      ]);

      const change = makeChange();
      const resultWaived = await service.evaluateForChange('tenant-1', change);

      mockObservationRepo.find.mockResolvedValue([
        { status: 'OPEN', observedAt: new Date(), isDeleted: false },
      ]);

      const resultOpen = await service.evaluateForChange('tenant-1', change);

      expect(resultWaived.resolvedRisks[0].contributionScore).toBeLessThan(
        resultOpen.resolvedRisks[0].contributionScore,
      );
    });

    it('should score CRITICAL higher than LOW severity', async () => {
      const critRisk = makeCatalogRisk({
        id: 'crk-c',
        severity: 'CRITICAL',
        scoreValue: 0,
      });
      const lowRisk = makeCatalogRisk({
        id: 'crk-l',
        severity: 'LOW',
        scoreValue: 0,
      });

      mockBindingRepo.find
        .mockResolvedValueOnce([
          {
            id: 'bind-c',
            tenantId: 'tenant-1',
            catalogRiskId: 'crk-c',
            catalogRisk: critRisk,
            targetType: 'CMDB_SERVICE',
            targetId: 'svc-1',
            enabled: true,
            isDeleted: false,
          },
        ])
        .mockResolvedValue([]);

      const change = makeChange();
      const resultCrit = await service.evaluateForChange('tenant-1', change);

      mockBindingRepo.find
        .mockResolvedValueOnce([
          {
            id: 'bind-l',
            tenantId: 'tenant-1',
            catalogRiskId: 'crk-l',
            catalogRisk: lowRisk,
            targetType: 'CMDB_SERVICE',
            targetId: 'svc-1',
            enabled: true,
            isDeleted: false,
          },
        ])
        .mockResolvedValue([]);

      const resultLow = await service.evaluateForChange('tenant-1', change);

      expect(resultCrit.aggregateScore).toBeGreaterThan(
        resultLow.aggregateScore,
      );
    });
  });

  describe('graceful degradation', () => {
    it('should work with all repos undefined', async () => {
      const degradedService = new CustomerRiskImpactService();
      const change = makeChange();
      const result = await degradedService.evaluateForChange(
        'tenant-1',
        change,
      );

      expect(result.resolvedRisks).toHaveLength(0);
      expect(result.aggregateScore).toBe(0);
      expect(result.riskFactor.score).toBe(0);
    });
  });
});
