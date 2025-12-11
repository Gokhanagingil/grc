import { Injectable, Optional, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { ProcessViolation } from '../entities/process-violation.entity';
import { GrcRisk } from '../entities/grc-risk.entity';
import { ViolationStatus } from '../enums';
import {
  ProcessViolationFilterDto,
  PROCESS_VIOLATION_SORTABLE_FIELDS,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';
import { AuditService } from '../../audit/audit.service';

/**
 * ProcessViolation Service
 *
 * Multi-tenant service for managing process violations.
 * Violations are automatically created when non-compliant control results are recorded.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 */
@Injectable()
export class ProcessViolationService extends MultiTenantServiceBase<ProcessViolation> {
  constructor(
    @InjectRepository(ProcessViolation)
    repository: Repository<ProcessViolation>,
    @InjectRepository(GrcRisk)
    private readonly riskRepository: Repository<GrcRisk>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  /**
   * Update a process violation
   */
  async updateViolation(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<
      Pick<
        ProcessViolation,
        | 'severity'
        | 'status'
        | 'title'
        | 'description'
        | 'ownerUserId'
        | 'dueDate'
        | 'resolutionNotes'
      >
    >,
  ): Promise<ProcessViolation | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    const violation = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });

    if (violation) {
      await this.auditService?.recordUpdate(
        'ProcessViolation',
        id,
        beforeState as unknown as Record<string, unknown>,
        violation as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );

      this.eventEmitter.emit('processViolation.updated', {
        violationId: violation.id,
        controlId: violation.controlId,
        tenantId,
        userId,
        changes: data,
      });

      // Emit specific event if status changed to resolved
      if (data.status === ViolationStatus.RESOLVED && beforeState.status !== ViolationStatus.RESOLVED) {
        this.eventEmitter.emit('processViolation.resolved', {
          violationId: violation.id,
          controlId: violation.controlId,
          tenantId,
          userId,
        });
      }
    }

    return violation;
  }

  /**
   * Link a violation to a GrcRisk
   */
  async linkRisk(
    tenantId: string,
    userId: string,
    violationId: string,
    riskId: string,
  ): Promise<ProcessViolation | null> {
    const violation = await this.findOneActiveForTenant(tenantId, violationId);
    if (!violation) {
      return null;
    }

    // Verify risk exists
    const risk = await this.riskRepository.findOne({
      where: { id: riskId, tenantId, isDeleted: false },
    });

    if (!risk) {
      throw new NotFoundException(`GrcRisk with ID ${riskId} not found`);
    }

    return this.updateViolation(tenantId, userId, violationId, {
      linkedRiskId: riskId,
    } as Partial<ProcessViolation>);
  }

  /**
   * Unlink a violation from a GrcRisk
   */
  async unlinkRisk(
    tenantId: string,
    userId: string,
    violationId: string,
  ): Promise<ProcessViolation | null> {
    const violation = await this.findOneActiveForTenant(tenantId, violationId);
    if (!violation) {
      return null;
    }

    // Use raw update to set linkedRiskId to null
    await this.repository.update(
      { id: violationId, tenantId },
      { linkedRiskId: null as unknown as string, updatedBy: userId },
    );

    return this.findOneActiveForTenant(tenantId, violationId);
  }

  /**
   * Find one active (non-deleted) violation for a tenant
   */
  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<ProcessViolation | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find one violation with relations
   */
  async findWithRelations(
    tenantId: string,
    id: string,
  ): Promise<ProcessViolation | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['control', 'control.process', 'controlResult', 'linkedRisk', 'owner'],
    });
  }

  /**
   * Find all violations for a control
   */
  async findByControl(
    tenantId: string,
    controlId: string,
  ): Promise<ProcessViolation[]> {
    return this.repository.find({
      where: { tenantId, controlId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find violations with pagination, sorting, and filtering
   */
  async findWithFilters(
    tenantId: string,
    filterDto: ProcessViolationFilterDto,
  ): Promise<PaginatedResponse<ProcessViolation>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      processId,
      controlId,
      status,
      severity,
      linkedRiskId,
      ownerUserId,
      createdFrom,
      createdTo,
      dueDateFrom,
      dueDateTo,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('violation');
    qb.leftJoinAndSelect('violation.control', 'control');
    qb.leftJoinAndSelect('control.process', 'process');

    qb.where('violation.tenantId = :tenantId', { tenantId });
    qb.andWhere('violation.isDeleted = :isDeleted', { isDeleted: false });

    if (processId) {
      qb.andWhere('control.processId = :processId', { processId });
    }

    if (controlId) {
      qb.andWhere('violation.controlId = :controlId', { controlId });
    }

    if (status) {
      qb.andWhere('violation.status = :status', { status });
    }

    if (severity) {
      qb.andWhere('violation.severity = :severity', { severity });
    }

    if (linkedRiskId) {
      qb.andWhere('violation.linkedRiskId = :linkedRiskId', { linkedRiskId });
    }

    if (ownerUserId) {
      qb.andWhere('violation.ownerUserId = :ownerUserId', { ownerUserId });
    }

    if (createdFrom) {
      qb.andWhere('violation.createdAt >= :createdFrom', { createdFrom });
    }

    if (createdTo) {
      qb.andWhere('violation.createdAt <= :createdTo', { createdTo });
    }

    if (dueDateFrom) {
      qb.andWhere('violation.dueDate >= :dueDateFrom', { dueDateFrom });
    }

    if (dueDateTo) {
      qb.andWhere('violation.dueDate <= :dueDateTo', { dueDateTo });
    }

    const total = await qb.getCount();

    const validSortBy = PROCESS_VIOLATION_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`violation.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Get violation statistics for a tenant
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const violations = await this.repository.find({
      where: { tenantId, isDeleted: false },
    });

    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const violation of violations) {
      byStatus[violation.status] = (byStatus[violation.status] || 0) + 1;
      bySeverity[violation.severity] = (bySeverity[violation.severity] || 0) + 1;
    }

    return {
      total: violations.length,
      byStatus,
      bySeverity,
    };
  }
}
