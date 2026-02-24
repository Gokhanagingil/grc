import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ItsmPir } from './pir.entity';
import { PirStatus, isValidPirTransition } from './pir.enums';
import { CreatePirDto } from './dto/create-pir.dto';
import { UpdatePirDto } from './dto/update-pir.dto';
import { PirFilterDto, PIR_SORTABLE_FIELDS } from './dto/pir-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class PirService {
  private readonly logger = new Logger(PirService.name);

  constructor(
    @InjectRepository(ItsmPir)
    private readonly pirRepo: Repository<ItsmPir>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  // ============================================================================
  // CRUD
  // ============================================================================

  async create(
    tenantId: string,
    userId: string,
    dto: CreatePirDto,
  ): Promise<ItsmPir> {
    const pir = this.pirRepo.create({
      tenantId,
      majorIncidentId: dto.majorIncidentId,
      title: dto.title,
      status: PirStatus.DRAFT,
      summary: dto.summary || null,
      whatHappened: dto.whatHappened || null,
      timelineHighlights: dto.timelineHighlights || null,
      rootCauses: dto.rootCauses || null,
      whatWorkedWell: dto.whatWorkedWell || null,
      whatDidNotWork: dto.whatDidNotWork || null,
      customerImpact: dto.customerImpact || null,
      detectionEffectiveness: dto.detectionEffectiveness || null,
      responseEffectiveness: dto.responseEffectiveness || null,
      preventiveActions: dto.preventiveActions || null,
      correctiveActions: dto.correctiveActions || null,
      metadata: dto.metadata || null,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.pirRepo.save(pir);

    this.logger.log(
      `PIR created: ${saved.id} for MI ${saved.majorIncidentId} tenant ${tenantId}`,
    );

    try {
      await this.auditService.recordCreate('ItsmPir', saved, userId, tenantId);
    } catch (err) {
      this.logger.warn(`Failed to record audit for PIR create: ${err}`);
    }

    this.eventEmitter.emit('pir.created', {
      tenantId,
      userId,
      pirId: saved.id,
      majorIncidentId: saved.majorIncidentId,
    });

    return saved;
  }

  async findOne(tenantId: string, id: string): Promise<ItsmPir | null> {
    return this.pirRepo.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findByMajorIncident(
    tenantId: string,
    majorIncidentId: string,
  ): Promise<ItsmPir | null> {
    return this.pirRepo.findOne({
      where: { majorIncidentId, tenantId, isDeleted: false },
    });
  }

  async findWithFilters(
    tenantId: string,
    filterDto: PirFilterDto,
  ): Promise<PaginatedResponse<ItsmPir>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      majorIncidentId,
      status,
      search,
    } = filterDto;

    const qb = this.pirRepo.createQueryBuilder('pir');
    qb.where('pir.tenantId = :tenantId', { tenantId });
    qb.andWhere('pir.isDeleted = :isDeleted', { isDeleted: false });

    if (majorIncidentId) {
      qb.andWhere('pir.majorIncidentId = :majorIncidentId', {
        majorIncidentId,
      });
    }
    if (status) {
      qb.andWhere('pir.status = :status', { status });
    }
    if (search) {
      qb.andWhere('(pir.title ILIKE :search OR pir.summary ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const total = await qb.getCount();

    const validSortBy = PIR_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`pir.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdatePirDto,
  ): Promise<ItsmPir> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`PIR with ID ${id} not found`);
    }

    // Status transition validation
    if (dto.status && dto.status !== existing.status) {
      if (!isValidPirTransition(existing.status, dto.status)) {
        throw new BadRequestException(
          `Invalid PIR status transition from ${existing.status} to ${dto.status}`,
        );
      }

      // Auto-set timestamps on state transitions
      if (dto.status === PirStatus.IN_REVIEW && !existing.submittedAt) {
        existing.submittedAt = new Date();
      }
      if (dto.status === PirStatus.CLOSED && !existing.closedAt) {
        existing.closedAt = new Date();
      }
    }

    // Merge fields
    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.status !== undefined) existing.status = dto.status;
    if (dto.summary !== undefined) existing.summary = dto.summary || null;
    if (dto.whatHappened !== undefined)
      existing.whatHappened = dto.whatHappened || null;
    if (dto.timelineHighlights !== undefined)
      existing.timelineHighlights = dto.timelineHighlights || null;
    if (dto.rootCauses !== undefined)
      existing.rootCauses = dto.rootCauses || null;
    if (dto.whatWorkedWell !== undefined)
      existing.whatWorkedWell = dto.whatWorkedWell || null;
    if (dto.whatDidNotWork !== undefined)
      existing.whatDidNotWork = dto.whatDidNotWork || null;
    if (dto.customerImpact !== undefined)
      existing.customerImpact = dto.customerImpact || null;
    if (dto.detectionEffectiveness !== undefined)
      existing.detectionEffectiveness = dto.detectionEffectiveness || null;
    if (dto.responseEffectiveness !== undefined)
      existing.responseEffectiveness = dto.responseEffectiveness || null;
    if (dto.preventiveActions !== undefined)
      existing.preventiveActions = dto.preventiveActions || null;
    if (dto.correctiveActions !== undefined)
      existing.correctiveActions = dto.correctiveActions || null;
    if (dto.metadata !== undefined) existing.metadata = dto.metadata || null;

    existing.updatedBy = userId;

    const saved = await this.pirRepo.save(existing);

    try {
      await this.auditService.recordUpdate(
        'ItsmPir',
        saved.id,
        {} as Record<string, unknown>,
        dto as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for PIR update: ${err}`);
    }

    if (dto.status) {
      this.eventEmitter.emit('pir.status-changed', {
        tenantId,
        userId,
        pirId: saved.id,
        newStatus: dto.status,
      });
    }

    return saved;
  }

  async approve(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<ItsmPir> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`PIR with ID ${id} not found`);
    }

    if (existing.status !== PirStatus.IN_REVIEW) {
      throw new BadRequestException(
        `PIR can only be approved from IN_REVIEW state, current state: ${existing.status}`,
      );
    }

    existing.status = PirStatus.APPROVED;
    existing.approvedBy = userId;
    existing.approvedAt = new Date();
    existing.updatedBy = userId;

    const saved = await this.pirRepo.save(existing);

    this.logger.log(`PIR approved: ${saved.id} by ${userId}`);

    try {
      await this.auditService.recordUpdate(
        'ItsmPir',
        saved.id,
        { status: PirStatus.IN_REVIEW } as unknown as Record<string, unknown>,
        { status: PirStatus.APPROVED, approvedBy: userId } as unknown as Record<
          string,
          unknown
        >,
        userId,
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for PIR approve: ${err}`);
    }

    this.eventEmitter.emit('pir.approved', {
      tenantId,
      userId,
      pirId: saved.id,
      majorIncidentId: saved.majorIncidentId,
    });

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
    await this.pirRepo.save(existing);

    try {
      await this.auditService.recordDelete(
        'ItsmPir',
        existing,
        userId,
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for PIR delete: ${err}`);
    }

    return true;
  }
}
