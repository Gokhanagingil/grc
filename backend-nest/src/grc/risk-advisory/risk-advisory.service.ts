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
import {
  buildCapaDraftPayload,
  resolveEffectiveTargetType,
} from './advisory-draft-mapper';

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
   * Returns partial success results with accurate per-item attribution.
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
        results.push(
          this.buildResultItem(
            item.suggestedRecordId,
            item.type,
            item.type,
            'failed',
            {
              userSafeMessage:
                'Suggested record not found in current advisory. Please re-analyze first.',
              errorCode: 'SUGGESTION_NOT_FOUND',
            },
          ),
        );
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
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Failed to create draft for ${item.suggestedRecordId}: ${errorMsg}`,
        );
        const effectiveTarget = resolveEffectiveTargetType(
          suggestedRecord.type,
        );
        results.push(
          this.buildResultItem(
            item.suggestedRecordId,
            suggestedRecord.type,
            effectiveTarget,
            'failed',
            {
              userSafeMessage: `Failed to create ${this.getTypeLabel(effectiveTarget)} draft. Please try again or create manually.`,
              technicalMessage: errorMsg,
              errorCode: 'CREATION_ERROR',
            },
          ),
        );
      }
    }

    const totalCreated = results.filter((r) => r.status === 'created').length;
    const totalFailed = results.filter((r) => r.status === 'failed').length;
    const totalSkipped = results.filter((r) => r.status === 'skipped').length;

    this.logger.log(
      `Draft creation complete: ${totalCreated} created, ${totalFailed} failed, ${totalSkipped} skipped`,
    );

    return {
      totalRequested: dto.selectedItems.length,
      totalCreated,
      totalFailed,
      totalSkipped,
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

  /**
   * Route a suggested record to the appropriate draft creation method.
   * Uses resolveEffectiveTargetType for accurate error attribution.
   */
  private async createDraftRecord(
    tenantId: string,
    riskId: string,
    userId: string,
    suggestedRecord: SuggestedRecord,
    titleOverride?: string,
    descriptionOverride?: string,
  ): Promise<DraftCreationResultItem> {
    const effectiveTarget = resolveEffectiveTargetType(suggestedRecord.type);

    switch (suggestedRecord.type) {
      case SuggestedRecordType.CHANGE:
        // Phase 1: Change creation requires ItsmModule cross-dependency.
        // Deferred to Phase 2. Return informative skip message.
        return this.buildResultItem(
          suggestedRecord.id,
          suggestedRecord.type,
          SuggestedRecordType.CHANGE,
          'skipped',
          {
            userSafeMessage:
              'Change creation via advisory will be available in Phase 2. Please create the change manually from ITSM > Changes.',
            errorCode: 'CHANGE_NOT_SUPPORTED_YET',
          },
        );

      case SuggestedRecordType.CAPA:
      case SuggestedRecordType.TASK:
        // Both CAPA and TASK suggestions create CAPA records.
        // TASK items are domain-mapped to CAPA in the current architecture.
        return this.createDraftCapa(
          tenantId,
          riskId,
          userId,
          suggestedRecord,
          titleOverride,
          descriptionOverride,
        );

      case SuggestedRecordType.CONTROL_TEST:
        return this.createDraftControlTest(
          tenantId,
          riskId,
          userId,
          suggestedRecord,
          titleOverride,
          descriptionOverride,
        );

      default:
        return this.buildResultItem(
          suggestedRecord.id,
          suggestedRecord.type,
          effectiveTarget,
          'failed',
          {
            userSafeMessage: `Unsupported record type: ${String(suggestedRecord.type)}`,
            errorCode: 'UNSUPPORTED_TYPE',
          },
        );
    }
  }

  /**
   * Create a CAPA draft using the centralized advisory-draft-mapper.
   *
   * This method uses buildCapaDraftPayload() to resolve advisory semantics
   * (e.g. UPPERCASE "CORRECTIVE") to valid domain enum values (lowercase "corrective"),
   * with compile-time type safety and runtime validation before DB insert.
   */
  private async createDraftCapa(
    tenantId: string,
    _riskId: string,
    userId: string,
    suggestedRecord: SuggestedRecord,
    titleOverride?: string,
    descriptionOverride?: string,
  ): Promise<DraftCreationResultItem> {
    const effectiveTarget = resolveEffectiveTargetType(suggestedRecord.type);

    if (!this.capaService) {
      return this.buildResultItem(
        suggestedRecord.id,
        suggestedRecord.type,
        effectiveTarget,
        'failed',
        {
          userSafeMessage:
            'CAPA service is not available. Please contact your administrator.',
          errorCode: 'CAPA_SERVICE_UNAVAILABLE',
        },
      );
    }

    // Use centralized mapper to build validated payload
    const mapResult = buildCapaDraftPayload(
      suggestedRecord,
      titleOverride,
      descriptionOverride,
    );

    // Check for mapping/validation errors BEFORE attempting DB insert
    if ('error' in mapResult) {
      this.logger.warn(
        `CAPA draft mapping failed for ${suggestedRecord.id}: ${mapResult.error}`,
      );
      return this.buildResultItem(
        suggestedRecord.id,
        suggestedRecord.type,
        effectiveTarget,
        'failed',
        {
          userSafeMessage: mapResult.error,
          errorCode: mapResult.errorCode,
        },
      );
    }

    try {
      const { payload } = mapResult;

      const capa = await this.capaService.create(
        tenantId,
        {
          title: payload.title,
          description: payload.description,
          type: payload.type,
          priority: payload.priority,
          metadata: payload.metadata,
        },
        userId,
      );

      return this.buildResultItem(
        suggestedRecord.id,
        suggestedRecord.type,
        effectiveTarget,
        'created',
        {
          createdRecordId: capa.id,
          createdRecordCode: capa.title || undefined,
        },
      );
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to create CAPA';
      this.logger.warn(
        `CAPA creation failed for ${suggestedRecord.id}: ${errorMsg}`,
      );
      return this.buildResultItem(
        suggestedRecord.id,
        suggestedRecord.type,
        effectiveTarget,
        'failed',
        {
          userSafeMessage: `Failed to create ${this.getTypeLabel(effectiveTarget)} draft. ${
            errorMsg.includes('enum')
              ? 'Internal type mapping error.'
              : 'Please try again.'
          }`,
          technicalMessage: errorMsg,
          errorCode: 'CAPA_CREATION_ERROR',
        },
      );
    }
  }

  /* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */
  private async createDraftControlTest(
    _tenantId: string,
    _riskId: string,
    _userId: string,
    suggestedRecord: SuggestedRecord,
    _titleOverride?: string,
    _descriptionOverride?: string,
  ): Promise<DraftCreationResultItem> {
    /* eslint-enable @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */
    // Control tests require a controlId — cannot create without one.
    return this.buildResultItem(
      suggestedRecord.id,
      suggestedRecord.type,
      SuggestedRecordType.CONTROL_TEST,
      'skipped',
      {
        userSafeMessage:
          'Control test creation requires a linked control. Please link a control to this risk first, then create the test from the control detail page.',
        errorCode: 'CONTROL_TEST_NO_LINKED_CONTROL',
      },
    );
  }

  // ===========================================================================
  // Result builder helper
  // ===========================================================================

  /**
   * Builds a DraftCreationResultItem with both new fields and legacy compat fields.
   * This ensures backward compatibility with the existing frontend while
   * providing richer error attribution for future frontend updates.
   */
  private buildResultItem(
    suggestedRecordId: string,
    requestedType: SuggestedRecordType,
    resolvedTargetType: SuggestedRecordType,
    status: 'created' | 'failed' | 'skipped',
    details: {
      createdRecordId?: string;
      createdRecordCode?: string;
      userSafeMessage?: string;
      technicalMessage?: string;
      errorCode?: string;
    } = {},
  ): DraftCreationResultItem {
    return {
      // New fields for accurate attribution
      suggestedRecordId,
      requestedType,
      resolvedTargetType,
      status,
      createdRecordId: details.createdRecordId,
      createdRecordCode: details.createdRecordCode,
      userSafeMessage: details.userSafeMessage,
      technicalMessage: details.technicalMessage,
      errorCode: details.errorCode,
      linkToRisk: false,

      // Legacy compat fields — existing frontend reads these
      type: requestedType,
      success: status === 'created',
      error: details.userSafeMessage,
    };
  }

  /**
   * Human-readable label for a SuggestedRecordType.
   * Used in user-facing error messages.
   */
  private getTypeLabel(type: SuggestedRecordType): string {
    switch (type) {
      case SuggestedRecordType.CAPA:
        return 'CAPA';
      case SuggestedRecordType.TASK:
        return 'Task';
      case SuggestedRecordType.CHANGE:
        return 'Change Request';
      case SuggestedRecordType.CONTROL_TEST:
        return 'Control Test';
      default:
        return String(type);
    }
  }
}
