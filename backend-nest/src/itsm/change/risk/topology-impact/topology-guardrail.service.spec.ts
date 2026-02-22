/**
 * Unit tests for TopologyGuardrailService
 *
 * Tests topology guardrail evaluation including:
 * - Governance decision → guardrail status mapping (deterministic)
 * - Reason building from governance factors
 * - Evidence summary construction
 * - Event bus integration (evaluated, recalculated, blocked, status_changed)
 * - Audit trail / journal entry writing
 * - Fail-open behavior when services unavailable
 * - Edge cases: no topology data, all services unavailable
 * - Tenant isolation (tenant ID passed through)
 *
 * Phase A: Topology Guardrails Backend
 */

import { TopologyGuardrailService } from './topology-guardrail.service';
import {
  TopologyGovernanceEvaluationResponse,
  TopologyGovernanceDecision,
} from './dto/topology-governance.dto';
import {
  GuardrailStatus,
  GOVERNANCE_TO_GUARDRAIL_MAP,
  GuardrailPreviousEvaluation,
} from './dto/topology-guardrail.dto';
import { ItsmChange, ChangeType, ChangeState, ChangeRisk, ChangeApprovalStatus } from '../../change.entity';

// ============================================================================
// Test Constants
// ============================================================================

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TENANT_ID_OTHER = '00000000-0000-0000-0000-000000000002';
const USER_ID = 'user-1';
const CHANGE_ID = 'change-1';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockChange(overrides?: Partial<ItsmChange>): ItsmChange {
  const change = new ItsmChange();
  change.id = CHANGE_ID;
  change.tenantId = TENANT_ID;
  change.number = 'CHG0001';
  change.title = 'Test change';
  change.description = 'A test change';
  change.type = ChangeType.NORMAL;
  change.state = ChangeState.ASSESS;
  change.risk = ChangeRisk.MEDIUM;
  change.approvalStatus = ChangeApprovalStatus.NOT_REQUESTED;
  change.serviceId = 'service-1';
  change.offeringId = null;
  change.implementationPlan = 'Implementation plan here';
  change.backoutPlan = 'Backout plan here';
  change.plannedStartAt = new Date('2026-03-01T10:00:00Z');
  change.plannedEndAt = new Date('2026-03-01T12:00:00Z');
  change.actualStartAt = null;
  change.actualEndAt = null;
  change.justification = null;
  change.metadata = null;
  Object.assign(change, overrides);
  return change;
}

function createMockGovernanceResult(
  overrides?: Partial<TopologyGovernanceEvaluationResponse>,
): TopologyGovernanceEvaluationResponse {
  return {
    changeId: CHANGE_ID,
    decision: 'ALLOWED',
    policyFlags: {
      topologyRiskScore: 25,
      topologyHighBlastRadius: false,
      topologyFragilitySignalsCount: 0,
      topologyCriticalDependencyTouched: false,
      topologySinglePointOfFailureRisk: false,
    },
    recommendedActions: [
      {
        key: 'implementationPlan',
        label: 'Implementation Plan',
        required: false,
        satisfied: true,
        reason: 'Recommended for change traceability',
      },
    ],
    explainability: {
      summary: 'Change is allowed. Topology analysis indicates acceptable risk level.',
      factors: [
        {
          key: 'topologyRiskScore',
          label: 'Topology Risk Score',
          value: 25,
          severity: 'info',
          explanation: 'Topology analysis computed a risk score of 25/100',
        },
      ],
      topDependencyPaths: [],
      matchedPolicyNames: [],
    },
    topologyDataAvailable: true,
    evaluatedAt: '2026-02-22T10:00:00.000Z',
    warnings: [],
    ...overrides,
  };
}

