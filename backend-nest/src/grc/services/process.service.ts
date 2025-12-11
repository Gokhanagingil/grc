import { Injectable, Optional, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { Process } from '../entities/process.entity';
import {
  ProcessFilterDto,
  PROCESS_SORTABLE_FIELDS,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';
import { AuditService } from '../../audit/audit.service';

/**
 * Process Service
 *
 * Multi-tenant service for managing business processes.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 * Implements soft delete - deleted records are marked with isDeleted=true.
 */
@Injectable()
export class ProcessService extends MultiTenantServiceBase<Process> {
  constructor(
    @InjectRepository(Process)
    repository: Repository<Process>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  /**
   * Create a new process
   */
  async createProcess(
    tenantId: string,
    userId: string,
    data: Omit<
      Partial<Process>,
      'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
  ): Promise<Process> {
    const process = await this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
    });

    // Record audit log
    await this.auditService?.recordCreate('Process', process, userId, tenantId);

    // Emit domain event
    this.eventEmitter.emit('process.created', {
      processId: process.id,
      tenantId,
      userId,
      name: process.name,
    });

    return process;
  }

  /**
   * Update a process
   */
  async updateProcess(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<Process, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<Process | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    const process = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });

    if (process) {
      await this.auditService?.recordUpdate(
        'Process',
        id,
        beforeState as unknown as Record<string, unknown>,
        process as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );

      this.eventEmitter.emit('process.updated', {
        processId: process.id,
        tenantId,
        userId,
        changes: data,
      });
    }

    return process;
  }

  /**
   * Soft delete a process
   */
  async softDeleteProcess(
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
    } as Partial<Omit<Process, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete('Process', existing, userId, tenantId);

    this.eventEmitter.emit('process.deleted', {
      processId: id,
      tenantId,
      userId,
      name: existing.name,
    });

    return true;
  }

  /**
   * Find one active (non-deleted) process for a tenant
   */
  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<Process | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find one active process with controls
   */
  async findWithControls(
    tenantId: string,
    id: string,
  ): Promise<Process | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['controls', 'owner'],
    });
  }

  /**
   * Find all active (non-deleted) processes for a tenant
   */
  async findAllActiveForTenant(
    tenantId: string,
    options?: {
      where?: FindOptionsWhere<Process>;
      order?: Record<string, 'ASC' | 'DESC'>;
      relations?: string[];
    },
  ): Promise<Process[]> {
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
   * Find processes with pagination, sorting, and filtering
   */
  async findWithFilters(
    tenantId: string,
    filterDto: ProcessFilterDto,
  ): Promise<PaginatedResponse<Process>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      name,
      code,
      category,
      ownerUserId,
      isActive,
      search,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('process');

    qb.where('process.tenantId = :tenantId', { tenantId });
    qb.andWhere('process.isDeleted = :isDeleted', { isDeleted: false });

    if (name) {
      qb.andWhere('process.name ILIKE :name', { name: `%${name}%` });
    }

    if (code) {
      qb.andWhere('process.code ILIKE :code', { code: `%${code}%` });
    }

    if (category) {
      qb.andWhere('process.category = :category', { category });
    }

    if (ownerUserId) {
      qb.andWhere('process.ownerUserId = :ownerUserId', { ownerUserId });
    }

    if (isActive !== undefined) {
      qb.andWhere('process.isActive = :isActive', { isActive });
    }

    if (search) {
      qb.andWhere(
        '(process.name ILIKE :search OR process.description ILIKE :search OR process.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = PROCESS_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`process.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Get process statistics for a tenant
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    byCategory: Record<string, number>;
  }> {
    const processes = await this.findAllActiveForTenant(tenantId);

    const byCategory: Record<string, number> = {};
    let active = 0;
    let inactive = 0;

    for (const process of processes) {
      if (process.isActive) {
        active++;
      } else {
        inactive++;
      }

      if (process.category) {
        byCategory[process.category] = (byCategory[process.category] || 0) + 1;
      }
    }

    return {
      total: processes.length,
      active,
      inactive,
      byCategory,
    };
  }
}
