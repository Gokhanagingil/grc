import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CmdbCi } from '../../../cmdb/ci/ci.entity';
import { CmdbCiRel } from '../../../cmdb/ci-rel/ci-rel.entity';
import { CmdbService as CmdbServiceEntity } from '../../../cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../../../cmdb/service-offering/cmdb-service-offering.entity';
import { CmdbServiceCi } from '../../../cmdb/service-ci/cmdb-service-ci.entity';
import { ItsmChange } from '../../change.entity';
import { ItsmMajorIncident } from '../../../major-incident/major-incident.entity';
import { ItsmMajorIncidentLink } from '../../../major-incident/major-incident-link.entity';
import { MajorIncidentLinkType } from '../../../major-incident/major-incident.enums';
import {
  ImpactBucket,
  ImpactBucketsSummary,
  TopologyCompletenessConfidence,
  TopologyImpactResponse,
  TopologyImpactedNode,
  TopologyImpactPath,
  TopologyBlastRadiusMetrics,
  TopologyRiskFactor,
  FragilitySignal,
  RcaTopologyHypothesesResponse,
  RcaHypothesis,
  RcaEvidence,
  RcaContradiction,
  RcaRecommendedAction,
} from './dto/topology-impact.dto';

// ============================================================================
// Constants & Weights
// ============================================================================

/** Maximum traversal depth for blast radius */
const MAX_BLAST_RADIUS_DEPTH = 3;

/** Maximum nodes before truncation */
const MAX_ANALYSIS_NODES = 500;

/** Maximum paths to return in response */
const MAX_TOP_PATHS = 10;

/** Maximum hypotheses to return */
const MAX_HYPOTHESES = 15;

/**
 * Topology risk scoring weights.
 * Each metric contributes a weighted sub-score to the overall topology risk.
 *
 * Rationale:
 * - impactedNodeCount (25): More nodes = more blast radius
 * - criticalCiRatio (20): Critical CIs amplify risk significantly
 * - maxChainDepth (15): Deeper chains = harder to predict cascade
 * - crossServicePropagation (20): Cross-service = wider organizational impact
 * - fragilityScore (20): Single points of failure magnify risk
 */
const TOPOLOGY_RISK_WEIGHTS = {
  impactedNodeCount: 25,
  criticalCiRatio: 20,
  maxChainDepth: 15,
  crossServicePropagation: 20,
  fragilityScore: 20,
};

/**
 * RCA hypothesis scoring weights.
 *
 * Rationale:
 * - common_upstream_dependency (90 base): Shared upstream is the most common root cause
 * - recent_change_on_shared_node (85 base): Changes are frequent cause of incidents
 * - single_point_of_failure (75 base): SPOFs are natural suspects
 * - high_impact_node (60 base): High fan-out nodes can cascade failures
 * - cross_service_dependency (70 base): Cross-service deps often cause wide outages
 */
const RCA_BASE_SCORES: Record<RcaHypothesis['type'], number> = {
  common_upstream_dependency: 90,
  recent_change_on_shared_node: 85,
  single_point_of_failure: 75,
  high_impact_node: 60,
  cross_service_dependency: 70,
};

// ============================================================================
// Internal graph types
// ============================================================================

interface GraphNode {
  id: string;
  type: 'ci' | 'service' | 'service_offering';
  label: string;
  className?: string;
  criticality?: string;
  environment?: string;
  depth: number;
}

