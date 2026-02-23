import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CmdbCi } from '../ci/ci.entity';
import { CmdbCiRel } from '../ci-rel/ci-rel.entity';
import { CmdbService } from '../service/cmdb-service.entity';
import { CmdbServiceOffering } from '../service-offering/cmdb-service-offering.entity';
import { CmdbServiceCi } from '../service-ci/cmdb-service-ci.entity';
import { CmdbRelationshipType } from '../relationship-type/relationship-type.entity';
import { CiClassInheritanceService } from '../ci-class/ci-class-inheritance.service';
import { TopologyQueryDto, TopologyDirection } from './dto/topology-query.dto';
import {
  TopologyResponse,
  TopologyNode,
  TopologyEdge,
  TopologyMeta,
  TopologyAnnotations,
  TopologySemanticsSummary,
} from './dto/topology-response.dto';

/** Maximum number of nodes before truncation */
const MAX_NODES = 200;
/** Maximum number of edges before truncation */
const MAX_EDGES = 500;

@Injectable()
export class TopologyService {
  constructor(
    @InjectRepository(CmdbCi)
    private readonly ciRepo: Repository<CmdbCi>,
    @InjectRepository(CmdbCiRel)
    private readonly ciRelRepo: Repository<CmdbCiRel>,
    @InjectRepository(CmdbService)
    private readonly serviceRepo: Repository<CmdbService>,
    @InjectRepository(CmdbServiceOffering)
    private readonly offeringRepo: Repository<CmdbServiceOffering>,
    @InjectRepository(CmdbServiceCi)
    private readonly serviceCiRepo: Repository<CmdbServiceCi>,
    @Optional()
    @InjectRepository(CmdbRelationshipType)
    private readonly relTypeRepo?: Repository<CmdbRelationshipType>,
    @Optional()
    private readonly inheritanceService?: CiClassInheritanceService,
  ) {}

  /**
   * Build topology graph centered on a specific CI.
   * Traverses CI-CI relationships and Service-CI links.
   */
  async getTopologyForCi(
    tenantId: string,
    ciId: string,
    query: TopologyQueryDto,
  ): Promise<TopologyResponse> {
    const depth = query.depth ?? 1;
    const direction = query.direction ?? TopologyDirection.BOTH;
    const relationTypesList = query.relationTypesList;
    const warnings: string[] = [];
    let truncated = false;

    // Collect nodes and edges via BFS
    const nodeMap = new Map<string, TopologyNode>();
    const edgeMap = new Map<string, TopologyEdge>();
    const visited = new Set<string>();

    // Start with the root CI
    const rootCi = await this.findCiForTenant(tenantId, ciId);
    if (!rootCi) {
      return this.emptyResponse(ciId, depth);
    }

    nodeMap.set(rootCi.id, this.ciToNode(rootCi));
    visited.add(rootCi.id);

    // BFS traversal
    let frontier: string[] = [rootCi.id];

    for (let d = 0; d < depth; d++) {
      if (frontier.length === 0) break;
      if (nodeMap.size >= MAX_NODES) {
        truncated = true;
        warnings.push(`Graph truncated at ${MAX_NODES} nodes (depth ${d})`);
        break;
      }

      const nextFrontier: string[] = [];

      // Fetch CI-CI relationships for current frontier
      const rels = await this.findCiRelationsForNodes(
        tenantId,
        frontier,
        direction,
        relationTypesList,
      );

      for (const rel of rels) {
        if (edgeMap.size >= MAX_EDGES) {
          truncated = true;
          warnings.push(`Graph truncated at ${MAX_EDGES} edges`);
          break;
        }

        const edgeKey = this.edgeKey(rel.sourceCiId, rel.targetCiId, rel.type);
        if (edgeMap.has(edgeKey)) continue; // de-dup

        edgeMap.set(edgeKey, {
          id: rel.id,
          source: rel.sourceCiId,
          target: rel.targetCiId,
          relationType: rel.type,
          direction: this.inferEdgeDirection(
            rel.sourceCiId,
            rel.targetCiId,
            frontier,
          ),
          inferred: false,
        });

        // Discover new nodes
        for (const neighborId of [rel.sourceCiId, rel.targetCiId]) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextFrontier.push(neighborId);

            if (nodeMap.size >= MAX_NODES) {
              truncated = true;
              warnings.push(`Graph truncated at ${MAX_NODES} nodes`);
              break;
            }
          }
        }

        if (truncated) break;
      }

