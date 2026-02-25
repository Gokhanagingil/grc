import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GrcRisk,
  GrcRiskControl,
  GrcControl,
  GrcRiskPolicy,
  GrcPolicy,
} from '../entities';
import {
  AdvisoryResult,
  CreateDraftsDto,
  CreateDraftsResult,
  DraftCreationResultItem,
  SuggestedRecordType,
  SuggestedRecord,
} from './dto/advisory.dto';
import {
  RiskAdvisoryHeuristics,
  RiskContext,
  CmdbContext,
} from './heuristics/risk-advisory-heuristics';
import {
  StubAiProvider,
  AiProviderAdapter,
} from './adapters/ai-provider.adapter';
import { GrcCapaService } from '../services/grc-capa.service';
import { GrcControlTestService } from '../services/grc-control-test.service';
import { AuditService } from '../../audit/audit.service';

/**
 * Risk Advisory Service
 *
 * Orchestrates deterministic advisory generation for risks.
 * Uses heuristics engine for theme classification and mitigation suggestions.
 * Creates draft records (CAPA/ControlTest) via existing service layer.
 * Change creation deferred to Phase 2 (requires cross-module ItsmModule dependency).
 *
 * Phase 1: Deterministic heuristics only.
 * Phase 2: Will integrate AiProviderAdapter for LLM-powered suggestions + Change creation.
 */
@Injectable()
export class RiskAdvisoryService {
  private readonly logger = new Logger(RiskAdvisoryService.name);
  private readonly aiProvider: AiProviderAdapter;

  // In-memory advisory cache (per risk). In production, this could be persisted.
  private readonly advisoryCache = new Map<string, AdvisoryResult>();

  constructor(
    @InjectRepository(GrcRisk)
    private readonly riskRepository: Repository<GrcRisk>,
    @InjectRepository(GrcRiskControl)
    private readonly riskControlRepository: Repository<GrcRiskControl>,
    @InjectRepository(GrcControl)
    private readonly controlRepository: Repository<GrcControl>,
    @InjectRepository(GrcRiskPolicy)
    private readonly riskPolicyRepository: Repository<GrcRiskPolicy>,
    @InjectRepository(GrcPolicy)
    private readonly policyRepository: Repository<GrcPolicy>,
    private readonly heuristics: RiskAdvisoryHeuristics,
    @Optional() private readonly capaService?: GrcCapaService,
    @Optional() private readonly controlTestService?: GrcControlTestService,
    @Optional() private readonly auditService?: AuditService,
  ) {
    this.aiProvider = new StubAiProvider();
  }