interface GraphEdge {
  sourceId: string;
  targetId: string;
  relationType: string;
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class TopologyImpactAnalysisService {
  private readonly logger = new Logger(TopologyImpactAnalysisService.name);

  constructor(
    @Optional()
    @InjectRepository(CmdbCi)
    private readonly ciRepo?: Repository<CmdbCi>,
    @Optional()
    @InjectRepository(CmdbCiRel)
    private readonly ciRelRepo?: Repository<CmdbCiRel>,
    @Optional()
    @InjectRepository(CmdbServiceEntity)
    private readonly serviceRepo?: Repository<CmdbServiceEntity>,
    @Optional()
    @InjectRepository(CmdbServiceOffering)
    private readonly offeringRepo?: Repository<CmdbServiceOffering>,
    @Optional()
    @InjectRepository(CmdbServiceCi)
    private readonly serviceCiRepo?: Repository<CmdbServiceCi>,
    @Optional()
    @InjectRepository(ItsmChange)
    private readonly changeRepo?: Repository<ItsmChange>,
    @Optional()
    @InjectRepository(ItsmMajorIncidentLink)
    private readonly miLinkRepo?: Repository<ItsmMajorIncidentLink>,
  ) {}

  // ==========================================================================
  // PUBLIC: Change Topology Impact
  // ==========================================================================

  /**
   * Calculate topology-based blast radius for a change.
   *
   * Algorithm:
   * 1. Find the change's service → get linked CIs via ServiceCi
   * 2. BFS from those root CIs up to MAX_BLAST_RADIUS_DEPTH
   * 3. Compute metrics: impacted nodes by depth, services, critical CIs
   * 4. Detect fragility signals (SPOFs, high fan-out, deep chains)
   * 5. Score the topology risk (0-100)
   * 6. Generate human-readable explanation
   */
  async calculateTopologyImpact(
    tenantId: string,
    change: ItsmChange,
  ): Promise<TopologyImpactResponse> {
    const warnings: string[] = [];
    const computedAt = new Date().toISOString();

    // Step 1: Find root CIs from the change's service
    const rootCiIds = await this.findRootCisForChange(tenantId, change);
    if (rootCiIds.length === 0) {
      warnings.push(
        'No CMDB CIs linked to change service; blast radius is empty',
      );
      return this.emptyImpactResponse(change.id, computedAt, warnings);
    }

    // Step 2: BFS traversal to build the impact graph
    const { nodes, edges, truncated } = await this.bfsTraversal(
      tenantId,
      rootCiIds,
      MAX_BLAST_RADIUS_DEPTH,
    );
    if (truncated) {
      warnings.push(`Graph truncated at ${MAX_ANALYSIS_NODES} nodes`);
    }

    // Step 3: Compute blast radius metrics
    const metrics = this.computeBlastRadiusMetrics(nodes, edges);

    // Step 4: Detect fragility signals
    const fragilitySignals = this.detectFragilitySignals(nodes, edges);

    // Step 5: Find top contributing paths
    const topPaths = this.findTopPaths(nodes, edges, rootCiIds);

    // Step 6: Score topology risk
    const topologyRiskScore = this.calculateTopologyRiskScore(
      metrics,
      fragilitySignals,
    );

    // Step 7: Generate explanation
    const riskExplanation = this.generateRiskExplanation(
      metrics,
      fragilitySignals,
      topologyRiskScore,
    );

    const { bucketByNodeId, summary: impactBuckets } =
      this.classifyImpactBuckets(nodes, edges);

    const completenessConfidence = this.computeTopologyCompletenessConfidence(
      nodes,
      edges,
      truncated,
    );

    const riskFactors = this.computeRiskFactors(metrics, fragilitySignals);

    // Build impacted nodes list (exclude root nodes, sorted by depth then criticality)
    const impactedNodes: TopologyImpactedNode[] = Array.from(nodes.values())
      .filter((n) => n.depth > 0)
      .sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        const aCrit = this.criticalityWeight(a.criticality);
        const bCrit = this.criticalityWeight(b.criticality);
        return bCrit - aCrit;
      })
      .map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        className: n.className,
        depth: n.depth,
        criticality: n.criticality,
        environment: n.environment,
        impactBucket: bucketByNodeId.get(n.id),
      }));

    return {
      changeId: change.id,
      rootNodeIds: rootCiIds,
      metrics,
      impactedNodes,
      topPaths,
      fragilitySignals,
      topologyRiskScore,
      riskExplanation,
      computedAt,
      warnings,

      // Phase 2 additions (backward compatible)
      impactBuckets,
      impactedServicesCount: metrics.impactedServiceCount,
      impactedOfferingsCount: metrics.impactedOfferingCount,
      impactedCriticalCisCount: metrics.criticalCiCount,
      completenessConfidence,
      riskFactors,
    };
  }

  // ==========================================================================
  // PUBLIC: Major Incident RCA Topology Hypotheses
  // ==========================================================================

  /**
   * Generate RCA topology hypotheses for a major incident.
   *
   * Algorithm:
   * 1. Find the MI's primary service + linked CIs/services from MI links
   * 2. BFS from those root nodes to build the neighborhood graph
   * 3. For each node, evaluate rule-based hypothesis generators:
   *    a. Common upstream dependency (node is upstream of multiple affected services)
   *    b. Recent change on shared node (node had a recent change and is connected to affected)
   *    c. Single point of failure (node has high in-degree + is on critical path)
   *    d. High impact node (high fan-out, many downstream dependents)
   *    e. Cross-service dependency (node bridges multiple service domains)
   * 4. Rank hypotheses by score descending
   * 5. Attach recommended follow-up actions
   */
  async generateRcaHypotheses(
    tenantId: string,
    majorIncident: ItsmMajorIncident,
  ): Promise<RcaTopologyHypothesesResponse> {
    const warnings: string[] = [];
    const computedAt = new Date().toISOString();

    // Step 1: Gather root nodes from MI
    const { rootServiceIds, linkedCiIds } = await this.gatherMiRootNodes(
      tenantId,
      majorIncident,
    );

    if (rootServiceIds.length === 0 && linkedCiIds.length === 0) {
      warnings.push(
        'No services or CIs linked to major incident; RCA analysis is empty',
      );
      return {
        majorIncidentId: majorIncident.id,
        rootServiceIds,
        linkedCiIds,
        hypotheses: [],
        nodesAnalyzed: 0,
        computedAt,
        warnings,
        rankingAlgorithm: 'weighted_evidence_v1',
      };
    }

    // Get CIs for linked services
    const allRootCiIds = [...linkedCiIds];
    for (const svcId of rootServiceIds) {
      const svcCis = await this.findCisForService(tenantId, svcId);
      for (const ciId of svcCis) {
        if (!allRootCiIds.includes(ciId)) {
          allRootCiIds.push(ciId);
        }
      }
    }

    // Step 2: BFS from root nodes
    const { nodes, edges, truncated } = await this.bfsTraversal(
      tenantId,
      allRootCiIds,
      MAX_BLAST_RADIUS_DEPTH,
    );
    if (truncated) {
      warnings.push(`Graph truncated at ${MAX_ANALYSIS_NODES} nodes`);
    }

    // Step 3-4: Generate and rank hypotheses
    const hypotheses: RcaHypothesis[] = [];

    // Build adjacency structures for analysis
    const adjacency = this.buildAdjacencyMap(edges);
    const reverseAdjacency = this.buildReverseAdjacencyMap(edges);
    const affectedNodeIds = new Set(allRootCiIds);

    // Find recent changes for nodes
    const recentChanges = await this.findRecentChangesForCis(
      tenantId,
      Array.from(nodes.keys()),
    );

    for (const [nodeId, node] of nodes) {
      // Skip root/affected nodes themselves as suspects
      if (affectedNodeIds.has(nodeId) && node.depth === 0) continue;

      // Rule A: Common upstream dependency
      const upstreamHypothesis = this.evaluateCommonUpstream(
        nodeId,
        node,
        adjacency,
        affectedNodeIds,
        rootServiceIds,
      );
      if (upstreamHypothesis) hypotheses.push(upstreamHypothesis);

      // Rule B: Recent change on shared node
      const changeHypothesis = this.evaluateRecentChange(
        nodeId,
        node,
        recentChanges,
        adjacency,
        affectedNodeIds,
      );
      if (changeHypothesis) hypotheses.push(changeHypothesis);

      // Rule C: Single point of failure
      const spofHypothesis = this.evaluateSinglePointOfFailure(
        nodeId,
        node,
        adjacency,
        reverseAdjacency,
        affectedNodeIds,
      );
      if (spofHypothesis) hypotheses.push(spofHypothesis);

      // Rule D: High impact node
      const highImpactHypothesis = this.evaluateHighImpactNode(
        nodeId,
        node,
        adjacency,
        affectedNodeIds,
      );
      if (highImpactHypothesis) hypotheses.push(highImpactHypothesis);

      // Rule E: Cross-service dependency
      const crossSvcHypothesis = this.evaluateCrossServiceDependency(
        nodeId,
        node,
        adjacency,
        nodes,
        rootServiceIds,
      );
      if (crossSvcHypothesis) hypotheses.push(crossSvcHypothesis);
    }

    // De-duplicate by hypothesis id
    const deduped = this.deduplicateHypotheses(hypotheses);

    // Phase 2: apply evidence weighting + contradiction markers, then rank
    const enriched = this.enrichRcaHypotheses(deduped, nodes, edges, truncated);
    const ranked = enriched
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_HYPOTHESES);

    return {
      majorIncidentId: majorIncident.id,
      rootServiceIds,
      linkedCiIds,
      hypotheses: ranked,
      nodesAnalyzed: nodes.size,
      computedAt,
      warnings,
      rankingAlgorithm: 'weighted_evidence_v1',
    };
  }

  // ==========================================================================
  // PUBLIC: Get topology risk factor for existing risk scoring integration
  // ==========================================================================

  /**
   * Calculate just the topology risk sub-score and evidence string
   * for integration into the existing RiskScoringService breakdown.
   */
  async getTopologyRiskFactor(
    tenantId: string,
    change: ItsmChange,
  ): Promise<{ score: number; evidence: string }> {
    try {
      const impact = await this.calculateTopologyImpact(tenantId, change);
      return {
        score: impact.topologyRiskScore,
        evidence: impact.riskExplanation,
      };
    } catch (err) {
      this.logger.warn(`Topology risk factor calculation failed: ${err}`);
      return {
        score: 0,
        evidence: 'Topology analysis unavailable',
      };
    }
  }

  // ==========================================================================
  // PRIVATE: Graph Traversal
  // ==========================================================================

  /**
   * BFS traversal from root node IDs up to maxDepth.
   * Returns a map of discovered nodes and edges.
   */
  async bfsTraversal(
    tenantId: string,
    rootNodeIds: string[],
    maxDepth: number,
  ): Promise<{
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
    truncated: boolean;
  }> {
    const nodeMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();
    let truncated = false;

    // Load root CIs
    const rootCis = await this.findCisForTenant(tenantId, rootNodeIds);
    for (const ci of rootCis) {
      nodeMap.set(ci.id, {
        id: ci.id,
        type: 'ci',
        label: ci.name,
        className: ci.ciClass?.name,
        criticality: ci.ciClass?.name === 'server' ? 'high' : undefined,
        environment: ci.environment,
        depth: 0,
      });
      visited.add(ci.id);
    }

    let frontier = rootNodeIds.filter((id) => nodeMap.has(id));

    for (let depth = 0; depth < maxDepth; depth++) {
      if (frontier.length === 0) break;
      if (nodeMap.size >= MAX_ANALYSIS_NODES) {
        truncated = true;
        break;
      }

      const nextFrontier: string[] = [];

      // Fetch CI-CI relationships
      const rels = await this.findCiRelationsForNodes(tenantId, frontier);
      for (const rel of rels) {
        const edgeKey = `${rel.sourceCiId}|${rel.targetCiId}|${rel.type}`;
        const reverseKey = `${rel.targetCiId}|${rel.sourceCiId}|${rel.type}`;
        const exists = edges.some(
          (e) =>
            `${e.sourceId}|${e.targetId}|${e.relationType}` === edgeKey ||
            `${e.sourceId}|${e.targetId}|${e.relationType}` === reverseKey,
        );
        if (!exists) {
          edges.push({
            sourceId: rel.sourceCiId,
            targetId: rel.targetCiId,
            relationType: rel.type,
          });
        }

        for (const neighborId of [rel.sourceCiId, rel.targetCiId]) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextFrontier.push(neighborId);
            if (nodeMap.size >= MAX_ANALYSIS_NODES) {
              truncated = true;
              break;
            }
          }
        }
        if (truncated) break;
      }

      // Fetch Service-CI links for frontier
      if (!truncated) {
        const svcCiLinks = await this.findServiceCiLinksForCis(
          tenantId,
          frontier,
        );
        for (const link of svcCiLinks) {
          const serviceNodeId = `service:${link.serviceId}`;
          if (!nodeMap.has(serviceNodeId) && link.service) {
            nodeMap.set(serviceNodeId, {
              id: serviceNodeId,
              type: 'service',
              label: link.service.name,
              criticality: link.service.criticality ?? undefined,
              depth: depth + 1,
            });
          }
          const edgeExists = edges.some(
            (e) =>
              e.sourceId === serviceNodeId &&
              e.targetId === link.ciId &&
              e.relationType === link.relationshipType,
          );
          if (!edgeExists) {
            edges.push({
              sourceId: serviceNodeId,
              targetId: link.ciId,
              relationType: link.relationshipType,
            });
          }
        }
      }

      // Load new CI nodes
      if (nextFrontier.length > 0 && !truncated) {
        const newCis = await this.findCisForTenant(tenantId, nextFrontier);
        for (const ci of newCis) {
          if (!nodeMap.has(ci.id)) {
            nodeMap.set(ci.id, {
              id: ci.id,
              type: 'ci',
              label: ci.name,
              className: ci.ciClass?.name,
              criticality: ci.ciClass?.name === 'server' ? 'high' : undefined,
              environment: ci.environment,
              depth: depth + 1,
            });
          }
        }
      }

      frontier = nextFrontier;
    }

    return { nodes: nodeMap, edges, truncated };
  }

  // ==========================================================================
  // PRIVATE: Blast Radius Metrics
  // ==========================================================================

  computeBlastRadiusMetrics(
    nodes: Map<string, GraphNode>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    edges: GraphEdge[],
  ): TopologyBlastRadiusMetrics {
    const impactedByDepth: Record<number, number> = {};
    let impactedServiceCount = 0;
    let impactedOfferingCount = 0;
    let impactedCiCount = 0;
    let criticalCiCount = 0;
    let maxChainDepth = 0;
    const serviceIds = new Set<string>();

    for (const node of nodes.values()) {
      // Track depth distribution
      impactedByDepth[node.depth] = (impactedByDepth[node.depth] || 0) + 1;
      maxChainDepth = Math.max(maxChainDepth, node.depth);

      if (node.type === 'service') {
        impactedServiceCount++;
        serviceIds.add(node.id);
      } else if (node.type === 'service_offering') {
        impactedOfferingCount++;
      } else if (node.type === 'ci') {
        impactedCiCount++;
        if (node.criticality === 'high' || node.criticality === 'critical') {
          criticalCiCount++;
        }
      }
    }

    const crossServicePropagation = serviceIds.size > 1;
    const crossServiceCount = serviceIds.size;

    return {
      totalImpactedNodes: nodes.size,
      impactedByDepth,
      impactedServiceCount,
      impactedOfferingCount,
      impactedCiCount,
      criticalCiCount,
      maxChainDepth,
      crossServicePropagation,
      crossServiceCount,
    };
  }

  // ==========================================================================
  // PRIVATE: Fragility Detection
  // ==========================================================================

  detectFragilitySignals(
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
  ): FragilitySignal[] {
    const signals: FragilitySignal[] = [];

    // Build degree maps
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    for (const edge of edges) {
      inDegree.set(edge.targetId, (inDegree.get(edge.targetId) || 0) + 1);
      outDegree.set(edge.sourceId, (outDegree.get(edge.sourceId) || 0) + 1);
    }

    for (const [nodeId, node] of nodes) {
      const inDeg = inDegree.get(nodeId) || 0;
      const outDeg = outDegree.get(nodeId) || 0;

      // Single point of failure: node has exactly 1 incoming and multiple outgoing
      // (many depend on it, but it has only one source of input)
      if (inDeg <= 1 && outDeg >= 3) {
        signals.push({
          type: 'single_point_of_failure',
          nodeId,
          nodeLabel: node.label,
          reason: `Node "${node.label}" has ${outDeg} downstream dependents but only ${inDeg} upstream source(s). Failure would cascade to ${outDeg} nodes.`,
          severity: Math.min(95, 50 + outDeg * 10),
        });
      }

      // No redundancy: node has exactly 1 incoming edge (single dependency path)
      if (inDeg === 1 && outDeg === 0 && node.type === 'ci') {
        signals.push({
          type: 'no_redundancy',
          nodeId,
          nodeLabel: node.label,
          reason: `CI "${node.label}" has a single dependency path with no redundancy.`,
          severity: 40,
        });
      }

      // High fan-out: node connects to many others
      if (outDeg >= 5) {
        signals.push({
          type: 'high_fan_out',
          nodeId,
          nodeLabel: node.label,
          reason: `Node "${node.label}" has ${outDeg} direct downstream connections - high fan-out amplifies blast radius.`,
          severity: Math.min(90, 40 + outDeg * 8),
        });
      }

      // Deep chain: node at depth >= 3
      if (node.depth >= 3) {
        signals.push({
          type: 'deep_chain',
          nodeId,
          nodeLabel: node.label,
          reason: `Node "${node.label}" is at depth ${node.depth} in the dependency chain - deep chains are harder to predict and control.`,
          severity: Math.min(80, 30 + node.depth * 15),
        });
      }
    }

    return signals.sort((a, b) => b.severity - a.severity);
  }

  // ==========================================================================
  // PRIVATE: Phase 2: Impact Buckets & Confidence
  // ==========================================================================

  private classifyImpactBuckets(
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
  ): {
    bucketByNodeId: Map<string, ImpactBucket>;
    summary: ImpactBucketsSummary;
  } {
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    for (const edge of edges) {
      inDegree.set(edge.targetId, (inDegree.get(edge.targetId) || 0) + 1);
      outDegree.set(edge.sourceId, (outDegree.get(edge.sourceId) || 0) + 1);
    }

    const summary: ImpactBucketsSummary = {
      direct: 0,
      downstream: 0,
      criticalPath: 0,
      unknownConfidence: 0,
    };

    const bucketByNodeId = new Map<string, ImpactBucket>();

    for (const node of nodes.values()) {
      if (node.depth <= 0) continue;

      const deg = (inDegree.get(node.id) || 0) + (outDegree.get(node.id) || 0);

      const isCriticalPath =
        node.type !== 'ci' || this.criticalityWeight(node.criticality) >= 80;
      const isUnknownConfidence =
        node.type === 'ci' && (!node.className || deg === 0);

      let bucket: ImpactBucket;
      if (isCriticalPath) {
        bucket = 'critical_path';
      } else if (isUnknownConfidence) {
        bucket = 'unknown_confidence';
      } else if (node.depth === 1) {
        bucket = 'direct';
      } else {
        bucket = 'downstream';
      }

      bucketByNodeId.set(node.id, bucket);

      if (bucket === 'direct') summary.direct++;
      if (bucket === 'downstream') summary.downstream++;
      if (bucket === 'critical_path') summary.criticalPath++;
      if (bucket === 'unknown_confidence') summary.unknownConfidence++;
    }

    return { bucketByNodeId, summary };
  }

  private computeTopologyCompletenessConfidence(
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    truncated: boolean,
  ): TopologyCompletenessConfidence {
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    for (const edge of edges) {
      inDegree.set(edge.targetId, (inDegree.get(edge.targetId) || 0) + 1);
      outDegree.set(edge.sourceId, (outDegree.get(edge.sourceId) || 0) + 1);
    }

    const impactedCiNodes = Array.from(nodes.values()).filter(
      (n) => n.type === 'ci' && n.depth > 0,
    );

    const missingClassCount = impactedCiNodes.filter(
      (n) => !n.className,
    ).length;
    const isolatedNodeCount = impactedCiNodes.filter((n) => {
      const deg = (inDegree.get(n.id) || 0) + (outDegree.get(n.id) || 0);
      return deg === 0;
    }).length;

    // Phase 2: health rules are not yet wired into this service.
    // We surface this explicitly as a confidence degrading factor.
    const healthRulesAvailable = false;

    const degradingFactors: TopologyCompletenessConfidence['degradingFactors'] =
      [];

    if (missingClassCount > 0) {
      degradingFactors.push({
        code: 'MISSING_CLASS_SEMANTICS',
        description: `${missingClassCount} impacted CI(s) missing class semantics (ciClass)`,
        impact: Math.min(40, 8 + missingClassCount * 4),
      });
    }

    if (isolatedNodeCount > 0) {
      degradingFactors.push({
        code: 'ISOLATED_NODES',
        description: `${isolatedNodeCount} impacted CI(s) have no relationships in the analyzed subgraph`,
        impact: Math.min(35, 5 + isolatedNodeCount * 5),
      });
    }

    if (!healthRulesAvailable) {
      degradingFactors.push({
        code: 'NO_HEALTH_RULES',
        description:
          'No health rules available to validate topology assumptions',
        impact: 10,
      });
    }

    if (truncated) {
      degradingFactors.push({
        code: 'GRAPH_TRUNCATED',
        description: `Traversal truncated at ${MAX_ANALYSIS_NODES} nodes (caps applied)`,
        impact: 15,
      });
    }

    const score = Math.max(
      0,
      100 - degradingFactors.reduce((sum, f) => sum + f.impact, 0),
    );

    const label: TopologyCompletenessConfidence['label'] =
      score >= 80
        ? 'HIGH'
        : score >= 60
          ? 'MEDIUM'
          : score >= 30
            ? 'LOW'
            : 'VERY_LOW';

    return {
      score,
      label,
      degradingFactors,
      missingClassCount,
      isolatedNodeCount,
      healthRulesAvailable,
    };
  }

  private computeRiskFactors(
    metrics: TopologyBlastRadiusMetrics,
    fragilitySignals: FragilitySignal[],
  ): TopologyRiskFactor[] {
    // Mirror sub-score computation in calculateTopologyRiskScore for explainability.

    let nodeCountScore: number;
    if (metrics.totalImpactedNodes <= 1) nodeCountScore = 5;
    else if (metrics.totalImpactedNodes <= 5) nodeCountScore = 20;
    else if (metrics.totalImpactedNodes <= 15) nodeCountScore = 45;
    else if (metrics.totalImpactedNodes <= 30) nodeCountScore = 65;
    else if (metrics.totalImpactedNodes <= 50) nodeCountScore = 80;
    else nodeCountScore = 95;

    let criticalCiScore: number;
    if (metrics.impactedCiCount === 0) {
      criticalCiScore = 0;
    } else {
      const ratio = metrics.criticalCiCount / metrics.impactedCiCount;
      criticalCiScore = Math.min(100, Math.round(ratio * 120));
    }

    let depthScore: number;
    if (metrics.maxChainDepth <= 1) depthScore = 10;
    else if (metrics.maxChainDepth === 2) depthScore = 40;
    else depthScore = Math.min(95, 40 + metrics.maxChainDepth * 20);

    let crossServiceScore: number;
    if (!metrics.crossServicePropagation) crossServiceScore = 5;
    else if (metrics.crossServiceCount <= 2) crossServiceScore = 50;
    else crossServiceScore = Math.min(95, 50 + metrics.crossServiceCount * 15);

    let fragilityScore = 0;
    if (fragilitySignals.length > 0) {
      const topSignals = [...fragilitySignals]
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 3);
      fragilityScore = Math.round(
        topSignals.reduce((sum, s) => sum + s.severity, 0) / topSignals.length,
      );
    }

    const severityFromSubScore = (
      s: number,
    ): TopologyRiskFactor['severity'] => {
      if (s >= 80) return 'critical';
      if (s >= 50) return 'warning';
      return 'info';
    };

    const mk = (
      key: string,
      label: string,
      subScore: number,
      maxContribution: number,
      reason: string,
    ): TopologyRiskFactor => ({
      key,
      label,
      contribution: Math.round((subScore / 100) * maxContribution),
      maxContribution,
      reason,
      severity: severityFromSubScore(subScore),
    });

    const factors: TopologyRiskFactor[] = [
      mk(
        'impactedNodeCount',
        'Blast radius size',
        nodeCountScore,
        TOPOLOGY_RISK_WEIGHTS.impactedNodeCount,
        `${metrics.totalImpactedNodes} node(s) impacted`,
      ),
      mk(
        'criticalCiRatio',
        'Critical CI concentration',
        criticalCiScore,
        TOPOLOGY_RISK_WEIGHTS.criticalCiRatio,
        metrics.impactedCiCount === 0
          ? 'No CIs impacted'
          : `${metrics.criticalCiCount}/${metrics.impactedCiCount} impacted CIs are critical`,
      ),
      mk(
        'maxChainDepth',
        'Dependency chain depth',
        depthScore,
        TOPOLOGY_RISK_WEIGHTS.maxChainDepth,
        `Max depth is ${metrics.maxChainDepth}`,
      ),
      mk(
        'crossServicePropagation',
        'Cross-service propagation',
        crossServiceScore,
        TOPOLOGY_RISK_WEIGHTS.crossServicePropagation,
        metrics.crossServicePropagation
          ? `Touches ${metrics.crossServiceCount} service(s)`
          : 'Contained within a single service boundary',
      ),
      mk(
        'fragilityScore',
        'Fragility signals',
        fragilityScore,
        TOPOLOGY_RISK_WEIGHTS.fragilityScore,
        fragilitySignals.length === 0
          ? 'No fragility signals detected'
          : `${fragilitySignals.length} fragility signal(s) detected`,
      ),
    ];

    return factors.sort((a, b) => b.contribution - a.contribution);
  }

  // ==========================================================================
  // PRIVATE: Top Paths
  // ==========================================================================

  findTopPaths(
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    rootNodeIds: string[],
  ): TopologyImpactPath[] {
    const paths: TopologyImpactPath[] = [];
    const adjacency = this.buildAdjacencyMap(edges);

    // DFS from each root to find all paths to leaf/critical nodes
    for (const rootId of rootNodeIds) {
      const rootNode = nodes.get(rootId);
      if (!rootNode) continue;

      this.dfsForPaths(
        rootId,
        [rootId],
        [rootNode.label],
        [],
        adjacency,
        nodes,
        new Set([rootId]),
        paths,
      );
    }

    // Sort by depth descending (longest paths first), take top N
    return paths.sort((a, b) => b.depth - a.depth).slice(0, MAX_TOP_PATHS);
  }

  private dfsForPaths(
    currentId: string,
    currentNodeIds: string[],
    currentLabels: string[],
    currentRelTypes: string[],
    adjacency: Map<string, Array<{ targetId: string; relationType: string }>>,
    nodes: Map<string, GraphNode>,
    visited: Set<string>,
    result: TopologyImpactPath[],
  ): void {
    const neighbors = adjacency.get(currentId) || [];
    let isLeaf = true;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.targetId)) continue;
      isLeaf = false;

      const neighborNode = nodes.get(neighbor.targetId);
      if (!neighborNode) continue;

      visited.add(neighbor.targetId);
      this.dfsForPaths(
        neighbor.targetId,
        [...currentNodeIds, neighbor.targetId],
        [...currentLabels, neighborNode.label],
        [...currentRelTypes, neighbor.relationType],
        adjacency,
        nodes,
        visited,
        result,
      );
      visited.delete(neighbor.targetId);
    }

    // Record path if it's a leaf or reaches depth >= 2
    if (isLeaf || currentNodeIds.length >= 3) {
      result.push({
        nodeIds: [...currentNodeIds],
        nodeLabels: [...currentLabels],
        depth: currentNodeIds.length - 1,
        relationTypes: [...currentRelTypes],
      });
    }
  }

  // ==========================================================================
  // PRIVATE: Topology Risk Scoring
  // ==========================================================================

  calculateTopologyRiskScore(
    metrics: TopologyBlastRadiusMetrics,
    fragilitySignals: FragilitySignal[],
  ): number {
    // Sub-score 1: Impacted node count (0-100)
    let nodeCountScore: number;
    if (metrics.totalImpactedNodes <= 1) {
      nodeCountScore = 5;
    } else if (metrics.totalImpactedNodes <= 5) {
      nodeCountScore = 20;
    } else if (metrics.totalImpactedNodes <= 15) {
      nodeCountScore = 45;
    } else if (metrics.totalImpactedNodes <= 30) {
      nodeCountScore = 65;
    } else if (metrics.totalImpactedNodes <= 50) {
      nodeCountScore = 80;
    } else {
      nodeCountScore = 95;
    }

    // Sub-score 2: Critical CI ratio (0-100)
    let criticalCiScore: number;
    if (metrics.impactedCiCount === 0) {
      criticalCiScore = 0;
    } else {
      const ratio = metrics.criticalCiCount / metrics.impactedCiCount;
      criticalCiScore = Math.min(100, Math.round(ratio * 120));
    }

    // Sub-score 3: Max chain depth (0-100)
    let depthScore: number;
    if (metrics.maxChainDepth <= 1) {
      depthScore = 10;
    } else if (metrics.maxChainDepth === 2) {
      depthScore = 40;
    } else {
      depthScore = Math.min(95, 40 + metrics.maxChainDepth * 20);
    }

    // Sub-score 4: Cross-service propagation (0-100)
    let crossServiceScore: number;
    if (!metrics.crossServicePropagation) {
      crossServiceScore = 5;
    } else if (metrics.crossServiceCount <= 2) {
      crossServiceScore = 50;
    } else {
      crossServiceScore = Math.min(95, 50 + metrics.crossServiceCount * 15);
    }

    // Sub-score 5: Fragility (0-100) - average of top 3 fragility severities
    let fragilityScore = 0;
    if (fragilitySignals.length > 0) {
      const topSignals = fragilitySignals
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 3);
      fragilityScore = Math.round(
        topSignals.reduce((sum, s) => sum + s.severity, 0) / topSignals.length,
      );
    }

    // Weighted sum
    const totalWeight = Object.values(TOPOLOGY_RISK_WEIGHTS).reduce(
      (sum, w) => sum + w,
      0,
    );
    const weightedSum =
      nodeCountScore * TOPOLOGY_RISK_WEIGHTS.impactedNodeCount +
      criticalCiScore * TOPOLOGY_RISK_WEIGHTS.criticalCiRatio +
      depthScore * TOPOLOGY_RISK_WEIGHTS.maxChainDepth +
      crossServiceScore * TOPOLOGY_RISK_WEIGHTS.crossServicePropagation +
      fragilityScore * TOPOLOGY_RISK_WEIGHTS.fragilityScore;

    return Math.round(weightedSum / totalWeight);
  }

  // ==========================================================================
  // PRIVATE: Risk Explanation
  // ==========================================================================

  generateRiskExplanation(
    metrics: TopologyBlastRadiusMetrics,
    fragilitySignals: FragilitySignal[],
    score: number,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Topology analysis: ${metrics.totalImpactedNodes} node(s) in blast radius across ${metrics.maxChainDepth} depth level(s).`,
    );

    if (metrics.criticalCiCount > 0) {
      parts.push(`${metrics.criticalCiCount} critical CI(s) impacted.`);
    }

    if (metrics.crossServicePropagation) {
      parts.push(
        `Blast radius crosses ${metrics.crossServiceCount} service boundaries.`,
      );
    }

    if (fragilitySignals.length > 0) {
      const spofs = fragilitySignals.filter(
        (s) => s.type === 'single_point_of_failure',
      );
      if (spofs.length > 0) {
        parts.push(`${spofs.length} single point(s) of failure detected.`);
      }
    }

    const level =
      score >= 75
        ? 'CRITICAL'
        : score >= 50
          ? 'HIGH'
          : score >= 25
            ? 'MEDIUM'
            : 'LOW';
    parts.push(`Topology risk level: ${level} (${score}/100).`);

    return parts.join(' ');
  }

  // ==========================================================================
  // PRIVATE: Phase 2: RCA evidence weighting & contradiction markers
  // ==========================================================================

  private enrichRcaHypotheses(
    hypotheses: RcaHypothesis[],
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    truncated: boolean,
  ): RcaHypothesis[] {
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    for (const edge of edges) {
      inDegree.set(edge.targetId, (inDegree.get(edge.targetId) || 0) + 1);
      outDegree.set(edge.sourceId, (outDegree.get(edge.sourceId) || 0) + 1);
    }

    const weightEvidence = (
      type: RcaEvidence['type'],
    ): { weight: number; isTopologyBased: boolean } => {
      switch (type) {
        case 'topology_path':
          return { weight: 40, isTopologyBased: true };
        case 'health_violation':
          return { weight: 35, isTopologyBased: false };
        case 'recent_change':
          return { weight: 30, isTopologyBased: false };
        case 'incident_history':
          return { weight: 20, isTopologyBased: false };
        case 'customer_risk':
          return { weight: 15, isTopologyBased: false };
        default:
          return { weight: 10, isTopologyBased: false };
      }
    };

    const clamp = (n: number, min: number, max: number): number =>
      Math.max(min, Math.min(max, n));

    return hypotheses.map((h) => {
      const suspect = nodes.get(h.suspectNodeId);
      const deg =
        (inDegree.get(h.suspectNodeId) || 0) +
        (outDegree.get(h.suspectNodeId) || 0);

      const weightedEvidence: RcaEvidence[] = h.evidence.map((e) => {
        const base = weightEvidence(e.type);
        return {
          ...e,
          weight: e.weight ?? base.weight,
          isTopologyBased: e.isTopologyBased ?? base.isTopologyBased,
        };
      });

      const evidenceWeight = clamp(
        weightedEvidence.reduce((sum, e) => sum + (e.weight ?? 0), 0),
        0,
        100,
      );

      const contradictions: RcaContradiction[] = [];

      if (truncated) {
        contradictions.push({
          code: 'GRAPH_TRUNCATED',
          description: `Topology traversal hit caps (${MAX_ANALYSIS_NODES} nodes); ranking confidence reduced`,
          confidenceReduction: 10,
        });
      }

      if (suspect?.type === 'ci' && !suspect.className) {
        contradictions.push({
          code: 'MISSING_CLASS_SEMANTICS',
          description:
            'CI class semantics missing for suspect node; relationship meaning may be incomplete',
          confidenceReduction: 10,
        });
      }

      if (suspect?.type === 'ci' && deg === 0) {
        contradictions.push({
          code: 'ISOLATED_NODE',
          description:
            'Suspect CI has no relationships in the analyzed subgraph; may indicate sparse topology data',
          confidenceReduction: 15,
        });
      }

      const contradictionPenalty = contradictions.reduce(
        (sum, c) => sum + c.confidenceReduction,
        0,
      );

      // Weighted ranking: keep existing rule-based score, then re-weight by evidence.
      // Deterministic (no timestamps/randomness).
      const score = clamp(
        Math.round(h.score * 0.7 + evidenceWeight * 0.3 - contradictionPenalty),
        0,
        100,
      );

      return {
        ...h,
        score,
        evidence: weightedEvidence,
        evidenceWeight,
        contradictions,
        corroboratingEvidenceCount: weightedEvidence.length,
        contradictionCount: contradictions.length,
      };
    });
  }

  // ==========================================================================
  // PRIVATE: RCA Hypothesis Evaluators
  // ==========================================================================

  private evaluateCommonUpstream(
    nodeId: string,
    node: GraphNode,
    adjacency: Map<string, Array<{ targetId: string; relationType: string }>>,
    affectedNodeIds: Set<string>,
    rootServiceIds: string[],
  ): RcaHypothesis | null {
    // Check if this node is upstream of multiple affected nodes
    const downstream = adjacency.get(nodeId) || [];
    const affectedDownstream = downstream.filter((d) =>
      affectedNodeIds.has(d.targetId),
    );

    if (affectedDownstream.length < 2) return null;

    const affectedServiceIds = rootServiceIds.filter((svcId) => {
      const svcNodeId = `service:${svcId}`;
      return (
        downstream.some((d) => d.targetId === svcNodeId) ||
        affectedNodeIds.has(svcNodeId)
      );
    });

    const score = Math.min(
      100,
      RCA_BASE_SCORES.common_upstream_dependency +
        affectedDownstream.length * 3,
    );

    return {
      id: `common_upstream_${nodeId}`,
      type: 'common_upstream_dependency',
      score,
      suspectNodeId: nodeId,
      suspectNodeLabel: node.label,
      suspectNodeType: node.type,
      explanation: `"${node.label}" is a common upstream dependency for ${affectedDownstream.length} affected node(s). A failure here would cascade to all of them.`,
      evidence: [
        {
          type: 'topology_path',
          description: `Connected downstream to ${affectedDownstream.length} affected nodes via ${[...new Set(affectedDownstream.map((d) => d.relationType))].join(', ')} relationships.`,
        },
      ],
      affectedServiceIds,
      recommendedActions: this.buildRcaRecommendations(
        'common_upstream_dependency',
        node,
      ),
    };
  }

  private evaluateRecentChange(
    nodeId: string,
    node: GraphNode,
    recentChanges: Map<
      string,
      Array<{ id: string; title: string; number: string }>
    >,
    adjacency: Map<string, Array<{ targetId: string; relationType: string }>>,
    affectedNodeIds: Set<string>,
  ): RcaHypothesis | null {
    const changes = recentChanges.get(nodeId);
    if (!changes || changes.length === 0) return null;

    // Check connectivity to affected nodes
    const downstream = adjacency.get(nodeId) || [];
    const connectedToAffected = downstream.some((d) =>
      affectedNodeIds.has(d.targetId),
    );
    if (!connectedToAffected && !affectedNodeIds.has(nodeId)) return null;

    const score = Math.min(
      100,
      RCA_BASE_SCORES.recent_change_on_shared_node + changes.length * 5,
    );

    return {
      id: `recent_change_${nodeId}`,
      type: 'recent_change_on_shared_node',
      score,
      suspectNodeId: nodeId,
      suspectNodeLabel: node.label,
      suspectNodeType: node.type,
      explanation: `"${node.label}" had ${changes.length} recent change(s) and is connected to affected services. Changes: ${changes.map((c) => c.number).join(', ')}.`,
      evidence: changes.map((c) => ({
        type: 'recent_change' as const,
        description: `Change ${c.number}: ${c.title}`,
        referenceId: c.id,
        referenceLabel: c.number,
      })),
      affectedServiceIds: [],
      recommendedActions: this.buildRcaRecommendations(
        'recent_change_on_shared_node',
        node,
      ),
    };
  }

  private evaluateSinglePointOfFailure(
    nodeId: string,
    node: GraphNode,
    adjacency: Map<string, Array<{ targetId: string; relationType: string }>>,
    reverseAdjacency: Map<
      string,
      Array<{ sourceId: string; relationType: string }>
    >,
    affectedNodeIds: Set<string>,
  ): RcaHypothesis | null {
    const downstream = adjacency.get(nodeId) || [];
    const upstream = reverseAdjacency.get(nodeId) || [];

    // SPOF: few upstream sources but many downstream dependents
    if (upstream.length > 1 || downstream.length < 2) return null;

    // Must be connected to affected nodes
    const connectedToAffected = downstream.some((d) =>
      affectedNodeIds.has(d.targetId),
    );
    if (!connectedToAffected) return null;

    const score = Math.min(
      100,
      RCA_BASE_SCORES.single_point_of_failure + downstream.length * 5,
    );

    return {
      id: `spof_${nodeId}`,
      type: 'single_point_of_failure',
      score,
      suspectNodeId: nodeId,
      suspectNodeLabel: node.label,
      suspectNodeType: node.type,
      explanation: `"${node.label}" is a single point of failure with ${upstream.length} upstream source(s) and ${downstream.length} downstream dependent(s). Failure would cascade widely.`,
      evidence: [
        {
          type: 'topology_path',
          description: `Single point of failure: ${upstream.length} upstream, ${downstream.length} downstream connections.`,
        },
      ],
      affectedServiceIds: [],
      recommendedActions: this.buildRcaRecommendations(
        'single_point_of_failure',
        node,
      ),
    };
  }

  private evaluateHighImpactNode(
    nodeId: string,
    node: GraphNode,
    adjacency: Map<string, Array<{ targetId: string; relationType: string }>>,
    affectedNodeIds: Set<string>,
  ): RcaHypothesis | null {
    const downstream = adjacency.get(nodeId) || [];
    if (downstream.length < 4) return null;

    const connectedToAffected = downstream.some((d) =>
      affectedNodeIds.has(d.targetId),
    );
    if (!connectedToAffected) return null;

    const score = Math.min(
      100,
      RCA_BASE_SCORES.high_impact_node + downstream.length * 3,
    );

    return {
      id: `high_impact_${nodeId}`,
      type: 'high_impact_node',
      score,
      suspectNodeId: nodeId,
      suspectNodeLabel: node.label,
      suspectNodeType: node.type,
      explanation: `"${node.label}" has ${downstream.length} direct downstream connections. Its high fan-out means failure could cascade widely.`,
      evidence: [
        {
          type: 'topology_path',
          description: `High fan-out node with ${downstream.length} downstream connections.`,
        },
      ],
      affectedServiceIds: [],
      recommendedActions: this.buildRcaRecommendations(
        'high_impact_node',
        node,
      ),
    };
  }

  private evaluateCrossServiceDependency(
    nodeId: string,
    node: GraphNode,
    adjacency: Map<string, Array<{ targetId: string; relationType: string }>>,
    nodes: Map<string, GraphNode>,
    rootServiceIds: string[],
  ): RcaHypothesis | null {
    if (node.type !== 'ci') return null;

    const downstream = adjacency.get(nodeId) || [];
    // Find unique service domains this CI connects to
    const connectedServices = new Set<string>();
    for (const d of downstream) {
      const targetNode = nodes.get(d.targetId);
      if (targetNode?.type === 'service') {
        connectedServices.add(d.targetId);
      }
    }

    if (connectedServices.size < 2) return null;

    const affectedServiceIds = rootServiceIds.filter((svcId) =>
      connectedServices.has(`service:${svcId}`),
    );

    const score = Math.min(
      100,
      RCA_BASE_SCORES.cross_service_dependency + connectedServices.size * 5,
    );

    return {
      id: `cross_svc_${nodeId}`,
      type: 'cross_service_dependency',
      score,
      suspectNodeId: nodeId,
      suspectNodeLabel: node.label,
      suspectNodeType: node.type,
      explanation: `CI "${node.label}" bridges ${connectedServices.size} service domain(s). Cross-service dependencies often cause wide-impact outages.`,
      evidence: [
        {
          type: 'topology_path',
          description: `Bridges ${connectedServices.size} services: ${[...connectedServices].map((id) => nodes.get(id)?.label || id).join(', ')}.`,
        },
      ],
      affectedServiceIds,
      recommendedActions: this.buildRcaRecommendations(
        'cross_service_dependency',
        node,
      ),
    };
  }

  private buildRcaRecommendations(
    hypothesisType: RcaHypothesis['type'],
    node: GraphNode,
  ): RcaRecommendedAction[] {
    const actions: RcaRecommendedAction[] = [];

    // Always recommend creating a problem
    actions.push({
      type: 'create_problem',
      label: `Create Problem for "${node.label}"`,
      reason: `Document root cause investigation for ${hypothesisType.replace(/_/g, ' ')} on "${node.label}".`,
      confidence: hypothesisType === 'common_upstream_dependency' ? 85 : 70,
    });

    // For recent changes, recommend linking the change
    if (hypothesisType === 'recent_change_on_shared_node') {
      actions.push({
        type: 'create_change_task',
        label: `Create rollback/mitigation task`,
        reason: `Recent change on "${node.label}" may need rollback or mitigation.`,
        confidence: 75,
      });
    }

    // For SPOFs, recommend known error candidate
    if (
      hypothesisType === 'single_point_of_failure' ||
      hypothesisType === 'high_impact_node'
    ) {
      actions.push({
        type: 'create_known_error',
        label: `Create Known Error for "${node.label}" SPOF`,
        reason: `Document the single point of failure / high impact nature of "${node.label}" as a known error for future reference.`,
        confidence: 65,
      });
    }

    return actions;
  }

  private deduplicateHypotheses(hypotheses: RcaHypothesis[]): RcaHypothesis[] {
    const seen = new Set<string>();
    return hypotheses.filter((h) => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });
  }

  // ==========================================================================
  // PRIVATE: Data Access Helpers
  // ==========================================================================

  private async findRootCisForChange(
    tenantId: string,
    change: ItsmChange,
  ): Promise<string[]> {
    if (!change.serviceId || !this.serviceCiRepo) return [];

    const links = await this.serviceCiRepo.find({
      where: { tenantId, serviceId: change.serviceId, isDeleted: false },
    });

    return links.map((l) => l.ciId);
  }

  private async gatherMiRootNodes(
    tenantId: string,
    mi: ItsmMajorIncident,
  ): Promise<{ rootServiceIds: string[]; linkedCiIds: string[] }> {
    const rootServiceIds: string[] = [];
    const linkedCiIds: string[] = [];

    // Primary service from the MI record
    if (mi.primaryServiceId) {
      rootServiceIds.push(mi.primaryServiceId);
    }

    // Links from MI link table
    if (this.miLinkRepo) {
      const links = await this.miLinkRepo.find({
        where: { tenantId, majorIncidentId: mi.id, isDeleted: false },
      });

      for (const link of links) {
        if (link.linkType === MajorIncidentLinkType.CMDB_SERVICE) {
          if (!rootServiceIds.includes(link.linkedRecordId)) {
            rootServiceIds.push(link.linkedRecordId);
          }
        } else if (link.linkType === MajorIncidentLinkType.CMDB_CI) {
          if (!linkedCiIds.includes(link.linkedRecordId)) {
            linkedCiIds.push(link.linkedRecordId);
          }
        }
      }
    }

    return { rootServiceIds, linkedCiIds };
  }

  private async findCisForService(
    tenantId: string,
    serviceId: string,
  ): Promise<string[]> {
    if (!this.serviceCiRepo) return [];
    const links = await this.serviceCiRepo.find({
      where: { tenantId, serviceId, isDeleted: false },
    });
    return links.map((l) => l.ciId);
  }

  private async findCisForTenant(
    tenantId: string,
    ciIds: string[],
  ): Promise<CmdbCi[]> {
    if (!this.ciRepo || ciIds.length === 0) return [];
    return this.ciRepo.find({
      where: { tenantId, isDeleted: false, id: In(ciIds) },
      relations: ['ciClass'],
    });
  }

  private async findCiRelationsForNodes(
    tenantId: string,
    nodeIds: string[],
  ): Promise<CmdbCiRel[]> {
    if (!this.ciRelRepo || nodeIds.length === 0) return [];

    const qb = this.ciRelRepo.createQueryBuilder('rel');
    qb.where('rel.tenantId = :tenantId', { tenantId });
    qb.andWhere('rel.isDeleted = :isDeleted', { isDeleted: false });
    qb.andWhere('rel.isActive = :isActive', { isActive: true });
    qb.andWhere(
      '(rel.sourceCiId IN (:...nodeIds) OR rel.targetCiId IN (:...nodeIds))',
      { nodeIds },
    );

    return qb.getMany();
  }

  private async findServiceCiLinksForCis(
    tenantId: string,
    ciIds: string[],
  ): Promise<CmdbServiceCi[]> {
    if (!this.serviceCiRepo || ciIds.length === 0) return [];
    return this.serviceCiRepo.find({
      where: { tenantId, ciId: In(ciIds), isDeleted: false },
      relations: ['service'],
    });
  }

  /**
   * Find changes that were implemented or closed in the last 7 days
   * on CIs linked to the given services.
   */
  private async findRecentChangesForCis(
    tenantId: string,
    nodeIds: string[],
  ): Promise<
    Map<string, Array<{ id: string; title: string; number: string }>>
  > {
    const result = new Map<
      string,
      Array<{ id: string; title: string; number: string }>
    >();

    if (!this.changeRepo || !this.serviceCiRepo || nodeIds.length === 0) {
      return result;
    }

    // Find which CIs are linked to which services
    const ciNodeIds = nodeIds.filter((id) => !id.includes(':'));
    if (ciNodeIds.length === 0) return result;

    const serviceCiLinks = await this.serviceCiRepo.find({
      where: { tenantId, ciId: In(ciNodeIds), isDeleted: false },
    });

    if (serviceCiLinks.length === 0) return result;

    const serviceIds = [...new Set(serviceCiLinks.map((l) => l.serviceId))];

    // Find recent changes on those services (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentChanges = await this.changeRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.isDeleted = false')
      .andWhere('c.serviceId IN (:...serviceIds)', { serviceIds })
      .andWhere('c.updatedAt >= :since', { since: sevenDaysAgo })
      .getMany();

    // Map changes back to CIs via service link
    for (const link of serviceCiLinks) {
      const changesForService = recentChanges.filter(
        (c) => c.serviceId === link.serviceId,
      );
      if (changesForService.length > 0) {
        result.set(
          link.ciId,
          changesForService.map((c) => ({
            id: c.id,
            title: c.title,
            number: c.number,
          })),
        );
      }
    }

    return result;
  }

  // ==========================================================================
  // PRIVATE: Utility
  // ==========================================================================

  private buildAdjacencyMap(
    edges: GraphEdge[],
  ): Map<string, Array<{ targetId: string; relationType: string }>> {
    const map = new Map<
      string,
      Array<{ targetId: string; relationType: string }>
    >();
    for (const edge of edges) {
      if (!map.has(edge.sourceId)) map.set(edge.sourceId, []);
      map.get(edge.sourceId)!.push({
        targetId: edge.targetId,
        relationType: edge.relationType,
      });
    }
    return map;
  }

  private buildReverseAdjacencyMap(
    edges: GraphEdge[],
  ): Map<string, Array<{ sourceId: string; relationType: string }>> {
    const map = new Map<
      string,
      Array<{ sourceId: string; relationType: string }>
    >();
    for (const edge of edges) {
      if (!map.has(edge.targetId)) map.set(edge.targetId, []);
      map.get(edge.targetId)!.push({
        sourceId: edge.sourceId,
        relationType: edge.relationType,
      });
    }
    return map;
  }

  private criticalityWeight(criticality?: string): number {
    switch (criticality) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  private emptyImpactResponse(
    changeId: string,
    computedAt: string,
    warnings: string[],
  ): TopologyImpactResponse {
    return {
      changeId,
      rootNodeIds: [],
      metrics: {
        totalImpactedNodes: 0,
        impactedByDepth: {},
        impactedServiceCount: 0,
        impactedOfferingCount: 0,
        impactedCiCount: 0,
        criticalCiCount: 0,
        maxChainDepth: 0,
        crossServicePropagation: false,
        crossServiceCount: 0,
      },
      impactedNodes: [],
      topPaths: [],
      fragilitySignals: [],
      topologyRiskScore: 0,
      riskExplanation: 'No topology data available for this change.',
      computedAt,
      warnings,

      // Phase 2 defaults
      impactBuckets: {
        direct: 0,
        downstream: 0,
        criticalPath: 0,
        unknownConfidence: 0,
      },
      impactedServicesCount: 0,
      impactedOfferingsCount: 0,
      impactedCriticalCisCount: 0,
      completenessConfidence: {
        score: 0,
        label: 'VERY_LOW',
        degradingFactors: [
          {
            code: 'NO_TOPOLOGY_DATA',
            description: 'No CIs or relationships found for this change',
            impact: 100,
          },
        ],
        missingClassCount: 0,
        isolatedNodeCount: 0,
        healthRulesAvailable: false,
      },
      riskFactors: [],
    };
  }
}
