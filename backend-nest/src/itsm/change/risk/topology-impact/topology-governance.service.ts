/**
 * TopologyGovernanceService
 *
 * Consumes topology impact analysis results and policy evaluation
 * to produce governance decisions with full explainability.
 *
 * Phase-C, Phase 1: Change Governance Auto-Enforcement (Topology-aware)
 *
 * Design principles:
 * - Fail-open: if topology data is unavailable, governance returns ALLOWED with warning
 * - Deterministic: no opaque evaluation logic; all decisions traceable to policy rules + topology flags
 * - Explainable: every decision includes reasons, factors, and recommended actions
 * - Safe: no eval/new Function; allowlist-safe conditions only
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { TopologyImpactAnalysisService } from './topology-impact-analysis.service';
import { PolicyService, PolicyEvaluationSummary } from '../policy.service';
import { JournalService } from '../../../journal/journal.service';
import { JournalType } from '../../../journal/journal.entity';
import { ItsmChange } from '../../change.entity';
import { RiskAssessment } from '../risk-assessment.entity';
import { CustomerRiskImpactResult } from '../customer-risk-impact.service';
import {
  TopologyImpactResponse,
  FragilitySignal,
} from './dto/topology-impact.dto';
import {
  TopologyGovernanceEvaluationResponse,
  TopologyGovernanceDecision,
  TopologyPolicyFlags,
  TopologyGovernanceFactor,
  TopologyGovernanceAction,
  TopologyGovernanceExplainability,
} from './dto/topology-governance.dto';

/** High blast radius threshold: if totalImpactedNodes >= this, flag is true */
const HIGH_BLAST_RADIUS_THRESHOLD = 10;

/** Maximum dependency paths to include in explainability payload */
const MAX_EXPLAINABILITY_PATHS = 5;

@Injectable()
export class TopologyGovernanceService {
  private readonly logger = new Logger(TopologyGovernanceService.name);

  constructor(
    @Optional()
    private readonly topologyImpactService?: TopologyImpactAnalysisService,
    @Optional()
    private readonly policyService?: PolicyService,
    @Optional()
    private readonly journalService?: JournalService,
  ) {}

  /**
   * Evaluate topology-aware governance for a change.
   *
   * Flow:
   * 1. Fetch topology impact (fail-open if unavailable)
   * 2. Compute policy-ready flags from topology data
   * 3. Run policy evaluation with topology context
   * 4. Build governance decision with explainability
   * 5. Write journal/audit entry
   */
  async evaluateGovernance(
    tenantId: string,
    userId: string,
    change: ItsmChange,
    assessment: RiskAssessment | null,
    customerRiskImpact?: CustomerRiskImpactResult | null,
  ): Promise<TopologyGovernanceEvaluationResponse> {
    const warnings: string[] = [];

    // Step 1: Fetch topology impact (fail-open)
    let topologyImpact: TopologyImpactResponse | null = null;
    let topologyDataAvailable = false;

    if (this.topologyImpactService) {
      try {
        topologyImpact = await this.topologyImpactService.calculateTopologyImpact(
          tenantId,
          change,
        );
        topologyDataAvailable = true;
      } catch (err) {
        this.logger.warn(
          `Topology impact fetch failed for change ${change.id} (fail-open): ${String(err)}`,
        );
        warnings.push('Topology impact data unavailable. Governance evaluated without topology context.');
      }
    } else {
      warnings.push('Topology impact analysis service not configured.');
    }

    // Step 2: Compute policy-ready flags
    const policyFlags = this.computePolicyFlags(topologyImpact);

    // Step 3: Run policy evaluation with topology context
    let policySummary: PolicyEvaluationSummary | null = null;
    if (this.policyService) {
      try {
        policySummary = await this.policyService.evaluatePolicies(
          tenantId,
          change,
          assessment,
          customerRiskImpact ?? null,
          topologyImpact,
          policyFlags,
        );
      } catch (err) {
        this.logger.warn(
          `Policy evaluation failed for change ${change.id}: ${String(err)}`,
        );
        warnings.push('Policy evaluation encountered an error. Default governance applied.');
      }
    }

    // Step 4: Build governance decision
    const decision = this.computeDecision(policyFlags, policySummary, assessment);
    const factors = this.buildFactors(policyFlags, topologyImpact, assessment);
    const recommendedActions = this.buildRecommendedActions(
      policyFlags,
      policySummary,
      change,
      topologyImpact,
    );
    const explainability = this.buildExplainability(
      decision,
      factors,
      topologyImpact,
      policySummary,
    );

    const result: TopologyGovernanceEvaluationResponse = {
      changeId: change.id,
      decision,
      policyFlags,
      recommendedActions,
      explainability,
      topologyDataAvailable,
      evaluatedAt: new Date().toISOString(),
      warnings,
    };

    // Step 5: Write journal entry (non-blocking)
    this.writeGovernanceJournalEntry(tenantId, userId, change.id, result).catch(
      (err) => {
        this.logger.warn(
          `Failed to write governance journal entry for change ${change.id}: ${String(err)}`,
        );
      },
    );

    return result;
  }

