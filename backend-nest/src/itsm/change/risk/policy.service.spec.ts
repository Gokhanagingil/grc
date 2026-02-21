import { PolicyService } from './policy.service';
import { ChangePolicy } from './change-policy.entity';
import {
  ItsmChange,
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from '../change.entity';
import { RiskAssessment, RiskLevel } from './risk-assessment.entity';
import { CustomerRiskImpactResult } from './customer-risk-impact.service';

// ---- helpers ----

function makeChange(overrides: Partial<ItsmChange> = {}): ItsmChange {
  return {
    id: 'chg-1',
    tenantId: 'tenant-1',
    number: 'CHG-001',
    title: 'Test Change',
    description: null,
    type: ChangeType.NORMAL,
    state: ChangeState.ASSESS,
    risk: ChangeRisk.MEDIUM,
    approvalStatus: ChangeApprovalStatus.NOT_REQUESTED,
    requesterId: null,
    requester: null,
    assigneeId: null,
    assignee: null,
    serviceId: 'svc-1',
    offeringId: null,
    cmdbService: null,
    offering: null,
    plannedStartAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    plannedEndAt: null,
    actualStartAt: null,
    actualEndAt: null,
    implementationPlan: null,
    backoutPlan: null,
    justification: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    createdBy: 'user-1',
    updatedBy: null,
    ...overrides,
  } as ItsmChange;
}

function makeAssessment(
  overrides: Partial<RiskAssessment> = {},
): RiskAssessment {
  return {
    id: 'ra-1',
    tenantId: 'tenant-1',
    changeId: 'chg-1',
    change: null as unknown as ItsmChange,
    tenant: null as unknown as never,
    riskScore: 50,
    riskLevel: RiskLevel.MEDIUM,
    computedAt: new Date(),
    breakdown: [],
    impactedCiCount: 2,
    impactedServiceCount: 1,
    hasFreezeConflict: false,
    hasSlaRisk: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    createdBy: 'system',
    updatedBy: null,
    ...overrides,
  } as RiskAssessment;
}

function makeCustomerRiskImpact(
  overrides: Partial<CustomerRiskImpactResult> = {},
): CustomerRiskImpactResult {
  return {
    changeId: 'chg-1',
    resolvedRisks: [],
    aggregateScore: 60,
    aggregateLabel: 'HIGH',
    topReasons: ['2 customer risks detected'],
    calculatedAt: new Date().toISOString(),
    riskFactor: {
      name: 'Customer Risk Exposure',
      weight: 14,
      score: 60,
      weightedScore: 840,
      evidence: '2 customer risk(s)',
    },
    ...overrides,
  };
}

function makePolicy(overrides: Partial<ChangePolicy> = {}): ChangePolicy {
  return {
    id: 'pol-1',
    tenantId: 'tenant-1',
    tenant: null as unknown as never,
    name: 'Test Policy',
    description: null,
    isActive: true,
    priority: 0,
    conditions: {},
    actions: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    createdBy: 'user-1',
    updatedBy: null,
    ...overrides,
  } as ChangePolicy;
}

// ---- tests ----

describe('PolicyService', () => {
  let service: PolicyService;
  let mockPolicyRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    mockPolicyRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    service = new PolicyService(mockPolicyRepo as never);
  });

  describe('evaluatePolicies - basic behavior', () => {
    it('should return ALLOW with empty fields when no policies exist', async () => {
      mockPolicyRepo.find.mockResolvedValue([]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
      );

      expect(result.decisionRecommendation).toBe('ALLOW');
      expect(result.matchedPolicies).toHaveLength(0);
      expect(result.rulesTriggered).toHaveLength(0);
      expect(result.reasons).toHaveLength(0);
      expect(result.requiredActions).toHaveLength(0);
      expect(result.requireCABApproval).toBe(false);
      expect(result.blockDuringFreeze).toBe(false);
    });

    it('should return ALLOW when no repo is available', async () => {
      const degradedService = new PolicyService();

      const result = await degradedService.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
      );

      expect(result.decisionRecommendation).toBe('ALLOW');
      expect(result.matchedPolicies).toHaveLength(0);
    });
  });

  describe('evaluatePolicies - condition matching', () => {
    it('should match policy when changeType matches', async () => {
      const policy = makePolicy({
        conditions: { changeType: ['NORMAL'] },
        actions: { requireCABApproval: false },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange({ type: ChangeType.NORMAL }),
        makeAssessment(),
      );

      expect(result.matchedPolicies).toHaveLength(1);
      expect(result.rulesTriggered).toHaveLength(1);
    });

    it('should NOT match policy when changeType does not match', async () => {
      const policy = makePolicy({
        conditions: { changeType: ['EMERGENCY'] },
        actions: { requireCABApproval: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange({ type: ChangeType.NORMAL }),
        makeAssessment(),
      );

      expect(result.matchedPolicies).toHaveLength(0);
      expect(result.requireCABApproval).toBe(false);
    });

    it('should match when riskLevelMin <= assessment risk level', async () => {
      const policy = makePolicy({
        conditions: { riskLevelMin: 'MEDIUM' },
        actions: {},
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment({ riskLevel: RiskLevel.HIGH }),
      );

      expect(result.matchedPolicies).toHaveLength(1);
    });

    it('should NOT match when riskLevelMin > assessment risk level', async () => {
      const policy = makePolicy({
        conditions: { riskLevelMin: 'HIGH' },
        actions: {},
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment({ riskLevel: RiskLevel.LOW }),
      );

      expect(result.matchedPolicies).toHaveLength(0);
    });

    it('should match when riskScoreMin <= assessment riskScore', async () => {
      const policy = makePolicy({
        conditions: { riskScoreMin: 40 },
        actions: {},
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment({ riskScore: 50 }),
      );

      expect(result.matchedPolicies).toHaveLength(1);
    });

    it('should match when hasFreezeConflict matches', async () => {
      const policy = makePolicy({
        conditions: { hasFreezeConflict: true },
        actions: { blockDuringFreeze: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment({ hasFreezeConflict: true }),
      );

      expect(result.matchedPolicies).toHaveLength(1);
      expect(result.blockDuringFreeze).toBe(true);
    });
  });

  describe('evaluatePolicies - customer risk conditions', () => {
    it('should match when customerRiskScoreMin <= aggregateScore', async () => {
      const policy = makePolicy({
        conditions: { customerRiskScoreMin: 50 },
        actions: { requireCABApproval: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const impact = makeCustomerRiskImpact({ aggregateScore: 60 });
      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
        impact,
      );

      expect(result.matchedPolicies).toHaveLength(1);
      expect(result.requireCABApproval).toBe(true);
    });

    it('should NOT match when customerRiskScoreMin > aggregateScore', async () => {
      const policy = makePolicy({
        conditions: { customerRiskScoreMin: 80 },
        actions: { requireCABApproval: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const impact = makeCustomerRiskImpact({ aggregateScore: 60 });
      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
        impact,
      );

      expect(result.matchedPolicies).toHaveLength(0);
      expect(result.requireCABApproval).toBe(false);
    });

    it('should match when customerRiskLabelMin <= aggregateLabel', async () => {
      const policy = makePolicy({
        conditions: { customerRiskLabelMin: 'MEDIUM' },
        actions: { requireImplementationPlan: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const impact = makeCustomerRiskImpact({ aggregateLabel: 'HIGH' });
      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
        impact,
      );

      expect(result.matchedPolicies).toHaveLength(1);
      expect(result.requiredActions).toContain('Implementation plan required');
    });

    it('should NOT match when customerRiskLabelMin > aggregateLabel', async () => {
      const policy = makePolicy({
        conditions: { customerRiskLabelMin: 'CRITICAL' },
        actions: { requireImplementationPlan: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const impact = makeCustomerRiskImpact({ aggregateLabel: 'HIGH' });
      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
        impact,
      );

      expect(result.matchedPolicies).toHaveLength(0);
    });

    it('should match with combined customer risk and technical conditions', async () => {
      const policy = makePolicy({
        conditions: {
          customerRiskScoreMin: 40,
          riskLevelMin: 'MEDIUM',
          changeType: ['NORMAL'],
        },
        actions: {
          requireCABApproval: true,
          requireImplementationPlan: true,
          requireBackoutPlan: true,
        },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const impact = makeCustomerRiskImpact({ aggregateScore: 60 });
      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange({ type: ChangeType.NORMAL }),
        makeAssessment({ riskLevel: RiskLevel.HIGH }),
        impact,
      );

      expect(result.matchedPolicies).toHaveLength(1);
      expect(result.requireCABApproval).toBe(true);
      expect(result.requiredActions).toContain('CAB approval required');
      expect(result.requiredActions).toContain('Implementation plan required');
      expect(result.requiredActions).toContain('Backout plan required');
    });

    it('should skip customer risk conditions when impact is null', async () => {
      const policy = makePolicy({
        conditions: { customerRiskScoreMin: 50 },
        actions: {},
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      // customerRiskScoreMin is set but no customerRiskImpact is provided
      // The condition check for customerRiskScoreMin requires customerRiskImpact to be truthy
      // When it's null, the condition is skipped (not evaluated), so the policy still matches
      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
        null,
      );

      // Policy matches because the customer risk condition is skipped when impact is null
      expect(result.matchedPolicies).toHaveLength(1);
    });
  });

  describe('evaluatePolicies - explainability fields', () => {
    it('should populate rulesTriggered with condition and action summaries', async () => {
      const policy = makePolicy({
        name: 'High Customer Risk Policy',
        conditions: { customerRiskScoreMin: 50, riskLevelMin: 'HIGH' },
        actions: { requireCABApproval: true, requireBackoutPlan: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const impact = makeCustomerRiskImpact({ aggregateScore: 70 });
      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment({ riskLevel: RiskLevel.CRITICAL }),
        impact,
      );

      expect(result.rulesTriggered).toHaveLength(1);
      expect(result.rulesTriggered[0].policyName).toBe(
        'High Customer Risk Policy',
      );
      expect(result.rulesTriggered[0].conditionsSummary).toContain(
        'customer risk score >= 50',
      );
      expect(result.rulesTriggered[0].conditionsSummary).toContain(
        'risk level >= HIGH',
      );
      expect(result.rulesTriggered[0].actionsSummary).toContain(
        'require CAB approval',
      );
      expect(result.rulesTriggered[0].actionsSummary).toContain(
        'require backout plan',
      );
    });

    it('should populate reasons with policy name and condition summary', async () => {
      const policy = makePolicy({
        name: 'Freeze Policy',
        conditions: { hasFreezeConflict: true },
        actions: { blockDuringFreeze: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment({ hasFreezeConflict: true }),
      );

      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toContain('Freeze Policy');
      expect(result.reasons[0]).toContain('freeze conflict present');
    });

    it('should populate requiredActions from policy actions', async () => {
      const policy = makePolicy({
        conditions: {},
        actions: {
          requireCABApproval: true,
          requireImplementationPlan: true,
          requireBackoutPlan: true,
          requireJustification: true,
          blockDuringFreeze: true,
          minLeadTimeHours: 24,
        },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
      );

      expect(result.requiredActions).toContain('CAB approval required');
      expect(result.requiredActions).toContain(
        'Change blocked during freeze window',
      );
      expect(result.requiredActions).toContain('Minimum lead time: 24h');
      expect(result.requiredActions).toContain('Implementation plan required');
      expect(result.requiredActions).toContain('Backout plan required');
      expect(result.requiredActions).toContain('Justification required');
    });

    it('should deduplicate requiredActions across multiple policies', async () => {
      const policy1 = makePolicy({
        id: 'pol-1',
        conditions: {},
        actions: { requireCABApproval: true },
      });
      const policy2 = makePolicy({
        id: 'pol-2',
        name: 'Policy 2',
        conditions: {},
        actions: { requireCABApproval: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy1, policy2]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
      );

      const cabActions = result.requiredActions.filter(
        (a) => a === 'CAB approval required',
      );
      expect(cabActions).toHaveLength(1);
    });
  });

  describe('evaluatePolicies - decision recommendation', () => {
    it('should return BLOCK when freeze conflict + blockDuringFreeze', async () => {
      const policy = makePolicy({
        conditions: { hasFreezeConflict: true },
        actions: { blockDuringFreeze: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment({ hasFreezeConflict: true }),
      );

      expect(result.decisionRecommendation).toBe('BLOCK');
    });

    it('should return CAB_REQUIRED when policy requires CAB approval', async () => {
      const policy = makePolicy({
        conditions: {},
        actions: { requireCABApproval: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
      );

      expect(result.decisionRecommendation).toBe('CAB_REQUIRED');
    });

    it('should return REVIEW when policies match but no CAB/block', async () => {
      const policy = makePolicy({
        conditions: {},
        actions: { requireImplementationPlan: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
      );

      expect(result.decisionRecommendation).toBe('REVIEW');
    });

    it('should return ALLOW when no policies match', async () => {
      const policy = makePolicy({
        conditions: { changeType: ['EMERGENCY'] },
        actions: { requireCABApproval: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange({ type: ChangeType.NORMAL }),
        makeAssessment(),
      );

      expect(result.decisionRecommendation).toBe('ALLOW');
    });

    it('should prioritize BLOCK > CAB_REQUIRED > REVIEW > ALLOW', async () => {
      // Policy that requires both CAB and freeze block
      const policy = makePolicy({
        conditions: { hasFreezeConflict: true },
        actions: { requireCABApproval: true, blockDuringFreeze: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment({ hasFreezeConflict: true }),
      );

      // BLOCK takes precedence over CAB_REQUIRED
      expect(result.decisionRecommendation).toBe('BLOCK');
    });

    it('should return CAB_REQUIRED when customer risk triggers CAB policy', async () => {
      const policy = makePolicy({
        conditions: { customerRiskLabelMin: 'HIGH' },
        actions: { requireCABApproval: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const impact = makeCustomerRiskImpact({ aggregateLabel: 'CRITICAL' });
      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment(),
        impact,
      );

      expect(result.decisionRecommendation).toBe('CAB_REQUIRED');
      expect(result.rulesTriggered[0].conditionsSummary).toContain(
        'customer risk label >= HIGH',
      );
    });
  });

  describe('evaluatePolicies - multiple policies', () => {
    it('should evaluate all matching policies and merge actions', async () => {
      const policy1 = makePolicy({
        id: 'pol-1',
        name: 'Risk Level Policy',
        conditions: { riskLevelMin: 'MEDIUM' },
        actions: { requireImplementationPlan: true },
      });
      const policy2 = makePolicy({
        id: 'pol-2',
        name: 'Customer Risk Policy',
        conditions: { customerRiskScoreMin: 40 },
        actions: { requireCABApproval: true, requireBackoutPlan: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy1, policy2]);

      const impact = makeCustomerRiskImpact({ aggregateScore: 60 });
      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange(),
        makeAssessment({ riskLevel: RiskLevel.HIGH }),
        impact,
      );

      expect(result.matchedPolicies).toHaveLength(2);
      expect(result.rulesTriggered).toHaveLength(2);
      expect(result.reasons).toHaveLength(2);
      expect(result.requireCABApproval).toBe(true);
      expect(result.requiredActions).toContain('Implementation plan required');
      expect(result.requiredActions).toContain('CAB approval required');
      expect(result.requiredActions).toContain('Backout plan required');
      expect(result.decisionRecommendation).toBe('CAB_REQUIRED');
    });

    it('should only include matched policies, not all', async () => {
      const policy1 = makePolicy({
        id: 'pol-1',
        name: 'Emergency Only',
        conditions: { changeType: ['EMERGENCY'] },
        actions: { requireCABApproval: true },
      });
      const policy2 = makePolicy({
        id: 'pol-2',
        name: 'All Changes',
        conditions: {},
        actions: { requireImplementationPlan: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy1, policy2]);

      const result = await service.evaluatePolicies(
        'tenant-1',
        makeChange({ type: ChangeType.NORMAL }),
        makeAssessment(),
      );

      expect(result.matchedPolicies).toHaveLength(1);
      expect(result.matchedPolicies[0].policyName).toBe('All Changes');
      expect(result.requireCABApproval).toBe(false);
    });
  });

  describe('evaluatePolicies - tenant isolation', () => {
    it('should query policies with correct tenantId', async () => {
      mockPolicyRepo.find.mockResolvedValue([]);

      await service.evaluatePolicies(
        'tenant-abc',
        makeChange(),
        makeAssessment(),
      );

      expect(mockPolicyRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-abc', isActive: true, isDeleted: false },
        order: { priority: 'ASC' },
      });
    });

    it('should only return policies for the requested tenant', async () => {
      const policy = makePolicy({
        tenantId: 'tenant-abc',
        conditions: {},
        actions: { requireCABApproval: true },
      });
      mockPolicyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluatePolicies(
        'tenant-abc',
        makeChange(),
        makeAssessment(),
      );

      expect(result.matchedPolicies).toHaveLength(1);
    });
  });
});
