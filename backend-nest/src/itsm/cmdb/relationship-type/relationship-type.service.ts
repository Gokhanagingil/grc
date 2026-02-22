import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbRelationshipType } from './relationship-type.entity';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { AuditService } from '../../../audit/audit.service';

@Injectable()
export class RelationshipTypeService extends MultiTenantServiceBase<CmdbRelationshipType> {
  constructor(
    @InjectRepository(CmdbRelationshipType)
    repository: Repository<CmdbRelationshipType>,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  /**
   * Find all active relationship types for a tenant.
   */
  async findAllActive(tenantId: string): Promise<CmdbRelationshipType[]> {
    return this.repository.find({
      where: { tenantId, isActive: true, isDeleted: false },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Find a single relationship type by ID.
   */
  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<CmdbRelationshipType | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find a relationship type by name.
   */
  async findByName(
    tenantId: string,
    name: string,
  ): Promise<CmdbRelationshipType | null> {
    return this.repository.findOne({
      where: { name, tenantId, isDeleted: false },
    });
  }

  /**
   * Create a new relationship type.
   */
  async createRelationshipType(
    tenantId: string,
    userId: string,
    data: Partial<
      Omit<
        CmdbRelationshipType,
        'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >
    >,
  ): Promise<CmdbRelationshipType> {
    // Check for duplicate name
    const existing = await this.findByName(tenantId, data.name ?? '');
    if (existing) {
      throw new BadRequestException(
        `Relationship type with name "${data.name}" already exists`,
      );
    }

    const entity = await this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'CmdbRelationshipType',
      entity,
      userId,
      tenantId,
    );

    return this.findOneActiveForTenant(
      tenantId,
      entity.id,
    ) as Promise<CmdbRelationshipType>;
  }

  /**
   * Update a relationship type.
   */
  async updateRelationshipType(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<CmdbRelationshipType, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<CmdbRelationshipType | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    const updated = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });

    if (updated) {
      await this.auditService?.recordUpdate(
        'CmdbRelationshipType',
        id,
        beforeState as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return updated ? this.findOneActiveForTenant(tenantId, id) : null;
  }

  /**
   * Soft delete a relationship type (only non-system types).
   */
  async softDeleteRelationshipType(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return false;
    }

    if (existing.isSystem) {
      throw new BadRequestException(
        'System-defined relationship types cannot be deleted',
      );
    }

    await this.updateForTenant(tenantId, id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<CmdbRelationshipType, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'CmdbRelationshipType',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  /**
   * List with pagination support.
   */
  async findWithFilters(
    tenantId: string,
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedResponse<CmdbRelationshipType>> {
    const qb = this.repository.createQueryBuilder('rt');
    qb.where('rt.tenantId = :tenantId', { tenantId });
    qb.andWhere('rt.isDeleted = :isDeleted', { isDeleted: false });
    qb.orderBy('rt.sortOrder', 'ASC');
    qb.addOrderBy('rt.name', 'ASC');

    const total = await qb.getCount();
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }
}
