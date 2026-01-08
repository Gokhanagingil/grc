import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrcStatusHistory } from '../entities';
import { StatusHistoryFilterDto } from '../dto/status-history.dto';

@Injectable()
export class GrcStatusHistoryService {
  // Whitelist of allowed sort fields to prevent SQL injection
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'entityType',
    'entityId',
    'previousStatus',
    'newStatus',
  ]);

  constructor(
    @InjectRepository(GrcStatusHistory)
    private readonly statusHistoryRepository: Repository<GrcStatusHistory>,
  ) {}

  async findAll(
    tenantId: string,
    filter: StatusHistoryFilterDto,
  ): Promise<{ items: GrcStatusHistory[]; total: number }> {
    const {
      entityType,
      entityId,
      changedByUserId,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filter;

    const queryBuilder = this.statusHistoryRepository
      .createQueryBuilder('statusHistory')
      .leftJoinAndSelect('statusHistory.changedBy', 'changedBy')
      .where('statusHistory.tenantId = :tenantId', { tenantId });

    if (entityType) {
      queryBuilder.andWhere('statusHistory.entityType = :entityType', {
        entityType,
      });
    }
    if (entityId) {
      queryBuilder.andWhere('statusHistory.entityId = :entityId', { entityId });
    }
    if (changedByUserId) {
      queryBuilder.andWhere(
        'statusHistory.changedByUserId = :changedByUserId',
        { changedByUserId },
      );
    }

    // Validate sortBy to prevent SQL injection
    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';

    const [items, total] = await queryBuilder
      .orderBy(`statusHistory.${safeSortBy}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<GrcStatusHistory> {
    const statusHistory = await this.statusHistoryRepository.findOne({
      where: { id, tenantId },
      relations: ['changedBy'],
    });

    if (!statusHistory) {
      throw new NotFoundException(
        `Status history entry with ID ${id} not found`,
      );
    }

    return statusHistory;
  }

  async findByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<GrcStatusHistory[]> {
    return this.statusHistoryRepository.find({
      where: { tenantId, entityType, entityId },
      relations: ['changedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    tenantId: string,
    entityType: string,
    entityId: string,
    previousStatus: string | null,
    newStatus: string,
    changedByUserId: string,
    changeReason?: string,
    metadata?: Record<string, unknown>,
  ): Promise<GrcStatusHistory> {
    const history = this.statusHistoryRepository.create({
      tenantId,
      entityType,
      entityId,
      previousStatus,
      newStatus,
      changedByUserId,
      changeReason,
      metadata,
    });

    return this.statusHistoryRepository.save(history);
  }

  async getStatusTimeline(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<{
    timeline: GrcStatusHistory[];
    currentStatus: string | null;
    totalTransitions: number;
    firstTransitionAt: Date | null;
    lastTransitionAt: Date | null;
  }> {
    const timeline = await this.findByEntity(tenantId, entityType, entityId);

    return {
      timeline,
      currentStatus: timeline.length > 0 ? timeline[0].newStatus : null,
      totalTransitions: timeline.length,
      firstTransitionAt:
        timeline.length > 0 ? timeline[timeline.length - 1].createdAt : null,
      lastTransitionAt: timeline.length > 0 ? timeline[0].createdAt : null,
    };
  }
}
