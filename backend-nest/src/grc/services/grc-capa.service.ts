import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrcCapa, GrcIssue, GrcStatusHistory } from '../entities';
import {
  CreateCapaDto,
  UpdateCapaDto,
  CapaFilterDto,
  CreateCapaFromSoaItemDto,
} from '../dto/capa.dto';
import { CapaStatus, SourceType } from '../enums';
import { AuditService } from '../../audit/audit.service';
import { parseFilterJson } from '../../common/list-query/list-query.parser';
import { validateFilterAgainstAllowlist } from '../../common/list-query/list-query.validator';
import {
  applyFilterTree,
  applyQuickSearch,
} from '../../common/list-query/list-query.apply';
import {
  CAPA_ALLOWLIST,
  CAPA_SEARCHABLE_COLUMNS,
} from '../../common/list-query/list-query.allowlist';

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
      filter: filterJson,
    } = filter;

    const queryBuilder = this.capaRepository
      .createQueryBuilder('capa')
      .leftJoinAndSelect('capa.owner', 'owner')
      .leftJoinAndSelect('capa.verifiedBy', 'verifiedBy')
      .leftJoinAndSelect('capa.closedBy', 'closedBy')
      .leftJoinAndSelect('capa.issue', 'issue')
      .where('capa.tenantId = :tenantId', { tenantId })
      .andWhere('capa.isDeleted = :isDeleted', { isDeleted: false });

    // Apply advanced filter tree if provided
    if (filterJson) {
      try {
        const parsed = parseFilterJson(filterJson);
        if (parsed.tree) {
          // validateFilterAgainstAllowlist throws BadRequestException if validation fails
          validateFilterAgainstAllowlist(parsed.tree, CAPA_ALLOWLIST);
          applyFilterTree(queryBuilder, parsed.tree, CAPA_ALLOWLIST, 'capa');
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException({
          message: 'Invalid filter JSON',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Legacy individual filters (backward compatibility)
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

    // Apply quick search using the standardized utility
    const searchTerm = q || search;
    if (searchTerm) {
      applyQuickSearch(
        queryBuilder,
        searchTerm,
        CAPA_SEARCHABLE_COLUMNS,
        'capa',
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

  async createFromSoaItem(
    tenantId: string,
    issueId: string,
    soaItemId: string,
    clauseCode: string,
    dto: CreateCapaFromSoaItemDto,
    userId: string,
  ): Promise<GrcCapa> {
    const issue = await this.issueRepository.findOne({
      where: { id: issueId, tenantId, isDeleted: false },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    const capa = this.capaRepository.create({
      ...dto,
      issueId,
      tenantId,
      createdBy: userId,
      status: CapaStatus.PLANNED,
      sourceType: SourceType.SOA_ITEM,
      sourceId: soaItemId,
      sourceRef: clauseCode,
      sourceMeta: {
        createdFromSoaItem: true,
      },
    });

    const saved = await this.capaRepository.save(capa);

    await this.recordStatusHistory(
      tenantId,
      saved.id,
      null,
      saved.status,
      userId,
      'CAPA created from SOA item',
      { source: 'SOA_ITEM', soaItemId },
    );

    await this.auditService.recordCreate('GrcCapa', saved, userId, tenantId);

    return this.findOne(tenantId, saved.id);
  }

  async findBySourceId(
    tenantId: string,
    sourceType: SourceType,
    sourceId: string,
    page = 1,
    pageSize = 5,
  ): Promise<{ items: GrcCapa[]; total: number }> {
    const [items, total] = await this.capaRepository.findAndCount({
      where: {
        tenantId,
        sourceType,
        sourceId,
        isDeleted: false,
      },
      relations: ['owner', 'issue'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }
}
