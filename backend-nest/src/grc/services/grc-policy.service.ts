import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcPolicy } from '../entities/grc-policy.entity';
import {
  PolicyCreatedEvent,
  PolicyUpdatedEvent,
  PolicyDeletedEvent,
} from '../events';
import { PolicyStatus } from '../enums';
import {
  PolicyFilterDto,
  POLICY_SORTABLE_FIELDS,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';

/**
 * GRC Policy Service
 *
 * Multi-tenant service for managing policies.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 * Implements soft delete - deleted records are marked with isDeleted=true.
 */
@Injectable()
export class GrcPolicyService extends MultiTenantServiceBase<GrcPolicy> {
  constructor(
    @InjectRepository(GrcPolicy)
    repository: Repository<GrcPolicy>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repository);
  }

  /**
   * Create a new policy and emit PolicyCreatedEvent
   */
  async createPolicy(
    tenantId: string,
    userId: string,
    data: Omit<
      Partial<GrcPolicy>,
      'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
  ): Promise<GrcPolicy> {
    const policy = await this.createForTenant(tenantId, {
      ...data,
      isDeleted: false,
    });

    // Emit domain event
    this.eventEmitter.emit(
      'policy.created',
      new PolicyCreatedEvent(policy.id, tenantId, userId, policy.name),
    );

    return policy;
  }

  /**
   * Update a policy and emit PolicyUpdatedEvent
   */
  async updatePolicy(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<GrcPolicy, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<GrcPolicy | null> {
    // First check if the policy exists and is not deleted
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const policy = await this.updateForTenant(tenantId, id, data);

    if (policy) {
      // Emit domain event
      this.eventEmitter.emit(
        'policy.updated',
        new PolicyUpdatedEvent(policy.id, tenantId, userId, data),
      );
    }

    return policy;
  }

  /**
   * Soft delete a policy and emit PolicyDeletedEvent
   * Sets isDeleted=true instead of removing the record
   */
  async softDeletePolicy(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    // First check if the policy exists and is not already deleted
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return false;
    }

    // Mark as deleted
    await this.updateForTenant(tenantId, id, { isDeleted: true } as Partial<
      Omit<GrcPolicy, 'id' | 'tenantId'>
    >);

    // Emit domain event
    this.eventEmitter.emit(
      'policy.deleted',
      new PolicyDeletedEvent(id, tenantId, userId, existing.name),
    );

    return true;
  }

  /**
   * Find one active (non-deleted) policy for a tenant
   */
  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<GrcPolicy | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find all active (non-deleted) policies for a tenant
   */
  async findAllActiveForTenant(
    tenantId: string,
    options?: {
      where?: FindOptionsWhere<GrcPolicy>;
      order?: Record<string, 'ASC' | 'DESC'>;
      relations?: string[];
    },
  ): Promise<GrcPolicy[]> {
    return this.repository.find({
      where: {
        ...((options?.where || {}) as FindOptionsWhere<GrcPolicy>),
        tenantId,
        isDeleted: false,
      },
      order: options?.order,
      relations: options?.relations,
    });
  }

  /**
   * Find policies by status for a tenant (excludes deleted)
   */
  async findByStatus(
    tenantId: string,
    status: PolicyStatus,
  ): Promise<GrcPolicy[]> {
    return this.findAllActiveForTenant(tenantId, {
      where: { status } as FindOptionsWhere<GrcPolicy>,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find active policies for a tenant (excludes deleted)
   */
  async findActivePolicies(tenantId: string): Promise<GrcPolicy[]> {
    return this.findByStatus(tenantId, PolicyStatus.ACTIVE);
  }

  /**
   * Find policies due for review (excludes deleted)
   */
  async findPoliciesDueForReview(tenantId: string): Promise<GrcPolicy[]> {
    const today = new Date();
    const policies = await this.findAllActiveForTenant(tenantId, {
      where: { status: PolicyStatus.ACTIVE } as FindOptionsWhere<GrcPolicy>,
    });

    return policies.filter(
      (policy) => policy.reviewDate && new Date(policy.reviewDate) <= today,
    );
  }

  /**
   * Find policies by category for a tenant (excludes deleted)
   */
  async findByCategory(
    tenantId: string,
    category: string,
  ): Promise<GrcPolicy[]> {
    return this.findAllActiveForTenant(tenantId, {
      where: { category } as FindOptionsWhere<GrcPolicy>,
      order: { name: 'ASC' },
    });
  }

  /**
   * Find policy with its associated controls (excludes deleted)
   */
  async findWithControls(
    tenantId: string,
    id: string,
  ): Promise<GrcPolicy | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['policyControls', 'policyControls.control'],
    });
  }

  /**
   * Get policy statistics for a tenant (excludes deleted)
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const policies = await this.findAllActiveForTenant(tenantId);

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const policy of policies) {
      byStatus[policy.status] = (byStatus[policy.status] || 0) + 1;
      if (policy.category) {
        byCategory[policy.category] = (byCategory[policy.category] || 0) + 1;
      }
    }

    return {
      total: policies.length,
      byStatus,
      byCategory,
    };
  }

  /**
   * Find policies with pagination, sorting, and filtering
   */
  async findWithFilters(
    tenantId: string,
    filterDto: PolicyFilterDto,
  ): Promise<PaginatedResponse<GrcPolicy>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      status,
      category,
      code,
      ownerUserId,
      approvedByUserId,
      createdFrom,
      createdTo,
      effectiveDateFrom,
      effectiveDateTo,
      reviewDateFrom,
      reviewDateTo,
      search,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('policy');

    // Base filters: tenant and not deleted
    qb.where('policy.tenantId = :tenantId', { tenantId });
    qb.andWhere('policy.isDeleted = :isDeleted', { isDeleted: false });

    // Apply optional filters
    if (status) {
      qb.andWhere('policy.status = :status', { status });
    }

    if (category) {
      qb.andWhere('policy.category = :category', { category });
    }

    if (code) {
      qb.andWhere('policy.code = :code', { code });
    }

    if (ownerUserId) {
      qb.andWhere('policy.ownerUserId = :ownerUserId', { ownerUserId });
    }

    if (approvedByUserId) {
      qb.andWhere('policy.approvedByUserId = :approvedByUserId', {
        approvedByUserId,
      });
    }

    if (createdFrom) {
      qb.andWhere('policy.createdAt >= :createdFrom', { createdFrom });
    }

    if (createdTo) {
      qb.andWhere('policy.createdAt <= :createdTo', { createdTo });
    }

    if (effectiveDateFrom) {
      qb.andWhere('policy.effectiveDate >= :effectiveDateFrom', {
        effectiveDateFrom,
      });
    }

    if (effectiveDateTo) {
      qb.andWhere('policy.effectiveDate <= :effectiveDateTo', {
        effectiveDateTo,
      });
    }

    if (reviewDateFrom) {
      qb.andWhere('policy.reviewDate >= :reviewDateFrom', { reviewDateFrom });
    }

    if (reviewDateTo) {
      qb.andWhere('policy.reviewDate <= :reviewDateTo', { reviewDateTo });
    }

    if (search) {
      qb.andWhere(
        '(policy.name ILIKE :search OR policy.summary ILIKE :search OR policy.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply sorting (validate sortBy field)
    const validSortBy = POLICY_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`policy.${validSortBy}`, validSortOrder);

    // Apply pagination
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Get summary/reporting data for policies
   */
  async getSummary(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    dueForReviewCount: number;
    activeCount: number;
    draftCount: number;
  }> {
    const qb = this.repository.createQueryBuilder('policy');
    qb.where('policy.tenantId = :tenantId', { tenantId });
    qb.andWhere('policy.isDeleted = :isDeleted', { isDeleted: false });

    const policies = await qb.getMany();

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let dueForReviewCount = 0;
    let activeCount = 0;
    let draftCount = 0;
    const now = new Date();

    for (const policy of policies) {
      // Count by status
      byStatus[policy.status] = (byStatus[policy.status] || 0) + 1;

      // Count by category
      if (policy.category) {
        byCategory[policy.category] = (byCategory[policy.category] || 0) + 1;
      }

      // Count active policies
      if (policy.status === PolicyStatus.ACTIVE) {
        activeCount++;
      }

      // Count draft policies
      if (policy.status === PolicyStatus.DRAFT) {
        draftCount++;
      }

      // Count due for review (reviewDate in the past and status is ACTIVE)
      if (
        policy.reviewDate &&
        new Date(policy.reviewDate) <= now &&
        policy.status === PolicyStatus.ACTIVE
      ) {
        dueForReviewCount++;
      }
    }

    return {
      total: policies.length,
      byStatus,
      byCategory,
      dueForReviewCount,
      activeCount,
      draftCount,
    };
  }
}
