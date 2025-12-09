import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcAudit } from '../entities/grc-audit.entity';
import { AuditFilterDto, AUDIT_SORTABLE_FIELDS } from '../dto/filter-audit.dto';
import { CreateAuditDto } from '../dto/create-audit.dto';
import { UpdateAuditDto } from '../dto/update-audit.dto';
import { PaginatedResponse, createPaginatedResponse } from '../dto';
import { AuditService } from '../../audit/audit.service';

/**
 * GRC Audit Service
 *
 * Multi-tenant service for managing audits.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 * Implements soft delete - deleted records are marked with isDeleted=true.
 * Integrates with AuditService for entity-level audit logging.
 */
@Injectable()
export class GrcAuditService extends MultiTenantServiceBase<GrcAudit> {
  constructor(
    @InjectRepository(GrcAudit)
    repository: Repository<GrcAudit>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  /**
   * Create a new audit and emit event
   * Records audit log
   */
  async createAudit(
    tenantId: string,
    userId: string,
    data: CreateAuditDto,
  ): Promise<GrcAudit> {
    const auditData: Partial<GrcAudit> = {
      ...data,
      plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : null,
      plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate) : null,
      ownerUserId: userId,
      createdBy: userId,
      isDeleted: false,
    };

    const audit = await this.createForTenant(tenantId, auditData);

    // Record audit log
    await this.auditService?.recordCreate('GrcAudit', audit, userId, tenantId);

    // Emit domain event
    this.eventEmitter.emit('audit.created', {
      auditId: audit.id,
      tenantId,
      userId,
      name: audit.name,
    });

    return audit;
  }

  /**
   * Update an audit and emit event
   * Records audit log with before/after state
   */
  async updateAudit(
    tenantId: string,
    userId: string,
    id: string,
    data: UpdateAuditDto,
  ): Promise<GrcAudit | null> {
    // First check if the audit exists and is not deleted
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    // Capture before state for audit
    const beforeState = { ...existing };

    // Convert string dates to Date objects
    const updateData: Partial<GrcAudit> = {
      ...data,
      plannedStartDate: data.plannedStartDate !== undefined
        ? (data.plannedStartDate ? new Date(data.plannedStartDate) : null)
        : undefined,
      plannedEndDate: data.plannedEndDate !== undefined
        ? (data.plannedEndDate ? new Date(data.plannedEndDate) : null)
        : undefined,
      actualStartDate: data.actualStartDate !== undefined
        ? (data.actualStartDate ? new Date(data.actualStartDate) : null)
        : undefined,
      actualEndDate: data.actualEndDate !== undefined
        ? (data.actualEndDate ? new Date(data.actualEndDate) : null)
        : undefined,
      updatedBy: userId,
    };

    const audit = await this.updateForTenant(tenantId, id, updateData);

    if (audit) {
      // Record audit log with before/after state
      await this.auditService?.recordUpdate(
        'GrcAudit',
        id,
        beforeState as unknown as Record<string, unknown>,
        audit as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );

      // Emit domain event
      this.eventEmitter.emit('audit.updated', {
        auditId: audit.id,
        tenantId,
        userId,
        changes: data,
      });
    }

    return audit;
  }

  /**
   * Soft delete an audit and emit event
   * Sets isDeleted=true instead of removing the record
   * Records audit log for the delete action
   */
  async softDeleteAudit(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    // First check if the audit exists and is not already deleted
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return false;
    }

    // Mark as deleted
    await this.updateForTenant(tenantId, id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<GrcAudit, 'id' | 'tenantId'>>);

    // Record audit log for delete action
    await this.auditService?.recordDelete('GrcAudit', existing, userId, tenantId);

    // Emit domain event
    this.eventEmitter.emit('audit.deleted', {
      auditId: id,
      tenantId,
      userId,
      name: existing.name,
    });

    return true;
  }

  /**
   * Find one active (non-deleted) audit for a tenant
   */
  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<GrcAudit | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find all active (non-deleted) audits for a tenant
   */
  async findAllActiveForTenant(tenantId: string): Promise<GrcAudit[]> {
    return this.repository.find({
      where: { tenantId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find audits with pagination, sorting, and filtering
   */
  async findWithFilters(
    tenantId: string,
    filterDto: AuditFilterDto,
  ): Promise<PaginatedResponse<GrcAudit>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      status,
      auditType,
      riskLevel,
      department,
      ownerUserId,
      leadAuditorId,
      createdFrom,
      createdTo,
      plannedStartFrom,
      plannedStartTo,
      search,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('audit');

    // Base filters: tenant and not deleted
    qb.where('audit.tenantId = :tenantId', { tenantId });
    qb.andWhere('audit.isDeleted = :isDeleted', { isDeleted: false });

    // Apply optional filters
    if (status) {
      qb.andWhere('audit.status = :status', { status });
    }

    if (auditType) {
      qb.andWhere('audit.auditType = :auditType', { auditType });
    }

    if (riskLevel) {
      qb.andWhere('audit.riskLevel = :riskLevel', { riskLevel });
    }

    if (department) {
      qb.andWhere('audit.department = :department', { department });
    }

    if (ownerUserId) {
      qb.andWhere('audit.ownerUserId = :ownerUserId', { ownerUserId });
    }

    if (leadAuditorId) {
      qb.andWhere('audit.leadAuditorId = :leadAuditorId', { leadAuditorId });
    }

    if (createdFrom) {
      qb.andWhere('audit.createdAt >= :createdFrom', { createdFrom });
    }

    if (createdTo) {
      qb.andWhere('audit.createdAt <= :createdTo', { createdTo });
    }

    if (plannedStartFrom) {
      qb.andWhere('audit.plannedStartDate >= :plannedStartFrom', { plannedStartFrom });
    }

    if (plannedStartTo) {
      qb.andWhere('audit.plannedStartDate <= :plannedStartTo', { plannedStartTo });
    }

    if (search) {
      qb.andWhere(
        '(audit.name ILIKE :search OR audit.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply sorting (validate sortBy field)
    const validSortBy = AUDIT_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`audit.${validSortBy}`, validSortOrder);

    // Apply pagination
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Get audit statistics for a tenant (excludes deleted)
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byRiskLevel: Record<string, number>;
  }> {
    const audits = await this.findAllActiveForTenant(tenantId);

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};

    for (const audit of audits) {
      byStatus[audit.status] = (byStatus[audit.status] || 0) + 1;
      byType[audit.auditType] = (byType[audit.auditType] || 0) + 1;
      byRiskLevel[audit.riskLevel] = (byRiskLevel[audit.riskLevel] || 0) + 1;
    }

    return {
      total: audits.length,
      byStatus,
      byType,
      byRiskLevel,
    };
  }

  /**
   * Get distinct values for a field (for filter dropdowns)
   */
  async getDistinctValues(
    tenantId: string,
    field: string,
  ): Promise<string[]> {
    const allowedFields = ['department', 'status', 'auditType', 'riskLevel'];
    if (!allowedFields.includes(field)) {
      return [];
    }

    const result = await this.repository
      .createQueryBuilder('audit')
      .select(`DISTINCT audit.${field}`, 'value')
      .where('audit.tenantId = :tenantId', { tenantId })
      .andWhere('audit.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(`audit.${field} IS NOT NULL`)
      .getRawMany();

    return result.map((r) => r.value).filter(Boolean);
  }

  /**
   * Check if user can create audits (always true for now, can be extended with ACL)
   */
  async canCreate(): Promise<boolean> {
    return true;
  }
}
