import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { ItsmIncident } from './incident.entity';
import {
  IncidentStatus,
  IncidentPriority,
  IncidentImpact,
  IncidentUrgency,
  calculatePriority,
} from '../enums';
import {
  IncidentFilterDto,
  INCIDENT_SORTABLE_FIELDS,
} from './dto/incident-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';

/**
 * ITSM Incident Service
 *
 * Multi-tenant service for managing incidents.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 * Implements soft delete - deleted records are marked with isDeleted=true.
 * Integrates with AuditService for entity-level audit logging.
 */
@Injectable()
export class IncidentService extends MultiTenantServiceBase<ItsmIncident> {
  constructor(
    @InjectRepository(ItsmIncident)
    repository: Repository<ItsmIncident>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  /**
   * Generate the next incident number for a tenant
   * Format: INC000001, INC000002, etc.
   */
  private async generateIncidentNumber(tenantId: string): Promise<string> {
    const result = await this.repository
      .createQueryBuilder('incident')
      .select('MAX(incident.number)', 'maxNumber')
      .where('incident.tenantId = :tenantId', { tenantId })
      .getRawOne<{ maxNumber: string | null }>();

    let nextNumber = 1;
    if (result?.maxNumber) {
      const currentNumber = parseInt(result.maxNumber.replace('INC', ''), 10);
      nextNumber = currentNumber + 1;
    }

    return `INC${nextNumber.toString().padStart(6, '0')}`;
  }

  /**
   * Create a new incident
   * Auto-generates incident number and calculates priority
   */
  async createIncident(
    tenantId: string,
    userId: string,
    data: Omit<
      Partial<ItsmIncident>,
      'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'number' | 'priority'
    >,
  ): Promise<ItsmIncident> {
    const number = await this.generateIncidentNumber(tenantId);
    const impact = data.impact || IncidentImpact.MEDIUM;
    const urgency = data.urgency || IncidentUrgency.MEDIUM;
    const priority = calculatePriority(impact, urgency);

    const incident = await this.createForTenant(tenantId, {
      ...data,
      number,
      priority,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate('ItsmIncident', incident, userId, tenantId);

    this.eventEmitter.emit('incident.created', {
      incidentId: incident.id,
      tenantId,
      userId,
      number: incident.number,
    });

    return incident;
  }

  /**
   * Update an incident
   * Recalculates priority if impact or urgency changes
   */
  async updateIncident(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<ItsmIncident, 'id' | 'tenantId' | 'isDeleted' | 'number'>>,
  ): Promise<ItsmIncident | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    const updateData: Partial<ItsmIncident> = {
      ...data,
      updatedBy: userId,
    };

    if (data.impact !== undefined || data.urgency !== undefined) {
      const impact = data.impact || existing.impact;
      const urgency = data.urgency || existing.urgency;
      updateData.priority = calculatePriority(impact, urgency);
    }

    const incident = await this.updateForTenant(tenantId, id, updateData);

    if (incident) {
      await this.auditService?.recordUpdate(
        'ItsmIncident',
        id,
        beforeState as unknown as Record<string, unknown>,
        incident as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );

      this.eventEmitter.emit('incident.updated', {
        incidentId: incident.id,
        tenantId,
        userId,
        changes: data,
      });
    }

    return incident;
  }

  /**
   * Soft delete an incident
   */
  async softDeleteIncident(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return false;
    }

    await this.updateForTenant(tenantId, id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<ItsmIncident, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'ItsmIncident',
      existing,
      userId,
      tenantId,
    );

    this.eventEmitter.emit('incident.deleted', {
      incidentId: id,
      tenantId,
      userId,
      number: existing.number,
    });

    return true;
  }

  /**
   * Find one active (non-deleted) incident for a tenant
   */
  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<ItsmIncident | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find all active (non-deleted) incidents for a tenant
   */
  async findAllActiveForTenant(tenantId: string): Promise<ItsmIncident[]> {
    return this.repository.find({
      where: { tenantId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find incidents with pagination, sorting, and filtering
   */
  async findWithFilters(
    tenantId: string,
    filterDto: IncidentFilterDto,
  ): Promise<PaginatedResponse<ItsmIncident>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      status,
      priority,
      category,
      impact,
      urgency,
      source,
      assignmentGroup,
      assignedTo,
      createdFrom,
      createdTo,
      search,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('incident');

    qb.where('incident.tenantId = :tenantId', { tenantId });
    qb.andWhere('incident.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      qb.andWhere('incident.status = :status', { status });
    }

    if (priority) {
      qb.andWhere('incident.priority = :priority', { priority });
    }

    if (category) {
      qb.andWhere('incident.category = :category', { category });
    }

    if (impact) {
      qb.andWhere('incident.impact = :impact', { impact });
    }

    if (urgency) {
      qb.andWhere('incident.urgency = :urgency', { urgency });
    }

    if (source) {
      qb.andWhere('incident.source = :source', { source });
    }

    if (assignmentGroup) {
      qb.andWhere('incident.assignmentGroup ILIKE :assignmentGroup', {
        assignmentGroup: `%${assignmentGroup}%`,
      });
    }

    if (assignedTo) {
      qb.andWhere('incident.assignedTo = :assignedTo', { assignedTo });
    }

    if (createdFrom) {
      qb.andWhere('incident.createdAt >= :createdFrom', { createdFrom });
    }

    if (createdTo) {
      qb.andWhere('incident.createdAt <= :createdTo', { createdTo });
    }

    if (search) {
      qb.andWhere(
        '(incident.number ILIKE :search OR incident.shortDescription ILIKE :search OR incident.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = INCIDENT_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`incident.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Resolve an incident
   * Sets status to RESOLVED and records resolvedAt timestamp
   */
  async resolveIncident(
    tenantId: string,
    userId: string,
    id: string,
    resolutionNotes?: string,
  ): Promise<ItsmIncident | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    if (existing.status === IncidentStatus.CLOSED) {
      return null;
    }

    return this.updateIncident(tenantId, userId, id, {
      status: IncidentStatus.RESOLVED,
      resolvedAt: new Date(),
      resolutionNotes: resolutionNotes || existing.resolutionNotes,
    });
  }

  /**
   * Close an incident
   * Sets status to CLOSED (incident should be resolved first)
   */
  async closeIncident(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<ItsmIncident | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    if (existing.status !== IncidentStatus.RESOLVED) {
      return null;
    }

    return this.updateIncident(tenantId, userId, id, {
      status: IncidentStatus.CLOSED,
    });
  }

  /**
   * Get incident statistics for a tenant
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const incidents = await this.findAllActiveForTenant(tenantId);

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const incident of incidents) {
      byStatus[incident.status] = (byStatus[incident.status] || 0) + 1;
      byPriority[incident.priority] = (byPriority[incident.priority] || 0) + 1;
      byCategory[incident.category] = (byCategory[incident.category] || 0) + 1;
    }

    return {
      total: incidents.length,
      byStatus,
      byPriority,
      byCategory,
    };
  }

  /**
   * Get summary/reporting data for incidents
   */
  async getSummary(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
    openCount: number;
    resolvedToday: number;
    avgResolutionTimeHours: number | null;
  }> {
    const qb = this.repository.createQueryBuilder('incident');
    qb.where('incident.tenantId = :tenantId', { tenantId });
    qb.andWhere('incident.isDeleted = :isDeleted', { isDeleted: false });

    const incidents = await qb.getMany();

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let openCount = 0;
    let resolvedToday = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const resolutionTimes: number[] = [];

    for (const incident of incidents) {
      byStatus[incident.status] = (byStatus[incident.status] || 0) + 1;
      byPriority[incident.priority] = (byPriority[incident.priority] || 0) + 1;
      byCategory[incident.category] = (byCategory[incident.category] || 0) + 1;
      bySource[incident.source] = (bySource[incident.source] || 0) + 1;

      if (
        incident.status === IncidentStatus.OPEN ||
        incident.status === IncidentStatus.IN_PROGRESS
      ) {
        openCount++;
      }

      if (incident.resolvedAt && new Date(incident.resolvedAt) >= today) {
        resolvedToday++;
      }

      if (incident.resolvedAt && incident.createdAt) {
        const resolutionTime =
          new Date(incident.resolvedAt).getTime() -
          new Date(incident.createdAt).getTime();
        resolutionTimes.push(resolutionTime / (1000 * 60 * 60));
      }
    }

    const avgResolutionTimeHours =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : null;

    return {
      total: incidents.length,
      byStatus,
      byPriority,
      byCategory,
      bySource,
      openCount,
      resolvedToday,
      avgResolutionTimeHours,
    };
  }
}
