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

  /* ------------------------------------------------------------------ */
  /* Linked Risk Contribution — enum canonicalization regression tests   */
  /* ------------------------------------------------------------------ */
  describe('calculateRisk — Linked Risk Contribution', () => {
    /**
     * Formula (from risk-scoring.service.ts, calculateLinkedRiskContribution):
     *
     *   For each linked risk:
     *     severityScore = severityMap[canonical(severity)]  ?? 25
     *     statusWeight  = statusWeightMap[canonical(status)] ?? 0.5
     *     weighted      = severityScore × statusWeight
     *
     *   avgWeightedScore = sum(weighted) / riskCount
     *   scaleFactor      = min(2.0, 1 + (riskCount - 1) × 0.25)   (capped at 2×)
     *   rawScore         = min(100, round(avgWeightedScore × scaleFactor))
     *   weightedScore    = rawScore × FACTOR_WEIGHTS.LINKED_RISK_CONTRIBUTION (12)
     *
     * Severity map:  critical=100, high=75, medium=50, low=25
     * Status weights: identified=1.0, assessed=1.0, treatment_planned=1.0,
     *                 treating=0.8, mitigating=0.6, monitored=0.6,
     *                 closed=0.2, accepted=0.2, draft=0.4
     */

    let serviceWithLinkedRisks: RiskScoringService;
    let mockChangeRiskRepo: Record<string, jest.Mock>;
    let mockGrcRiskRepo: {
      find: jest.Mock;
      createQueryBuilder: jest.Mock;
    };

    /** Helper to build a mock GrcRisk-like object */
    function makeGrcRisk(overrides: {
      id?: string;
      severity: string;
      status: string;
      title?: string;
      code?: string;
    }) {
      return {
        id: overrides.id ?? 'risk-' + Math.random().toString(36).slice(2, 10),
        tenantId: 'tenant-1',
        severity: overrides.severity,
        status: overrides.status,
        title: overrides.title ?? 'Test Risk',
        code: overrides.code ?? 'RSK-001',
        isDeleted: false,
      };
    }

    beforeEach(() => {
      mockChangeRiskRepo = {
        find: jest.fn().mockResolvedValue([]),
      };

      mockGrcRiskRepo = {
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      };

      serviceWithLinkedRisks = new RiskScoringService(
        mockRiskRepo as never,
        mockServiceCiRepo as never,
        mockCiRelRepo as never,
        mockQualitySnapshotRepo as never,
        mockSlaInstanceRepo as never,
        mockConflictRepo as never,
        mockCustomerRiskImpactService as never,
        undefined, // topologyImpactService
        mockChangeRiskRepo as never,
        mockGrcRiskRepo as never,
      );
    });

    /* --- Worked example 1: No linked risks → score 0 --- */
    it('should return score 0 when no linked risks exist', async () => {
      mockChangeRiskRepo.find.mockResolvedValue([]);
      const change = makeChange();
      const result = await serviceWithLinkedRisks.calculateRisk(
        'tenant-1',
        'user-1',
        change,
      );
      const factor = result!.breakdown.find(
        (f) => f.name === 'Linked Risk Contribution',
      );
      expect(factor).toBeDefined();
      expect(factor!.score).toBe(0);
      expect(factor!.weightedScore).toBe(0);
      expect(factor!.evidence).toContain('No linked risks');
    });

    /* --- Worked example 2: 1 low/identified risk --- */
    it('should correctly score 1 low open risk (lowercase enums)', async () => {
      // Setup: 1 link → 1 risk with severity=low, status=identified
      mockChangeRiskRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', changeId: 'change-1', riskId: 'risk-low-1' },
      ]);
      const riskObj = makeGrcRisk({
        id: 'risk-low-1',
        severity: 'low',
        status: 'identified',
      });
      mockGrcRiskRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([riskObj]),
      });

      const change = makeChange();
      const result = await serviceWithLinkedRisks.calculateRisk(
        'tenant-1',
        'user-1',
        change,
      );
      const factor = result!.breakdown.find(
        (f) => f.name === 'Linked Risk Contribution',
      );

      // Manual calculation:
      //   sevScore = 25 (low), statusWeight = 1.0 (identified)
      //   weighted = 25 × 1.0 = 25
      //   avg = 25 / 1 = 25
      //   scaleFactor = min(2.0, 1 + 0×0.25) = 1.0
      //   rawScore = min(100, round(25 × 1.0)) = 25
      //   weightedScore = 25 × 12 = 300
      expect(factor!.score).toBe(25);
      expect(factor!.weightedScore).toBe(25 * 12);
    });

    /* --- Worked example 3: 1 high/identified risk --- */
    it('should correctly score 1 high open risk', async () => {
      mockChangeRiskRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', changeId: 'change-1', riskId: 'risk-high-1' },
      ]);
      const riskObj = makeGrcRisk({
        id: 'risk-high-1',
        severity: 'high',
        status: 'identified',
      });
      mockGrcRiskRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([riskObj]),
      });

      const change = makeChange();
      const result = await serviceWithLinkedRisks.calculateRisk(
        'tenant-1',
        'user-1',
        change,
      );
      const factor = result!.breakdown.find(
        (f) => f.name === 'Linked Risk Contribution',
      );

      // Manual calculation:
      //   sevScore = 75 (high), statusWeight = 1.0 (identified)
      //   weighted = 75 × 1.0 = 75
      //   avg = 75, scaleFactor = 1.0
      //   rawScore = min(100, round(75)) = 75
      //   weightedScore = 75 × 12 = 900
      expect(factor!.score).toBe(75);
      expect(factor!.weightedScore).toBe(75 * 12);
    });

    /* --- Worked example 4: Mixed risks (open + closed) --- */
    it('should correctly score mixed linked risks (open + closed)', async () => {
      mockChangeRiskRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', changeId: 'change-1', riskId: 'risk-a' },
        { tenantId: 'tenant-1', changeId: 'change-1', riskId: 'risk-b' },
      ]);
      const riskA = makeGrcRisk({
        id: 'risk-a',
        severity: 'critical',
        status: 'identified',
        title: 'Open Critical Risk',
      });
      const riskB = makeGrcRisk({
        id: 'risk-b',
        severity: 'medium',
        status: 'closed',
        title: 'Closed Medium Risk',
      });
      mockGrcRiskRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([riskA, riskB]),
      });

      const change = makeChange();
      const result = await serviceWithLinkedRisks.calculateRisk(
        'tenant-1',
        'user-1',
        change,
      );
      const factor = result!.breakdown.find(
        (f) => f.name === 'Linked Risk Contribution',
      );

      // Manual calculation:
      //   Risk A: critical(100) × identified(1.0) = 100
      //   Risk B: medium(50) × closed(0.2)       = 10
      //   total = 110, avg = 110 / 2 = 55
      //   scaleFactor = min(2.0, 1 + (2-1)×0.25) = 1.25
      //   rawScore = min(100, round(55 × 1.25)) = min(100, 69) = 69
      //   weightedScore = 69 × 12 = 828
      expect(factor!.score).toBe(69);
      expect(factor!.weightedScore).toBe(69 * 12);
      expect(factor!.evidence).toContain('1 CRITICAL');
      expect(factor!.evidence).toContain('1 open/active');
    });

    /* --- Enum canonicalization: UPPERCASE severity/status --- */
    it('should handle UPPERCASE enum values via canonicalization', async () => {
      mockChangeRiskRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', changeId: 'change-1', riskId: 'risk-up-1' },
      ]);
      const riskObj = makeGrcRisk({
        id: 'risk-up-1',
        severity: 'HIGH', // UPPERCASE — must be canonicalized
        status: 'IDENTIFIED', // UPPERCASE — must be canonicalized
      });
      mockGrcRiskRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([riskObj]),
      });

      const change = makeChange();
      const result = await serviceWithLinkedRisks.calculateRisk(
        'tenant-1',
        'user-1',
        change,
      );
      const factor = result!.breakdown.find(
        (f) => f.name === 'Linked Risk Contribution',
      );

      // Same as "1 high open risk" — canonicalization should normalize
      // sevScore = 75 (high), statusWeight = 1.0 (identified)
      // rawScore = 75
      expect(factor!.score).toBe(75);
      expect(factor!.weightedScore).toBe(75 * 12);
    });

    /* --- Enum canonicalization: MixedCase severity/status --- */
    it('should handle MixedCase enum values via canonicalization', async () => {
      mockChangeRiskRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', changeId: 'change-1', riskId: 'risk-mix-1' },
      ]);
      const riskObj = makeGrcRisk({
        id: 'risk-mix-1',
        severity: 'Critical', // MixedCase
        status: 'Treatment_Planned', // MixedCase
      });
      mockGrcRiskRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([riskObj]),
      });

      const change = makeChange();
      const result = await serviceWithLinkedRisks.calculateRisk(
        'tenant-1',
        'user-1',
        change,
      );
      const factor = result!.breakdown.find(
        (f) => f.name === 'Linked Risk Contribution',
      );

      // critical(100) × treatment_planned(1.0) = 100
      // rawScore = min(100, round(100 × 1.0)) = 100
      expect(factor!.score).toBe(100);
      expect(factor!.weightedScore).toBe(100 * 12);
    });

    /* --- Enum canonicalization: unknown/null values → fallback defaults --- */
    it('should use fallback defaults for unknown or null enum values', async () => {
      mockChangeRiskRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', changeId: 'change-1', riskId: 'risk-null-1' },
      ]);
      const riskObj = makeGrcRisk({
        id: 'risk-null-1',
        severity: null as unknown as string, // null severity → fallback 25
        status: 'UNKNOWN_STATUS', // unknown status → fallback 0.5
      });
      mockGrcRiskRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([riskObj]),
      });

      const change = makeChange();
      const result = await serviceWithLinkedRisks.calculateRisk(
        'tenant-1',
        'user-1',
        change,
      );
      const factor = result!.breakdown.find(
        (f) => f.name === 'Linked Risk Contribution',
      );

      // null severity → canonicalized to '' → not in map → fallback 25
      // unknown_status → canonicalized to 'unknown_status' → not in map → fallback 0.5
      // weighted = 25 × 0.5 = 12.5
      // rawScore = min(100, round(12.5 × 1.0)) = 13
      expect(factor!.score).toBe(13);
      expect(factor!.weightedScore).toBe(13 * 12);
    });

    /* --- Enum canonicalization: whitespace-padded values --- */
    it('should handle whitespace-padded enum values via trim', async () => {
      mockChangeRiskRepo.find.mockResolvedValue([
        { tenantId: 'tenant-1', changeId: 'change-1', riskId: 'risk-ws-1' },
      ]);
      const riskObj = makeGrcRisk({
        id: 'risk-ws-1',
        severity: '  medium  ', // padded with spaces
        status: '  closed  ', // padded with spaces
      });
      mockGrcRiskRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([riskObj]),
      });

      const change = makeChange();
      const result = await serviceWithLinkedRisks.calculateRisk(
        'tenant-1',
        'user-1',
        change,
      );
      const factor = result!.breakdown.find(
        (f) => f.name === 'Linked Risk Contribution',
      );

      // medium(50) × closed(0.2) = 10
      // rawScore = min(100, round(10 × 1.0)) = 10
      expect(factor!.score).toBe(10);
      expect(factor!.weightedScore).toBe(10 * 12);
    });

    /* --- Scale factor capping: 5+ risks → scaleFactor capped at 2.0 --- */
    it('should cap scaleFactor at 2.0 for 5+ linked risks', async () => {
      const links = Array.from({ length: 5 }, (_, i) => ({
        tenantId: 'tenant-1',
        changeId: 'change-1',
        riskId: `risk-cap-${i}`,
      }));
      mockChangeRiskRepo.find.mockResolvedValue(links);

      const risks = links.map((l) =>
        makeGrcRisk({
          id: l.riskId,
          severity: 'low',
          status: 'closed',
        }),
      );
      mockGrcRiskRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(risks),
      });

      const change = makeChange();
      const result = await serviceWithLinkedRisks.calculateRisk(
        'tenant-1',
        'user-1',
        change,
      );
      const factor = result!.breakdown.find(
        (f) => f.name === 'Linked Risk Contribution',
      );

      // Each risk: low(25) × closed(0.2) = 5
      // avg = 5, scaleFactor = min(2.0, 1 + 4×0.25) = min(2.0, 2.0) = 2.0
      // rawScore = min(100, round(5 × 2.0)) = 10
      expect(factor!.score).toBe(10);
      expect(factor!.evidence).toContain('5 linked risk(s)');
      expect(factor!.evidence).toContain('scale=2.00');
    });
  });
});