  /**
   * Compute policy-ready flags from topology impact data.
   */
  computePolicyFlags(
    topologyImpact: TopologyImpactResponse | null,
  ): TopologyPolicyFlags {
    if (!topologyImpact) {
      return {
        topologyRiskScore: 0,
        topologyHighBlastRadius: false,
        topologyFragilitySignalsCount: 0,
        topologyCriticalDependencyTouched: false,
        topologySinglePointOfFailureRisk: false,
      };
    }

    const { metrics, fragilitySignals, topologyRiskScore } = topologyImpact;

    return {
      topologyRiskScore,
      topologyHighBlastRadius:
        metrics.totalImpactedNodes >= HIGH_BLAST_RADIUS_THRESHOLD,
      topologyFragilitySignalsCount: fragilitySignals.length,
      topologyCriticalDependencyTouched: metrics.criticalCiCount > 0,
      topologySinglePointOfFailureRisk: fragilitySignals.some(
        (s: FragilitySignal) => s.type === 'single_point_of_failure',
      ),
    };
  }

  /**
   * Compute the overall governance decision from topology flags, policy evaluation, and risk assessment.
   */
  private computeDecision(
    policyFlags: TopologyPolicyFlags,
    policySummary: PolicyEvaluationSummary | null,
    assessment: RiskAssessment | null,
  ): TopologyGovernanceDecision {
    // If policy says BLOCK, respect it
    if (policySummary?.decisionRecommendation === 'BLOCK') {
      return 'BLOCKED';
    }

    // If policy says CAB_REQUIRED, respect it
    if (policySummary?.decisionRecommendation === 'CAB_REQUIRED') {
      return 'CAB_REQUIRED';
    }

    // Topology-driven escalation (even without matching policies)
    // Critical topology risk + SPOF => BLOCKED
    if (
      policyFlags.topologyRiskScore >= 80 &&
      policyFlags.topologySinglePointOfFailureRisk &&
      assessment?.hasFreezeConflict
    ) {
      return 'BLOCKED';
    }

    // High topology risk => CAB_REQUIRED
    if (policyFlags.topologyRiskScore >= 60) {
      return 'CAB_REQUIRED';
    }

    // High blast radius + critical dependencies => CAB_REQUIRED
    if (
      policyFlags.topologyHighBlastRadius &&
      policyFlags.topologyCriticalDependencyTouched
    ) {
      return 'CAB_REQUIRED';
    }

    // Moderate risk with missing evidence => ADDITIONAL_EVIDENCE_REQUIRED
    if (
      policyFlags.topologyRiskScore >= 40 &&
      policyFlags.topologyFragilitySignalsCount > 0
    ) {
      return 'ADDITIONAL_EVIDENCE_REQUIRED';
    }

    // If policy says REVIEW, map to ADDITIONAL_EVIDENCE_REQUIRED
    if (policySummary?.decisionRecommendation === 'REVIEW') {
      return 'ADDITIONAL_EVIDENCE_REQUIRED';
    }

    return 'ALLOWED';
  }

