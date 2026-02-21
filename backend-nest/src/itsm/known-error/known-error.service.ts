import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ItsmKnownError } from './known-error.entity';
import { CreateKnownErrorDto } from './dto/create-known-error.dto';
import { UpdateKnownErrorDto } from './dto/update-known-error.dto';
import { KnownErrorFilterDto } from './dto/known-error-filter.dto';
import { KnownErrorState } from '../enums';
import { AuditService } from '../../audit/audit.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';

/**
 * Known Error Service
 *
 * Handles CRUD operations for Known Errors with multi-tenant isolation,
 * audit trail, and event emission.
 */
@Injectable()
export class KnownErrorService {
  private readonly logger = new Logger(KnownErrorService.name);

  constructor(
    @InjectRepository(ItsmKnownError)
    private readonly knownErrorRepository: Repository<ItsmKnownError>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new Known Error
   */
  async createKnownError(
    tenantId: string,
    userId: string,
    dto: CreateKnownErrorDto,
  ): Promise<ItsmKnownError> {
    const knownError = this.knownErrorRepository.create({
      tenantId,
      title: dto.title,
      symptoms: dto.symptoms || null,
      rootCause: dto.rootCause || null,
      workaround: dto.workaround || null,
      permanentFixStatus: dto.permanentFixStatus,
      articleRef: dto.articleRef || null,
      state: dto.state || KnownErrorState.DRAFT,
      problemId: dto.problemId || null,
      createdBy: userId,
      isDeleted: false,
    });

    // Set publishedAt if state is PUBLISHED
    if (knownError.state === KnownErrorState.PUBLISHED) {
      knownError.publishedAt = new Date();
    }

    const saved = await this.knownErrorRepository.save(knownError);

    this.logger.log(
      `Known Error created: ${saved.id} for tenant ${tenantId}`,
    );

    try {
      await this.auditService.recordCreate(
        tenantId,
        userId,
        'ItsmKnownError',
        saved.id,
        saved,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for known error create: ${err}`);
    }

    this.eventEmitter.emit('known-error.created', {
      tenantId,
      userId,
      knownErrorId: saved.id,
      knownError: saved,
    });

    return saved;
  }

  /**
   * Update an existing Known Error
   */
  async updateKnownError(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateKnownErrorDto,
  ): Promise<ItsmKnownError | null> {
    const existing = await this.knownErrorRepository.findOne({
      where: { id, tenantId, isDeleted: false },
    });

    if (!existing) {
      return null;
    }

    const oldState = existing.state;

    // Merge updates
    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.symptoms !== undefined) existing.symptoms = dto.symptoms;
    if (dto.rootCause !== undefined) existing.rootCause = dto.rootCause;
    if (dto.workaround !== undefined) existing.workaround = dto.workaround;
    if (dto.permanentFixStatus !== undefined)
      existing.permanentFixStatus = dto.permanentFixStatus;
    if (dto.articleRef !== undefined) existing.articleRef = dto.articleRef;
    if (dto.state !== undefined) existing.state = dto.state;
    if (dto.problemId !== undefined) existing.problemId = dto.problemId;

    // Set publishedAt on transition to PUBLISHED
    if (
      dto.state === KnownErrorState.PUBLISHED &&
      oldState !== KnownErrorState.PUBLISHED
    ) {
      existing.publishedAt = new Date();
    }

    existing.updatedBy = userId;

    const saved = await this.knownErrorRepository.save(existing);

    try {
      await this.auditService.recordUpdate(
        tenantId,
        userId,
        'ItsmKnownError',
        saved.id,
        dto,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for known error update: ${err}`);
    }

    this.eventEmitter.emit('known-error.updated', {
      tenantId,
      userId,
      knownErrorId: saved.id,
      knownError: saved,
    });

    return saved;
  }

  /**
   * Soft delete a Known Error
   */
  async softDeleteKnownError(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.knownErrorRepository.findOne({
      where: { id, tenantId, isDeleted: false },
    });

    if (!existing) {
      return false;
    }

    existing.isDeleted = true;
    existing.updatedBy = userId;
    await this.knownErrorRepository.save(existing);

    try {
      await this.auditService.recordDelete(
        tenantId,
        userId,
        'ItsmKnownError',
        id,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for known error delete: ${err}`);
    }

    this.eventEmitter.emit('known-error.deleted', {
      tenantId,
      userId,
      knownErrorId: id,
    });

    return true;
  }

  /**
   * Find a single Known Error by ID (tenant-scoped)
   */
  async findOne(tenantId: string, id: string): Promise<ItsmKnownError | null> {
    return this.knownErrorRepository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find Known Errors with filters and pagination (LIST-CONTRACT)
   */
  async findWithFilters(
    tenantId: string,
    filterDto: KnownErrorFilterDto,
  ): Promise<PaginatedResponse<ItsmKnownError>> {
    const qb = this.knownErrorRepository.createQueryBuilder('ke');

    qb.where('ke.tenantId = :tenantId', { tenantId });
    qb.andWhere('ke.isDeleted = false');

    if (filterDto.state) {
      qb.andWhere('ke.state = :state', { state: filterDto.state });
    }

    if (filterDto.permanentFixStatus) {
      qb.andWhere('ke.permanentFixStatus = :fixStatus', {
        fixStatus: filterDto.permanentFixStatus,
      });
    }

    if (filterDto.problemId) {
      qb.andWhere('ke.problemId = :problemId', {
        problemId: filterDto.problemId,
      });
    }

    if (filterDto.search) {
      qb.andWhere(
        '(ke.title ILIKE :search OR ke.symptoms ILIKE :search OR ke.rootCause ILIKE :search)',
        { search: `%${filterDto.search}%` },
      );
    }

    // Sorting
    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'title',
      'state',
      'permanentFixStatus',
      'publishedAt',
    ];
    let sortField = 'createdAt';
    let sortOrder: 'ASC' | 'DESC' = 'DESC';

    if (filterDto.sort) {
      const [field, order] = filterDto.sort.split(':');
      if (allowedSortFields.includes(field)) {
        sortField = field;
      }
      if (order?.toUpperCase() === 'ASC' || order?.toUpperCase() === 'DESC') {
        sortOrder = order.toUpperCase() as 'ASC' | 'DESC';
      }
    } else if (filterDto.sortBy) {
      if (allowedSortFields.includes(filterDto.sortBy)) {
        sortField = filterDto.sortBy;
      }
      if (filterDto.sortOrder) {
        sortOrder = filterDto.sortOrder.toUpperCase() as 'ASC' | 'DESC';
      }
    }

    qb.orderBy(`ke.${sortField}`, sortOrder);

    const page = filterDto.getEffectivePage();
    const pageSize = filterDto.getEffectiveLimit();
    qb.skip(filterDto.getEffectiveOffset());
    qb.take(pageSize);

    const [items, total] = await Promise.all([qb.getMany(), qb.getCount()]);

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Get Known Errors for a specific problem
   */
  async findByProblemId(
    tenantId: string,
    problemId: string,
  ): Promise<ItsmKnownError[]> {
    return this.knownErrorRepository.find({
      where: { tenantId, problemId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }
}
