import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcRisk } from '../entities/grc-risk.entity';
import { GrcRiskHistory } from '../entities/history';
import {
  RiskCreatedEvent,
  RiskUpdatedEvent,
  RiskDeletedEvent,
} from '../events';
import { RiskStatus, RiskSeverity, RiskLikelihood } from '../enums';
import {
  RiskFilterDto,
  RISK_SORTABLE_FIELDS,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';
import { AuditService } from '../../audit/audit.service';

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
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
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
    const risk = await this.createForTenant(tenantId, {
      ...data,
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
  }> {
    const qb = this.repository.createQueryBuilder('risk');
    qb.where('risk.tenantId = :tenantId', { tenantId });
    qb.andWhere('risk.isDeleted = :isDeleted', { isDeleted: false });

    const risks = await qb.getMany();

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

      // Collect open risks (not closed or mitigated)
      if (
        risk.status !== RiskStatus.CLOSED &&
        risk.status !== RiskStatus.MITIGATED
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
    };
  }
}
