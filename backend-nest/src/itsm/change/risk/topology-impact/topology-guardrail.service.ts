/**
 * TopologyGuardrailService
 *
 * Wraps topology governance evaluation into a simplified PASS/WARN/BLOCK
 * guardrail framework with evidence summaries, event bus integration,
 * and audit trail support.
 *
 * Phase A: Topology Guardrails Backend
 *
 * Design principles:
 * - Deterministic: guardrail status is a pure function of governance decision
 * - Fail-open: if topology data unavailable, returns PASS with warnings
 * - Explainable: every reason is machine-readable + human-readable
 * - Auditable: event bus + journal entries for every evaluation
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { TopologyGovernanceService } from './topology-governance.service';
import { ChangeService } from '../../change.service';
import { RiskScoringService } from '../risk-scoring.service';
import {
  CustomerRiskImpactService,
  CustomerRiskImpactResult,
} from '../customer-risk-impact.service';
import { EventBusService } from '../../../../event-bus/event-bus.service';
import { JournalService } from '../../../journal/journal.service';
import { JournalType } from '../../../journal/journal.entity';
import { ItsmChange } from '../../change.entity';
import { RiskAssessment } from '../risk-assessment.entity';
import {
  TopologyGovernanceEvaluationResponse,
  TopologyGovernanceDecision,
} from './dto/topology-governance.dto';
import {
  TopologyGuardrailEvaluationResponse,
  GuardrailStatus,
  GuardrailReason,
  GuardrailEvidenceSummary,
  GuardrailPreviousEvaluation,
  GOVERNANCE_TO_GUARDRAIL_MAP,
} from './dto/topology-guardrail.dto';

/** Maximum journal message length */
const JOURNAL_MESSAGE_CAP = 2000;

/** Event source identifier for guardrail events */
const EVENT_SOURCE = 'topology-guardrail';

/** Event names */
const EVENT_GUARDRAIL_EVALUATED = 'topology_guardrail.evaluated';
const EVENT_GUARDRAIL_RECALCULATED = 'topology_guardrail.recalculated';
const EVENT_GUARDRAIL_BLOCKED = 'topology_guardrail.blocked';
const EVENT_GUARDRAIL_STATUS_CHANGED = 'topology_guardrail.status_changed';

@Injectable()
export class TopologyGuardrailService {
  private readonly logger = new Logger(TopologyGuardrailService.name);

  constructor(
    @Optional()
    private readonly topologyGovernanceService?: TopologyGovernanceService,
    @Optional()
    private readonly changeService?: ChangeService,
    @Optional()
    private readonly riskScoringService?: RiskScoringService,
    @Optional()
    private readonly customerRiskImpactService?: CustomerRiskImpactService,
    @Optional()
    private readonly eventBusService?: EventBusService,
    @Optional()
    private readonly journalService?: JournalService,
  ) {}

