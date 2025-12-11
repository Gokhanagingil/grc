import { Injectable, Optional, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { ProcessControl } from '../entities/process-control.entity';
import { ProcessControlRisk } from '../entities/process-control-risk.entity';
import { GrcRisk } from '../entities/grc-risk.entity';
import {
  ProcessControlFilterDto,
  PROCESS_CONTROL_SORTABLE_FIELDS,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';
import { AuditService } from '../../audit/audit.service';

/**
 * ProcessControl Service
 *
 * Multi-tenant service for managing process controls.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 * Implements soft delete - deleted records are marked with isDeleted=true.
 */
@Injectable()
export class ProcessControlService extends MultiTenantServiceBase<ProcessControl> {
  constructor(
    @InjectRepository(ProcessControl)
    repository: Repository<ProcessControl>,
    @InjectRepository(ProcessControlRisk)
    private readonly controlRiskRepository: Repository<ProcessControlRisk>,
    @InjectRepository(GrcRisk)
    private readonly riskRepository: Repository<GrcRisk>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  /**
   * Create a new process control
   */
  async createProcessControl(
    tenantId: string,
    userId: string,
    data: Omit<
      Partial<ProcessControl>,
      'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
  ): Promise<ProcessControl> {
    const control = await this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'ProcessControl',
      control,
      userId,
      tenantId,
    );

    this.eventEmitter.emit('processControl.created', {
      controlId: control.id,
      processId: control.processId,
      tenantId,
      userId,
      name: control.name,
    });

    return control;
  }

  /**
   * Update a process control
   */
  async updateProcessControl(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<ProcessControl, 'id' | 'tenantId' | 'isDeleted' | 'processId'>>,
  ): Promise<ProcessControl | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    const control = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });

    if (control) {
      await this.auditService?.recordUpdate(
        'ProcessControl',
        id,
        beforeState as unknown as Record<string, unknown>,
        control as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );

      this.eventEmitter.emit('processControl.updated', {
        controlId: control.id,
        processId: control.processId,
        tenantId,
        userId,
        changes: data,
      });
    }

    return control;
  }

  /**
   * Soft delete a process control
   */
  async softDeleteProcessControl(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return false;
    }

    await this.updateForTenant(tenantId, id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<ProcessControl, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'ProcessControl',
      existing,
      userId,
      tenantId,
    );

    this.eventEmitter.emit('processControl.deleted', {
      controlId: id,
      processId: existing.processId,
      tenantId,
      userId,
      name: existing.name,
    });

    return true;
  }

  /**
   * Find one active (non-deleted) process control for a tenant
   */
  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<ProcessControl | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find one active process control with relations
   */
  async findWithRelations(
    tenantId: string,
    id: string,
  ): Promise<ProcessControl | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['process', 'owner', 'controlRisks', 'controlRisks.risk'],
    });
  }

  /**
   * Find all active controls for a process
   */
  async findByProcess(
    tenantId: string,
    processId: string,
  ): Promise<ProcessControl[]> {
    return this.repository.find({
      where: { tenantId, processId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find process controls with pagination, sorting, and filtering
   */
  async findWithFilters(
    tenantId: string,
    filterDto: ProcessControlFilterDto,
  ): Promise<PaginatedResponse<ProcessControl>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      processId,
      name,
      isAutomated,
      frequency,
      expectedResultType,
      isActive,
      search,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('control');

    qb.where('control.tenantId = :tenantId', { tenantId });
    qb.andWhere('control.isDeleted = :isDeleted', { isDeleted: false });

    if (processId) {
      qb.andWhere('control.processId = :processId', { processId });
    }

    if (name) {
      qb.andWhere('control.name ILIKE :name', { name: `%${name}%` });
    }

    if (isAutomated !== undefined) {
      qb.andWhere('control.isAutomated = :isAutomated', { isAutomated });
    }

    if (frequency) {
      qb.andWhere('control.frequency = :frequency', { frequency });
    }

    if (expectedResultType) {
      qb.andWhere('control.expectedResultType = :expectedResultType', {
        expectedResultType,
      });
    }

    if (isActive !== undefined) {
      qb.andWhere('control.isActive = :isActive', { isActive });
    }

    if (search) {
      qb.andWhere(
        '(control.name ILIKE :search OR control.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = PROCESS_CONTROL_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`control.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Link risks to a process control (replaces existing links)
   */
  async linkRisks(
    tenantId: string,
    controlId: string,
    riskIds: string[],
  ): Promise<ProcessControlRisk[]> {
    // Verify control exists
    const control = await this.findOneActiveForTenant(tenantId, controlId);
    if (!control) {
      throw new NotFoundException(`ProcessControl with ID ${controlId} not found`);
    }

    // Verify all risks exist
    if (riskIds.length > 0) {
      const risks = await this.riskRepository.find({
        where: {
          id: In(riskIds),
          tenantId,
          isDeleted: false,
        },
      });

      if (risks.length !== riskIds.length) {
        throw new NotFoundException('One or more risks not found');
      }
    }

    // Remove existing links
    await this.controlRiskRepository.delete({
      tenantId,
      controlId,
    });

    // Create new links
    if (riskIds.length === 0) {
      return [];
    }

    const controlRisks = riskIds.map((riskId) =>
      this.controlRiskRepository.create({
        tenantId,
        controlId,
        riskId,
      }),
    );

    return this.controlRiskRepository.save(controlRisks);
  }

  /**
   * Get linked risks for a process control
   */
  async getLinkedRisks(
    tenantId: string,
    controlId: string,
  ): Promise<GrcRisk[]> {
    const controlRisks = await this.controlRiskRepository.find({
      where: { tenantId, controlId },
      relations: ['risk'],
    });

    return controlRisks
      .map((cr) => cr.risk)
      .filter((risk) => risk && !risk.isDeleted);
  }
}