      // Fetch Service-CI links for frontier CIs
      if (!truncated) {
        const serviceCiLinks = await this.findServiceCiLinksForCis(
          tenantId,
          frontier,
        );
        for (const link of serviceCiLinks) {
          const serviceNodeId = `service:${link.serviceId}`;
          const edgeKey = this.edgeKey(
            serviceNodeId,
            link.ciId,
            link.relationshipType,
          );
          if (edgeMap.has(edgeKey)) continue;

          if (edgeMap.size >= MAX_EDGES) {
            truncated = true;
            warnings.push(`Graph truncated at ${MAX_EDGES} edges`);
            break;
          }

          edgeMap.set(edgeKey, {
            id: link.id,
            source: serviceNodeId,
            target: link.ciId,
            relationType: link.relationshipType,
            direction: 'downstream',
            inferred: false,
          });

          if (!nodeMap.has(serviceNodeId)) {
            if (nodeMap.size >= MAX_NODES) {
              truncated = true;
              warnings.push(`Graph truncated at ${MAX_NODES} nodes`);
              break;
            }
            // Load service data
            const svc = link.service;
            if (svc) {
              nodeMap.set(serviceNodeId, this.serviceToNode(svc));
            }
          }
        }
      }

      // Load newly discovered CI nodes
      if (nextFrontier.length > 0 && !truncated) {
        const newCis = await this.findCisForTenant(tenantId, nextFrontier);
        for (const ci of newCis) {
          if (!nodeMap.has(ci.id)) {
            nodeMap.set(ci.id, this.ciToNode(ci));
          }
        }
      }

