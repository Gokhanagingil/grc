import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { GrcCapa, GrcIssue, GrcStatusHistory } from '../entities';
import { CreateCapaDto, UpdateCapaDto, CapaFilterDto } from '../dto/capa.dto';
import { CapaStatus } from '../enums';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class GrcCapaService {
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'title',
    'type',
    'status',
    'priority',
    'dueDate',
    'completedDate',
    'verifiedAt',
    'closedAt',
  ]);

  constructor(
    @InjectRepository(GrcCapa)
    private readonly capaRepository: Repository<GrcCapa>,
    @InjectRepository(GrcIssue)
    private readonly issueRepository: Repository<GrcIssue>,
    @InjectRepository(GrcStatusHistory)
    private readonly statusHistoryRepository: Repository<GrcStatusHistory>,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateCapaDto,
    userId: string,
  ): Promise<GrcCapa> {
    const issue = await this.issueRepository.findOne({
      where: { id: dto.issueId, tenantId, isDeleted: false },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${dto.issueId} not found`);
    }

    const capa = this.capaRepository.create({
      ...dto,
      tenantId,
      createdBy: userId,
      status: dto.status || CapaStatus.PLANNED,
    });

    const saved = await this.capaRepository.save(capa);

    await this.recordStatusHistory(
      tenantId,
      saved.id,
      null,
      saved.status,
      userId,
      'CAPA created',
      { source: 'MANUAL' },
    );

    await this.auditService.recordCreate('GrcCapa', saved, userId, tenantId);

    return this.findOne(tenantId, saved.id);
  }

  async findAll(
    tenantId: string,
    filter: CapaFilterDto,
  ): Promise<{ items: GrcCapa[]; total: number }> {
    const {
      type,
      status,
      priority,
      issueId,
      ownerUserId,
      q,
      search,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filter;

    const queryBuilder = this.capaRepository
      .createQueryBuilder('capa')
      .leftJoinAndSelect('capa.owner', 'owner')
      .leftJoinAndSelect('capa.verifiedBy', 'verifiedBy')
      .leftJoinAndSelect('capa.closedBy', 'closedBy')
      .leftJoinAndSelect('capa.issue', 'issue')
      .where('capa.tenantId = :tenantId', { tenantId })
      .andWhere('capa.isDeleted = :isDeleted', { isDeleted: false });

    if (type) {
      queryBuilder.andWhere('capa.type = :type', { type });
    }
    if (status) {
      queryBuilder.andWhere('capa.status = :status', { status });
    }
    if (priority) {
      queryBuilder.andWhere('capa.priority = :priority', { priority });
    }
    if (issueId) {
      queryBuilder.andWhere('capa.issueId = :issueId', { issueId });
    }
    if (ownerUserId) {
      queryBuilder.andWhere('capa.ownerUserId = :ownerUserId', { ownerUserId });
    }

    const searchTerm = q || search;
    if (searchTerm) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(capa.title) LIKE LOWER(:searchTerm)', {
            searchTerm: `%${searchTerm}%`,
          })
            .orWhere('LOWER(capa.description) LIKE LOWER(:searchTerm)', {
              searchTerm: `%${searchTerm}%`,
            })
            .orWhere('LOWER(capa.rootCauseAnalysis) LIKE LOWER(:searchTerm)', {
              searchTerm: `%${searchTerm}%`,
            });
        }),
      );
    }

    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';

    const [items, total] = await queryBuilder
      .orderBy(`capa.${safeSortBy}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<GrcCapa> {
    const capa = await this.capaRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['owner', 'verifiedBy', 'closedBy', 'issue', 'tasks'],
    });

    if (!capa) {
      throw new NotFoundException(`CAPA with ID ${id} not found`);
    }

    return capa;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCapaDto,
    userId: string,
  ): Promise<GrcCapa> {
    const capa = await this.findOne(tenantId, id);
    const oldValue = { ...capa };

    Object.assign(capa, dto, { updatedBy: userId });

    const saved = await this.capaRepository.save(capa);

    await this.auditService.recordUpdate(
      'GrcCapa',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return this.findOne(tenantId, saved.id);
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const capa = await this.findOne(tenantId, id);

    capa.isDeleted = true;
    capa.updatedBy = userId;

    await this.capaRepository.save(capa);

    await this.auditService.recordDelete('GrcCapa', capa, userId, tenantId);
  }

  async findByIssue(tenantId: string, issueId: string): Promise<GrcCapa[]> {
    await this.issueRepository.findOne({
      where: { id: issueId, tenantId, isDeleted: false },
    });

    return this.capaRepository.find({
      where: { issueId, tenantId, isDeleted: false },
      relations: ['owner', 'verifiedBy', 'closedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  private async recordStatusHistory(
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
      entityType: 'CAPA',
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
