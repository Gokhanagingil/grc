import { Injectable, Optional, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcRisk } from '../entities/grc-risk.entity';
import { GrcRiskHistory } from '../entities/history';
import { GrcRiskPolicy } from '../entities/grc-risk-policy.entity';
import { GrcRiskRequirement } from '../entities/grc-risk-requirement.entity';
import { GrcRiskControl } from '../entities/grc-risk-control.entity';
import { GrcRiskAssessment } from '../entities/grc-risk-assessment.entity';
import { GrcRiskTreatmentAction } from '../entities/grc-risk-treatment-action.entity';
import { GrcPolicy } from '../entities/grc-policy.entity';
import { GrcRequirement } from '../entities/grc-requirement.entity';
import { GrcControl } from '../entities/grc-control.entity';
import {
  RiskCreatedEvent,
  RiskUpdatedEvent,
  RiskDeletedEvent,
} from '../events';
import {
  RiskStatus,
  RiskSeverity,
  RiskLikelihood,
  AssessmentType,
  ControlEffectiveness,
  TreatmentActionStatus,
} from '../enums';
import {
  calculateScoreAndBand,
  aggregateRisksToHeatmap,
  HeatmapData,
  calculateResidualScoreNumeric,
  calculateResidualComponents,
  getRiskBand,
  ControlLinkDataNumeric,
  effectivenessPercentToReductionFactor,
} from '../utils/risk-scoring.util';
import {
  RiskFilterDto,
  RISK_SORTABLE_FIELDS,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';
import { AuditService } from '../../audit/audit.service';
import { UniversalListService } from '../../common';
import { CodeGeneratorService, CodePrefix } from './code-generator.service';

/**
 * GRC Risk Service
 *
 * Multi-tenant service for managing risks.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 * Implements soft delete - deleted records are marked with isDeleted=true.
 * Integrates with AuditService for entity-level audit logging.
 */

@Injectable()
export class GrcRiskService extends MultiTenantServiceBase<GrcRisk> {
  constructor(
    @InjectRepository(GrcRisk)
    repository: Repository<GrcRisk>,
    @InjectRepository(GrcRiskHistory)
    private readonly historyRepository: Repository<GrcRiskHistory>,
    @InjectRepository(GrcRiskPolicy)
    private readonly riskPolicyRepository: Repository<GrcRiskPolicy>,
    @InjectRepository(GrcRiskRequirement)
    private readonly riskRequirementRepository: Repository<GrcRiskRequirement>,
    @InjectRepository(GrcPolicy)
    private readonly policyRepository: Repository<GrcPolicy>,
    @InjectRepository(GrcRequirement)
    private readonly requirementRepository: Repository<GrcRequirement>,
    @InjectRepository(GrcRiskControl)
    private readonly riskControlRepository: Repository<GrcRiskControl>,
    @InjectRepository(GrcControl)
    private readonly controlRepository: Repository<GrcControl>,
    @InjectRepository(GrcRiskAssessment)
    private readonly assessmentRepository: Repository<GrcRiskAssessment>,
    @InjectRepository(GrcRiskTreatmentAction)
    private readonly treatmentActionRepository: Repository<GrcRiskTreatmentAction>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly universalListService?: UniversalListService,
    @Optional() private readonly codeGeneratorService?: CodeGeneratorService,
  ) {
    super(repository);
  }

  /**
   * Create a new risk and emit RiskCreatedEvent
   * Records audit log and creates initial history entry
   */
  async createRisk(
    tenantId: string,
    userId: string,
    data: Omit<
      Partial<GrcRisk>,
      'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
  ): Promise<GrcRisk> {
    // Generate code if not provided
    let code = data.code;
    if (!code && this.codeGeneratorService) {
      code = await this.codeGeneratorService.generateCode(
        tenantId,
        CodePrefix.RISK,
      );
    }

    const risk = await this.createForTenant(tenantId, {
      ...data,
      code,
      createdBy: userId,
      isDeleted: false,
    });

    // Record audit log
    await this.auditService?.recordCreate('GrcRisk', risk, userId, tenantId);

    // Create history entry
    await this.createHistoryEntry(risk, userId);

    // Emit domain event
    this.eventEmitter.emit(
      'risk.created',
      new RiskCreatedEvent(risk.id, tenantId, userId, risk.title),
    );

    return risk;
  }

  /**
   * Update a risk and emit RiskUpdatedEvent
   * Records audit log with before/after state and creates history entry
   */
  async updateRisk(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<GrcRisk, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<GrcRisk | null> {
    // First check if the risk exists and is not deleted
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    // Capture before state for audit
    const beforeState = { ...existing };

    const risk = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });

    if (risk) {
      // Record audit log with before/after state
      await this.auditService?.recordUpdate(
        'GrcRisk',
        id,
        beforeState as unknown as Record<string, unknown>,
        risk as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );

      // Create history entry
      await this.createHistoryEntry(risk, userId);

      // Emit domain event
      this.eventEmitter.emit(
        'risk.updated',
        new RiskUpdatedEvent(risk.id, tenantId, userId, data),
      );
    }

    return risk;
  }

  /**
   * Soft delete a risk and emit RiskDeletedEvent
   * Sets isDeleted=true instead of removing the record
   * Records audit log for the delete action
   */
  async softDeleteRisk(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    // First check if the risk exists and is not already deleted
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return false;
    }

    // Mark as deleted
    await this.updateForTenant(tenantId, id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<GrcRisk, 'id' | 'tenantId'>>);

    // Record audit log for delete action
    await this.auditService?.recordDelete(
      'GrcRisk',
      existing,
      userId,
      tenantId,
    );

    // Create final history entry marking deletion
    await this.createHistoryEntry(
      { ...existing, isDeleted: true },
      userId,
      'Soft deleted',
    );

    // Emit domain event
    this.eventEmitter.emit(
      'risk.deleted',
      new RiskDeletedEvent(id, tenantId, userId, existing.title),
    );

    return true;
  }

  /**
   * Create a history entry for a risk
   * @param risk - The risk entity to create history for
   * @param changedBy - ID of the user who made the change
   * @param changeReason - Optional reason for the change
   */
  private async createHistoryEntry(
    risk: GrcRisk,
    changedBy: string,
    changeReason?: string,
  ): Promise<GrcRiskHistory> {
    const likelihoodValue = this.likelihoodToNumber(risk.likelihood);
    const impactValue = this.severityToNumber(risk.impact);

    const historyEntry = this.historyRepository.create({
      riskId: risk.id,
      tenantId: risk.tenantId,
      title: risk.title,
      description: risk.description,
      severity: risk.severity,
      status: risk.status,
      ownerUserId: risk.ownerUserId,
      likelihood: likelihoodValue,
      impact: impactValue,
      riskScore: risk.score,
      mitigation: risk.mitigationPlan,
      metadata: risk.metadata,
      changedBy,
      changeReason: changeReason ?? null,
    });

    return this.historyRepository.save(historyEntry);
  }

  private likelihoodToNumber(likelihood: RiskLikelihood): number {
    const mapping: Record<RiskLikelihood, number> = {
      [RiskLikelihood.RARE]: 1,
      [RiskLikelihood.UNLIKELY]: 2,
      [RiskLikelihood.POSSIBLE]: 3,
      [RiskLikelihood.LIKELY]: 4,
      [RiskLikelihood.ALMOST_CERTAIN]: 5,
    };
    return mapping[likelihood] ?? 3;
  }

  private severityToNumber(severity: RiskSeverity): number {
    const mapping: Record<RiskSeverity, number> = {
      [RiskSeverity.LOW]: 1,
      [RiskSeverity.MEDIUM]: 2,
      [RiskSeverity.HIGH]: 3,
      [RiskSeverity.CRITICAL]: 4,
    };
    return mapping[severity] ?? 2;
  }

  /**
   * Find one active (non-deleted) risk for a tenant
   */
  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<GrcRisk | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find all active (non-deleted) risks for a tenant
   */
  async findAllActiveForTenant(
    tenantId: string,
    options?: {
      where?: FindOptionsWhere<GrcRisk>;
      order?: Record<string, 'ASC' | 'DESC'>;
      relations?: string[];
    },
  ): Promise<GrcRisk[]> {
    return this.repository.find({
      where: {
        ...(options?.where || {}),
        tenantId,
        isDeleted: false,
      },
      order: options?.order,
      relations: options?.relations,
    });
  }

  /**
   * Find risks by status for a tenant (excludes deleted)
   */
  async findByStatus(tenantId: string, status: RiskStatus): Promise<GrcRisk[]> {
    return this.findAllActiveForTenant(tenantId, {
      where: { status } as FindOptionsWhere<GrcRisk>,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find risks by severity for a tenant (excludes deleted)
   */
  async findBySeverity(
    tenantId: string,
    severity: RiskSeverity,
  ): Promise<GrcRisk[]> {
    return this.findAllActiveForTenant(tenantId, {
      where: { severity } as FindOptionsWhere<GrcRisk>,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find high-severity risks (HIGH or CRITICAL) - excludes deleted
   */
  async findHighSeverityRisks(tenantId: string): Promise<GrcRisk[]> {
    return this.repository.find({
      where: [
        { tenantId, severity: RiskSeverity.HIGH, isDeleted: false },
        { tenantId, severity: RiskSeverity.CRITICAL, isDeleted: false },
      ],
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Find risks with their associated controls (excludes deleted)
   */
  async findWithControls(
    tenantId: string,
    id: string,
  ): Promise<GrcRisk | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['riskControls', 'riskControls.control'],
    });
  }

  /**
   * Get risk statistics for a tenant (excludes deleted)
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const risks = await this.findAllActiveForTenant(tenantId);

    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const risk of risks) {
      byStatus[risk.status] = (byStatus[risk.status] || 0) + 1;
      bySeverity[risk.severity] = (bySeverity[risk.severity] || 0) + 1;
    }

    return {
      total: risks.length,
      byStatus,
      bySeverity,
    };
  }

  /**
   * Find risks with pagination, sorting, and filtering
   */
  async findWithFilters(
    tenantId: string,
    filterDto: RiskFilterDto,
  ): Promise<PaginatedResponse<GrcRisk>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      status,
      severity,
      likelihood,
      impact,
      category,
      ownerUserId,
      createdFrom,
      createdTo,
      dueDateFrom,
      dueDateTo,
      search,
      inherentLikelihood,
      inherentImpact,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('risk');

    // Base filters: tenant and not deleted
    qb.where('risk.tenantId = :tenantId', { tenantId });
    qb.andWhere('risk.isDeleted = :isDeleted', { isDeleted: false });

    // Apply optional filters
    if (status) {
      qb.andWhere('risk.status = :status', { status });
    }

    if (severity) {
      qb.andWhere('risk.severity = :severity', { severity });
    }

    if (likelihood) {
      qb.andWhere('risk.likelihood = :likelihood', { likelihood });
    }

    if (impact) {
      qb.andWhere('risk.impact = :impact', { impact });
    }

    if (category) {
      qb.andWhere('risk.category = :category', { category });
    }

    if (ownerUserId) {
      qb.andWhere('risk.ownerUserId = :ownerUserId', { ownerUserId });
    }

    if (createdFrom) {
      qb.andWhere('risk.createdAt >= :createdFrom', { createdFrom });
    }

    if (createdTo) {
      qb.andWhere('risk.createdAt <= :createdTo', { createdTo });
    }

    if (dueDateFrom) {
      qb.andWhere('risk.dueDate >= :dueDateFrom', { dueDateFrom });
    }

    if (dueDateTo) {
      qb.andWhere('risk.dueDate <= :dueDateTo', { dueDateTo });
    }

    if (search) {
      qb.andWhere(
        '(risk.title ILIKE :search OR risk.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Numeric filters for heatmap drill-down
    if (inherentLikelihood !== undefined) {
      qb.andWhere('risk.inherentLikelihood = :inherentLikelihood', {
        inherentLikelihood,
      });
    }

    if (inherentImpact !== undefined) {
      qb.andWhere('risk.inherentImpact = :inherentImpact', { inherentImpact });
    }

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply sorting (validate sortBy field)
    const validSortBy = RISK_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`risk.${validSortBy}`, validSortOrder);

    // Apply pagination
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Get summary/reporting data for risks
   * Enhanced with KPI-ready fields for Dashboard
   */
  async getSummary(tenantId: string): Promise<{
    total: number;
    totalCount: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byLikelihood: Record<string, number>;
    byCategory: Record<string, number>;
    highPriorityCount: number;
    overdueCount: number;
    top5OpenRisks: Array<{
      id: string;
      title: string;
      severity: string;
      score: number | null;
    }>;
    totalLinkedPolicies: number;
    totalLinkedRequirements: number;
    risksWithPoliciesCount: number;
    risksWithRequirementsCount: number;
  }> {
    const qb = this.repository.createQueryBuilder('risk');
    qb.where('risk.tenantId = :tenantId', { tenantId });
    qb.andWhere('risk.isDeleted = :isDeleted', { isDeleted: false });

    const risks = await qb.getMany();

    // Get relationship counts
    const [totalLinkedPolicies, totalLinkedRequirements] = await Promise.all([
      this.riskPolicyRepository.count({ where: { tenantId } }),
      this.riskRequirementRepository.count({ where: { tenantId } }),
    ]);

    // Get count of risks that have at least one linked policy or requirement
    const risksWithPolicies = await this.riskPolicyRepository
      .createQueryBuilder('rp')
      .select('DISTINCT rp.riskId')
      .where('rp.tenantId = :tenantId', { tenantId })
      .getRawMany();

    const risksWithRequirements = await this.riskRequirementRepository
      .createQueryBuilder('rr')
      .select('DISTINCT rr.riskId')
      .where('rr.tenantId = :tenantId', { tenantId })
      .getRawMany();

    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byLikelihood: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let highPriorityCount = 0;
    let overdueCount = 0;
    const now = new Date();

    // Collect open risks for top 5 calculation
    const openRisks: GrcRisk[] = [];

    for (const risk of risks) {
      // Count by status
      byStatus[risk.status] = (byStatus[risk.status] || 0) + 1;

      // Count by severity
      bySeverity[risk.severity] = (bySeverity[risk.severity] || 0) + 1;

      // Count by likelihood
      byLikelihood[risk.likelihood] = (byLikelihood[risk.likelihood] || 0) + 1;

      // Count by category
      if (risk.category) {
        byCategory[risk.category] = (byCategory[risk.category] || 0) + 1;
      }

      // Count high priority (HIGH or CRITICAL severity)
      if (
        risk.severity === RiskSeverity.HIGH ||
        risk.severity === RiskSeverity.CRITICAL
      ) {
        highPriorityCount++;
      }

      // Count overdue (dueDate in the past and not closed)
      if (
        risk.dueDate &&
        new Date(risk.dueDate) < now &&
        risk.status !== RiskStatus.CLOSED
      ) {
        overdueCount++;
      }

      // Collect open risks (not closed or accepted)
      if (
        risk.status !== RiskStatus.CLOSED &&
        risk.status !== RiskStatus.ACCEPTED
      ) {
        openRisks.push(risk);
      }
    }

    // Sort open risks by score (descending) and take top 5
    const top5OpenRisks = openRisks
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5)
      .map((risk) => ({
        id: risk.id,
        title: risk.title,
        severity: risk.severity,
        score: risk.score,
      }));

    return {
      total: risks.length,
      totalCount: risks.length,
      byStatus,
      bySeverity,
      byLikelihood,
      byCategory,
      highPriorityCount,
      overdueCount,
      top5OpenRisks,
      totalLinkedPolicies,
      totalLinkedRequirements,
      risksWithPoliciesCount: risksWithPolicies.length,
      risksWithRequirementsCount: risksWithRequirements.length,
    };
  }

  // ============================================================================
  // Relationship Management Methods
  // ============================================================================

  /**
   * Link policies to a risk
   * Replaces existing policy links with the new set
   */
  async linkPolicies(
    tenantId: string,
    riskId: string,
    policyIds: string[],
  ): Promise<GrcRiskPolicy[]> {
    // Verify risk exists
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    // Verify all policies exist
    const policies = await this.policyRepository.find({
      where: {
        id: In(policyIds),
        tenantId,
        isDeleted: false,
      },
    });

    if (policies.length !== policyIds.length) {
      const foundIds = policies.map((p) => p.id);
      const missingIds = policyIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Policies not found: ${missingIds.join(', ')}`,
      );
    }

    // Remove existing links for this risk
    await this.riskPolicyRepository.delete({
      tenantId,
      riskId,
    });

    // Create new links
    const riskPolicies = policyIds.map((policyId) =>
      this.riskPolicyRepository.create({
        tenantId,
        riskId,
        policyId,
      }),
    );

    return this.riskPolicyRepository.save(riskPolicies);
  }

  /**
   * Get policies linked to a risk
   */
  async getLinkedPolicies(
    tenantId: string,
    riskId: string,
  ): Promise<GrcPolicy[]> {
    // Verify risk exists
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    const riskPolicies = await this.riskPolicyRepository.find({
      where: { tenantId, riskId },
      relations: ['policy'],
    });

    return riskPolicies.map((rp) => rp.policy).filter((p) => p && !p.isDeleted);
  }

  /**
   * Link a single policy to a risk (idempotent)
   */
  async linkPolicy(
    tenantId: string,
    riskId: string,
    policyId: string,
  ): Promise<GrcRiskPolicy> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    const policy = await this.policyRepository.findOne({
      where: { id: policyId, tenantId, isDeleted: false },
    });
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }

    // Check if link already exists (idempotent)
    const existing = await this.riskPolicyRepository.findOne({
      where: { tenantId, riskId, policyId },
    });
    if (existing) {
      return existing;
    }

    const riskPolicy = this.riskPolicyRepository.create({
      tenantId,
      riskId,
      policyId,
    });

    return this.riskPolicyRepository.save(riskPolicy);
  }

  /**
   * Unlink a single policy from a risk
   */
  async unlinkPolicy(
    tenantId: string,
    riskId: string,
    policyId: string,
  ): Promise<boolean> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    const result = await this.riskPolicyRepository.delete({
      tenantId,
      riskId,
      policyId,
    });

    return (result.affected ?? 0) > 0;
  }

  /**
   * Link requirements to a risk
   * Replaces existing requirement links with the new set
   */
  async linkRequirements(
    tenantId: string,
    riskId: string,
    requirementIds: string[],
  ): Promise<GrcRiskRequirement[]> {
    // Verify risk exists
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    // Verify all requirements exist
    const requirements = await this.requirementRepository.find({
      where: {
        id: In(requirementIds),
        tenantId,
        isDeleted: false,
      },
    });

    if (requirements.length !== requirementIds.length) {
      const foundIds = requirements.map((r) => r.id);
      const missingIds = requirementIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Requirements not found: ${missingIds.join(', ')}`,
      );
    }

    // Remove existing links for this risk
    await this.riskRequirementRepository.delete({
      tenantId,
      riskId,
    });

    // Create new links
    const riskRequirements = requirementIds.map((requirementId) =>
      this.riskRequirementRepository.create({
        tenantId,
        riskId,
        requirementId,
      }),
    );

    return this.riskRequirementRepository.save(riskRequirements);
  }

  /**
   * Get requirements linked to a risk
   */
  async getLinkedRequirements(
    tenantId: string,
    riskId: string,
  ): Promise<GrcRequirement[]> {
    // Verify risk exists
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    const riskRequirements = await this.riskRequirementRepository.find({
      where: { tenantId, riskId },
      relations: ['requirement'],
    });

    return riskRequirements
      .map((rr) => rr.requirement)
      .filter((r) => r && !r.isDeleted);
  }

  /**
   * Get relationship counts for a risk
   */
  async getRelationshipCounts(
    tenantId: string,
    riskId: string,
  ): Promise<{ linkedPoliciesCount: number; linkedRequirementsCount: number }> {
    const [policiesCount, requirementsCount] = await Promise.all([
      this.riskPolicyRepository.count({ where: { tenantId, riskId } }),
      this.riskRequirementRepository.count({ where: { tenantId, riskId } }),
    ]);

    return {
      linkedPoliciesCount: policiesCount,
      linkedRequirementsCount: requirementsCount,
    };
  }

  // ============================================================================
  // Control Relationship Management Methods
  // ============================================================================

  /**
   * Link a control to a risk
   * Creates a new risk-control mapping if it doesn't exist
   */
  async linkControl(
    tenantId: string,
    riskId: string,
    controlId: string,
  ): Promise<GrcRiskControl> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    const control = await this.controlRepository.findOne({
      where: { id: controlId, tenantId, isDeleted: false },
    });
    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }

    const existing = await this.riskControlRepository.findOne({
      where: { tenantId, riskId, controlId },
    });
    if (existing) {
      return existing;
    }

    const riskControl = this.riskControlRepository.create({
      tenantId,
      riskId,
      controlId,
    });

    const savedLink = await this.riskControlRepository.save(riskControl);

    // Recalculate residual risk after linking control
    await this.recalculateResidualRisk(tenantId, riskId);

    return savedLink;
  }

  /**
   * Unlink a control from a risk
   * Removes the risk-control mapping
   */
  async unlinkControl(
    tenantId: string,
    riskId: string,
    controlId: string,
  ): Promise<boolean> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    const result = await this.riskControlRepository.delete({
      tenantId,
      riskId,
      controlId,
    });

    const wasDeleted = (result.affected ?? 0) > 0;

    // Recalculate residual risk after unlinking control
    if (wasDeleted) {
      await this.recalculateResidualRisk(tenantId, riskId);
    }

    return wasDeleted;
  }

  /**
   * Get controls linked to a risk
   */
  async getLinkedControls(
    tenantId: string,
    riskId: string,
  ): Promise<GrcControl[]> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    const riskControls = await this.riskControlRepository.find({
      where: { tenantId, riskId },
      relations: ['control'],
    });

    return riskControls
      .map((rc) => rc.control)
      .filter((c) => c && !c.isDeleted);
  }

  /**
   * Calculate risk score based on likelihood and impact
   * Score = likelihoodValue (1-5) * impactValue (1-4)
   */
  calculateScore(likelihood: RiskLikelihood, impact: RiskSeverity): number {
    const likelihoodValue = this.likelihoodToNumber(likelihood);
    const impactValue = this.severityToNumber(impact);
    return likelihoodValue * impactValue;
  }

  // ============================================================================
  // Risk Assessment Methods (MVP+)
  // ============================================================================

  /**
   * Create a risk assessment and update the risk's current scores
   */
  async createAssessment(
    tenantId: string,
    userId: string,
    riskId: string,
    data: {
      assessmentType: AssessmentType;
      likelihood: number;
      impact: number;
      rationale?: string;
      assessedAt?: Date;
      metadata?: Record<string, unknown>;
    },
  ): Promise<GrcRiskAssessment> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    // Calculate score and band
    const { score, band } = calculateScoreAndBand(data.likelihood, data.impact);

    // Create assessment record
    const assessment = this.assessmentRepository.create({
      tenantId,
      riskId,
      assessmentType: data.assessmentType,
      likelihood: data.likelihood,
      impact: data.impact,
      score,
      band,
      rationale: data.rationale ?? null,
      assessedAt: data.assessedAt ?? new Date(),
      assessedByUserId: userId,
      metadata: data.metadata ?? null,
      createdBy: userId,
    });

    const savedAssessment = await this.assessmentRepository.save(assessment);

    // Update risk's current scores based on assessment type
    const updateData: Partial<GrcRisk> = {};
    if (data.assessmentType === AssessmentType.INHERENT) {
      updateData.inherentLikelihood = data.likelihood;
      updateData.inherentImpact = data.impact;
      updateData.inherentScore = score;
      updateData.inherentBand = band;
    } else {
      updateData.residualLikelihood = data.likelihood;
      updateData.residualImpact = data.impact;
      updateData.residualScore = score;
      updateData.residualBand = band;
    }

    await this.updateRisk(tenantId, userId, riskId, updateData);

    return savedAssessment;
  }

  /**
   * Get assessment history for a risk
   */
  async getAssessments(
    tenantId: string,
    riskId: string,
    options?: {
      assessmentType?: AssessmentType;
      limit?: number;
    },
  ): Promise<GrcRiskAssessment[]> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    const qb = this.assessmentRepository.createQueryBuilder('assessment');
    qb.where('assessment.tenantId = :tenantId', { tenantId });
    qb.andWhere('assessment.riskId = :riskId', { riskId });
    qb.andWhere('assessment.isDeleted = :isDeleted', { isDeleted: false });

    if (options?.assessmentType) {
      qb.andWhere('assessment.assessmentType = :assessmentType', {
        assessmentType: options.assessmentType,
      });
    }

    qb.orderBy('assessment.assessedAt', 'DESC');

    if (options?.limit) {
      qb.take(options.limit);
    }

    return qb.getMany();
  }

  // ============================================================================
  // Heatmap Methods (MVP+)
  // ============================================================================

  /**
   * Get heatmap data for risks
   * Returns 5x5 grid counts for inherent and residual scores
   */
  async getHeatmap(tenantId: string): Promise<HeatmapData> {
    const risks = await this.findAllActiveForTenant(tenantId);
    return aggregateRisksToHeatmap(risks);
  }

  /**
   * Get risk detail with assessments and linked controls
   */
  async getRiskDetail(
    tenantId: string,
    riskId: string,
  ): Promise<{
    risk: GrcRisk;
    assessments: GrcRiskAssessment[];
    linkedControls: Array<{
      control: GrcControl;
      effectivenessRating: ControlEffectiveness;
      notes: string | null;
    }>;
  } | null> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      return null;
    }

    const [assessments, riskControls] = await Promise.all([
      this.getAssessments(tenantId, riskId, { limit: 10 }),
      this.riskControlRepository.find({
        where: { tenantId, riskId },
        relations: ['control'],
      }),
    ]);

    const linkedControls = riskControls
      .filter((rc) => rc.control && !rc.control.isDeleted)
      .map((rc) => ({
        control: rc.control,
        effectivenessRating: rc.effectivenessRating,
        notes: rc.notes,
      }));

    return {
      risk,
      assessments,
      linkedControls,
    };
  }

  /**
   * Link a control to a risk with effectiveness rating
   */
  async linkControlWithEffectiveness(
    tenantId: string,
    riskId: string,
    controlId: string,
    effectivenessRating?: ControlEffectiveness,
    notes?: string,
  ): Promise<GrcRiskControl> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    const control = await this.controlRepository.findOne({
      where: { id: controlId, tenantId, isDeleted: false },
    });
    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }

    const existing = await this.riskControlRepository.findOne({
      where: { tenantId, riskId, controlId },
    });

    if (existing) {
      // Update existing link
      existing.effectivenessRating =
        effectivenessRating ?? ControlEffectiveness.UNKNOWN;
      existing.notes = notes ?? existing.notes;
      const savedLink = await this.riskControlRepository.save(existing);

      // Recalculate residual risk after updating effectiveness
      await this.recalculateResidualRisk(tenantId, riskId);

      return savedLink;
    }

    const riskControl = this.riskControlRepository.create({
      tenantId,
      riskId,
      controlId,
      effectivenessRating: effectivenessRating ?? ControlEffectiveness.UNKNOWN,
      notes: notes ?? null,
    });

    const savedLink = await this.riskControlRepository.save(riskControl);

    // Recalculate residual risk after linking control
    await this.recalculateResidualRisk(tenantId, riskId);

    return savedLink;
  }

  /**
   * Update control link effectiveness
   */
  async updateControlEffectiveness(
    tenantId: string,
    riskId: string,
    controlId: string,
    effectivenessRating: ControlEffectiveness,
    notes?: string,
  ): Promise<GrcRiskControl | null> {
    const existing = await this.riskControlRepository.findOne({
      where: { tenantId, riskId, controlId },
    });

    if (!existing) {
      return null;
    }

    existing.effectivenessRating = effectivenessRating;
    if (notes !== undefined) {
      existing.notes = notes;
    }

    const savedLink = await this.riskControlRepository.save(existing);

    // Recalculate residual risk after updating effectiveness
    await this.recalculateResidualRisk(tenantId, riskId);

    return savedLink;
  }

  /**
   * Update effectiveness override on a risk-control link
   *
   * Sets or clears the overrideEffectivenessPercent for a specific risk-control link.
   * When set, this value takes precedence over the control's global effectivenessPercent.
   * When null, the control's global effectivenessPercent is used.
   *
   * @param tenantId - Tenant ID
   * @param riskId - Risk ID
   * @param controlId - Control ID
   * @param overrideEffectivenessPercent - Override value (0-100) or null to clear
   * @returns Updated risk-control link or null if not found
   */
  async updateEffectivenessOverride(
    tenantId: string,
    riskId: string,
    controlId: string,
    overrideEffectivenessPercent: number | null,
  ): Promise<GrcRiskControl | null> {
    const existing = await this.riskControlRepository.findOne({
      where: { tenantId, riskId, controlId },
    });

    if (!existing) {
      return null;
    }

    // Validate range if not null
    if (overrideEffectivenessPercent !== null) {
      if (
        overrideEffectivenessPercent < 0 ||
        overrideEffectivenessPercent > 100
      ) {
        throw new Error(
          'Override effectiveness percent must be between 0 and 100',
        );
      }
    }

    existing.overrideEffectivenessPercent = overrideEffectivenessPercent;
    const savedLink = await this.riskControlRepository.save(existing);

    // Recalculate residual risk after updating effectiveness override
    await this.recalculateResidualRisk(tenantId, riskId);

    return savedLink;
  }

  // ============================================================================
  // Residual Risk Calculation Methods
  // ============================================================================

  /**
   * Recalculate residual risk for a risk based on linked controls
   * Uses diminishing returns model with numeric percent-based effectiveness
   *
   * The effective effectiveness for each control is determined by:
   * 1. If overrideEffectivenessPercent is set on the risk-control link, use it
   * 2. Otherwise, use the control's global effectivenessPercent
   * 3. If neither is set, fall back to default (50%)
   *
   * @param tenantId - Tenant ID
   * @param riskId - Risk ID
   * @returns Updated risk with recalculated residual scores
   */
  async recalculateResidualRisk(
    tenantId: string,
    riskId: string,
  ): Promise<GrcRisk | null> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      return null;
    }

    // Get inherent score (use stored value or calculate from likelihood/impact)
    let inherentScore = risk.inherentScore;
    if (inherentScore === null || inherentScore === undefined) {
      if (risk.inherentLikelihood && risk.inherentImpact) {
        inherentScore = risk.inherentLikelihood * risk.inherentImpact;
      } else {
        // Fall back to enum-based calculation
        const likelihoodValue = this.likelihoodToNumber(risk.likelihood);
        const impactValue = this.severityToNumber(risk.impact);
        inherentScore = likelihoodValue * impactValue;
      }
    }

    // Get all linked controls with their effectiveness and the control's global effectiveness
    const riskControls = await this.riskControlRepository.find({
      where: { tenantId, riskId },
      relations: ['control'],
    });

    // Convert to ControlLinkDataNumeric format using effective effectiveness
    // Effective effectiveness = overrideEffectivenessPercent ?? control.effectivenessPercent ?? 50
    const controlLinksNumeric: ControlLinkDataNumeric[] = riskControls
      .filter((rc) => rc.control && !rc.control.isDeleted)
      .map((rc) => {
        const effectiveEffectiveness =
          rc.overrideEffectivenessPercent ??
          rc.control?.effectivenessPercent ??
          50; // Default to 50% if neither is set
        return {
          effectivenessPercent: effectiveEffectiveness,
          coverage: 1.0, // Default coverage, can be extended later
        };
      });

    // Calculate residual score using numeric percent-based diminishing returns model
    const residualScore = calculateResidualScoreNumeric(
      inherentScore,
      controlLinksNumeric,
    );

    // Calculate residual likelihood and impact components
    const inherentLikelihood =
      risk.inherentLikelihood || this.likelihoodToNumber(risk.likelihood);
    const inherentImpact =
      risk.inherentImpact || this.severityToNumber(risk.impact);
    const { residualLikelihood, residualImpact } = calculateResidualComponents(
      inherentLikelihood,
      inherentImpact,
      residualScore,
    );

    // Get residual band
    const residualBand = getRiskBand(residualScore);

    // Update risk with new residual values
    await this.repository.update(
      { id: riskId, tenantId },
      {
        residualScore,
        residualLikelihood,
        residualImpact,
        residualBand,
      },
    );

    // Return updated risk
    return this.findOneActiveForTenant(tenantId, riskId);
  }

  /**
   * Get linked controls with effectiveness for residual calculation display
   *
   * Returns both enum-based effectivenessRating (for backward compatibility)
   * and numeric percent-based effectiveness data for the new model.
   *
   * Effective effectiveness = overrideEffectivenessPercent ?? control.effectivenessPercent ?? 50
   */
  async getLinkedControlsWithEffectiveness(
    tenantId: string,
    riskId: string,
  ): Promise<
    Array<{
      controlId: string;
      controlTitle: string;
      controlCode: string | null;
      effectivenessRating: ControlEffectiveness;
      controlEffectivenessPercent: number | null;
      overrideEffectivenessPercent: number | null;
      effectiveEffectivenessPercent: number;
      reductionFactor: number;
    }>
  > {
    const riskControls = await this.riskControlRepository.find({
      where: { tenantId, riskId },
      relations: ['control'],
    });

    const result: Array<{
      controlId: string;
      controlTitle: string;
      controlCode: string | null;
      effectivenessRating: ControlEffectiveness;
      controlEffectivenessPercent: number | null;
      overrideEffectivenessPercent: number | null;
      effectiveEffectivenessPercent: number;
      reductionFactor: number;
    }> = [];

    for (const rc of riskControls) {
      const ctrl = rc.control;
      if (ctrl && !ctrl.isDeleted) {
        const effectivenessRating =
          rc.effectivenessRating || ControlEffectiveness.UNKNOWN;

        // Calculate effective effectiveness percent
        // Priority: override > control global > default (50)
        const effectiveEffectivenessPercent =
          rc.overrideEffectivenessPercent ?? ctrl.effectivenessPercent ?? 50;

        // Calculate reduction factor from numeric percent
        const reductionFactor = effectivenessPercentToReductionFactor(
          effectiveEffectivenessPercent,
        );

        result.push({
          controlId: rc.controlId,
          controlTitle: ctrl.name,
          controlCode: ctrl.code || null,
          effectivenessRating,
          controlEffectivenessPercent: ctrl.effectivenessPercent ?? null,
          overrideEffectivenessPercent: rc.overrideEffectivenessPercent ?? null,
          effectiveEffectivenessPercent,
          reductionFactor,
        });
      }
    }

    return result;
  }

  // ============================================================================
  // Treatment Action Methods
  // ============================================================================

  /**
   * Get all treatment actions for a risk
   */
  async getTreatmentActions(
    tenantId: string,
    riskId: string,
  ): Promise<GrcRiskTreatmentAction[]> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    return this.treatmentActionRepository.find({
      where: { tenantId, riskId, isDeleted: false },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Get a single treatment action
   */
  async getTreatmentAction(
    tenantId: string,
    riskId: string,
    actionId: string,
  ): Promise<GrcRiskTreatmentAction | null> {
    return this.treatmentActionRepository.findOne({
      where: { id: actionId, tenantId, riskId, isDeleted: false },
    });
  }

  /**
   * Create a treatment action for a risk
   */
  async createTreatmentAction(
    tenantId: string,
    userId: string,
    riskId: string,
    data: {
      title: string;
      description?: string;
      status?: TreatmentActionStatus;
      ownerUserId?: string;
      ownerDisplayName?: string;
      dueDate?: Date;
      progressPct?: number;
      evidenceLink?: string;
      sortOrder?: number;
      notes?: string;
    },
  ): Promise<GrcRiskTreatmentAction> {
    const risk = await this.findOneActiveForTenant(tenantId, riskId);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    // Get max sort order if not provided
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const existingActions = await this.treatmentActionRepository.find({
        where: { tenantId, riskId, isDeleted: false },
        select: ['sortOrder'],
        order: { sortOrder: 'DESC' },
        take: 1,
      });
      sortOrder =
        existingActions.length > 0 ? existingActions[0].sortOrder + 1 : 0;
    }

    const action = this.treatmentActionRepository.create({
      tenantId,
      riskId,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? TreatmentActionStatus.PLANNED,
      ownerUserId: data.ownerUserId ?? null,
      ownerDisplayName: data.ownerDisplayName ?? null,
      dueDate: data.dueDate ?? null,
      progressPct: data.progressPct ?? 0,
      evidenceLink: data.evidenceLink ?? null,
      sortOrder,
      notes: data.notes ?? null,
      createdBy: userId,
      isDeleted: false,
    });

    return this.treatmentActionRepository.save(action);
  }

  /**
   * Update a treatment action
   */
  async updateTreatmentAction(
    tenantId: string,
    userId: string,
    riskId: string,
    actionId: string,
    data: {
      title?: string;
      description?: string;
      status?: TreatmentActionStatus;
      ownerUserId?: string;
      ownerDisplayName?: string;
      dueDate?: Date | null;
      completedAt?: Date | null;
      progressPct?: number;
      evidenceLink?: string;
      sortOrder?: number;
      notes?: string;
    },
  ): Promise<GrcRiskTreatmentAction | null> {
    const action = await this.treatmentActionRepository.findOne({
      where: { id: actionId, tenantId, riskId, isDeleted: false },
    });

    if (!action) {
      return null;
    }

    // Update fields
    if (data.title !== undefined) action.title = data.title;
    if (data.description !== undefined) action.description = data.description;
    if (data.status !== undefined) {
      action.status = data.status;
      // Auto-set completedAt when status changes to COMPLETED
      if (
        data.status === TreatmentActionStatus.COMPLETED &&
        !action.completedAt
      ) {
        action.completedAt = new Date();
        action.progressPct = 100;
      }
    }
    if (data.ownerUserId !== undefined) action.ownerUserId = data.ownerUserId;
    if (data.ownerDisplayName !== undefined)
      action.ownerDisplayName = data.ownerDisplayName;
    if (data.dueDate !== undefined) action.dueDate = data.dueDate;
    if (data.completedAt !== undefined) action.completedAt = data.completedAt;
    if (data.progressPct !== undefined) action.progressPct = data.progressPct;
    if (data.evidenceLink !== undefined)
      action.evidenceLink = data.evidenceLink;
    if (data.sortOrder !== undefined) action.sortOrder = data.sortOrder;
    if (data.notes !== undefined) action.notes = data.notes;
    action.updatedBy = userId;

    return this.treatmentActionRepository.save(action);
  }

  /**
   * Delete a treatment action (soft delete)
   */
  async deleteTreatmentAction(
    tenantId: string,
    userId: string,
    riskId: string,
    actionId: string,
  ): Promise<boolean> {
    const action = await this.treatmentActionRepository.findOne({
      where: { id: actionId, tenantId, riskId, isDeleted: false },
    });

    if (!action) {
      return false;
    }

    action.isDeleted = true;
    action.updatedBy = userId;
    await this.treatmentActionRepository.save(action);

    return true;
  }

  /**
   * Get treatment action count for a risk
   */
  async getTreatmentActionCount(
    tenantId: string,
    riskId: string,
  ): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    planned: number;
  }> {
    const actions = await this.treatmentActionRepository.find({
      where: { tenantId, riskId, isDeleted: false },
      select: ['status'],
    });

    return {
      total: actions.length,
      completed: actions.filter(
        (a) => a.status === TreatmentActionStatus.COMPLETED,
      ).length,
      inProgress: actions.filter(
        (a) => a.status === TreatmentActionStatus.IN_PROGRESS,
      ).length,
      planned: actions.filter((a) => a.status === TreatmentActionStatus.PLANNED)
        .length,
    };
  }

  /**
   * Get risks above appetite threshold
   * Uses residualScore if available, otherwise inherentScore
   */
  async getRisksAboveAppetite(
    tenantId: string,
    appetiteScore: number,
    options: {
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
    } = {},
  ): Promise<PaginatedResponse<GrcRisk>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'residualScore',
      sortOrder = 'DESC',
    } = options;

    const queryBuilder = this.repository
      .createQueryBuilder('risk')
      .where('risk.tenantId = :tenantId', { tenantId })
      .andWhere('risk.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        '(risk.residualScore > :appetiteScore OR (risk.residualScore IS NULL AND risk.inherentScore > :appetiteScore))',
        { appetiteScore },
      );

    const total = await queryBuilder.getCount();

    const validSortFields = [
      'residualScore',
      'inherentScore',
      'title',
      'createdAt',
      'updatedAt',
    ];
    const safeSortBy = validSortFields.includes(sortBy)
      ? sortBy
      : 'residualScore';

    const risks = await queryBuilder
      .orderBy(`risk.${safeSortBy}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return createPaginatedResponse(risks, total, page, pageSize);
  }

  /**
   * Get count of risks above appetite threshold
   */
  async getAboveAppetiteCount(
    tenantId: string,
    appetiteScore: number,
  ): Promise<number> {
    return this.repository
      .createQueryBuilder('risk')
      .where('risk.tenantId = :tenantId', { tenantId })
      .andWhere('risk.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        '(risk.residualScore > :appetiteScore OR (risk.residualScore IS NULL AND risk.inherentScore > :appetiteScore))',
        { appetiteScore },
      )
      .getCount();
  }

  /**
   * Get risk statistics including above-appetite count
   */
  async getStatsWithAppetite(
    tenantId: string,
    appetiteScore: number,
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    aboveAppetiteCount: number;
    appetiteScore: number;
    averageResidualScore: number | null;
    averageInherentScore: number | null;
  }> {
    const risks = await this.repository.find({
      where: { tenantId, isDeleted: false },
      select: ['status', 'severity', 'residualScore', 'inherentScore'],
    });

    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let aboveAppetiteCount = 0;
    let totalResidual = 0;
    let residualCount = 0;
    let totalInherent = 0;
    let inherentCount = 0;

    for (const risk of risks) {
      byStatus[risk.status] = (byStatus[risk.status] || 0) + 1;
      bySeverity[risk.severity] = (bySeverity[risk.severity] || 0) + 1;

      const effectiveScore = risk.residualScore ?? risk.inherentScore;
      if (effectiveScore !== null && effectiveScore > appetiteScore) {
        aboveAppetiteCount++;
      }

      if (risk.residualScore !== null) {
        totalResidual += risk.residualScore;
        residualCount++;
      }
      if (risk.inherentScore !== null) {
        totalInherent += risk.inherentScore;
        inherentCount++;
      }
    }

    return {
      total: risks.length,
      byStatus,
      bySeverity,
      aboveAppetiteCount,
      appetiteScore,
      averageResidualScore:
        residualCount > 0
          ? Math.round((totalResidual / residualCount) * 10) / 10
          : null,
      averageInherentScore:
        inherentCount > 0
          ? Math.round((totalInherent / inherentCount) * 10) / 10
          : null,
    };
  }
}