function createHighRiskGovernanceResult(): TopologyGovernanceEvaluationResponse {
  return createMockGovernanceResult({
    decision: 'CAB_REQUIRED',
    policyFlags: {
      topologyRiskScore: 72,
      topologyHighBlastRadius: true,
      topologyFragilitySignalsCount: 2,
      topologyCriticalDependencyTouched: true,
      topologySinglePointOfFailureRisk: false,
    },
    recommendedActions: [
      {
        key: 'implementationPlan',
        label: 'Implementation Plan',
        required: true,
        satisfied: true,
        reason: 'Required due to topology risk level or policy rule',
      },
      {
        key: 'backoutPlan',
        label: 'Backout Plan',
        required: true,
        satisfied: false,
        reason: 'Required due to topology risk level or policy rule',
      },
      {
        key: 'cabApproval',
        label: 'CAB Approval',
        required: true,
        satisfied: false,
        reason: 'Required by policy or topology risk assessment',
      },
    ],
    explainability: {
      summary: 'CAB approval required. Key factors: Topology Risk Score, Blast Radius, Critical Dependency Touched.',
      factors: [
        {
          key: 'topologyRiskScore',
          label: 'Topology Risk Score',
          value: 72,
          severity: 'critical',
          explanation: 'Topology analysis computed a risk score of 72/100',
        },
        {
          key: 'blastRadius',
          label: 'Blast Radius',
          value: 15,
          severity: 'critical',
          explanation: '15 nodes impacted across 3 service(s)',
        },
        {
          key: 'criticalDependency',
          label: 'Critical Dependency Touched',
          value: true,
          severity: 'critical',
          explanation: '2 critical CI(s) are in the blast radius',
        },
        {
          key: 'fragilitySignals',
          label: 'Fragility Signals',
          value: 2,
          severity: 'warning',
          explanation: '2 fragility signal(s) detected (SPOF, no redundancy, high fan-out, deep chains)',
        },
        {
          key: 'crossServicePropagation',
          label: 'Cross-Service Propagation',
          value: 3,
          severity: 'warning',
          explanation: 'Impact propagates across 3 service boundaries',
        },
      ],
      topDependencyPaths: [
        { nodeLabels: ['Service A', 'CI-1', 'CI-2'], depth: 2 },
      ],
      matchedPolicyNames: ['HighRiskPolicy'],
    },
    topologyDataAvailable: true,
    evaluatedAt: '2026-02-22T10:00:00.000Z',
    warnings: [],
  });
}

function createBlockedGovernanceResult(): TopologyGovernanceEvaluationResponse {
  return createMockGovernanceResult({
    decision: 'BLOCKED',
    policyFlags: {
      topologyRiskScore: 90,
      topologyHighBlastRadius: true,
      topologyFragilitySignalsCount: 3,
      topologyCriticalDependencyTouched: true,
      topologySinglePointOfFailureRisk: true,
    },
    recommendedActions: [],
    explainability: {
      summary: 'Change is blocked. Critical factors: SPOF, freeze conflict.',
      factors: [
        {
          key: 'topologyRiskScore',
          label: 'Topology Risk Score',
          value: 90,
          severity: 'critical',
          explanation: 'Topology analysis computed a risk score of 90/100',
        },
        {
          key: 'singlePointOfFailure',
          label: 'Single Point of Failure Risk',
          value: true,
          severity: 'critical',
          explanation: 'A single point of failure was detected in the dependency graph',
        },
        {
          key: 'freezeConflict',
          label: 'Freeze Window Conflict',
          value: true,
          severity: 'critical',
          explanation: 'Change overlaps with an active freeze window',
        },
      ],
      topDependencyPaths: [],
      matchedPolicyNames: ['FreezePolicy'],
    },
    topologyDataAvailable: true,
    evaluatedAt: '2026-02-22T10:00:00.000Z',
    warnings: [],
  });
}

// ============================================================================
// Mock Services
// ============================================================================

function createMockGovernanceService(
  result?: TopologyGovernanceEvaluationResponse,
) {
  return {
    evaluateGovernance: jest.fn().mockResolvedValue(
      result ?? createMockGovernanceResult(),
    ),
    computePolicyFlags: jest.fn(),
  };
}

function createMockRiskScoringService(assessment?: unknown) {
  return {
    getAssessment: jest.fn().mockResolvedValue(assessment ?? null),
  };
}

function createMockCustomerRiskImpactService(impact?: unknown) {
  return {
    evaluateForChange: jest.fn().mockResolvedValue(impact ?? null),
  };
}

function createMockEventBusService() {
  return {
    emit: jest.fn().mockResolvedValue({ id: 'event-1' }),
  };
}