  /**
   * Build the factors list for explainability.
   */
  private buildFactors(
    policyFlags: TopologyPolicyFlags,
    topologyImpact: TopologyImpactResponse | null,
    assessment: RiskAssessment | null,
  ): TopologyGovernanceFactor[] {
    const factors: TopologyGovernanceFactor[] = [];

    // Topology risk score
    factors.push({
      key: 'topologyRiskScore',
      label: 'Topology Risk Score',
      value: policyFlags.topologyRiskScore,
      severity: policyFlags.topologyRiskScore >= 60
        ? 'critical'
        : policyFlags.topologyRiskScore >= 40
          ? 'warning'
          : 'info',
      explanation: `Topology analysis computed a risk score of ${policyFlags.topologyRiskScore}/100`,
    });

    // Blast radius
    if (topologyImpact) {
      factors.push({
        key: 'blastRadius',
        label: 'Blast Radius',
        value: topologyImpact.metrics.totalImpactedNodes,
        severity: policyFlags.topologyHighBlastRadius ? 'critical' : 'info',
        explanation: `${topologyImpact.metrics.totalImpactedNodes} nodes impacted across ${topologyImpact.metrics.impactedServiceCount} service(s)`,
      });
    }

    // Critical dependencies
    if (policyFlags.topologyCriticalDependencyTouched) {
      factors.push({
        key: 'criticalDependency',
        label: 'Critical Dependency Touched',
        value: true,
        severity: 'critical',
        explanation: `${topologyImpact?.metrics.criticalCiCount ?? 0} critical CI(s) are in the blast radius`,
      });
    }

    // SPOF risk
    if (policyFlags.topologySinglePointOfFailureRisk) {
      factors.push({
        key: 'singlePointOfFailure',
        label: 'Single Point of Failure Risk',
        value: true,
        severity: 'critical',
        explanation: 'A single point of failure was detected in the dependency graph',
      });
    }

    // Fragility signals
    if (policyFlags.topologyFragilitySignalsCount > 0) {
      factors.push({
        key: 'fragilitySignals',
        label: 'Fragility Signals',
        value: policyFlags.topologyFragilitySignalsCount,
        severity: policyFlags.topologyFragilitySignalsCount >= 3 ? 'critical' : 'warning',
        explanation: `${policyFlags.topologyFragilitySignalsCount} fragility signal(s) detected (SPOF, no redundancy, high fan-out, deep chains)`,
      });
    }

    // Cross-service propagation
    if (topologyImpact?.metrics.crossServicePropagation) {
      factors.push({
        key: 'crossServicePropagation',
        label: 'Cross-Service Propagation',
        value: topologyImpact.metrics.crossServiceCount,
        severity: 'warning',
        explanation: `Impact propagates across ${topologyImpact.metrics.crossServiceCount} service boundaries`,
      });
    }

    // Freeze conflict
    if (assessment?.hasFreezeConflict) {
      factors.push({
        key: 'freezeConflict',
        label: 'Freeze Window Conflict',
        value: true,
        severity: 'critical',
        explanation: 'Change overlaps with an active freeze window',
      });
    }

    return factors;
  }

  /**
   * Build recommended/required actions checklist.
   */
  private buildRecommendedActions(
    policyFlags: TopologyPolicyFlags,
    policySummary: PolicyEvaluationSummary | null,
    change: ItsmChange,
    topologyImpact: TopologyImpactResponse | null,
  ): TopologyGovernanceAction[] {
    const actions: TopologyGovernanceAction[] = [];

    // Implementation plan
    const requireImpl =
      policySummary?.requiredActions?.includes('Implementation plan required') ||
      policyFlags.topologyRiskScore >= 40;
    actions.push({
      key: 'implementationPlan',
      label: 'Implementation Plan',
      required: !!requireImpl,
      satisfied: !!change.implementationPlan?.trim(),
      reason: requireImpl
        ? 'Required due to topology risk level or policy rule'
        : 'Recommended for change traceability',
    });

    // Backout plan
    const requireBackout =
      policySummary?.requiredActions?.includes('Backout plan required') ||
      policyFlags.topologyRiskScore >= 40;
    actions.push({
      key: 'backoutPlan',
      label: 'Backout Plan',
      required: !!requireBackout,
      satisfied: !!change.backoutPlan?.trim(),
      reason: requireBackout
        ? 'Required due to topology risk level or policy rule'
        : 'Recommended for safe rollback capability',
    });

    // Test evidence
    const requireTest =
      policyFlags.topologyCriticalDependencyTouched ||
      policyFlags.topologySinglePointOfFailureRisk;
    actions.push({
      key: 'testEvidence',
      label: 'Test Evidence',
      required: !!requireTest,
      satisfied: false, // Not tracked in change entity yet
      reason: requireTest
        ? 'Required: critical dependencies or SPOF detected in topology'
        : 'Recommended for production changes',
    });

    // Stakeholder communications
    const requireComms =
      topologyImpact?.metrics.crossServicePropagation ||
      policyFlags.topologyHighBlastRadius;
    actions.push({
      key: 'stakeholderComms',
      label: 'Stakeholder Communications',
      required: !!requireComms,
      satisfied: false,
      reason: requireComms
        ? 'Required: change impacts multiple services or has high blast radius'
        : 'Recommended for visibility',
    });

    // Maintenance window
    const requireWindow =
      policyFlags.topologyRiskScore >= 60 ||
      (policyFlags.topologyCriticalDependencyTouched &&
        policyFlags.topologyHighBlastRadius);
    actions.push({
      key: 'maintenanceWindow',
      label: 'Maintenance Window',
      required: !!requireWindow,
      satisfied: !!(change.plannedStartAt && change.plannedEndAt),
      reason: requireWindow
        ? 'Required: high topology risk mandates scheduled maintenance window'
        : 'Recommended for controlled deployment',
    });

    // CAB approval
    if (policySummary?.requireCABApproval || policyFlags.topologyRiskScore >= 60) {
      actions.push({
        key: 'cabApproval',
        label: 'CAB Approval',
        required: true,
        satisfied: change.approvalStatus === 'APPROVED',
        reason: 'Required by policy or topology risk assessment',
      });
    }

    return actions;
  }