  /**
   * Evaluate topology guardrails for a change.
   *
   * This is the main entry point. Orchestrates:
   * 1. Fetch change record
   * 2. Fetch risk assessment (fail-open)
   * 3. Fetch customer risk impact (fail-open)
   * 4. Run governance evaluation
   * 5. Map to guardrail status
   * 6. Build evidence summary + reasons
   * 7. Publish events + audit trail
   */
  async evaluateGuardrails(
    tenantId: string,
    userId: string,
    change: ItsmChange,
    previousEvaluation?: GuardrailPreviousEvaluation | null,
  ): Promise<TopologyGuardrailEvaluationResponse> {
    const warnings: string[] = [];

    // Step 1: Fetch risk assessment (fail-open)
    let assessment: RiskAssessment | null = null;
    if (this.riskScoringService) {
      try {
        assessment = await this.riskScoringService.getAssessment(
          tenantId,
          change.id,
        );
      } catch (err) {
        this.logger.warn(
          `Risk assessment fetch failed for change ${change.id}: ${String(err)}`,
        );
        warnings.push(
          'Risk assessment unavailable. Guardrail evaluated without risk context.',
        );
      }
    }

    // Step 2: Fetch customer risk impact (fail-open)
    let customerRiskImpact: CustomerRiskImpactResult | null = null;
    if (this.customerRiskImpactService) {
      try {
        customerRiskImpact =
          await this.customerRiskImpactService.evaluateForChange(
            tenantId,
            change,
          );
      } catch (err) {
        this.logger.warn(
          `Customer risk impact fetch failed for change ${change.id}: ${String(err)}`,
        );
        warnings.push(
          'Customer risk impact unavailable. Guardrail evaluated without customer risk context.',
        );
      }
    }

    // Step 3: Run governance evaluation
    let governanceResult: TopologyGovernanceEvaluationResponse;
    if (this.topologyGovernanceService) {
      governanceResult =
        await this.topologyGovernanceService.evaluateGovernance(
          tenantId,
          userId,
          change,
          assessment,
          customerRiskImpact,
        );
    } else {
      // Fail-open: return PASS with warning
      warnings.push(
        'Topology governance service not configured. Guardrail defaults to PASS.',
      );
      governanceResult = this.buildFailOpenGovernanceResult(change.id);
    }

    // Merge governance warnings
    if (governanceResult.warnings.length > 0) {
      warnings.push(...governanceResult.warnings);
    }

    // Step 4: Map governance decision → guardrail status
    const guardrailStatus = this.mapDecisionToGuardrailStatus(
      governanceResult.decision,
    );

    // Step 5: Build reasons from governance factors
    const reasons = this.buildReasons(governanceResult);

    // Step 6: Build evidence summary
    const evidenceSummary = this.buildEvidenceSummary(governanceResult);

    const result: TopologyGuardrailEvaluationResponse = {
      changeId: change.id,
      guardrailStatus,
      governanceDecision: governanceResult.decision,
      reasons,
      recommendedActions: governanceResult.recommendedActions,
      evidenceSummary,
      policyFlags: governanceResult.policyFlags,
      explainability: governanceResult.explainability,
      evaluatedAt: new Date().toISOString(),
      evaluatedBy: userId,
      previousEvaluation: previousEvaluation ?? null,
      warnings,
    };

    // Step 7: Publish events + audit trail (non-blocking)
    this.publishGuardrailEvents(
      tenantId,
      userId,
      change.id,
      result,
      previousEvaluation ?? null,
    ).catch((err) => {
      this.logger.warn(
        `Failed to publish guardrail events for change ${change.id}: ${String(err)}`,
      );
    });

    this.writeGuardrailJournalEntry(
      tenantId,
      userId,
      change.id,
      result,
      previousEvaluation ?? null,
    ).catch((err) => {
      this.logger.warn(
        `Failed to write guardrail journal entry for change ${change.id}: ${String(err)}`,
      );
    });

    return result;
  }

  /**
   * Map governance decision to guardrail status.
   * Deterministic, pure function.
   */
  mapDecisionToGuardrailStatus(
    decision: TopologyGovernanceDecision,
  ): GuardrailStatus {
    return GOVERNANCE_TO_GUARDRAIL_MAP[decision] ?? 'PASS';
  }

  /**
   * Build machine-readable + human-readable reasons from governance evaluation.
   */
  buildReasons(
    governance: TopologyGovernanceEvaluationResponse,
  ): GuardrailReason[] {
    const reasons: GuardrailReason[] = [];

    // Map factors to reasons
    for (const factor of governance.explainability.factors) {
      reasons.push({
        code: this.factorKeyToReasonCode(factor.key),
        severity: factor.severity,
        message: factor.explanation,
      });
    }

    // Add decision-level reason
    if (governance.decision === 'BLOCKED') {
      reasons.push({
        code: 'GOVERNANCE_BLOCKED',
        severity: 'critical',
        message: governance.explainability.summary,
      });
    } else if (governance.decision === 'CAB_REQUIRED') {
      reasons.push({
        code: 'CAB_APPROVAL_REQUIRED',
        severity: 'warning',
        message: governance.explainability.summary,
      });
    } else if (governance.decision === 'ADDITIONAL_EVIDENCE_REQUIRED') {
      reasons.push({
        code: 'ADDITIONAL_EVIDENCE_NEEDED',
        severity: 'warning',
        message: governance.explainability.summary,
      });
    }

    // Add unsatisfied required action reasons
    for (const action of governance.recommendedActions) {
      if (action.required && !action.satisfied) {
        reasons.push({
          code: `MISSING_${action.key.toUpperCase()}`,
          severity: 'warning',
          message: `Required action not satisfied: ${action.label}. ${action.reason}`,
        });
      }
    }

    return reasons;
  }

