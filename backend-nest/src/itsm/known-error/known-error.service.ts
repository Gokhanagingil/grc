import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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

    this.logger.log(`Known Error created: ${saved.id} for tenant ${tenantId}`);

    try {
      await this.auditService.recordCreate(
        'ItsmKnownError',
        saved,
        userId,
        tenantId,
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

    // Validate state transitions
    if (dto.state !== undefined && dto.state !== oldState) {
      this.validateStateTransition(oldState, dto.state);
    }

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
    if (dto.knowledgeCandidate !== undefined)
      existing.knowledgeCandidate = dto.knowledgeCandidate;
    if (dto.knowledgeCandidatePayload !== undefined)
      existing.knowledgeCandidatePayload = dto.knowledgeCandidatePayload;

    // Set lifecycle timestamps on state transitions
    if (
      dto.state === KnownErrorState.VALIDATED &&
      oldState !== KnownErrorState.VALIDATED
    ) {
      existing.validatedAt = new Date();
      existing.validatedBy = userId;
    }
    if (
      dto.state === KnownErrorState.PUBLISHED &&
      oldState !== KnownErrorState.PUBLISHED
    ) {
      existing.publishedAt = new Date();
    }
    if (
      dto.state === KnownErrorState.RETIRED &&
      oldState !== KnownErrorState.RETIRED
    ) {
      existing.retiredAt = new Date();
    }

    existing.updatedBy = userId;

    const saved = await this.knownErrorRepository.save(existing);

    try {
      await this.auditService.recordUpdate(
        'ItsmKnownError',
        saved.id,
        {} as Record<string, unknown>,
        dto as unknown as Record<string, unknown>,
        userId,
        tenantId,
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
        'ItsmKnownError',
        existing,
        userId,
        tenantId,
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

  // ============================================================================
  // State Transition Validation (Phase 2)
  // ============================================================================

  /**
   * Valid state transitions for Known Errors:
   * DRAFT → VALIDATED → PUBLISHED → RETIRED
   * DRAFT → PUBLISHED (skip validation if needed)
   * RETIRED → DRAFT (reopen/rework)
   */
  private static readonly VALID_TRANSITIONS: Record<
    KnownErrorState,
    KnownErrorState[]
  > = {
    [KnownErrorState.DRAFT]: [
      KnownErrorState.VALIDATED,
      KnownErrorState.PUBLISHED,
    ],
    [KnownErrorState.VALIDATED]: [
      KnownErrorState.PUBLISHED,
      KnownErrorState.DRAFT,
    ],
    [KnownErrorState.PUBLISHED]: [KnownErrorState.RETIRED],
    [KnownErrorState.RETIRED]: [KnownErrorState.DRAFT],
  };

  private validateStateTransition(
    currentState: KnownErrorState,
    targetState: KnownErrorState,
  ): void {
    const allowed = KnownErrorService.VALID_TRANSITIONS[currentState] || [];
    if (!allowed.includes(targetState)) {
      throw new BadRequestException(
        `Cannot transition Known Error from ${currentState} to ${targetState}. ` +
          `Allowed transitions from ${currentState}: ${allowed.join(', ') || 'none'}`,
      );
    }
  }

  // ============================================================================
  // Lifecycle Actions (Phase 2)
  // ============================================================================

  /**
   * Validate a Known Error (DRAFT → VALIDATED)
   */
  async validateKnownError(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<ItsmKnownError | null> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) return null;

    this.validateStateTransition(existing.state, KnownErrorState.VALIDATED);

    existing.state = KnownErrorState.VALIDATED;
    existing.validatedAt = new Date();
    existing.validatedBy = userId;
    existing.updatedBy = userId;

    const saved = await this.knownErrorRepository.save(existing);

    this.eventEmitter.emit('known-error.validated', {
      tenantId,
      userId,
      knownErrorId: saved.id,
    });

    return saved;
  }

  /**
   * Publish a Known Error (DRAFT/VALIDATED → PUBLISHED)
   */
  async publishKnownError(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<ItsmKnownError | null> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) return null;

    this.validateStateTransition(existing.state, KnownErrorState.PUBLISHED);

    existing.state = KnownErrorState.PUBLISHED;
    existing.publishedAt = new Date();
    existing.updatedBy = userId;

    const saved = await this.knownErrorRepository.save(existing);

    this.eventEmitter.emit('known-error.published', {
      tenantId,
      userId,
      knownErrorId: saved.id,
    });

    return saved;
  }

  /**
   * Retire a Known Error (PUBLISHED → RETIRED)
   */
  async retireKnownError(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<ItsmKnownError | null> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) return null;

    this.validateStateTransition(existing.state, KnownErrorState.RETIRED);

    existing.state = KnownErrorState.RETIRED;
    existing.retiredAt = new Date();
    existing.updatedBy = userId;

    const saved = await this.knownErrorRepository.save(existing);

    this.eventEmitter.emit('known-error.retired', {
      tenantId,
      userId,
      knownErrorId: saved.id,
    });

    return saved;
  }

  /**
   * Reopen a retired Known Error (RETIRED → DRAFT)
   */
  async reopenKnownError(
    tenantId: string,
    userId: string,
    id: string,
    reason: string,
  ): Promise<ItsmKnownError | null> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) return null;

    if (existing.state !== KnownErrorState.RETIRED) {
      throw new BadRequestException(
        `Cannot reopen a Known Error in state ${existing.state}. Only RETIRED Known Errors can be reopened.`,
      );
    }

    existing.state = KnownErrorState.DRAFT;
    existing.updatedBy = userId;
    // Store reason in metadata
    existing.metadata = {
      ...((existing.metadata as Record<string, unknown>) || {}),
      lastReopenReason: reason,
      lastReopenedAt: new Date().toISOString(),
    };

    const saved = await this.knownErrorRepository.save(existing);

    try {
      await this.auditService.recordUpdate(
        'ItsmKnownError',
        saved.id,
        { state: KnownErrorState.RETIRED } as unknown as Record<
          string,
          unknown
        >,
        {
          state: KnownErrorState.DRAFT,
          reopenReason: reason,
        } as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for known error reopen: ${err}`);
    }

    this.eventEmitter.emit('known-error.reopened', {
      tenantId,
      userId,
      knownErrorId: saved.id,
      reason,
    });

    return saved;
  }
}