  /**
   * Build the full explainability payload.
   */
  private buildExplainability(
    decision: TopologyGovernanceDecision,
    factors: TopologyGovernanceFactor[],
    topologyImpact: TopologyImpactResponse | null,
    policySummary: PolicyEvaluationSummary | null,
  ): TopologyGovernanceExplainability {
    const summary = this.buildDecisionSummary(decision, factors);

    // Extract top dependency paths (capped)
    const topDependencyPaths = (topologyImpact?.topPaths ?? [])
      .slice(0, MAX_EXPLAINABILITY_PATHS)
      .map((p) => ({
        nodeLabels: p.nodeLabels.slice(0, 10), // cap label array length
        depth: p.depth,
      }));

    const matchedPolicyNames = (policySummary?.rulesTriggered ?? []).map(
      (r) => r.policyName,
    );

    return {
      summary,
      factors,
      topDependencyPaths,
      matchedPolicyNames,
    };
  }

  /**
   * Build a concise human-readable summary of the governance decision.
   */
  private buildDecisionSummary(
    decision: TopologyGovernanceDecision,
    factors: TopologyGovernanceFactor[],
  ): string {
    const criticalFactors = factors
      .filter((f) => f.severity === 'critical')
      .map((f) => f.label);

    switch (decision) {
      case 'BLOCKED':
        return `Change is blocked. Critical factors: ${criticalFactors.join(', ') || 'policy rule'}.`;
      case 'CAB_REQUIRED':
        return `CAB approval required. Key factors: ${criticalFactors.length > 0 ? criticalFactors.join(', ') : 'elevated topology risk'}.`;
      case 'ADDITIONAL_EVIDENCE_REQUIRED':
        return `Additional evidence required before proceeding. ${factors.filter((f) => f.severity === 'warning').length} warning factor(s) detected.`;
      case 'ALLOWED':
        return 'Change is allowed. Topology analysis indicates acceptable risk level.';
      default:
        return 'Governance evaluation complete.';
    }
  }

  /**
   * Write a journal/audit entry for the governance evaluation.
   * Non-blocking: errors are caught by the caller.
   */
  private async writeGovernanceJournalEntry(
    tenantId: string,
    userId: string,
    changeId: string,
    result: TopologyGovernanceEvaluationResponse,
  ): Promise<void> {
    if (!this.journalService) return;

    const message = [
      `[Topology Governance] Decision: ${result.decision}`,
      `Risk Score: ${result.policyFlags.topologyRiskScore}`,
      result.policyFlags.topologyHighBlastRadius ? 'High blast radius detected.' : '',
      result.policyFlags.topologySinglePointOfFailureRisk ? 'SPOF risk detected.' : '',
      result.policyFlags.topologyCriticalDependencyTouched ? 'Critical dependency touched.' : '',
      `Actions: ${result.recommendedActions.filter((a) => a.required && !a.satisfied).map((a) => a.label).join(', ') || 'None outstanding'}`,
      result.explainability.summary,
    ]
      .filter(Boolean)
      .join(' | ');

    await this.journalService.createJournalEntry(
      tenantId,
      userId,
      'changes',
      changeId,
      {
        type: JournalType.WORK_NOTE,
        message: message.slice(0, 2000), // Cap message length
      },
    );
  }
}