  /**
   * Build a structured evidence summary from governance evaluation.
   */
  buildEvidenceSummary(
    governance: TopologyGovernanceEvaluationResponse,
  ): GuardrailEvidenceSummary {
    // Extract fragile dependencies from factors
    const fragileDependencies: GuardrailEvidenceSummary['fragileDependencies'] =
      [];

    // Look at factors for fragility-related data
    const fragilityFactor = governance.explainability.factors.find(
      (f) => f.key === 'fragilitySignals',
    );
    if (fragilityFactor) {
      fragileDependencies.push({
        type: 'fragility_signals',
        description: fragilityFactor.explanation,
        affectedNodeLabel: 'Multiple nodes',
      });
    }

    const spofFactor = governance.explainability.factors.find(
      (f) => f.key === 'singlePointOfFailure',
    );

    // Extract single points of failure
    const singlePointsOfFailure: string[] = [];
    if (spofFactor) {
      singlePointsOfFailure.push('Detected in dependency graph');
    }

    // Extract blast radius metrics from factors
    const blastRadiusFactor = governance.explainability.factors.find(
      (f) => f.key === 'blastRadius',
    );
    const crossServiceFactor = governance.explainability.factors.find(
      (f) => f.key === 'crossServicePropagation',
    );

    return {
      blastRadiusMetrics: {
        totalImpactedNodes:
          typeof blastRadiusFactor?.value === 'number'
            ? blastRadiusFactor.value
            : 0,
        criticalCiCount: governance.policyFlags
          .topologyCriticalDependencyTouched
          ? 1
          : 0,
        impactedServiceCount:
          typeof crossServiceFactor?.value === 'number'
            ? crossServiceFactor.value
            : 0,
        maxChainDepth: 0, // Not directly available from factors
        crossServicePropagation: !!crossServiceFactor,
      },
      fragileDependencies,
      singlePointsOfFailure,
      topologyRiskScore: governance.policyFlags.topologyRiskScore,
      topologyDataAvailable: governance.topologyDataAvailable,
    };
  }

  // ==========================================================================
  // Event Bus Integration
  // ==========================================================================

  /**
   * Publish guardrail events to the event bus.
   * Non-blocking: errors are caught by the caller.
   */
  private async publishGuardrailEvents(
    tenantId: string,
    userId: string,
    changeId: string,
    result: TopologyGuardrailEvaluationResponse,
    previousEvaluation: GuardrailPreviousEvaluation | null,
  ): Promise<void> {
    if (!this.eventBusService) return;

    const basePayload = {
      changeId,
      guardrailStatus: result.guardrailStatus,
      governanceDecision: result.governanceDecision,
      topologyRiskScore: result.policyFlags.topologyRiskScore,
      evaluatedAt: result.evaluatedAt,
    };

    // Always emit evaluated event
    const eventName = previousEvaluation
      ? EVENT_GUARDRAIL_RECALCULATED
      : EVENT_GUARDRAIL_EVALUATED;

    await this.eventBusService.emit({
      tenantId,
      source: EVENT_SOURCE,
      eventName,
      tableName: 'itsm_changes',
      recordId: changeId,
      payload: basePayload,
      actorId: userId,
    });

    // Emit blocked event if status is BLOCK
    if (result.guardrailStatus === 'BLOCK') {
      await this.eventBusService.emit({
        tenantId,
        source: EVENT_SOURCE,
        eventName: EVENT_GUARDRAIL_BLOCKED,
        tableName: 'itsm_changes',
        recordId: changeId,
        payload: {
          ...basePayload,
          reasons: result.reasons
            .filter((r) => r.severity === 'critical')
            .map((r) => r.message),
        },
        actorId: userId,
      });
    }

    // Emit status_changed event if status differs from previous
    if (
      previousEvaluation &&
      previousEvaluation.guardrailStatus !== result.guardrailStatus
    ) {
      await this.eventBusService.emit({
        tenantId,
        source: EVENT_SOURCE,
        eventName: EVENT_GUARDRAIL_STATUS_CHANGED,
        tableName: 'itsm_changes',
        recordId: changeId,
        payload: {
          ...basePayload,
          previousStatus: previousEvaluation.guardrailStatus,
          previousDecision: previousEvaluation.governanceDecision,
        },
        actorId: userId,
      });
    }
  }