  /**
   * Analyze a risk and generate advisory recommendations.
   * Uses deterministic heuristics (Phase 1) with AI-ready contract.
   */
  async analyzeRisk(
    tenantId: string,
    riskId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: {
      includeCmdbTopology?: boolean;
      includeLinkedEntities?: boolean;
    },
  ): Promise<AdvisoryResult> {
    this.logger.log(`Analyzing risk ${riskId} for tenant ${tenantId}`);

    // 1. Load risk with validation
    const risk = await this.loadRisk(tenantId, riskId);

    // 2. Build risk context
    const riskContext = await this.buildRiskContext(tenantId, risk);

    // 3. Build CMDB context (lightweight — no cross-module dependency needed for v1)
    const cmdbContext = this.buildLightweightCmdbContext();

    // 4. Try AI provider first (stub returns null in Phase 1)
    const aiResult = await this.aiProvider.generateAdvisory({
      riskId: risk.id,
      riskTitle: risk.title,
      riskDescription: risk.description,
      riskCategory: risk.category,
      riskSeverity: risk.severity,
      riskLikelihood: risk.likelihood,
      riskImpact: risk.impact,
      inherentScore: risk.inherentScore,
      residualScore: risk.residualScore,
      linkedControls: riskContext.linkedControls.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
      })),
      linkedPolicies: riskContext.linkedPolicies.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
      })),
      affectedCis: [],
      affectedServices: [],
    });

    // 5. Build advisory using heuristics (deterministic)
    const advisory = this.heuristics.buildAdvisoryResult(
      riskContext,
      cmdbContext,
    );

    // If AI provider returned something, merge it (Phase 2)
    if (aiResult) {
      this.logger.log('AI provider returned result — merging with heuristics');
    }

    // 6. Cache the advisory
    const cacheKey = `${tenantId}:${riskId}`;
    this.advisoryCache.set(cacheKey, advisory);

    this.logger.log(
      `Advisory generated for risk ${riskId}: theme=${advisory.riskTheme}, confidence=${advisory.confidence}`,
    );

    return advisory;
  }

  /**
   * Get the latest advisory for a risk (from cache).
   * Returns null if no advisory has been generated yet.
   */
  async getLatestAdvisory(
    tenantId: string,
    riskId: string,
  ): Promise<AdvisoryResult | null> {
    // Validate risk exists and belongs to tenant
    await this.loadRisk(tenantId, riskId);

    const cacheKey = `${tenantId}:${riskId}`;
    return this.advisoryCache.get(cacheKey) || null;
  }

  /**
   * Create draft records from selected advisory suggestions.
   * Uses existing service layer (CapaService, ControlTestService).
   * Returns partial success results.
   */
  async createDrafts(
    tenantId: string,
    riskId: string,
    userId: string,
    dto: CreateDraftsDto,
  ): Promise<CreateDraftsResult> {
    this.logger.log(
      `Creating ${dto.selectedItems.length} draft(s) for risk ${riskId}`,
    );

    // Validate risk exists
    await this.loadRisk(tenantId, riskId);

    // Get the advisory (from cache)
    const cacheKey = `${tenantId}:${riskId}`;
    const advisory = this.advisoryCache.get(cacheKey);

    if (!advisory) {
      throw new BadRequestException(
        'No advisory found for this risk. Please run Analyze first.',
      );
    }

    const results: DraftCreationResultItem[] = [];

    for (const item of dto.selectedItems) {
      // Find the suggested record in the advisory
      const suggestedRecord = advisory.suggestedRecords.find(
        (sr) => sr.id === item.suggestedRecordId,
      );

      if (!suggestedRecord) {
        results.push({
          suggestedRecordId: item.suggestedRecordId,
          type: item.type,
          success: false,
          error: 'Suggested record not found in advisory',
          linkToRisk: false,
        });
        continue;
      }

      try {
        const result = await this.createDraftRecord(
          tenantId,
          riskId,
          userId,
          suggestedRecord,
          item.titleOverride,
          item.descriptionOverride,
        );
        results.push(result);
      } catch (error) {
        this.logger.warn(
          `Failed to create draft for ${item.suggestedRecordId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        results.push({
          suggestedRecordId: item.suggestedRecordId,
          type: item.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          linkToRisk: false,
        });
      }
    }

    const totalCreated = results.filter((r) => r.success).length;
    const totalFailed = results.filter((r) => !r.success).length;

    this.logger.log(
      `Draft creation complete: ${totalCreated} created, ${totalFailed} failed`,
    );

    return {
      totalRequested: dto.selectedItems.length,
      totalCreated,
      totalFailed,
      results,
    };
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  private async loadRisk(tenantId: string, riskId: string): Promise<GrcRisk> {
    const risk = await this.riskRepository.findOne({
      where: { id: riskId, tenantId, isDeleted: false },
    });

    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    return risk;
  }

  private async buildRiskContext(
    tenantId: string,
    risk: GrcRisk,
  ): Promise<RiskContext> {
    // Load linked controls
    const linkedControls = await this.loadLinkedControls(tenantId, risk.id);

    // Load linked policies
    const linkedPolicies = await this.loadLinkedPolicies(tenantId, risk.id);

    return {
      id: risk.id,
      title: risk.title,
      description: risk.description,
      category: risk.category,
      severity: risk.severity,
      likelihood: risk.likelihood,
      impact: risk.impact,
      status: risk.status,
      inherentScore: risk.inherentScore,
      residualScore: risk.residualScore,
      linkedControls,
      linkedPolicies,
    };
  }

  private async loadLinkedControls(
    tenantId: string,
    riskId: string,
  ): Promise<RiskContext['linkedControls']> {
    try {
      const riskControls = await this.riskControlRepository.find({
        where: { tenantId, riskId },
        relations: ['control'],
      });

      return riskControls
        .filter((rc) => rc.control && !rc.control.isDeleted)
        .map((rc) => ({
          id: rc.control.id,
          name: rc.control.name,
          code: rc.control.code || null,
          status: rc.control.status,
          effectivenessPercent: rc.overrideEffectivenessPercent ?? undefined,
        }));
    } catch {
      this.logger.warn(`Failed to load linked controls for risk ${riskId}`);
      return [];
    }
  }

  private async loadLinkedPolicies(
    tenantId: string,
    riskId: string,
  ): Promise<RiskContext['linkedPolicies']> {
    try {
      const riskPolicies = await this.riskPolicyRepository.find({
        where: { tenantId, riskId },
        relations: ['policy'],
      });

      return riskPolicies
        .filter((rp) => rp.policy && !rp.policy.isDeleted)
        .map((rp) => ({
          id: rp.policy.id,
          name: rp.policy.name,
          code: rp.policy.code || null,
          status: rp.policy.status,
        }));
    } catch {
      this.logger.warn(`Failed to load linked policies for risk ${riskId}`);
      return [];
    }
  }

  /**
   * Lightweight CMDB context for v1.
   * Full CMDB integration (topology traversal) will be added in Phase 2.
   */
  private buildLightweightCmdbContext(): CmdbContext | null {
    return null;
  }

  private async createDraftRecord(
    tenantId: string,
    riskId: string,
    userId: string,
    suggestedRecord: SuggestedRecord,
    titleOverride?: string,
    descriptionOverride?: string,
  ): Promise<DraftCreationResultItem> {
    const title = titleOverride || suggestedRecord.title;
    const description = descriptionOverride || suggestedRecord.description;

    switch (suggestedRecord.type) {
      case SuggestedRecordType.CHANGE:
        // Phase 1: Change creation requires ItsmModule cross-dependency.
        // Deferred to Phase 2. Return informative message.
        return {
          suggestedRecordId: suggestedRecord.id,
          type: SuggestedRecordType.CHANGE,
          success: false,
          error:
            'Change creation via advisory will be available in Phase 2. Please create the change manually from ITSM > Changes.',
          linkToRisk: false,
        };

      case SuggestedRecordType.CAPA:
        return this.createDraftCapa(
          tenantId,
          riskId,
          userId,
          suggestedRecord,
          title,
          description,
        );

      case SuggestedRecordType.CONTROL_TEST:
        return this.createDraftControlTest(
          tenantId,
          riskId,
          userId,
          suggestedRecord,
          title,
          description,
        );

      case SuggestedRecordType.TASK:
        return this.createDraftCapa(
          tenantId,
          riskId,
          userId,
          suggestedRecord,
          title,
          description,
        );

      default:
        return {
          suggestedRecordId: suggestedRecord.id,
          type: suggestedRecord.type,
          success: false,
          error: `Unsupported record type: ${String(suggestedRecord.type)}`,
          linkToRisk: false,
        };
    }
  }

  private async createDraftCapa(
    tenantId: string,
    _riskId: string,
    userId: string,
    suggestedRecord: SuggestedRecord,
    title: string,
    description: string,
  ): Promise<DraftCreationResultItem> {
    if (!this.capaService) {
      return {
        suggestedRecordId: suggestedRecord.id,
        type: suggestedRecord.type,
        success: false,
        error: 'CAPA service not available',
        linkToRisk: false,
      };
    }

    try {
      const capaType =
        suggestedRecord.templateData?.type === 'PREVENTIVE'
          ? 'PREVENTIVE'
          : 'CORRECTIVE';

      const capa = await this.capaService.create(
        tenantId,
        {
          title,
          description,
          type: capaType as never,
          priority: (suggestedRecord.priority === 'HIGH'
            ? 'HIGH'
            : suggestedRecord.priority === 'LOW'
              ? 'LOW'
              : 'MEDIUM') as never,
          metadata: {
            advisorySource: 'risk-advisory-pack-v1',
            suggestedRecordId: suggestedRecord.id,
          },
        },
        userId,
      );

      return {
        suggestedRecordId: suggestedRecord.id,
        type: suggestedRecord.type,
        success: true,
        createdRecordId: capa.id,
        createdRecordCode: (capa as unknown as Record<string, unknown>).code as
          | string
          | undefined,
        linkToRisk: false, // CAPA linkage is via issue, not direct risk link
      };
    } catch (error) {
      return {
        suggestedRecordId: suggestedRecord.id,
        type: suggestedRecord.type,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create CAPA',
        linkToRisk: false,
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async createDraftControlTest(
    _tenantId: string,
    _riskId: string,
    _userId: string,
    suggestedRecord: SuggestedRecord,
    _title: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    _description: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<DraftCreationResultItem> {
    // Control tests require a controlId — cannot create without one.
    return {
      suggestedRecordId: suggestedRecord.id,
      type: SuggestedRecordType.CONTROL_TEST,
      success: false,
      error:
        'Control test creation requires a linked control. Please link a control to this risk first, then create the test from the control detail page.',
      linkToRisk: false,
    };
  }
}
