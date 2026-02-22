/**
 * Suggested Task Pack Service
 *
 * Generates topology-driven operational task suggestions for changes
 * based on topology impact analysis, risk level, and fragility signals.
 *
 * Phase-C, Phase 3: Topology-aware Operational Tasking.
 */
import { Injectable, Optional, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopologyImpactAnalysisService } from './topology-impact-analysis.service';
import { ItsmChange } from '../../change.entity';
import {
  SuggestedTask,
  SuggestedTaskPackResponse,
} from './dto/suggested-task-pack.dto';
import {
  TopologyImpactResponse,
} from './dto/topology-impact.dto';

/** Threshold for high blast radius (nodes) */
const HIGH_BLAST_RADIUS = 10;
/** Threshold for critical blast radius (nodes) */
const CRITICAL_BLAST_RADIUS = 25;

@Injectable()
export class SuggestedTaskPackService {
  private readonly logger = new Logger(SuggestedTaskPackService.name);

  constructor(
    @Optional()
    private readonly topologyAnalysis?: TopologyImpactAnalysisService,
    @Optional()
    @InjectRepository(ItsmChange)
    private readonly changeRepo?: Repository<ItsmChange>,
  ) {}

  /**
   * Generate a suggested task pack for a change based on topology impact.
   */
  async generateTaskPack(
    tenantId: string,
    changeId: string,
  ): Promise<SuggestedTaskPackResponse> {
    const warnings: string[] = [];

    if (!this.topologyAnalysis) {
      return this.emptyPack(changeId, warnings.concat('Topology analysis service not available.'));
    }

    // Fetch the change entity (needed by calculateTopologyImpact)
    let change: ItsmChange | null = null;
    if (this.changeRepo) {
      change = await this.changeRepo.findOne({
        where: { id: changeId, tenantId, isDeleted: false } as Record<string, unknown>,
      });
    }
    if (!change) {
      return this.emptyPack(changeId, warnings.concat('Change not found.'));
    }

    let impact: TopologyImpactResponse;
    try {
      impact = await this.topologyAnalysis.calculateTopologyImpact(
        tenantId,
        change,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to calculate topology impact for task pack: ${(err as Error).message}`,
      );
      return this.emptyPack(
        changeId,
        warnings.concat('Topology impact calculation failed. Returning generic tasks.'),
      );
    }

    const tasks = this.buildTasksFromImpact(impact);

    const recommendedCount = tasks.filter((t) => t.recommended).length;

    return {
      changeId,
      riskLevel: this.classifyRiskLevel(impact.topologyRiskScore),
      topologyRiskScore: impact.topologyRiskScore,
      tasks,
      totalTasks: tasks.length,
      recommendedCount,
      generatedAt: new Date().toISOString(),
      warnings: impact.warnings.concat(warnings),
    };
  }

  // ==========================================================================
  // PRIVATE: Task Generation Logic
  // ==========================================================================

  private buildTasksFromImpact(impact: TopologyImpactResponse): SuggestedTask[] {
    const tasks: SuggestedTask[] = [];
    const score = impact.topologyRiskScore;
    const metrics = impact.metrics;
    const signals = impact.fragilitySignals;

    // ---- VALIDATION tasks ----
    // Always suggest a basic validation task
    tasks.push({
      templateKey: 'validate_change_scope',
      category: 'VALIDATION',
      title: 'Validate change scope against topology impact',
      description: `Review the topology blast radius (${metrics.totalImpactedNodes} nodes, ${metrics.impactedServiceCount} services) and confirm the change scope covers all impacted areas. Verify that test plans address ${metrics.criticalCiCount} critical CIs.`,
      priority: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW',
      reason: `Topology analysis shows ${metrics.totalImpactedNodes} impacted nodes across ${metrics.impactedServiceCount} services.`,
      triggerSignals: ['blast_radius'],
      recommended: true,
    });

    // If cross-service propagation, add cross-service validation
    if (metrics.crossServicePropagation) {
      tasks.push({
        templateKey: 'validate_cross_service_impact',
        category: 'VALIDATION',
        title: 'Validate cross-service impact and integration points',
        description: `This change propagates across ${metrics.crossServiceCount} service boundaries. Verify integration points, SLAs, and data flows between affected services are tested.`,
        priority: 'HIGH',
        reason: `Blast radius crosses ${metrics.crossServiceCount} service boundaries.`,
        triggerSignals: ['cross_service_propagation'],
        recommended: true,
      });
    }

    // If high blast radius, add extended validation
    if (metrics.totalImpactedNodes >= HIGH_BLAST_RADIUS) {
      tasks.push({
        templateKey: 'validate_blast_radius_coverage',
        category: 'VALIDATION',
        title: 'Extended blast radius coverage validation',
        description: `High blast radius detected (${metrics.totalImpactedNodes} nodes). Perform extended validation including: smoke tests on all critical paths, dependency health checks, and performance baseline comparison.`,
        priority: metrics.totalImpactedNodes >= CRITICAL_BLAST_RADIUS ? 'CRITICAL' : 'HIGH',
        reason: `Blast radius of ${metrics.totalImpactedNodes} nodes exceeds threshold of ${HIGH_BLAST_RADIUS}.`,
        triggerSignals: ['high_blast_radius'],
        recommended: true,
      });
    }

    // ---- ROLLBACK READINESS tasks ----
    // Always suggest rollback readiness for non-trivial changes
    if (score >= 30 || metrics.totalImpactedNodes >= 5) {
      tasks.push({
        templateKey: 'prepare_rollback_plan',
        category: 'ROLLBACK_READINESS',
        title: 'Verify rollback plan completeness',
        description: `Ensure the backout/rollback plan covers all ${metrics.totalImpactedNodes} impacted nodes. Verify rollback can be executed within the maintenance window and data integrity is preserved.`,
        priority: score >= 70 ? 'HIGH' : 'MEDIUM',
        reason: `Topology risk score of ${score} requires verified rollback capability.`,
        triggerSignals: ['topology_risk_score'],
        recommended: score >= 50,
      });
    }

    // If SPOFs detected, add SPOF-specific rollback task
    const spofSignals = signals.filter((s) => s.type === 'single_point_of_failure');
    if (spofSignals.length > 0) {
      tasks.push({
        templateKey: 'rollback_spof_mitigation',
        category: 'ROLLBACK_READINESS',
        title: 'SPOF rollback mitigation plan',
        description: `${spofSignals.length} single point(s) of failure detected: ${spofSignals.map((s) => s.nodeLabel).join(', ')}. Prepare specific rollback procedures for each SPOF to minimize downtime.`,
        priority: 'HIGH',
        reason: `${spofSignals.length} SPOF(s) detected in the topology.`,
        triggerSignals: spofSignals.map((s) => `spof:${s.nodeId}`),
        recommended: true,
      });
    }

    // ---- DEPENDENCY COMMUNICATION tasks ----
    // Notify dependency owners if cross-service
    if (metrics.crossServicePropagation || metrics.impactedServiceCount > 1) {
      tasks.push({
        templateKey: 'notify_dependency_owners',
        category: 'DEPENDENCY_COMMUNICATION',
        title: 'Notify dependency owners of planned change',
        description: `Contact owners of ${metrics.impactedServiceCount} affected services to communicate the change window, expected impact, and rollback procedures. Ensure acknowledgement is received before implementation.`,
        priority: score >= 70 ? 'HIGH' : 'MEDIUM',
        reason: `Change impacts ${metrics.impactedServiceCount} services requiring owner coordination.`,
        triggerSignals: ['cross_service_propagation', 'multi_service_impact'],
        recommended: metrics.impactedServiceCount > 2,
      });
    }

    // High fan-out signals → notify downstream consumers
    const fanOutSignals = signals.filter((s) => s.type === 'high_fan_out');
    if (fanOutSignals.length > 0) {
      tasks.push({
        templateKey: 'notify_downstream_consumers',
        category: 'DEPENDENCY_COMMUNICATION',
        title: 'Notify downstream consumers of high fan-out nodes',
        description: `High fan-out detected on: ${fanOutSignals.map((s) => s.nodeLabel).join(', ')}. Notify all downstream consumers and prepare for potential cascading impact.`,
        priority: 'HIGH',
        reason: `${fanOutSignals.length} high fan-out node(s) may affect many downstream consumers.`,
        triggerSignals: fanOutSignals.map((s) => `fan_out:${s.nodeId}`),
        recommended: true,
      });
    }

    // ---- MONITORING tasks ----
    // Always suggest enhanced monitoring for risky changes
    if (score >= 30) {
      tasks.push({
        templateKey: 'setup_enhanced_monitoring',
        category: 'MONITORING',
        title: 'Set up enhanced monitoring during change window',
        description: `Configure enhanced monitoring and alerting for ${metrics.totalImpactedNodes} impacted nodes during the change window. Include: error rate thresholds, latency baselines, and health check frequency increase.`,
        priority: score >= 60 ? 'HIGH' : 'MEDIUM',
        reason: `Topology risk score of ${score} warrants enhanced observability.`,
        triggerSignals: ['topology_risk_score'],
        recommended: score >= 50,
      });
    }

    // Deep chain → watch for cascading failures
    const deepChainSignals = signals.filter((s) => s.type === 'deep_chain');
    if (deepChainSignals.length > 0 || metrics.maxChainDepth >= 4) {
      tasks.push({
        templateKey: 'monitor_cascade_propagation',
        category: 'MONITORING',
        title: 'Monitor for cascading failure propagation',
        description: `Deep dependency chain detected (depth: ${metrics.maxChainDepth}). Set up cascading failure detection with progressive alerting along the dependency chain. Monitor tail-end services for delayed impact.`,
        priority: 'HIGH',
        reason: `Dependency chain depth of ${metrics.maxChainDepth} increases cascading failure risk.`,
        triggerSignals: ['deep_chain', `max_depth:${metrics.maxChainDepth}`],
        recommended: true,
      });
    }

    // ---- DOCUMENTATION tasks ----
    // Suggest documentation for high-risk changes
    if (score >= 50) {
      tasks.push({
        templateKey: 'document_topology_decisions',
        category: 'DOCUMENTATION',
        title: 'Document topology-informed implementation decisions',
        description: `Record the topology analysis results and how they influenced implementation decisions. Include: blast radius assessment, SPOF mitigations applied, and dependency coordination outcomes.`,
        priority: 'MEDIUM',
        reason: `High-risk change (score ${score}) should have documented topology decision rationale.`,
        triggerSignals: ['topology_risk_score'],
        recommended: false,
      });
    }

    return tasks;
  }

  private classifyRiskLevel(score: number): string {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'MINIMAL';
  }

  private emptyPack(
    changeId: string,
    warnings: string[],
  ): SuggestedTaskPackResponse {
    return {
      changeId,
      riskLevel: 'UNKNOWN',
      topologyRiskScore: 0,
      tasks: [],
      totalTasks: 0,
      recommendedCount: 0,
      generatedAt: new Date().toISOString(),
      warnings,
    };
  }
}
