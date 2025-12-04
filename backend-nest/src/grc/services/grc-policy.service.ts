import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcPolicy } from '../entities/grc-policy.entity';
import { PolicyCreatedEvent, PolicyUpdatedEvent } from '../events';
import { PolicyStatus } from '../enums';

/**
 * GRC Policy Service
 *
 * Multi-tenant service for managing policies.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
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
      'id' | 'tenantId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<GrcPolicy> {
    const policy = await this.createForTenant(tenantId, data);

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
    data: Partial<Omit<GrcPolicy, 'id' | 'tenantId'>>,
  ): Promise<GrcPolicy | null> {
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
   * Find policies by status for a tenant
   */
  async findByStatus(
    tenantId: string,
    status: PolicyStatus,
  ): Promise<GrcPolicy[]> {
    return this.findAllForTenant(tenantId, {
      where: { status } as FindOptionsWhere<GrcPolicy>,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find active policies for a tenant
   */
  async findActivePolicies(tenantId: string): Promise<GrcPolicy[]> {
    return this.findByStatus(tenantId, PolicyStatus.ACTIVE);
  }

  /**
   * Find policies due for review
   */
  async findPoliciesDueForReview(tenantId: string): Promise<GrcPolicy[]> {
    const today = new Date();
    const policies = await this.findAllForTenant(tenantId, {
      where: { status: PolicyStatus.ACTIVE } as FindOptionsWhere<GrcPolicy>,
    });

    return policies.filter(
      (policy) => policy.reviewDate && new Date(policy.reviewDate) <= today,
    );
  }

  /**
   * Find policies by category for a tenant
   */
  async findByCategory(
    tenantId: string,
    category: string,
  ): Promise<GrcPolicy[]> {
    return this.findAllForTenant(tenantId, {
      where: { category } as FindOptionsWhere<GrcPolicy>,
      order: { name: 'ASC' },
    });
  }

  /**
   * Find policy with its associated controls
   */
  async findWithControls(
    tenantId: string,
    id: string,
  ): Promise<GrcPolicy | null> {
    return this.repository.findOne({
      where: { id, tenantId },
      relations: ['policyControls', 'policyControls.control'],
    });
  }

  /**
   * Get policy statistics for a tenant
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const policies = await this.findAllForTenant(tenantId);

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
