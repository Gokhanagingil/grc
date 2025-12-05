import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, SelectQueryBuilder } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcRisk } from '../entities/grc-risk.entity';
import {
  RiskCreatedEvent,
  RiskUpdatedEvent,
  RiskDeletedEvent,
} from '../events';
import { RiskStatus, RiskSeverity } from '../enums';
import {
  RiskFilterDto,
  RISK_SORTABLE_FIELDS,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';

/**
 * GRC Risk Service
 *
 * Multi-tenant service for managing risks.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 * Implements soft delete - deleted records are marked with isDeleted=true.
 */
@Injectable()
export class GrcRiskService extends MultiTenantServiceBase<GrcRisk> {
  constructor(
    @InjectRepository(GrcRisk)
    repository: Repository<GrcRisk>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repository);
  }

  /**
   * Create a new risk and emit RiskCreatedEvent
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
      isDeleted: false,
    });

    // Emit domain event
    this.eventEmitter.emit(
      'risk.created',
      new RiskCreatedEvent(risk.id, tenantId, userId, risk.title),
    );

    return risk;
  }

  /**
   * Update a risk and emit RiskUpdatedEvent
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

    const risk = await this.updateForTenant(tenantId, id, data);

    if (risk) {
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
    await this.updateForTenant(tenantId, id, { isDeleted: true } as Partial<
      Omit<GrcRisk, 'id' | 'tenantId'>
    >);

    // Emit domain event
    this.eventEmitter.emit(
      'risk.deleted',
      new RiskDeletedEvent(id, tenantId, userId, existing.title),
    );

    return true;
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
        ...((options?.where || {}) as FindOptionsWhere<GrcRisk>),
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
   */
  async getSummary(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byLikelihood: Record<string, number>;
    byCategory: Record<string, number>;
    highPriorityCount: number;
    overdueCount: number;
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
    }

    return {
      total: risks.length,
      byStatus,
      bySeverity,
      byLikelihood,
      byCategory,
      highPriorityCount,
      overdueCount,
    };
  }
}
