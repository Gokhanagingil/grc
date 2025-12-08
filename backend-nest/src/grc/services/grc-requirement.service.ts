import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcRequirement } from '../entities/grc-requirement.entity';
import {
  RequirementCreatedEvent,
  RequirementUpdatedEvent,
  RequirementDeletedEvent,
} from '../events';
import { ComplianceFramework } from '../enums';
import {
  RequirementFilterDto,
  REQUIREMENT_SORTABLE_FIELDS,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';

/**
 * GRC Requirement Service
 *
 * Multi-tenant service for managing compliance requirements.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 * Implements soft delete - deleted records are marked with isDeleted=true.
 */
@Injectable()
export class GrcRequirementService extends MultiTenantServiceBase<GrcRequirement> {
  constructor(
    @InjectRepository(GrcRequirement)
    repository: Repository<GrcRequirement>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repository);
  }

  /**
   * Create a new requirement and emit RequirementCreatedEvent
   */
  async createRequirement(
    tenantId: string,
    userId: string,
    data: Omit<
      Partial<GrcRequirement>,
      'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
  ): Promise<GrcRequirement> {
    const requirement = await this.createForTenant(tenantId, {
      ...data,
      isDeleted: false,
    });

    // Emit domain event
    this.eventEmitter.emit(
      'requirement.created',
      new RequirementCreatedEvent(
        requirement.id,
        tenantId,
        userId,
        requirement.title,
        requirement.framework,
      ),
    );

    return requirement;
  }

  /**
   * Update a requirement and emit RequirementUpdatedEvent
   */
  async updateRequirement(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<GrcRequirement, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<GrcRequirement | null> {
    // First check if the requirement exists and is not deleted
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const requirement = await this.updateForTenant(tenantId, id, data);

    if (requirement) {
      // Emit domain event
      this.eventEmitter.emit(
        'requirement.updated',
        new RequirementUpdatedEvent(requirement.id, tenantId, userId, data),
      );
    }

    return requirement;
  }

  /**
   * Soft delete a requirement and emit RequirementDeletedEvent
   * Sets isDeleted=true instead of removing the record
   */
  async softDeleteRequirement(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    // First check if the requirement exists and is not already deleted
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return false;
    }

    // Mark as deleted
    await this.updateForTenant(tenantId, id, { isDeleted: true } as Partial<
      Omit<GrcRequirement, 'id' | 'tenantId'>
    >);

    // Emit domain event
    this.eventEmitter.emit(
      'requirement.deleted',
      new RequirementDeletedEvent(
        id,
        tenantId,
        userId,
        existing.title,
        existing.framework,
      ),
    );

    return true;
  }

  /**
   * Find one active (non-deleted) requirement for a tenant
   */
  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<GrcRequirement | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find all active (non-deleted) requirements for a tenant
   */
  async findAllActiveForTenant(
    tenantId: string,
    options?: {
      where?: FindOptionsWhere<GrcRequirement>;
      order?: Record<string, 'ASC' | 'DESC'>;
      relations?: string[];
    },
  ): Promise<GrcRequirement[]> {
    return this.repository.find({
      where: {
        ...(options?.where || {}),
        tenantId,
        isDeleted: false,
      },
      order: options?.order,
      relations: options?.relations,
    });
  }

  /**
   * Find requirements by framework for a tenant (excludes deleted)
   */
  async findByFramework(
    tenantId: string,
    framework: ComplianceFramework,
  ): Promise<GrcRequirement[]> {
    return this.findAllActiveForTenant(tenantId, {
      where: { framework } as FindOptionsWhere<GrcRequirement>,
      order: { referenceCode: 'ASC' },
    });
  }

  /**
   * Find requirements by status for a tenant (excludes deleted)
   */
  async findByStatus(
    tenantId: string,
    status: string,
  ): Promise<GrcRequirement[]> {
    return this.findAllActiveForTenant(tenantId, {
      where: { status } as FindOptionsWhere<GrcRequirement>,
      order: { framework: 'ASC', referenceCode: 'ASC' },
    });
  }

  /**
   * Find requirement with its associated controls (excludes deleted)
   */
  async findWithControls(
    tenantId: string,
    id: string,
  ): Promise<GrcRequirement | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['requirementControls', 'requirementControls.control'],
    });
  }

  /**
   * Get requirement statistics for a tenant (excludes deleted)
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    byFramework: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const requirements = await this.findAllActiveForTenant(tenantId);

    const byFramework: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const req of requirements) {
      byFramework[req.framework] = (byFramework[req.framework] || 0) + 1;
      byStatus[req.status] = (byStatus[req.status] || 0) + 1;
    }

    return {
      total: requirements.length,
      byFramework,
      byStatus,
    };
  }

  /**
   * Get all unique frameworks used by a tenant (excludes deleted)
   */
  async getFrameworks(tenantId: string): Promise<ComplianceFramework[]> {
    const requirements = await this.findAllActiveForTenant(tenantId);
    const frameworks = new Set<ComplianceFramework>();

    for (const req of requirements) {
      frameworks.add(req.framework);
    }

    return Array.from(frameworks);
  }

  /**
   * Find requirements with pagination, sorting, and filtering
   */
  async findWithFilters(
    tenantId: string,
    filterDto: RequirementFilterDto,
  ): Promise<PaginatedResponse<GrcRequirement>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      framework,
      status,
      category,
      priority,
      referenceCode,
      ownerUserId,
      createdFrom,
      createdTo,
      dueDateFrom,
      dueDateTo,
      search,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('requirement');

    // Base filters: tenant and not deleted
    qb.where('requirement.tenantId = :tenantId', { tenantId });
    qb.andWhere('requirement.isDeleted = :isDeleted', { isDeleted: false });

    // Apply optional filters
    if (framework) {
      qb.andWhere('requirement.framework = :framework', { framework });
    }

    if (status) {
      qb.andWhere('requirement.status = :status', { status });
    }

    if (category) {
      qb.andWhere('requirement.category = :category', { category });
    }

    if (priority) {
      qb.andWhere('requirement.priority = :priority', { priority });
    }

    if (referenceCode) {
      qb.andWhere('requirement.referenceCode = :referenceCode', {
        referenceCode,
      });
    }

    if (ownerUserId) {
      qb.andWhere('requirement.ownerUserId = :ownerUserId', { ownerUserId });
    }

    if (createdFrom) {
      qb.andWhere('requirement.createdAt >= :createdFrom', { createdFrom });
    }

    if (createdTo) {
      qb.andWhere('requirement.createdAt <= :createdTo', { createdTo });
    }

    if (dueDateFrom) {
      qb.andWhere('requirement.dueDate >= :dueDateFrom', { dueDateFrom });
    }

    if (dueDateTo) {
      qb.andWhere('requirement.dueDate <= :dueDateTo', { dueDateTo });
    }

    if (search) {
      qb.andWhere(
        '(requirement.title ILIKE :search OR requirement.description ILIKE :search OR requirement.referenceCode ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply sorting (validate sortBy field)
    const validSortBy = REQUIREMENT_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`requirement.${validSortBy}`, validSortOrder);

    // Apply pagination
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Get summary/reporting data for requirements
   * Enhanced with KPI-ready fields for Dashboard
   */
  async getSummary(tenantId: string): Promise<{
    total: number;
    totalCount: number;
    byFramework: Record<string, number>;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    compliantCount: number;
    nonCompliantCount: number;
    inProgressCount: number;
    requirementCoveragePercentage: number;
  }> {
    const qb = this.repository.createQueryBuilder('requirement');
    qb.where('requirement.tenantId = :tenantId', { tenantId });
    qb.andWhere('requirement.isDeleted = :isDeleted', { isDeleted: false });

    const requirements = await qb.getMany();

    const byFramework: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let compliantCount = 0;
    let nonCompliantCount = 0;
    let inProgressCount = 0;

    for (const req of requirements) {
      // Count by framework
      byFramework[req.framework] = (byFramework[req.framework] || 0) + 1;

      // Count by status
      byStatus[req.status] = (byStatus[req.status] || 0) + 1;

      // Count by category
      if (req.category) {
        byCategory[req.category] = (byCategory[req.category] || 0) + 1;
      }

      // Count by priority
      if (req.priority) {
        byPriority[req.priority] = (byPriority[req.priority] || 0) + 1;
      }

      // Count compliance status
      if (req.status === 'compliant') {
        compliantCount++;
      } else if (req.status === 'non_compliant') {
        nonCompliantCount++;
      } else if (req.status === 'in_progress') {
        inProgressCount++;
      }
    }

    // Calculate requirement coverage percentage (compliant / total requirements)
    const requirementCoveragePercentage =
      requirements.length > 0
        ? Math.round((compliantCount / requirements.length) * 100 * 100) / 100
        : 0;

    return {
      total: requirements.length,
      totalCount: requirements.length,
      byFramework,
      byStatus,
      byCategory,
      byPriority,
      compliantCount,
      nonCompliantCount,
      inProgressCount,
      requirementCoveragePercentage,
    };
  }
}
