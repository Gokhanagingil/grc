import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrcControlTest, GrcControl, GrcStatusHistory } from '../entities';
import { ControlTestStatus } from '../enums';
import {
  CreateControlTestDto,
  UpdateControlTestDto,
  UpdateControlTestStatusDto,
  ControlTestFilterDto,
} from '../dto/control-test.dto';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class GrcControlTestService {
  // Whitelist of allowed sort fields to prevent SQL injection
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'scheduledDate',
    'startedAt',
    'completedAt',
    'status',
    'name',
    'testType',
  ]);

  private readonly validTransitions: Map<
    ControlTestStatus,
    ControlTestStatus[]
  > = new Map([
    [
      ControlTestStatus.PLANNED,
      [ControlTestStatus.IN_PROGRESS, ControlTestStatus.CANCELLED],
    ],
    [
      ControlTestStatus.IN_PROGRESS,
      [ControlTestStatus.COMPLETED, ControlTestStatus.CANCELLED],
    ],
    [ControlTestStatus.COMPLETED, []],
    [ControlTestStatus.CANCELLED, []],
  ]);

  constructor(
    @InjectRepository(GrcControlTest)
    private readonly controlTestRepository: Repository<GrcControlTest>,
    @InjectRepository(GrcControl)
    private readonly controlRepository: Repository<GrcControl>,
    @InjectRepository(GrcStatusHistory)
    private readonly statusHistoryRepository: Repository<GrcStatusHistory>,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateControlTestDto,
    userId: string,
  ): Promise<GrcControlTest> {
    const control = await this.controlRepository.findOne({
      where: { id: dto.controlId, tenantId, isDeleted: false },
    });

    if (!control) {
      throw new NotFoundException(`Control with ID ${dto.controlId} not found`);
    }

    const controlTest = this.controlTestRepository.create({
      ...dto,
      tenantId,
      status: ControlTestStatus.PLANNED,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.controlTestRepository.save(controlTest);

    await this.createStatusHistory(
      tenantId,
      saved.id,
      null,
      ControlTestStatus.PLANNED,
      userId,
      'Control test created',
    );

    await this.auditService.recordCreate(
      'GrcControlTest',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  /**
   * List Contract v1 compliant findAll method
   *
   * Supports:
   * - q (text search on name, description)
   * - controlId filter
   * - status filter
   * - testType filter
   * - testerUserId filter
   * - scheduledDate range filters
   */
  async findAll(
    tenantId: string,
    filter: ControlTestFilterDto,
  ): Promise<{ items: GrcControlTest[]; total: number }> {
    const {
      controlId,
      status,
      testType,
      testerUserId,
      scheduledDateFrom,
      scheduledDateTo,
      q,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filter;

    const queryBuilder = this.controlTestRepository
      .createQueryBuilder('controlTest')
      .leftJoinAndSelect('controlTest.control', 'control')
      .leftJoinAndSelect('controlTest.tester', 'tester')
      .leftJoinAndSelect('controlTest.reviewer', 'reviewer')
      .where('controlTest.tenantId = :tenantId', { tenantId })
      .andWhere('controlTest.isDeleted = :isDeleted', { isDeleted: false });

    if (controlId) {
      queryBuilder.andWhere('controlTest.controlId = :controlId', {
        controlId,
      });
    }
    if (status) {
      queryBuilder.andWhere('controlTest.status = :status', { status });
    }
    if (testType) {
      queryBuilder.andWhere('controlTest.testType = :testType', { testType });
    }
    if (testerUserId) {
      queryBuilder.andWhere('controlTest.testerUserId = :testerUserId', {
        testerUserId,
      });
    }
    if (scheduledDateFrom) {
      queryBuilder.andWhere('controlTest.scheduledDate >= :scheduledDateFrom', {
        scheduledDateFrom,
      });
    }
    if (scheduledDateTo) {
      queryBuilder.andWhere('controlTest.scheduledDate <= :scheduledDateTo', {
        scheduledDateTo,
      });
    }

    // List Contract v1 - Text search on name and description
    if (q) {
      queryBuilder.andWhere(
        '(controlTest.name ILIKE :q OR controlTest.description ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    // Validate sortBy to prevent SQL injection
    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';

    const [items, total] = await queryBuilder
      .orderBy(`controlTest.${safeSortBy}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<GrcControlTest> {
    const controlTest = await this.controlTestRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['control', 'tester', 'reviewer'],
    });

    if (!controlTest) {
      throw new NotFoundException(`Control test with ID ${id} not found`);
    }

    return controlTest;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateControlTestDto,
    userId: string,
  ): Promise<GrcControlTest> {
    const controlTest = await this.findOne(tenantId, id);
    const oldValue = { ...controlTest };

    Object.assign(controlTest, dto, { updatedBy: userId });

    const saved = await this.controlTestRepository.save(controlTest);

    await this.auditService.recordUpdate(
      'GrcControlTest',
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
    dto: UpdateControlTestStatusDto,
    userId: string,
  ): Promise<GrcControlTest> {
    const controlTest = await this.findOne(tenantId, id);
    const previousStatus = controlTest.status;

    this.validateStatusTransition(previousStatus, dto.status);

    controlTest.status = dto.status;
    controlTest.updatedBy = userId;

    if (
      dto.status === ControlTestStatus.IN_PROGRESS &&
      !controlTest.startedAt
    ) {
      controlTest.startedAt = new Date();
    }

    if (dto.status === ControlTestStatus.COMPLETED) {
      controlTest.completedAt = new Date();
    }

    const saved = await this.controlTestRepository.save(controlTest);

    await this.createStatusHistory(
      tenantId,
      id,
      previousStatus,
      dto.status,
      userId,
      dto.reason,
    );

    await this.auditService.recordUpdate(
      'GrcControlTest',
      saved.id,
      { status: previousStatus },
      { status: dto.status },
      userId,
      tenantId,
    );

    return saved;
  }

  async softDelete(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const controlTest = await this.findOne(tenantId, id);

    controlTest.isDeleted = true;
    controlTest.updatedBy = userId;

    await this.controlTestRepository.save(controlTest);

    await this.auditService.recordDelete(
      'GrcControlTest',
      controlTest,
      userId,
      tenantId,
    );
  }

  private validateStatusTransition(
    currentStatus: ControlTestStatus,
    newStatus: ControlTestStatus,
  ): void {
    const allowedTransitions = this.validTransitions.get(currentStatus) || [];

    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
          `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`,
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
  ): Promise<void> {
    const history = this.statusHistoryRepository.create({
      tenantId,
      entityType: 'CONTROL_TEST',
      entityId,
      previousStatus,
      newStatus,
      changedByUserId: userId,
      changeReason: reason,
    });

    await this.statusHistoryRepository.save(history);
  }
}
