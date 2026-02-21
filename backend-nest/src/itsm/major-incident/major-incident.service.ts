import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ItsmMajorIncident } from './major-incident.entity';
import { ItsmMajorIncidentUpdate } from './major-incident-update.entity';
import { ItsmMajorIncidentLink } from './major-incident-link.entity';
import {
  MajorIncidentStatus,
  MajorIncidentUpdateType,
  MajorIncidentUpdateVisibility,
  MajorIncidentLinkType,
  isValidMajorIncidentTransition,
} from './major-incident.enums';
import { CreateMajorIncidentDto } from './dto/create-major-incident.dto';
import { UpdateMajorIncidentDto } from './dto/update-major-incident.dto';
import { CreateMajorIncidentUpdateDto } from './dto/create-major-incident-update.dto';
import { CreateMajorIncidentLinkDto } from './dto/major-incident-link.dto';
import { MajorIncidentFilterDto, MI_SORTABLE_FIELDS } from './dto/major-incident-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class MajorIncidentService {
  private readonly logger = new Logger(MajorIncidentService.name);

  constructor(
    @InjectRepository(ItsmMajorIncident)
    private readonly miRepo: Repository<ItsmMajorIncident>,
    @InjectRepository(ItsmMajorIncidentUpdate)
    private readonly updateRepo: Repository<ItsmMajorIncidentUpdate>,
    @InjectRepository(ItsmMajorIncidentLink)
    private readonly linkRepo: Repository<ItsmMajorIncidentLink>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  // ============================================================================
  // Number Generation
  // ============================================================================

  private async generateNumber(tenantId: string): Promise<string> {
    const result = await this.miRepo
      .createQueryBuilder('mi')
      .select('MAX(mi.number)', 'maxNumber')
      .where('mi.tenantId = :tenantId', { tenantId })
      .getRawOne<{ maxNumber: string | null }>();

    let nextNumber = 1;
    if (result?.maxNumber) {
      const current = parseInt(result.maxNumber.replace('MI', ''), 10);
      if (!isNaN(current)) {
        nextNumber = current + 1;
      }
    }

    return `MI${nextNumber.toString().padStart(6, '0')}`;
  }

  // ============================================================================
  // CRUD
  // ============================================================================

  async declare(
    tenantId: string,
    userId: string,
    dto: CreateMajorIncidentDto,
  ): Promise<ItsmMajorIncident> {
    const number = await this.generateNumber(tenantId);

    const mi = this.miRepo.create({
      tenantId,
      number,
      title: dto.title,
      description: dto.description || null,
      status: MajorIncidentStatus.DECLARED,
      severity: dto.severity || undefined,
      commanderId: dto.commanderId || null,
      communicationsLeadId: dto.communicationsLeadId || null,
      techLeadId: dto.techLeadId || null,
      bridgeUrl: dto.bridgeUrl || null,
      bridgeChannel: dto.bridgeChannel || null,
      bridgeStartedAt: dto.bridgeStartedAt ? new Date(dto.bridgeStartedAt) : null,
      customerImpactSummary: dto.customerImpactSummary || null,
      businessImpactSummary: dto.businessImpactSummary || null,
      primaryServiceId: dto.primaryServiceId || null,
      primaryOfferingId: dto.primaryOfferingId || null,
      sourceIncidentId: dto.sourceIncidentId || null,
      declaredAt: new Date(),
      metadata: dto.metadata || null,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.miRepo.save(mi);

    this.logger.log(`Major Incident declared: ${saved.number} (${saved.id}) for tenant ${tenantId}`);

    // Create initial timeline entry
    await this.createTimelineUpdate(tenantId, userId, saved.id, {
      message: `Major Incident ${saved.number} declared: ${saved.title}`,
      updateType: MajorIncidentUpdateType.STATUS_CHANGE,
      visibility: MajorIncidentUpdateVisibility.INTERNAL,
    });

    try {
      await this.auditService.recordCreate(
        'ItsmMajorIncident',
        saved,
        userId,
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for MI create: ${err}`);
    }

    this.eventEmitter.emit('major-incident.declared', {
      tenantId,
      userId,
      majorIncidentId: saved.id,
      number: saved.number,
      severity: saved.severity,
    });

    return saved;
  }

  async findOne(tenantId: string, id: string): Promise<ItsmMajorIncident | null> {
    return this.miRepo.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findWithFilters(
    tenantId: string,
    filterDto: MajorIncidentFilterDto,
  ): Promise<PaginatedResponse<ItsmMajorIncident>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      status,
      severity,
      commanderId,
      search,
      createdFrom,
      createdTo,
    } = filterDto;

    const qb = this.miRepo.createQueryBuilder('mi');
    qb.where('mi.tenantId = :tenantId', { tenantId });
    qb.andWhere('mi.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      qb.andWhere('mi.status = :status', { status });
    }
    if (severity) {
      qb.andWhere('mi.severity = :severity', { severity });
    }
    if (commanderId) {
      qb.andWhere('mi.commanderId = :commanderId', { commanderId });
    }
    if (search) {
      qb.andWhere(
        '(mi.number ILIKE :search OR mi.title ILIKE :search OR mi.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (createdFrom) {
      qb.andWhere('mi.createdAt >= :createdFrom', { createdFrom });
    }
    if (createdTo) {
      qb.andWhere('mi.createdAt <= :createdTo', { createdTo });
    }

    const total = await qb.getCount();

    const validSortBy = MI_SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    const validSortOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`mi.${validSortBy}`, validSortOrder as 'ASC' | 'DESC');

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateMajorIncidentDto,
  ): Promise<ItsmMajorIncident> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Major Incident with ID ${id} not found`);
    }

    // Status transition validation
    if (dto.status && dto.status !== existing.status) {
      if (!isValidMajorIncidentTransition(existing.status, dto.status)) {
        throw new BadRequestException(
          `Invalid status transition from ${existing.status} to ${dto.status}`,
        );
      }

      // Auto-set timestamps on state transitions
      if (dto.status === MajorIncidentStatus.RESOLVED && !existing.resolvedAt) {
        existing.resolvedAt = new Date();
      }
      if (dto.status === MajorIncidentStatus.CLOSED && !existing.closedAt) {
        existing.closedAt = new Date();
      }

      // Validation: RESOLVED requires resolutionSummary
      if (dto.status === MajorIncidentStatus.RESOLVED) {
        const resolSummary = dto.resolutionSummary || existing.resolutionSummary;
        if (!resolSummary) {
          throw new BadRequestException(
            'Resolution summary is required when resolving a major incident',
          );
        }
      }

      // Create status change timeline entry
      await this.createTimelineUpdate(tenantId, userId, id, {
        message: `Status changed from ${existing.status} to ${dto.status}`,
        updateType: MajorIncidentUpdateType.STATUS_CHANGE,
        visibility: MajorIncidentUpdateVisibility.INTERNAL,
        metadata: { previousStatus: existing.status, newStatus: dto.status },
      });
    }

    // Merge fields
    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.description !== undefined) existing.description = dto.description;
    if (dto.status !== undefined) existing.status = dto.status;
    if (dto.severity !== undefined) existing.severity = dto.severity;
    if (dto.commanderId !== undefined) existing.commanderId = dto.commanderId;
    if (dto.communicationsLeadId !== undefined) existing.communicationsLeadId = dto.communicationsLeadId;
    if (dto.techLeadId !== undefined) existing.techLeadId = dto.techLeadId;
    if (dto.bridgeUrl !== undefined) existing.bridgeUrl = dto.bridgeUrl;
    if (dto.bridgeChannel !== undefined) existing.bridgeChannel = dto.bridgeChannel;
    if (dto.bridgeStartedAt !== undefined) existing.bridgeStartedAt = dto.bridgeStartedAt ? new Date(dto.bridgeStartedAt) : null;
    if (dto.bridgeEndedAt !== undefined) existing.bridgeEndedAt = dto.bridgeEndedAt ? new Date(dto.bridgeEndedAt) : null;
    if (dto.customerImpactSummary !== undefined) existing.customerImpactSummary = dto.customerImpactSummary;
    if (dto.businessImpactSummary !== undefined) existing.businessImpactSummary = dto.businessImpactSummary;
    if (dto.primaryServiceId !== undefined) existing.primaryServiceId = dto.primaryServiceId;
    if (dto.primaryOfferingId !== undefined) existing.primaryOfferingId = dto.primaryOfferingId;
    if (dto.resolutionSummary !== undefined) existing.resolutionSummary = dto.resolutionSummary;
    if (dto.resolutionCode !== undefined) existing.resolutionCode = dto.resolutionCode;
    if (dto.metadata !== undefined) existing.metadata = dto.metadata;

    existing.updatedBy = userId;

    const saved = await this.miRepo.save(existing);

    try {
      await this.auditService.recordUpdate(
        'ItsmMajorIncident',
        saved.id,
        {} as Record<string, unknown>,
        dto as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for MI update: ${err}`);
    }

    this.eventEmitter.emit('major-incident.updated', {
      tenantId,
      userId,
      majorIncidentId: saved.id,
      changes: dto,
    });

    return saved;
  }

  async softDelete(tenantId: string, userId: string, id: string): Promise<boolean> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) return false;

    existing.isDeleted = true;
    existing.updatedBy = userId;
    await this.miRepo.save(existing);

    try {
      await this.auditService.recordDelete('ItsmMajorIncident', existing, userId, tenantId);
    } catch (err) {
      this.logger.warn(`Failed to record audit for MI delete: ${err}`);
    }

    return true;
  }

  // ============================================================================
  // Timeline Updates
  // ============================================================================

  async createTimelineUpdate(
    tenantId: string,
    userId: string,
    majorIncidentId: string,
    dto: CreateMajorIncidentUpdateDto & { metadata?: Record<string, unknown> },
  ): Promise<ItsmMajorIncidentUpdate> {
    const update = this.updateRepo.create({
      tenantId,
      majorIncidentId,
      message: dto.message,
      updateType: dto.updateType || MajorIncidentUpdateType.TECHNICAL_UPDATE,
      visibility: dto.visibility || MajorIncidentUpdateVisibility.INTERNAL,
      previousStatus: (dto.metadata as Record<string, unknown>)?.previousStatus as string || null,
      newStatus: (dto.metadata as Record<string, unknown>)?.newStatus as string || null,
      metadata: dto.metadata || null,
      createdBy: userId,
      isDeleted: false,
    });

    return this.updateRepo.save(update);
  }

  async getTimeline(
    tenantId: string,
    majorIncidentId: string,
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedResponse<ItsmMajorIncidentUpdate>> {
    const qb = this.updateRepo.createQueryBuilder('upd');
    qb.where('upd.tenantId = :tenantId', { tenantId });
    qb.andWhere('upd.majorIncidentId = :majorIncidentId', { majorIncidentId });
    qb.andWhere('upd.isDeleted = false');

    const total = await qb.getCount();

    qb.orderBy('upd.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  // ============================================================================
  // Link Management
  // ============================================================================

  async linkRecord(
    tenantId: string,
    userId: string,
    majorIncidentId: string,
    dto: CreateMajorIncidentLinkDto,
  ): Promise<ItsmMajorIncidentLink> {
    const mi = await this.findOne(tenantId, majorIncidentId);
    if (!mi) {
      throw new NotFoundException(`Major Incident with ID ${majorIncidentId} not found`);
    }

    // Check for duplicate
    const existing = await this.linkRepo.findOne({
      where: {
        tenantId,
        majorIncidentId,
        linkType: dto.linkType,
        linkedRecordId: dto.linkedRecordId,
      },
    });
    if (existing) {
      throw new ConflictException('This record is already linked to the major incident');
    }

    const link = this.linkRepo.create({
      tenantId,
      majorIncidentId,
      linkType: dto.linkType,
      linkedRecordId: dto.linkedRecordId,
      linkedRecordLabel: dto.linkedRecordLabel || null,
      notes: dto.notes || null,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.linkRepo.save(link);

    // Add timeline entry for link
    await this.createTimelineUpdate(tenantId, userId, majorIncidentId, {
      message: `Linked ${dto.linkType} record: ${dto.linkedRecordLabel || dto.linkedRecordId}`,
      updateType: MajorIncidentUpdateType.ACTION_TAKEN,
      visibility: MajorIncidentUpdateVisibility.INTERNAL,
    });

    return saved;
  }

  async unlinkRecord(
    tenantId: string,
    majorIncidentId: string,
    linkId: string,
  ): Promise<boolean> {
    const link = await this.linkRepo.findOne({
      where: { id: linkId, tenantId, majorIncidentId },
    });
    if (!link) return false;

    await this.linkRepo.remove(link);
    return true;
  }

  async getLinks(
    tenantId: string,
    majorIncidentId: string,
    linkType?: MajorIncidentLinkType,
  ): Promise<ItsmMajorIncidentLink[]> {
    const where: Record<string, unknown> = {
      tenantId,
      majorIncidentId,
      isDeleted: false,
    };
    if (linkType) {
      where.linkType = linkType;
    }

    return this.linkRepo.find({
      where: where as Record<string, string | boolean>,
      order: { createdAt: 'DESC' },
    });
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getStatistics(tenantId: string): Promise<Record<string, number>> {
    const qb = this.miRepo.createQueryBuilder('mi');
    qb.select('mi.status', 'status');
    qb.addSelect('COUNT(*)::int', 'count');
    qb.where('mi.tenantId = :tenantId', { tenantId });
    qb.andWhere('mi.isDeleted = false');
    qb.groupBy('mi.status');

    const results = await qb.getRawMany<{ status: string; count: number }>();
    const stats: Record<string, number> = { total: 0 };

    for (const r of results) {
      stats[r.status] = r.count;
      stats.total += r.count;
    }

    return stats;
  }
}
