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
}
