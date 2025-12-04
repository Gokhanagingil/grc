import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcRequirement } from '../entities/grc-requirement.entity';
import { RequirementCreatedEvent } from '../events';
import { ComplianceFramework } from '../enums';

/**
 * GRC Requirement Service
 *
 * Multi-tenant service for managing compliance requirements.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
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
      'id' | 'tenantId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<GrcRequirement> {
    const requirement = await this.createForTenant(tenantId, data);

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
   * Find requirements by framework for a tenant
   */
  async findByFramework(
    tenantId: string,
    framework: ComplianceFramework,
  ): Promise<GrcRequirement[]> {
    return this.findAllForTenant(tenantId, {
      where: { framework } as FindOptionsWhere<GrcRequirement>,
      order: { referenceCode: 'ASC' },
    });
  }

  /**
   * Find requirements by status for a tenant
   */
  async findByStatus(
    tenantId: string,
    status: string,
  ): Promise<GrcRequirement[]> {
    return this.findAllForTenant(tenantId, {
      where: { status } as FindOptionsWhere<GrcRequirement>,
      order: { framework: 'ASC', referenceCode: 'ASC' },
    });
  }

  /**
   * Find requirement with its associated controls
   */
  async findWithControls(
    tenantId: string,
    id: string,
  ): Promise<GrcRequirement | null> {
    return this.repository.findOne({
      where: { id, tenantId },
      relations: ['requirementControls', 'requirementControls.control'],
    });
  }

  /**
   * Get requirement statistics for a tenant
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    byFramework: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const requirements = await this.findAllForTenant(tenantId);

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
   * Get all unique frameworks used by a tenant
   */
  async getFrameworks(tenantId: string): Promise<ComplianceFramework[]> {
    const requirements = await this.findAllForTenant(tenantId);
    const frameworks = new Set<ComplianceFramework>();

    for (const req of requirements) {
      frameworks.add(req.framework);
    }

    return Array.from(frameworks);
  }
}
