import { RiskScoringService } from './risk-scoring.service';
import {
  ItsmChange,
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from '../change.entity';
import { RiskLevel } from './risk-assessment.entity';

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
  change.serviceId = null;
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

describe('RiskScoringService', () => {
  let service: RiskScoringService;
  let mockRiskRepo: Record<string, jest.Mock>;
  let mockServiceCiRepo: Record<string, jest.Mock>;
  let mockCiRelRepo: Record<string, jest.Mock>;
  let mockQualitySnapshotRepo: Record<string, jest.Mock>;
  let mockSlaInstanceRepo: Record<string, jest.Mock>;
  let mockConflictRepo: Record<string, jest.Mock>;
  let mockCustomerRiskImpactService: { evaluateForChange: jest.Mock };

  beforeEach(() => {
    mockRiskRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((data) => ({ ...data, id: 'risk-1' })),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };
    mockServiceCiRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockCiRelRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockQualitySnapshotRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockSlaInstanceRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockConflictRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockCustomerRiskImpactService = {
      evaluateForChange: jest.fn().mockResolvedValue({
        changeId: 'change-1',
        resolvedRisks: [],
        aggregateScore: 0,
        aggregateLabel: 'LOW',
        topReasons: [],
        calculatedAt: new Date().toISOString(),
        riskFactor: {
          name: 'Customer Risk Exposure',
          weight: 14,
          score: 0,
          weightedScore: 0,
          evidence: 'No customer risks bound to affected service/CIs',
        },
      }),
    };

    service = new RiskScoringService(
      mockRiskRepo as never,
      mockServiceCiRepo as never,
      mockCiRelRepo as never,
      mockQualitySnapshotRepo as never,
      mockSlaInstanceRepo as never,
      mockConflictRepo as never,
      mockCustomerRiskImpactService as never,
      undefined, // topologyImpactService (optional)
      undefined, // changeRiskRepo (optional)
      undefined, // grcRiskRepo (optional)
    );
  });

  describe('calculateRisk', () => {
    it('should return a risk assessment for a basic normal change', async () => {
      const change = makeChange();
      const result = await service.calculateRisk('tenant-1', 'user-1', change);

      expect(result).toBeDefined();
      expect(result!.riskScore).toBeGreaterThanOrEqual(0);
      expect(result!.riskScore).toBeLessThanOrEqual(100);
      expect(result!.breakdown).toHaveLength(9);
      expect(result!.breakdown.map((f) => f.name)).toEqual([
        'Blast Radius',
        'CMDB Quality',
        'Change Type',
        'Lead Time',
        'SLA Breach Forecast',
        'Conflict Status',
        'Customer Risk Exposure',
        'Topology Impact',
        'Linked Risk Contribution',
      ]);
    });

    it('should produce deterministic results for same input', async () => {
      const change = makeChange();
      const result1 = await service.calculateRisk('tenant-1', 'user-1', change);
      mockRiskRepo.findOne.mockResolvedValue(null);
      const result2 = await service.calculateRisk('tenant-1', 'user-1', change);

      expect(result1!.riskScore).toBe(result2!.riskScore);
      expect(result1!.riskLevel).toBe(result2!.riskLevel);
    });

    it('should score STANDARD changes lower than NORMAL', async () => {
      const standardChange = makeChange({ type: ChangeType.STANDARD });
      const normalChange = makeChange({ type: ChangeType.NORMAL });

      const standardResult = await service.calculateRisk(
        'tenant-1',
        'user-1',
        standardChange,
      );
      mockRiskRepo.findOne.mockResolvedValue(null);
      const normalResult = await service.calculateRisk(
        'tenant-1',
        'user-1',
        normalChange,
      );

      expect(standardResult!.riskScore).toBeLessThan(normalResult!.riskScore);
    });

    it('should score EMERGENCY changes higher than NORMAL', async () => {
      const emergencyChange = makeChange({ type: ChangeType.EMERGENCY });
      const normalChange = makeChange({ type: ChangeType.NORMAL });

      const emergencyResult = await service.calculateRisk(
        'tenant-1',
        'user-1',
        emergencyChange,
      );
      mockRiskRepo.findOne.mockResolvedValue(null);
      const normalResult = await service.calculateRisk(
        'tenant-1',
        'user-1',
        normalChange,
      );

      expect(emergencyResult!.riskScore).toBeGreaterThan(
        normalResult!.riskScore,
      );
    });

    it('should increase score when many CIs are impacted (blast radius)', async () => {
      const change = makeChange({ serviceId: 'svc-1' });
      mockServiceCiRepo.find.mockResolvedValue(
        Array.from({ length: 30 }, (_, i) => ({
          tenantId: 'tenant-1',
          serviceId: 'svc-1',
          ciId: `ci-${i}`,
        })),
      );

      const result = await service.calculateRisk('tenant-1', 'user-1', change);

      const blastFactor = result!.breakdown.find(
        (f) => f.name === 'Blast Radius',
      );
      expect(blastFactor!.score).toBeGreaterThanOrEqual(75);
      expect(result!.impactedCiCount).toBeGreaterThanOrEqual(30);
    });

    it('should increase score when CMDB quality is low', async () => {
      const change = makeChange();
      mockQualitySnapshotRepo.findOne.mockResolvedValue({
        score: 30,
        tenantId: 'tenant-1',
      });

      const result = await service.calculateRisk('tenant-1', 'user-1', change);

      const qualityFactor = result!.breakdown.find(
        (f) => f.name === 'CMDB Quality',
      );
      expect(qualityFactor!.score).toBe(70);
    });

    it('should decrease score when CMDB quality is high', async () => {
      const change = makeChange();
      mockQualitySnapshotRepo.findOne.mockResolvedValue({
        score: 95,
        tenantId: 'tenant-1',
      });

      const result = await service.calculateRisk('tenant-1', 'user-1', change);

      const qualityFactor = result!.breakdown.find(
        (f) => f.name === 'CMDB Quality',
      );
      expect(qualityFactor!.score).toBe(5);
    });

    it('should increase score for short lead time (< 4h)', async () => {
      const now = new Date();
      const change = makeChange({
        createdAt: now,
        plannedStartAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      });

      const result = await service.calculateRisk('tenant-1', 'user-1', change);

      const leadFactor = result!.breakdown.find((f) => f.name === 'Lead Time');
      expect(leadFactor!.score).toBe(90);
    });

    it('should decrease score for long lead time (> 7 days)', async () => {
      const now = new Date();
      const change = makeChange({
        createdAt: now,
        plannedStartAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      });

      const result = await service.calculateRisk('tenant-1', 'user-1', change);

      const leadFactor = result!.breakdown.find((f) => f.name === 'Lead Time');
      expect(leadFactor!.score).toBe(5);
    });

    it('should detect freeze window conflicts as critical', async () => {
      const change = makeChange();
      mockConflictRepo.find.mockResolvedValue([
        {
          tenantId: 'tenant-1',
          changeId: 'change-1',
          conflictType: 'FREEZE_WINDOW',
          isDeleted: false,
        },
      ]);

      const result = await service.calculateRisk('tenant-1', 'user-1', change);

      const conflictFactor = result!.breakdown.find(
        (f) => f.name === 'Conflict Status',
      );
      expect(conflictFactor!.score).toBe(95);
      expect(result!.hasFreezeConflict).toBe(true);
    });

    it('should detect overlap conflicts', async () => {
      const change = makeChange();
      mockConflictRepo.find.mockResolvedValue([
        {
          tenantId: 'tenant-1',
          changeId: 'change-1',
          conflictType: 'OVERLAP',
          isDeleted: false,
        },
        {
          tenantId: 'tenant-1',
          changeId: 'change-1',
          conflictType: 'OVERLAP',
          isDeleted: false,
        },
      ]);

      const result = await service.calculateRisk('tenant-1', 'user-1', change);

      const conflictFactor = result!.breakdown.find(
        (f) => f.name === 'Conflict Status',
      );
      expect(conflictFactor!.score).toBeGreaterThanOrEqual(70);
      expect(result!.hasFreezeConflict).toBe(false);
    });

    it('should return LOW risk level for score < 25', async () => {
      const change = makeChange({ type: ChangeType.STANDARD });
      const now = new Date();
      change.createdAt = now;
      change.plannedStartAt = new Date(
        now.getTime() + 10 * 24 * 60 * 60 * 1000,
      );
      change.plannedEndAt = new Date(
        now.getTime() + 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
      );
      mockQualitySnapshotRepo.findOne.mockResolvedValue({
        score: 95,
        tenantId: 'tenant-1',
      });

      const result = await service.calculateRisk('tenant-1', 'user-1', change);

      expect(result!.riskLevel).toBe(RiskLevel.LOW);
      expect(result!.riskScore).toBeLessThan(25);
    });

    it('should detect SLA at-risk instances during change window', async () => {
      const now = new Date();
      const change = makeChange({
        serviceId: 'svc-1',
        plannedStartAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        plannedEndAt: new Date(now.getTime() + 26 * 60 * 60 * 1000),
      });

      mockSlaInstanceRepo.find.mockResolvedValue([
        {
          tenantId: 'tenant-1',
          status: 'IN_PROGRESS',
          breached: false,
          dueAt: new Date(now.getTime() + 25 * 60 * 60 * 1000),
        },
      ]);

      const result = await service.calculateRisk('tenant-1', 'user-1', change);

      expect(result!.hasSlaRisk).toBe(true);
      const slaFactor = result!.breakdown.find(
        (f) => f.name === 'SLA Breach Forecast',
      );
      expect(slaFactor!.score).toBeGreaterThanOrEqual(50);
    });

    it('should update existing assessment instead of creating new one', async () => {
      const change = makeChange();
      const existingAssessment = {
        id: 'existing-risk-1',
        tenantId: 'tenant-1',
        changeId: 'change-1',
        riskScore: 30,
        riskLevel: RiskLevel.MEDIUM,
        computedAt: new Date(),
        breakdown: [],
        impactedCiCount: 0,
        impactedServiceCount: 0,
        hasFreezeConflict: false,
        hasSlaRisk: false,
        isDeleted: false,
      };
      mockRiskRepo.findOne.mockResolvedValue(existingAssessment);

      await service.calculateRisk('tenant-1', 'user-1', change);

      expect(mockRiskRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'existing-risk-1' }),
      );
      expect(mockRiskRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('getAssessment', () => {
    it('should return null when no assessment exists', async () => {
      mockRiskRepo.findOne.mockResolvedValue(null);
      const result = await service.getAssessment('tenant-1', 'change-1');
      expect(result).toBeNull();
    });

    it('should return assessment when it exists', async () => {
      const assessment = { id: 'risk-1', riskScore: 50 };
      mockRiskRepo.findOne.mockResolvedValue(assessment);
      const result = await service.getAssessment('tenant-1', 'change-1');
      expect(result).toEqual(assessment);
    });
  });
});