  // ==========================================================================
  // Audit Trail (Journal)
  // ==========================================================================

  /**
   * Write a journal/audit entry for the guardrail evaluation.
   * Non-blocking: errors are caught by the caller.
   */
  private async writeGuardrailJournalEntry(
    tenantId: string,
    userId: string,
    changeId: string,
    result: TopologyGuardrailEvaluationResponse,
    previousEvaluation: GuardrailPreviousEvaluation | null,
  ): Promise<void> {
    if (!this.journalService) return;

    const parts: string[] = [
      `[Topology Guardrail] Status: ${result.guardrailStatus} (Decision: ${result.governanceDecision})`,
      `Risk Score: ${result.policyFlags.topologyRiskScore}/100`,
    ];

    if (result.guardrailStatus === 'BLOCK') {
      parts.push(
        `BLOCKED reasons: ${result.reasons
          .filter((r) => r.severity === 'critical')
          .map((r) => r.message)
          .join('; ')}`,
      );
    }

    const unsatisfied = result.recommendedActions
      .filter((a) => a.required && !a.satisfied)
      .map((a) => a.label);
    if (unsatisfied.length > 0) {
      parts.push(`Outstanding actions: ${unsatisfied.join(', ')}`);
    }

    if (previousEvaluation) {
      parts.push(
        `Previous: ${previousEvaluation.guardrailStatus} (${previousEvaluation.governanceDecision}) at ${previousEvaluation.evaluatedAt}`,
      );
      if (previousEvaluation.guardrailStatus !== result.guardrailStatus) {
        parts.push(
          `Status changed: ${previousEvaluation.guardrailStatus} -> ${result.guardrailStatus}`,
        );
      }
    }

    const message = parts.filter(Boolean).join(' | ');

    await this.journalService.createJournalEntry(
      tenantId,
      userId,
      'changes',
      changeId,
      {
        type: JournalType.WORK_NOTE,
        message: message.slice(0, JOURNAL_MESSAGE_CAP),
      },
    );
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Convert a governance factor key to a machine-readable reason code.
   */
  private factorKeyToReasonCode(key: string): string {
    const map: Record<string, string> = {
      topologyRiskScore: 'TOPOLOGY_RISK_SCORE',
      blastRadius: 'HIGH_BLAST_RADIUS',
      criticalDependency: 'CRITICAL_DEPENDENCY_TOUCHED',
      singlePointOfFailure: 'SPOF_DETECTED',
      fragilitySignals: 'FRAGILITY_SIGNALS',
      crossServicePropagation: 'CROSS_SERVICE_PROPAGATION',
      freezeConflict: 'FREEZE_WINDOW_CONFLICT',
    };
    return map[key] || key.toUpperCase();
  }

  /**
   * Build a fail-open governance result when the governance service is unavailable.
   */
  private buildFailOpenGovernanceResult(
    changeId: string,
  ): TopologyGovernanceEvaluationResponse {
    return {
      changeId,
      decision: 'ALLOWED',
      policyFlags: {
        topologyRiskScore: 0,
        topologyHighBlastRadius: false,
        topologyFragilitySignalsCount: 0,
        topologyCriticalDependencyTouched: false,
        topologySinglePointOfFailureRisk: false,
      },
      recommendedActions: [],
      explainability: {
        summary:
          'Topology governance service unavailable. Default PASS applied.',
        factors: [],
        topDependencyPaths: [],
        matchedPolicyNames: [],
      },
      topologyDataAvailable: false,
      evaluatedAt: new Date().toISOString(),
      warnings: [
        'Topology governance service unavailable. Guardrail defaults to PASS.',
      ],
    };
  }
}
