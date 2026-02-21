import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ItsmPirAction } from './pir-action.entity';
import { PirActionStatus } from './pir.enums';
import { CreatePirActionDto } from './dto/create-pir-action.dto';
import { UpdatePirActionDto } from './dto/update-pir-action.dto';
import {
  PirActionFilterDto,
  PIR_ACTION_SORTABLE_FIELDS,
} from './dto/pir-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class PirActionService {
  private readonly logger = new Logger(PirActionService.name);

  constructor(
    @InjectRepository(ItsmPirAction)
    private readonly actionRepo: Repository<ItsmPirAction>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  // ============================================================================
  // CRUD
  // ============================================================================

  async create(
    tenantId: string,
    userId: string,
    dto: CreatePirActionDto,
  ): Promise<ItsmPirAction> {
    const action = this.actionRepo.create({
      tenantId,
      pirId: dto.pirId,
      title: dto.title,
      description: dto.description || null,
      ownerId: dto.ownerId || null,
      dueDate: dto.dueDate || null,
      status: PirActionStatus.OPEN,
      priority: dto.priority || undefined,
      problemId: dto.problemId || null,
      changeId: dto.changeId || null,
      riskObservationId: dto.riskObservationId || null,
      metadata: dto.metadata || null,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.actionRepo.save(action);

    this.logger.log(
      `PIR Action created: ${saved.id} for PIR ${saved.pirId} tenant ${tenantId}`,
    );

    try {
      await this.auditService.recordCreate(
        'ItsmPirAction',
        saved,
        userId,
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for PIR Action create: ${err}`);
    }

    this.eventEmitter.emit('pir-action.created', {
      tenantId,
      userId,
      actionId: saved.id,
      pirId: saved.pirId,
    });

    return saved;
  }

  async findOne(tenantId: string, id: string): Promise<ItsmPirAction | null> {
    return this.actionRepo.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findWithFilters(
    tenantId: string,
    filterDto: PirActionFilterDto,
  ): Promise<PaginatedResponse<ItsmPirAction>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      pirId,
      status,
      ownerId,
      overdue,
    } = filterDto;

    const qb = this.actionRepo.createQueryBuilder('action');
    qb.where('action.tenantId = :tenantId', { tenantId });
    qb.andWhere('action.isDeleted = :isDeleted', { isDeleted: false });

    if (pirId) {
      qb.andWhere('action.pirId = :pirId', { pirId });
    }
    if (status) {
      qb.andWhere('action.status = :status', { status });
    }
    if (ownerId) {
      qb.andWhere('action.ownerId = :ownerId', { ownerId });
    }
    if (overdue === 'true') {
      const today = new Date().toISOString().split('T')[0];
      qb.andWhere('action.dueDate < :today', { today });
      qb.andWhere('action.status NOT IN (:...completedStatuses)', {
        completedStatuses: [
          PirActionStatus.COMPLETED,
          PirActionStatus.CANCELLED,
        ],
      });
    }

    const total = await qb.getCount();

    const validSortBy = PIR_ACTION_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`action.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdatePirActionDto,
  ): Promise<ItsmPirAction> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`PIR Action with ID ${id} not found`);
    }

    // Merge fields
    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.description !== undefined)
      existing.description = dto.description || null;
    if (dto.ownerId !== undefined) existing.ownerId = dto.ownerId || null;
    if (dto.dueDate !== undefined) existing.dueDate = dto.dueDate || null;
    if (dto.status !== undefined) {
      existing.status = dto.status;
      if (dto.status === PirActionStatus.COMPLETED && !existing.completedAt) {
        existing.completedAt = new Date();
      }
    }
    if (dto.priority !== undefined) existing.priority = dto.priority;
    if (dto.problemId !== undefined) existing.problemId = dto.problemId || null;
    if (dto.changeId !== undefined) existing.changeId = dto.changeId || null;
    if (dto.riskObservationId !== undefined)
      existing.riskObservationId = dto.riskObservationId || null;
    if (dto.metadata !== undefined) existing.metadata = dto.metadata || null;

    existing.updatedBy = userId;

    const saved = await this.actionRepo.save(existing);

    try {
      await this.auditService.recordUpdate(
        'ItsmPirAction',
        saved.id,
        {} as Record<string, unknown>,
        dto as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for PIR Action update: ${err}`);
    }

    return saved;
  }

  async softDelete(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) return false;

    existing.isDeleted = true;
    existing.updatedBy = userId;
    await this.actionRepo.save(existing);

    try {
      await this.auditService.recordDelete(
        'ItsmPirAction',
        existing,
        userId,
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for PIR Action delete: ${err}`);
    }

    return true;
  }

  /**
   * Find overdue actions across all PIRs for a tenant
   */
  async findOverdue(tenantId: string): Promise<ItsmPirAction[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.actionRepo.find({
      where: {
        tenantId,
        isDeleted: false,
        dueDate: LessThan(today),
        status: PirActionStatus.OPEN,
      },
      order: { dueDate: 'ASC' },
    });
  }
}
