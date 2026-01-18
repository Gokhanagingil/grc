import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrcCapaTask, GrcCapa, GrcStatusHistory } from '../entities';
import { CAPATaskStatus } from '../enums';
import {
  CreateCapaTaskDto,
  UpdateCapaTaskDto,
  UpdateCapaTaskStatusDto,
  CompleteCapaTaskDto,
  CapaTaskFilterDto,
} from '../dto/capa-task.dto';
import { AuditService } from '../../audit/audit.service';
import { ClosureLoopService } from './closure-loop.service';

@Injectable()
export class GrcCapaTaskService {
  // Whitelist of allowed sort fields to prevent SQL injection
  private readonly allowedSortFields: Set<string> = new Set([
    'sequenceOrder',
    'createdAt',
    'updatedAt',
    'dueDate',
    'status',
    'title',
    'completedAt',
  ]);

  private readonly validTransitions: Map<CAPATaskStatus, CAPATaskStatus[]> =
    new Map([
      [
        CAPATaskStatus.PENDING,
        [CAPATaskStatus.IN_PROGRESS, CAPATaskStatus.CANCELLED],
      ],
      [
        CAPATaskStatus.IN_PROGRESS,
        [
          CAPATaskStatus.COMPLETED,
          CAPATaskStatus.PENDING,
          CAPATaskStatus.CANCELLED,
        ],
      ],
      [CAPATaskStatus.COMPLETED, [CAPATaskStatus.IN_PROGRESS]],
      [CAPATaskStatus.CANCELLED, [CAPATaskStatus.PENDING]],
    ]);