function createMockJournalService() {
  return {
    createJournalEntry: jest.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('TopologyGuardrailService', () => {
  // ==========================================================================
  // Decision → Guardrail Status Mapping
  // ==========================================================================

  describe('mapDecisionToGuardrailStatus', () => {
    let service: TopologyGuardrailService;

    beforeEach(() => {
      service = new TopologyGuardrailService();
    });

    it('should map ALLOWED → PASS', () => {
      expect(service.mapDecisionToGuardrailStatus('ALLOWED')).toBe('PASS');
    });

    it('should map CAB_REQUIRED → WARN', () => {
      expect(service.mapDecisionToGuardrailStatus('CAB_REQUIRED')).toBe('WARN');
    });

    it('should map ADDITIONAL_EVIDENCE_REQUIRED → WARN', () => {
      expect(
        service.mapDecisionToGuardrailStatus('ADDITIONAL_EVIDENCE_REQUIRED'),
      ).toBe('WARN');
    });

    it('should map BLOCKED → BLOCK', () => {
      expect(service.mapDecisionToGuardrailStatus('BLOCKED')).toBe('BLOCK');
    });

    it('should be deterministic across multiple calls', () => {
      const decisions: TopologyGovernanceDecision[] = [
        'ALLOWED',
        'CAB_REQUIRED',
        'BLOCKED',
        'ADDITIONAL_EVIDENCE_REQUIRED',
      ];
      for (const decision of decisions) {
        const r1 = service.mapDecisionToGuardrailStatus(decision);
        const r2 = service.mapDecisionToGuardrailStatus(decision);
        const r3 = service.mapDecisionToGuardrailStatus(decision);
        expect(r1).toBe(r2);
        expect(r2).toBe(r3);
      }
    });

    it('should have all governance decisions covered in the map', () => {
      const allDecisions: TopologyGovernanceDecision[] = [
        'ALLOWED',
        'CAB_REQUIRED',
        'BLOCKED',
        'ADDITIONAL_EVIDENCE_REQUIRED',
      ];
      for (const d of allDecisions) {
        expect(GOVERNANCE_TO_GUARDRAIL_MAP[d]).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Reason Building
  // ==========================================================================

  describe('buildReasons', () => {
    let service: TopologyGuardrailService;

    beforeEach(() => {
      service = new TopologyGuardrailService();
    });

    it('should build reasons from governance factors (ALLOWED case)', () => {
      const governance = createMockGovernanceResult();
      const reasons = service.buildReasons(governance);

      // Should have at least the topologyRiskScore factor
      expect(reasons.length).toBeGreaterThanOrEqual(1);
      expect(reasons.some((r) => r.code === 'TOPOLOGY_RISK_SCORE')).toBe(true);
    });

    it('should include GOVERNANCE_BLOCKED reason for BLOCKED decision', () => {
      const governance = createBlockedGovernanceResult();
      const reasons = service.buildReasons(governance);

      expect(reasons.some((r) => r.code === 'GOVERNANCE_BLOCKED')).toBe(true);
      expect(
        reasons.find((r) => r.code === 'GOVERNANCE_BLOCKED')?.severity,
      ).toBe('critical');
    });

    it('should include CAB_APPROVAL_REQUIRED reason for CAB_REQUIRED decision', () => {
      const governance = createHighRiskGovernanceResult();
      const reasons = service.buildReasons(governance);

      expect(
        reasons.some((r) => r.code === 'CAB_APPROVAL_REQUIRED'),
      ).toBe(true);
    });

    it('should include ADDITIONAL_EVIDENCE_NEEDED for ADDITIONAL_EVIDENCE_REQUIRED decision', () => {
      const governance = createMockGovernanceResult({
        decision: 'ADDITIONAL_EVIDENCE_REQUIRED',
        explainability: {
          summary: 'Additional evidence required.',
          factors: [],
          topDependencyPaths: [],
          matchedPolicyNames: [],
        },
      });
      const reasons = service.buildReasons(governance);

      expect(
        reasons.some((r) => r.code === 'ADDITIONAL_EVIDENCE_NEEDED'),
      ).toBe(true);
    });

    it('should include MISSING_ reasons for unsatisfied required actions', () => {
      const governance = createHighRiskGovernanceResult();
      const reasons = service.buildReasons(governance);

      // backoutPlan is required but not satisfied
      expect(
        reasons.some((r) => r.code === 'MISSING_BACKOUTPLAN'),
      ).toBe(true);
      // cabApproval is required but not satisfied
      expect(
        reasons.some((r) => r.code === 'MISSING_CABAPPROVAL'),
      ).toBe(true);
    });

    it('should NOT include MISSING_ reasons for satisfied required actions', () => {
      const governance = createHighRiskGovernanceResult();
      const reasons = service.buildReasons(governance);

      // implementationPlan is required AND satisfied
      expect(
        reasons.some((r) => r.code === 'MISSING_IMPLEMENTATIONPLAN'),
      ).toBe(false);
    });

    it('should map factor keys to proper reason codes', () => {
      const governance = createHighRiskGovernanceResult();
      const reasons = service.buildReasons(governance);

      expect(reasons.some((r) => r.code === 'HIGH_BLAST_RADIUS')).toBe(true);
      expect(
        reasons.some((r) => r.code === 'CRITICAL_DEPENDENCY_TOUCHED'),
      ).toBe(true);
      expect(
        reasons.some((r) => r.code === 'CROSS_SERVICE_PROPAGATION'),
      ).toBe(true);
    });

    it('should preserve factor severity in reasons', () => {
      const governance = createHighRiskGovernanceResult();
      const reasons = service.buildReasons(governance);

      const riskScoreReason = reasons.find(
        (r) => r.code === 'TOPOLOGY_RISK_SCORE',
      );
      expect(riskScoreReason?.severity).toBe('critical');
    });
  });

  // ==========================================================================
  // Evidence Summary Building
  // ==========================================================================

  describe('buildEvidenceSummary', () => {
    let service: TopologyGuardrailService;

    beforeEach(() => {
      service = new TopologyGuardrailService();
    });

    it('should build evidence summary for ALLOWED (low risk)', () => {
      const governance = createMockGovernanceResult();
      const summary = service.buildEvidenceSummary(governance);

      expect(summary.topologyRiskScore).toBe(25);
      expect(summary.topologyDataAvailable).toBe(true);
      expect(summary.singlePointsOfFailure).toHaveLength(0);
      expect(summary.fragileDependencies).toHaveLength(0);
    });

    it('should build evidence summary with blast radius metrics', () => {
      const governance = createHighRiskGovernanceResult();
      const summary = service.buildEvidenceSummary(governance);

      expect(summary.blastRadiusMetrics.totalImpactedNodes).toBe(15);
      expect(summary.blastRadiusMetrics.crossServicePropagation).toBe(true);
      expect(summary.blastRadiusMetrics.impactedServiceCount).toBe(3);
      expect(summary.topologyRiskScore).toBe(72);
    });

    it('should include SPOF in singlePointsOfFailure', () => {
      const governance = createBlockedGovernanceResult();
      const summary = service.buildEvidenceSummary(governance);

      expect(summary.singlePointsOfFailure.length).toBeGreaterThan(0);
    });

    it('should include fragility signals in fragileDependencies', () => {
      const governance = createHighRiskGovernanceResult();
      const summary = service.buildEvidenceSummary(governance);

      expect(summary.fragileDependencies.length).toBeGreaterThanOrEqual(1);
    });

    it('should set topologyDataAvailable from governance', () => {
      const noDataGovernance = createMockGovernanceResult({
        topologyDataAvailable: false,
      });
      const summary = service.buildEvidenceSummary(noDataGovernance);

      expect(summary.topologyDataAvailable).toBe(false);
    });
  });

  // ==========================================================================
  // Full Guardrail Evaluation (with mocked dependencies)
  // ==========================================================================

  describe('evaluateGuardrails', () => {
    it('should return PASS for ALLOWED governance result', async () => {
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );

      expect(result.guardrailStatus).toBe('PASS');
      expect(result.governanceDecision).toBe('ALLOWED');
      expect(result.changeId).toBe(CHANGE_ID);
      expect(result.evaluatedBy).toBe(USER_ID);
      expect(result.previousEvaluation).toBeNull();
    });

    it('should return WARN for CAB_REQUIRED governance result', async () => {
      const mockGovernance = createMockGovernanceService(
        createHighRiskGovernanceResult(),
      );
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );

      expect(result.guardrailStatus).toBe('WARN');
      expect(result.governanceDecision).toBe('CAB_REQUIRED');
    });

    it('should return BLOCK for BLOCKED governance result', async () => {
      const mockGovernance = createMockGovernanceService(
        createBlockedGovernanceResult(),
      );
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );

      expect(result.guardrailStatus).toBe('BLOCK');
      expect(result.governanceDecision).toBe('BLOCKED');
    });

    it('should include reasons and evidence summary', async () => {
      const mockGovernance = createMockGovernanceService(
        createHighRiskGovernanceResult(),
      );
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );

      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.evidenceSummary).toBeDefined();
      expect(result.evidenceSummary.topologyRiskScore).toBe(72);
    });

    it('should pass previous evaluation context', async () => {
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const previousEvaluation: GuardrailPreviousEvaluation = {
        guardrailStatus: 'BLOCK',
        governanceDecision: 'BLOCKED',
        topologyRiskScore: 90,
        evaluatedAt: '2026-02-22T09:00:00.000Z',
      };

      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
        previousEvaluation,
      );

      expect(result.previousEvaluation).toEqual(previousEvaluation);
    });

    it('should set evaluatedAt and evaluatedBy', async () => {
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );

      expect(result.evaluatedAt).toBeDefined();
      expect(new Date(result.evaluatedAt).getTime()).not.toBeNaN();
      expect(result.evaluatedBy).toBe(USER_ID);
    });
  });

  // ==========================================================================
  // Fail-Open Behavior
  // ==========================================================================

  describe('fail-open behavior', () => {
    it('should return PASS when governance service is unavailable', async () => {
      // No governance service provided
      const service = new TopologyGuardrailService(
        undefined,
        undefined,
        undefined,
        undefined,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );

      expect(result.guardrailStatus).toBe('PASS');
      expect(result.governanceDecision).toBe('ALLOWED');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some((w) =>
          w.includes('governance service not configured'),
        ),
      ).toBe(true);
    });

    it('should add warnings when risk assessment fails', async () => {
      const mockGovernance = createMockGovernanceService();
      const mockRisk = {
        getAssessment: jest.fn().mockRejectedValue(new Error('DB timeout')),
      };
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        mockRisk as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );

      expect(result.guardrailStatus).toBe('PASS');
      expect(
        result.warnings.some((w) => w.includes('Risk assessment unavailable')),
      ).toBe(true);
    });

    it('should add warnings when customer risk impact fails', async () => {
      const mockGovernance = createMockGovernanceService();
      const mockCustomerRisk = {
        evaluateForChange: jest
          .fn()
          .mockRejectedValue(new Error('Service unavailable')),
      };
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        mockCustomerRisk as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );

      expect(result.guardrailStatus).toBe('PASS');
      expect(
        result.warnings.some((w) =>
          w.includes('Customer risk impact unavailable'),
        ),
      ).toBe(true);
    });

    it('should still succeed even when all optional services are unavailable', async () => {
      const service = new TopologyGuardrailService();

      const change = createMockChange();
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );

      expect(result.guardrailStatus).toBe('PASS');
      expect(result.changeId).toBe(CHANGE_ID);
    });
  });

  // ==========================================================================
  // Event Bus Integration
  // ==========================================================================

  describe('event bus integration', () => {
    it('should emit evaluated event on first evaluation', async () => {
      const mockEventBus = createMockEventBusService();
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        mockEventBus as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      await service.evaluateGuardrails(TENANT_ID, USER_ID, change);

      // Wait for non-blocking event emission
      await new Promise((r) => setTimeout(r, 50));

      expect(mockEventBus.emit).toHaveBeenCalled();
      const firstCall = mockEventBus.emit.mock.calls[0][0];
      expect(firstCall.eventName).toBe('topology_guardrail.evaluated');
      expect(firstCall.tenantId).toBe(TENANT_ID);
      expect(firstCall.recordId).toBe(CHANGE_ID);
      expect(firstCall.actorId).toBe(USER_ID);
    });

    it('should emit recalculated event when previous evaluation exists', async () => {
      const mockEventBus = createMockEventBusService();
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        mockEventBus as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const previousEvaluation: GuardrailPreviousEvaluation = {
        guardrailStatus: 'PASS',
        governanceDecision: 'ALLOWED',
        topologyRiskScore: 25,
        evaluatedAt: '2026-02-22T09:00:00.000Z',
      };

      await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
        previousEvaluation,
      );

      await new Promise((r) => setTimeout(r, 50));

      const firstCall = mockEventBus.emit.mock.calls[0][0];
      expect(firstCall.eventName).toBe('topology_guardrail.recalculated');
    });

    it('should emit blocked event when guardrail status is BLOCK', async () => {
      const mockEventBus = createMockEventBusService();
      const mockGovernance = createMockGovernanceService(
        createBlockedGovernanceResult(),
      );
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        mockEventBus as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      await service.evaluateGuardrails(TENANT_ID, USER_ID, change);

      await new Promise((r) => setTimeout(r, 50));

      // Should have at least 2 calls: evaluated + blocked
      expect(mockEventBus.emit.mock.calls.length).toBeGreaterThanOrEqual(2);
      const blockedCall = mockEventBus.emit.mock.calls.find(
        (c: Array<{ eventName: string }>) =>
          c[0].eventName === 'topology_guardrail.blocked',
      );
      expect(blockedCall).toBeDefined();
    });

    it('should emit status_changed event when status differs from previous', async () => {
      const mockEventBus = createMockEventBusService();
      const mockGovernance = createMockGovernanceService(); // returns ALLOWED → PASS
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        mockEventBus as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const previousEvaluation: GuardrailPreviousEvaluation = {
        guardrailStatus: 'BLOCK', // was BLOCK, now PASS
        governanceDecision: 'BLOCKED',
        topologyRiskScore: 90,
        evaluatedAt: '2026-02-22T09:00:00.000Z',
      };

      await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
        previousEvaluation,
      );

      await new Promise((r) => setTimeout(r, 50));

      const statusChangedCall = mockEventBus.emit.mock.calls.find(
        (c: Array<{ eventName: string }>) =>
          c[0].eventName === 'topology_guardrail.status_changed',
      );
      expect(statusChangedCall).toBeDefined();
      expect(statusChangedCall[0].payload.previousStatus).toBe('BLOCK');
    });

    it('should NOT emit status_changed when status is the same', async () => {
      const mockEventBus = createMockEventBusService();
      const mockGovernance = createMockGovernanceService(); // returns ALLOWED → PASS
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        mockEventBus as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      const previousEvaluation: GuardrailPreviousEvaluation = {
        guardrailStatus: 'PASS', // same as current
        governanceDecision: 'ALLOWED',
        topologyRiskScore: 25,
        evaluatedAt: '2026-02-22T09:00:00.000Z',
      };

      await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
        previousEvaluation,
      );

      await new Promise((r) => setTimeout(r, 50));

      const statusChangedCall = mockEventBus.emit.mock.calls.find(
        (c: Array<{ eventName: string }>) =>
          c[0].eventName === 'topology_guardrail.status_changed',
      );
      expect(statusChangedCall).toBeUndefined();
    });

    it('should not fail if event bus service is unavailable', async () => {
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        undefined, // no event bus
        createMockJournalService() as never,
      );

      const change = createMockChange();
      // Should not throw
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );
      expect(result.guardrailStatus).toBe('PASS');
    });
  });

  // ==========================================================================
  // Audit Trail (Journal)
  // ==========================================================================

  describe('audit trail', () => {
    it('should write journal entry on evaluation', async () => {
      const mockJournal = createMockJournalService();
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        mockJournal as never,
      );

      const change = createMockChange();
      await service.evaluateGuardrails(TENANT_ID, USER_ID, change);

      // Wait for non-blocking journal write
      await new Promise((r) => setTimeout(r, 50));

      expect(mockJournal.createJournalEntry).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'changes',
        CHANGE_ID,
        expect.objectContaining({
          message: expect.stringContaining('[Topology Guardrail]'),
        }),
      );
    });

    it('should include status change in journal when previous evaluation differs', async () => {
      const mockJournal = createMockJournalService();
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        mockJournal as never,
      );

      const change = createMockChange();
      const previousEvaluation: GuardrailPreviousEvaluation = {
        guardrailStatus: 'BLOCK',
        governanceDecision: 'BLOCKED',
        topologyRiskScore: 90,
        evaluatedAt: '2026-02-22T09:00:00.000Z',
      };

      await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
        previousEvaluation,
      );

      await new Promise((r) => setTimeout(r, 50));

      const journalCall = mockJournal.createJournalEntry.mock.calls[0];
      const message = journalCall[4].message;
      expect(message).toContain('Status changed: BLOCK -> PASS');
    });

    it('should not fail if journal service is unavailable', async () => {
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        undefined, // no journal
      );

      const change = createMockChange();
      // Should not throw
      const result = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );
      expect(result.guardrailStatus).toBe('PASS');
    });
  });

  // ==========================================================================
  // Tenant Isolation
  // ==========================================================================

  describe('tenant isolation', () => {
    it('should pass tenantId to governance service', async () => {
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      await service.evaluateGuardrails(TENANT_ID, USER_ID, change);

      expect(mockGovernance.evaluateGovernance).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        change,
        null,
        null,
      );
    });

    it('should pass tenantId to risk scoring service', async () => {
      const mockRisk = createMockRiskScoringService();
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        mockRisk as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      await service.evaluateGuardrails(TENANT_ID, USER_ID, change);

      expect(mockRisk.getAssessment).toHaveBeenCalledWith(
        TENANT_ID,
        CHANGE_ID,
      );
    });

    it('should pass tenantId to event bus', async () => {
      const mockEventBus = createMockEventBusService();
      const mockGovernance = createMockGovernanceService();
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        mockEventBus as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();
      await service.evaluateGuardrails(TENANT_ID, USER_ID, change);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_ID }),
      );
    });
  });

  // ==========================================================================
  // Determinism
  // ==========================================================================

  describe('determinism', () => {
    it('should produce identical guardrail status for identical inputs', async () => {
      const governanceResult = createHighRiskGovernanceResult();
      const mockGovernance = createMockGovernanceService(governanceResult);
      const service = new TopologyGuardrailService(
        mockGovernance as never,
        undefined,
        createMockRiskScoringService() as never,
        createMockCustomerRiskImpactService() as never,
        createMockEventBusService() as never,
        createMockJournalService() as never,
      );

      const change = createMockChange();

      const r1 = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );
      const r2 = await service.evaluateGuardrails(
        TENANT_ID,
        USER_ID,
        change,
      );

      expect(r1.guardrailStatus).toBe(r2.guardrailStatus);
      expect(r1.governanceDecision).toBe(r2.governanceDecision);
      expect(r1.reasons.length).toBe(r2.reasons.length);
    });

    it('should produce same reasons for same governance input', () => {
      const service = new TopologyGuardrailService();
      const governance = createHighRiskGovernanceResult();

      const reasons1 = service.buildReasons(governance);
      const reasons2 = service.buildReasons(governance);

      expect(reasons1.map((r) => r.code)).toEqual(
        reasons2.map((r) => r.code),
      );
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle governance with no factors', () => {
      const service = new TopologyGuardrailService();
      const governance = createMockGovernanceResult({
        explainability: {
          summary: 'No data available.',
          factors: [],
          topDependencyPaths: [],
          matchedPolicyNames: [],
        },
      });

      const reasons = service.buildReasons(governance);
      // Should not crash, may have zero or minimal reasons
      expect(Array.isArray(reasons)).toBe(true);
    });

    it('should handle governance with no recommended actions', () => {
      const service = new TopologyGuardrailService();
      const governance = createMockGovernanceResult({
        recommendedActions: [],
      });

      const reasons = service.buildReasons(governance);
      // No MISSING_ reasons should appear
      const missingReasons = reasons.filter((r) =>
        r.code.startsWith('MISSING_'),
      );
      expect(missingReasons).toHaveLength(0);
    });

    it('should handle governance with empty warnings', () => {
      const service = new TopologyGuardrailService();
      const governance = createMockGovernanceResult({
        warnings: [],
      });

      const summary = service.buildEvidenceSummary(governance);
      expect(summary).toBeDefined();
    });

    it('should handle topology data unavailable', () => {
      const service = new TopologyGuardrailService();
      const governance = createMockGovernanceResult({
        topologyDataAvailable: false,
        policyFlags: {
          topologyRiskScore: 0,
          topologyHighBlastRadius: false,
          topologyFragilitySignalsCount: 0,
          topologyCriticalDependencyTouched: false,
          topologySinglePointOfFailureRisk: false,
        },
        explainability: {
          summary: 'No topology data.',
          factors: [],
          topDependencyPaths: [],
          matchedPolicyNames: [],
        },
      });

      const summary = service.buildEvidenceSummary(governance);
      expect(summary.topologyDataAvailable).toBe(false);
      expect(summary.topologyRiskScore).toBe(0);
    });

    it('should handle unknown factor keys gracefully', () => {
      const service = new TopologyGuardrailService();
      const governance = createMockGovernanceResult({
        explainability: {
          summary: 'Test',
          factors: [
            {
              key: 'some_unknown_factor',
              label: 'Unknown Factor',
              value: 42,
              severity: 'warning',
              explanation: 'Some explanation',
            },
          ],
          topDependencyPaths: [],
          matchedPolicyNames: [],
        },
      });

      const reasons = service.buildReasons(governance);
      // Should use uppercased key as fallback
      expect(
        reasons.some((r) => r.code === 'SOME_UNKNOWN_FACTOR'),
      ).toBe(true);
    });
  });
});
