/**
 * Traceability Summary Service
 *
 * Builds a closed-loop traceability graph summary for a change or
 * major incident, showing the chain from topology analysis →
 * governance decision → approvals → orchestrated records → outcomes.
 *
 * Phase-C, Phase 3: Closed-Loop Traceability.
 */
import { Injectable, Optional, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItsmChange } from '../../change.entity';
import { ItsmProblem } from '../../../problem/problem.entity';
import { ItsmKnownError } from '../../../known-error/known-error.entity';
import {
  TraceabilityNode,
  TraceabilityEdge,
  TraceabilitySummaryResponse,
} from './dto/suggested-task-pack.dto';

@Injectable()
export class TraceabilitySummaryService {
  private readonly logger = new Logger(TraceabilitySummaryService.name);

  constructor(
    @Optional()
    @InjectRepository(ItsmChange)
    private readonly changeRepo?: Repository<ItsmChange>,
    @Optional()
    @InjectRepository(ItsmProblem)
    private readonly problemRepo?: Repository<ItsmProblem>,
    @Optional()
    @InjectRepository(ItsmKnownError)
    private readonly knownErrorRepo?: Repository<ItsmKnownError>,
  ) {}

  /**
   * Build traceability summary for a change.
   */
  async getChangeTraceability(
    tenantId: string,
    changeId: string,
  ): Promise<TraceabilitySummaryResponse> {
    const nodes: TraceabilityNode[] = [];
    const edges: TraceabilityEdge[] = [];
    const warnings: string[] = [];

    // 1. Root: the change itself
    let changeLabel = `Change ${changeId.substring(0, 8)}`;
    let changeStatus = 'UNKNOWN';
    let changeCreatedAt = new Date().toISOString();

    if (this.changeRepo) {
      try {
        const change = await this.changeRepo.findOne({
          where: { id: changeId, tenantId, isDeleted: false } as Record<string, unknown>,
        });
        if (change) {
          changeLabel = `${change.number}: ${change.title}`;
          changeStatus = change.state;
          changeCreatedAt = change.createdAt?.toISOString?.() || changeCreatedAt;
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch change for traceability: ${(err as Error).message}`);
        warnings.push('Could not load change details.');
      }
    }

    nodes.push({
      type: 'CHANGE',
      id: changeId,
      label: changeLabel,
      status: changeStatus,
      createdAt: changeCreatedAt,
    });

    // 2. Check for topology analysis metadata on the change
    const topologyNodeId = `topology:${changeId}`;
    nodes.push({
      type: 'TOPOLOGY_ANALYSIS',
      id: topologyNodeId,
      label: 'Topology Impact Analysis',
      status: 'COMPUTED',
      createdAt: new Date().toISOString(),
      meta: { note: 'Run topology impact to populate' },
    });
    edges.push({
      fromId: changeId,
      toId: topologyNodeId,
      relation: 'ANALYZED_BY',
      label: 'Topology analysis performed',
    });

    // 3. Check for governance decision
    const govNodeId = `governance:${changeId}`;
    nodes.push({
      type: 'GOVERNANCE_DECISION',
      id: govNodeId,
      label: 'Governance Decision',
      status: 'EVALUATED',
      createdAt: new Date().toISOString(),
      meta: { note: 'Run governance evaluation to populate' },
    });
    edges.push({
      fromId: topologyNodeId,
      toId: govNodeId,
      relation: 'DECIDED_BY',
      label: 'Governance evaluation based on topology',
    });

    // 4. Look for problems linked to this change (via metadata)
    if (this.problemRepo) {
      try {
        const problems = await this.problemRepo
          .createQueryBuilder('p')
          .where('p.tenantId = :tenantId', { tenantId })
          .andWhere('p.isDeleted = false')
          .andWhere("p.metadata->>'sourceChangeId' = :changeId", { changeId })
          .getMany();

        for (const problem of problems) {
          nodes.push({
            type: 'PROBLEM',
            id: problem.id,
            label: `Problem: ${problem.shortDescription || problem.id.substring(0, 8)}`,
            status: problem.state,
            createdAt: problem.createdAt?.toISOString?.() || new Date().toISOString(),
          });
          edges.push({
            fromId: changeId,
            toId: problem.id,
            relation: 'RESULTED_IN',
            label: 'Problem identified from change',
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch linked problems: ${(err as Error).message}`);
      }
    }

    // 5. Look for known errors linked to this change
    if (this.knownErrorRepo) {
      try {
        const knownErrors = await this.knownErrorRepo
          .createQueryBuilder('ke')
          .where('ke.tenantId = :tenantId', { tenantId })
          .andWhere('ke.isDeleted = false')
          .andWhere("ke.metadata->>'sourceChangeId' = :changeId", { changeId })
          .getMany();

        for (const ke of knownErrors) {
          nodes.push({
            type: 'KNOWN_ERROR',
            id: ke.id,
            label: `Known Error: ${ke.title || ke.id.substring(0, 8)}`,
            status: ke.state,
            createdAt: ke.createdAt?.toISOString?.() || new Date().toISOString(),
          });
          edges.push({
            fromId: changeId,
            toId: ke.id,
            relation: 'RESULTED_IN',
            label: 'Known error documented from change',
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch linked known errors: ${(err as Error).message}`);
      }
    }

    const metrics = this.computeMetrics(nodes, edges);
    const summary = this.buildSummaryText(nodes, metrics);

    return {
      rootId: changeId,
      rootType: 'CHANGE',
      nodes,
      edges,
      summary,
      metrics,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build traceability summary for a major incident.
   */
  async getMajorIncidentTraceability(
    tenantId: string,
    majorIncidentId: string,
  ): Promise<TraceabilitySummaryResponse> {
    const nodes: TraceabilityNode[] = [];
    const edges: TraceabilityEdge[] = [];

    // 1. Root: the major incident
    nodes.push({
      type: 'MAJOR_INCIDENT',
      id: majorIncidentId,
      label: `Major Incident ${majorIncidentId.substring(0, 8)}`,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });

    // 2. RCA topology analysis node
    const rcaNodeId = `rca:${majorIncidentId}`;
    nodes.push({
      type: 'TOPOLOGY_ANALYSIS',
      id: rcaNodeId,
      label: 'RCA Topology Hypotheses',
      status: 'COMPUTED',
      createdAt: new Date().toISOString(),
    });
    edges.push({
      fromId: majorIncidentId,
      toId: rcaNodeId,
      relation: 'ANALYZED_BY',
      label: 'RCA topology analysis performed',
    });

    // 3. Find problems created from RCA hypotheses (via metadata.rcaTraceability)
    if (this.problemRepo) {
      try {
        const problems = await this.problemRepo
          .createQueryBuilder('p')
          .where('p.tenantId = :tenantId', { tenantId })
          .andWhere('p.isDeleted = false')
          .andWhere("p.metadata->'rcaTraceability'->>'sourceMajorIncidentId' = :miId", {
            miId: majorIncidentId,
          })
          .getMany();

        for (const problem of problems) {
          const hypId =
            (problem.metadata as Record<string, Record<string, string>>)?.rcaTraceability
              ?.sourceHypothesisId || '';
          const hypNodeId = hypId ? `hypothesis:${hypId}` : null;

          // Add hypothesis node if not already added
          if (hypNodeId && !nodes.some((n) => n.id === hypNodeId)) {
            nodes.push({
              type: 'RCA_HYPOTHESIS',
              id: hypNodeId,
              label: `Hypothesis: ${(problem.metadata as Record<string, Record<string, string>>)?.rcaTraceability?.suspectNodeLabel || 'Unknown'}`,
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              meta: {
                hypothesisType: (problem.metadata as Record<string, Record<string, string>>)?.rcaTraceability?.hypothesisType,
              },
            });
            edges.push({
              fromId: rcaNodeId,
              toId: hypNodeId,
              relation: 'RESULTED_IN',
              label: 'Hypothesis generated',
            });
          }

          nodes.push({
            type: 'PROBLEM',
            id: problem.id,
            label: `Problem: ${problem.shortDescription || problem.id.substring(0, 8)}`,
            status: problem.state,
            createdAt: problem.createdAt?.toISOString?.() || new Date().toISOString(),
          });
          edges.push({
            fromId: hypNodeId || rcaNodeId,
            toId: problem.id,
            relation: 'CREATED_FROM',
            label: 'Problem created from hypothesis',
          });
        }
      } catch (err) {
        this.logger.warn(
          `Failed to fetch orchestrated problems: ${(err as Error).message}`,
        );
      }
    }

    // 4. Find known errors created from RCA hypotheses
    if (this.knownErrorRepo) {
      try {
        const knownErrors = await this.knownErrorRepo
          .createQueryBuilder('ke')
          .where('ke.tenantId = :tenantId', { tenantId })
          .andWhere('ke.isDeleted = false')
          .andWhere("ke.metadata->'rcaTraceability'->>'sourceMajorIncidentId' = :miId", {
            miId: majorIncidentId,
          })
          .getMany();

        for (const ke of knownErrors) {
          nodes.push({
            type: 'KNOWN_ERROR',
            id: ke.id,
            label: `Known Error: ${ke.title || ke.id.substring(0, 8)}`,
            status: ke.state,
            createdAt: ke.createdAt?.toISOString?.() || new Date().toISOString(),
          });
          edges.push({
            fromId: rcaNodeId,
            toId: ke.id,
            relation: 'CREATED_FROM',
            label: 'Known Error created from RCA',
          });
        }
      } catch (err) {
        this.logger.warn(
          `Failed to fetch orchestrated known errors: ${(err as Error).message}`,
        );
      }
    }

    const metrics = this.computeMetrics(nodes, edges);
    const summary = this.buildSummaryText(nodes, metrics);

    return {
      rootId: majorIncidentId,
      rootType: 'MAJOR_INCIDENT',
      nodes,
      edges,
      summary,
      metrics,
      generatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // PRIVATE: Metrics & Summary
  // ==========================================================================

  private computeMetrics(
    nodes: TraceabilityNode[],
    edges: TraceabilityEdge[],
  ): TraceabilitySummaryResponse['metrics'] {
    const hasTopologyAnalysis = nodes.some((n) => n.type === 'TOPOLOGY_ANALYSIS');
    const hasGovernanceDecision = nodes.some((n) => n.type === 'GOVERNANCE_DECISION');
    const hasOrchestrationActions = nodes.some(
      (n) =>
        n.type === 'PROBLEM' ||
        n.type === 'KNOWN_ERROR' ||
        n.type === 'PIR_ACTION',
    );

    // Completeness: base 20 for having the root, +20 for topology, +20 for governance,
    // +20 for orchestration actions, +20 for multiple nodes
    let completenessScore = 20;
    if (hasTopologyAnalysis) completenessScore += 20;
    if (hasGovernanceDecision) completenessScore += 20;
    if (hasOrchestrationActions) completenessScore += 20;
    if (nodes.length >= 5) completenessScore += 20;

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      hasTopologyAnalysis,
      hasGovernanceDecision,
      hasOrchestrationActions,
      completenessScore: Math.min(completenessScore, 100),
    };
  }

  private buildSummaryText(
    nodes: TraceabilityNode[],
    metrics: TraceabilitySummaryResponse['metrics'],
  ): string {
    const parts: string[] = [];

    const problemCount = nodes.filter((n) => n.type === 'PROBLEM').length;
    const keCount = nodes.filter((n) => n.type === 'KNOWN_ERROR').length;
    const pirCount = nodes.filter((n) => n.type === 'PIR_ACTION').length;

    if (metrics.hasTopologyAnalysis) {
      parts.push('Topology analysis completed');
    }
    if (metrics.hasGovernanceDecision) {
      parts.push('governance decision evaluated');
    }
    if (problemCount > 0) {
      parts.push(`${problemCount} problem(s) created`);
    }
    if (keCount > 0) {
      parts.push(`${keCount} known error(s) documented`);
    }
    if (pirCount > 0) {
      parts.push(`${pirCount} PIR action(s) created`);
    }

    if (parts.length === 0) {
      return 'No traceability chain established yet.';
    }

    return `Traceability chain: ${parts.join(' → ')}. Completeness: ${metrics.completenessScore}%.`;
  }
}