  constructor(
    @InjectRepository(GrcCapaTask)
    private readonly capaTaskRepository: Repository<GrcCapaTask>,
    @InjectRepository(GrcCapa)
    private readonly capaRepository: Repository<GrcCapa>,
    @InjectRepository(GrcStatusHistory)
    private readonly statusHistoryRepository: Repository<GrcStatusHistory>,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => ClosureLoopService))
    private readonly closureLoopService: ClosureLoopService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateCapaTaskDto,
    userId: string,
  ): Promise<GrcCapaTask> {
    const capa = await this.capaRepository.findOne({
      where: { id: dto.capaId, tenantId, isDeleted: false },
    });

    if (!capa) {
      throw new NotFoundException(`CAPA with ID ${dto.capaId} not found`);
    }

    const capaTask = this.capaTaskRepository.create({
      ...dto,
      tenantId,
      status: CAPATaskStatus.PENDING,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.capaTaskRepository.save(capaTask);

    await this.createStatusHistory(
      tenantId,
      saved.id,
      null,
      CAPATaskStatus.PENDING,
      userId,
      'CAPA task created',
      { source: 'SYSTEM' },
    );

    await this.auditService.recordCreate(
      'GrcCapaTask',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  async findAll(
    tenantId: string,
    filter: CapaTaskFilterDto,
  ): Promise<{ items: GrcCapaTask[]; total: number }> {
    const {
      capaId,
      status,
      assigneeUserId,
      dueDateFrom,
      dueDateTo,
      page = 1,
      pageSize = 20,
      sortBy = 'sequenceOrder',
      sortOrder = 'ASC',
    } = filter;

    const queryBuilder = this.capaTaskRepository
      .createQueryBuilder('capaTask')
      .leftJoinAndSelect('capaTask.capa', 'capa')
      .leftJoinAndSelect('capaTask.assignee', 'assignee')
      .leftJoinAndSelect('capaTask.completedBy', 'completedBy')
      .where('capaTask.tenantId = :tenantId', { tenantId })
      .andWhere('capaTask.isDeleted = :isDeleted', { isDeleted: false });

    if (capaId) {
      queryBuilder.andWhere('capaTask.capaId = :capaId', { capaId });
    }
    if (status) {
      queryBuilder.andWhere('capaTask.status = :status', { status });
    }
    if (assigneeUserId) {
      queryBuilder.andWhere('capaTask.assigneeUserId = :assigneeUserId', {
        assigneeUserId,
      });
    }
    if (dueDateFrom) {
      queryBuilder.andWhere('capaTask.dueDate >= :dueDateFrom', {
        dueDateFrom,
      });
    }
    if (dueDateTo) {
      queryBuilder.andWhere('capaTask.dueDate <= :dueDateTo', { dueDateTo });
    }

    // Validate sortBy to prevent SQL injection
    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'sequenceOrder';

    const [items, total] = await queryBuilder
      .orderBy(`capaTask.${safeSortBy}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<GrcCapaTask> {
    const capaTask = await this.capaTaskRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['capa', 'assignee', 'completedBy'],
    });

    if (!capaTask) {
      throw new NotFoundException(`CAPA task with ID ${id} not found`);
    }

    return capaTask;
  }

  async findByCapaId(tenantId: string, capaId: string): Promise<GrcCapaTask[]> {
    return this.capaTaskRepository.find({
      where: { capaId, tenantId, isDeleted: false },
      relations: ['assignee', 'completedBy'],
      order: { sequenceOrder: 'ASC' },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCapaTaskDto,
    userId: string,
  ): Promise<GrcCapaTask> {
    const capaTask = await this.findOne(tenantId, id);
    const oldValue = { ...capaTask };

    Object.assign(capaTask, dto, { updatedBy: userId });

    const saved = await this.capaTaskRepository.save(capaTask);

    await this.auditService.recordUpdate(
      'GrcCapaTask',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdateCapaTaskStatusDto,
    userId: string,
  ): Promise<GrcCapaTask> {
    const capaTask = await this.findOne(tenantId, id);
    const previousStatus = capaTask.status;

    this.validateStatusTransition(previousStatus, dto.status);

    capaTask.status = dto.status;
    capaTask.updatedBy = userId;

    if (dto.status === CAPATaskStatus.COMPLETED) {
      capaTask.completedAt = new Date();
      capaTask.completedByUserId = userId;
    }

    if (
      dto.status === CAPATaskStatus.IN_PROGRESS &&
      previousStatus === CAPATaskStatus.COMPLETED
    ) {
      capaTask.completedAt = null;
      capaTask.completedByUserId = null;
    }

    const saved = await this.capaTaskRepository.save(capaTask);

    await this.createStatusHistory(
      tenantId,
      id,
      previousStatus,
      dto.status,
      userId,
      dto.reason ?? 'Manual status change',
      { source: 'MANUAL' },
    );

    await this.auditService.recordUpdate(
      'GrcCapaTask',
      saved.id,
      { status: previousStatus },
      { status: dto.status },
      userId,
      tenantId,
    );

    if (
      dto.status === CAPATaskStatus.COMPLETED ||
      dto.status === CAPATaskStatus.CANCELLED
    ) {
      await this.closureLoopService.checkAndCascadeCapaClose(
        tenantId,
        capaTask.capaId,
        userId,
      );
    }

    return saved;
  }

  async complete(
    tenantId: string,
    id: string,
    dto: CompleteCapaTaskDto,
    userId: string,
  ): Promise<GrcCapaTask> {
    const capaTask = await this.findOne(tenantId, id);
    const previousStatus = capaTask.status;

    if (capaTask.status === CAPATaskStatus.COMPLETED) {
      throw new BadRequestException('CAPA task is already completed');
    }

    if (capaTask.status === CAPATaskStatus.CANCELLED) {
      throw new BadRequestException('Cannot complete a cancelled CAPA task');
    }

    capaTask.status = CAPATaskStatus.COMPLETED;
    capaTask.completedAt = new Date();
    capaTask.completedByUserId = userId;
    capaTask.updatedBy = userId;

    if (dto.completionNotes) {
      capaTask.notes = dto.completionNotes;
    }

    const saved = await this.capaTaskRepository.save(capaTask);

    await this.createStatusHistory(
      tenantId,
      id,
      previousStatus,
      CAPATaskStatus.COMPLETED,
      userId,
      dto.completionNotes || 'Task completed',
      { source: 'MANUAL' },
    );

    await this.auditService.recordUpdate(
      'GrcCapaTask',
      saved.id,
      { status: previousStatus },
      { status: CAPATaskStatus.COMPLETED },
      userId,
      tenantId,
    );

    await this.closureLoopService.checkAndCascadeCapaClose(
      tenantId,
      capaTask.capaId,
      userId,
    );

    return saved;
  }

  async softDelete(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const capaTask = await this.findOne(tenantId, id);

    capaTask.isDeleted = true;
    capaTask.updatedBy = userId;

    await this.capaTaskRepository.save(capaTask);

    await this.auditService.recordDelete(
      'GrcCapaTask',
      capaTask,
      userId,
      tenantId,
    );
  }

  async getTaskCompletionStats(
    tenantId: string,
    capaId: string,
  ): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    cancelled: number;
    completionPercentage: number;
  }> {
    const tasks = await this.findByCapaId(tenantId, capaId);

    const stats = {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === CAPATaskStatus.COMPLETED)
        .length,
      inProgress: tasks.filter((t) => t.status === CAPATaskStatus.IN_PROGRESS)
        .length,
      pending: tasks.filter((t) => t.status === CAPATaskStatus.PENDING).length,
      cancelled: tasks.filter((t) => t.status === CAPATaskStatus.CANCELLED)
        .length,
      completionPercentage: 0,
    };

    const activeTasks = stats.total - stats.cancelled;
    if (activeTasks > 0) {
      stats.completionPercentage = Math.round(
        (stats.completed / activeTasks) * 100,
      );
    }

    return stats;
  }

  private validateStatusTransition(
    currentStatus: CAPATaskStatus,
    newStatus: CAPATaskStatus,
  ): void {
    const allowedTransitions = this.validTransitions.get(currentStatus) || [];

    if (!allowedTransitions.includes(newStatus)) {
      const allowedList =
        allowedTransitions.length > 0
          ? `[${allowedTransitions.join(', ')}]`
          : '[]';
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
          `Allowed next statuses from ${currentStatus}: ${allowedList}`,
      );
    }
  }

  private async createStatusHistory(
    tenantId: string,
    entityId: string,
    previousStatus: string | null,
    newStatus: string,
    userId: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const history = this.statusHistoryRepository.create({
      tenantId,
      entityType: 'CAPA_TASK',
      entityId,
      previousStatus,
      newStatus,
      changedByUserId: userId,
      changeReason: reason,
      metadata,
    });

    await this.statusHistoryRepository.save(history);
  }
}