      frontier = nextFrontier;
    }

    // Defensive: remove edges pointing to missing nodes
    const finalEdges: TopologyEdge[] = [];
    for (const edge of edgeMap.values()) {
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        finalEdges.push(edge);
      }
    }

    const meta: TopologyMeta = {
      rootNodeId: ciId,
      depth,
      nodeCount: nodeMap.size,
      edgeCount: finalEdges.length,
      truncated,
      warnings,
    };

    // Phase C: enrich with class lineage and semantics if requested
    if (query.includeSemantics) {
      await Promise.all([
        this.enrichNodesWithClassLineage(tenantId, nodeMap),
        this.enrichEdgesWithSemantics(tenantId, finalEdges),
      ]);
      meta.semanticsSummary = this.buildSemanticsSummary(finalEdges);
    }

    const annotations: TopologyAnnotations = {};

    return {
      nodes: Array.from(nodeMap.values()),
      edges: finalEdges,
      meta,
      annotations,
    };
  }

  /**
   * Build topology graph centered on a specific CMDB Service.
   * Shows the service, its offerings, and linked CIs.
   */
  async getTopologyForService(
    tenantId: string,
    serviceId: string,
    query: TopologyQueryDto,
  ): Promise<TopologyResponse> {
    const depth = query.depth ?? 1;
    const relationTypesList = query.relationTypesList;
    const direction = query.direction ?? TopologyDirection.BOTH;
    const warnings: string[] = [];
    let truncated = false;

    const nodeMap = new Map<string, TopologyNode>();
    const edgeMap = new Map<string, TopologyEdge>();
    const visited = new Set<string>();

    // Load the root service
    const service = await this.findServiceForTenant(tenantId, serviceId);
    if (!service) {
      return this.emptyResponse(serviceId, depth);
    }

    const serviceNodeId = `service:${service.id}`;
    nodeMap.set(serviceNodeId, this.serviceToNode(service));
    visited.add(serviceNodeId);

    // Load service offerings
    const offerings = await this.findOfferingsForService(tenantId, serviceId);
    for (const off of offerings) {
      if (nodeMap.size >= MAX_NODES) {
        truncated = true;
        warnings.push(`Graph truncated at ${MAX_NODES} nodes`);
        break;
      }

      const offeringNodeId = `offering:${off.id}`;
      nodeMap.set(offeringNodeId, this.offeringToNode(off));

      const edgeKey = this.edgeKey(
        serviceNodeId,
        offeringNodeId,
        'has_offering',
      );
      edgeMap.set(edgeKey, {
        id: `${service.id}-${off.id}`,
        source: serviceNodeId,
        target: offeringNodeId,
        relationType: 'has_offering',
        direction: 'downstream',
        inferred: false,
      });
    }

    // Load CIs linked to this service
    const serviceCiLinks = await this.findCisLinkedToService(
      tenantId,
      serviceId,
    );
    const linkedCiIds: string[] = [];

    for (const link of serviceCiLinks) {
      if (nodeMap.size >= MAX_NODES) {
        truncated = true;
        warnings.push(`Graph truncated at ${MAX_NODES} nodes`);
        break;
      }

      if (!nodeMap.has(link.ciId)) {
        const ci = link.ci;
        if (ci) {
          nodeMap.set(ci.id, this.ciToNode(ci));
          linkedCiIds.push(ci.id);
          visited.add(ci.id);
        }
      }

      const edgeKey = this.edgeKey(
        serviceNodeId,
        link.ciId,
        link.relationshipType,
      );
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          id: link.id,
          source: serviceNodeId,
          target: link.ciId,
          relationType: link.relationshipType,
          direction: 'downstream',
          inferred: false,
        });
      }
    }

    // If depth > 1, traverse CI-CI relationships from linked CIs
    if (depth > 1 && linkedCiIds.length > 0 && !truncated) {
      let frontier = linkedCiIds;

      for (let d = 1; d < depth; d++) {
        if (frontier.length === 0 || truncated) break;

        const nextFrontier: string[] = [];
        const rels = await this.findCiRelationsForNodes(
          tenantId,
          frontier,
          direction,
          relationTypesList,
        );

        for (const rel of rels) {
          if (edgeMap.size >= MAX_EDGES) {
            truncated = true;
            warnings.push(`Graph truncated at ${MAX_EDGES} edges`);
            break;
          }

          const edgeKey = this.edgeKey(
            rel.sourceCiId,
            rel.targetCiId,
            rel.type,
          );
          if (edgeMap.has(edgeKey)) continue;

          edgeMap.set(edgeKey, {
            id: rel.id,
            source: rel.sourceCiId,
            target: rel.targetCiId,
            relationType: rel.type,
            direction: this.inferEdgeDirection(
              rel.sourceCiId,
              rel.targetCiId,
              frontier,
            ),
            inferred: false,
          });

          for (const neighborId of [rel.sourceCiId, rel.targetCiId]) {
            if (!visited.has(neighborId)) {
              visited.add(neighborId);
              nextFrontier.push(neighborId);

              if (nodeMap.size >= MAX_NODES) {
                truncated = true;
                warnings.push(`Graph truncated at ${MAX_NODES} nodes`);
                break;
              }
            }
          }

          if (truncated) break;
        }

        // Load new CI nodes
        if (nextFrontier.length > 0 && !truncated) {
          const newCis = await this.findCisForTenant(tenantId, nextFrontier);
          for (const ci of newCis) {
            if (!nodeMap.has(ci.id)) {
              nodeMap.set(ci.id, this.ciToNode(ci));
            }
          }
        }

        frontier = nextFrontier;
      }
    }

    // Defensive: remove edges pointing to missing nodes
    const finalEdges: TopologyEdge[] = [];
    for (const edge of edgeMap.values()) {
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        finalEdges.push(edge);
      }
    }

    const meta: TopologyMeta = {
      rootNodeId: serviceId,
      depth,
      nodeCount: nodeMap.size,
      edgeCount: finalEdges.length,
      truncated,
      warnings,
    };

    // Phase C: enrich with class lineage and semantics if requested
    if (query.includeSemantics) {
      await Promise.all([
        this.enrichNodesWithClassLineage(tenantId, nodeMap),
        this.enrichEdgesWithSemantics(tenantId, finalEdges),
      ]);
      meta.semanticsSummary = this.buildSemanticsSummary(finalEdges);
    }

    const annotations: TopologyAnnotations = {};

    return {
      nodes: Array.from(nodeMap.values()),
      edges: finalEdges,
      meta,
      annotations,
    };
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  private async findCiForTenant(
    tenantId: string,
    ciId: string,
  ): Promise<CmdbCi | null> {
    return this.ciRepo.findOne({
      where: { id: ciId, tenantId, isDeleted: false },
      relations: ['ciClass'],
    });
  }

  private async findCisForTenant(
    tenantId: string,
    ciIds: string[],
  ): Promise<CmdbCi[]> {
    if (ciIds.length === 0) return [];
    return this.ciRepo.find({
      where: { tenantId, isDeleted: false, id: In(ciIds) },
      relations: ['ciClass'],
    });
  }

  private async findServiceForTenant(
    tenantId: string,
    serviceId: string,
  ): Promise<CmdbService | null> {
    return this.serviceRepo.findOne({
      where: { id: serviceId, tenantId, isDeleted: false },
    });
  }

  private async findOfferingsForService(
    tenantId: string,
    serviceId: string,
  ): Promise<CmdbServiceOffering[]> {
    return this.offeringRepo.find({
      where: { tenantId, serviceId, isDeleted: false },
    });
  }

  private async findCiRelationsForNodes(
    tenantId: string,
    nodeIds: string[],
    direction: TopologyDirection,
    relationTypesList?: string[],
  ): Promise<CmdbCiRel[]> {
    if (nodeIds.length === 0) return [];

    const qb = this.ciRelRepo.createQueryBuilder('rel');
    qb.leftJoinAndSelect('rel.sourceCi', 'src');
    qb.leftJoinAndSelect('rel.targetCi', 'tgt');
    qb.where('rel.tenantId = :tenantId', { tenantId });
    qb.andWhere('rel.isDeleted = :isDeleted', { isDeleted: false });
    qb.andWhere('rel.isActive = :isActive', { isActive: true });

    if (direction === TopologyDirection.DOWNSTREAM) {
      qb.andWhere('rel.sourceCiId IN (:...nodeIds)', { nodeIds });
    } else if (direction === TopologyDirection.UPSTREAM) {
      qb.andWhere('rel.targetCiId IN (:...nodeIds)', { nodeIds });
    } else {
      qb.andWhere(
        '(rel.sourceCiId IN (:...nodeIds) OR rel.targetCiId IN (:...nodeIds))',
        { nodeIds },
      );
    }

    if (relationTypesList && relationTypesList.length > 0) {
      qb.andWhere('rel.type IN (:...relTypes)', {
        relTypes: relationTypesList,
      });
    }

    return qb.getMany();
  }

  private async findServiceCiLinksForCis(
    tenantId: string,
    ciIds: string[],
  ): Promise<CmdbServiceCi[]> {
    if (ciIds.length === 0) return [];
    return this.serviceCiRepo.find({
      where: { tenantId, ciId: In(ciIds), isDeleted: false },
      relations: ['service'],
    });
  }

  private async findCisLinkedToService(
    tenantId: string,
    serviceId: string,
  ): Promise<CmdbServiceCi[]> {
    return this.serviceCiRepo.find({
      where: { tenantId, serviceId, isDeleted: false },
      relations: ['ci', 'ci.ciClass'],
    });
  }

  private ciToNode(ci: CmdbCi): TopologyNode {
    return {
      id: ci.id,
      type: 'ci',
      label: ci.name,
      className: ci.ciClass?.name ?? undefined,
      classId: ci.classId ?? undefined,
      status: ci.lifecycle,
      environment: ci.environment,
      ipAddress: ci.ipAddress ?? undefined,
      owner: ci.ownedBy ?? ci.managedBy ?? undefined,
    };
  }

  /**
   * Enrich topology nodes with class lineage info.
   * Called after graph is built to add ancestor chain data.
   */
  private async enrichNodesWithClassLineage(
    tenantId: string,
    nodeMap: Map<string, TopologyNode>,
  ): Promise<void> {
    if (!this.inheritanceService) return;

    // Build a cache of classId -> lineage to avoid repeated lookups
    const lineageCache = new Map<string, string[]>();

    for (const node of nodeMap.values()) {
      if (node.type !== 'ci' || !node.classId) continue;

      if (!lineageCache.has(node.classId)) {
        try {
          const ancestors = await this.inheritanceService.getAncestorChain(
            tenantId,
            node.classId,
          );
          // ancestors is [parent, grandparent, ...root], reverse to get root->current
          const lineage = ancestors
            .slice()
            .reverse()
            .map((a) => a.name);
          if (node.className) {
            lineage.push(node.className);
          }
          lineageCache.set(node.classId, lineage);
        } catch {
          // Skip lineage on error
          lineageCache.set(node.classId, []);
        }
      }

      const lineage = lineageCache.get(node.classId);
      if (lineage && lineage.length > 1) {
        node.classLineage = lineage;
      }
    }
  }

  /**
   * Enrich edges with relationship type semantics.
   * Adds labels, directionality, and risk propagation hints from the catalog.
   */
  private async enrichEdgesWithSemantics(
    tenantId: string,
    edges: TopologyEdge[],
  ): Promise<void> {
    if (!this.relTypeRepo) return;

    // Collect unique relation types
    const typeNames = new Set<string>();
    for (const edge of edges) {
      typeNames.add(edge.relationType);
    }

    // Bulk-load relationship type semantics
    const semanticsMap = new Map<string, CmdbRelationshipType>();
    if (typeNames.size > 0) {
      try {
        const types = await this.relTypeRepo.find({
          where: {
            tenantId,
            isDeleted: false,
            name: In(Array.from(typeNames)),
          },
        });
        for (const t of types) {
          semanticsMap.set(t.name, t);
        }
      } catch {
        // If the catalog table/migration isn't available, skip semantics enrichment
        return;
      }
    }

    // Enrich each edge
    for (const edge of edges) {
      const sem = semanticsMap.get(edge.relationType);
      if (sem) {
        edge.relationLabel = sem.label;
        if (sem.inverseLabel) {
          edge.inverseLabel = sem.inverseLabel;
        }
        edge.directionality = sem.directionality as
          | 'unidirectional'
          | 'bidirectional';
        edge.riskPropagation = sem.riskPropagation as
          | 'forward'
          | 'reverse'
          | 'both'
          | 'none';
      }
    }
  }

  /**
   * Build a semantics summary from enriched edges.
   * Provides counts and breakdowns useful for topology intelligence consumers.
   */
  private buildSemanticsSummary(
    edges: TopologyEdge[],
  ): TopologySemanticsSummary {
    const totalEdges = edges.length;
    let semanticsEnrichedEdges = 0;
    const unknownTypes = new Set<string>();
    const byRiskPropagation: Record<string, number> = {};
    const byDirectionality: Record<string, number> = {};

    for (const edge of edges) {
      if (edge.relationLabel) {
        semanticsEnrichedEdges++;
      } else {
        unknownTypes.add(edge.relationType);
      }

      const rp = edge.riskPropagation ?? 'unknown';
      byRiskPropagation[rp] = (byRiskPropagation[rp] ?? 0) + 1;

      const dir = edge.directionality ?? 'unknown';
      byDirectionality[dir] = (byDirectionality[dir] ?? 0) + 1;
    }

    return {
      totalEdges,
      semanticsEnrichedEdges,
      unknownRelationTypesCount: unknownTypes.size,
      unknownRelationTypes: Array.from(unknownTypes),
      byRiskPropagation,
      byDirectionality,
    };
  }

  private serviceToNode(svc: CmdbService): TopologyNode {
    return {
      id: `service:${svc.id}`,
      type: 'service',
      label: svc.name,
      status: svc.status,
      criticality: svc.criticality ?? undefined,
      owner: svc.ownerEmail ?? undefined,
      tier: svc.tier ?? undefined,
    };
  }

  private offeringToNode(off: CmdbServiceOffering): TopologyNode {
    return {
      id: `offering:${off.id}`,
      type: 'service_offering',
      label: off.name,
      status: off.status,
    };
  }

  private edgeKey(source: string, target: string, type: string): string {
    // Ensure consistent key regardless of order for bidirectional de-dup
    const sorted = [source, target].sort();
    return `${sorted[0]}|${sorted[1]}|${type}`;
  }

  private inferEdgeDirection(
    sourceCiId: string,
    targetCiId: string,
    frontier: string[],
  ): 'upstream' | 'downstream' | 'bidirectional' {
    const sourceInFrontier = frontier.includes(sourceCiId);
    const targetInFrontier = frontier.includes(targetCiId);
    if (sourceInFrontier && !targetInFrontier) return 'downstream';
    if (!sourceInFrontier && targetInFrontier) return 'upstream';
    return 'bidirectional';
  }

  private emptyResponse(rootNodeId: string, depth: number): TopologyResponse {
    return {
      nodes: [],
      edges: [],
      meta: {
        rootNodeId,
        depth,
        nodeCount: 0,
        edgeCount: 0,
        truncated: false,
        warnings: ['Root node not found'],
      },
      annotations: {},
    };
  }
}
