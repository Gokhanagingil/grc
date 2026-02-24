import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbCiClass } from './ci-class.entity';
import {
  CiClassFilterDto,
  CI_CLASS_SORTABLE_FIELDS,
} from './dto/ci-class-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { AuditService } from '../../../audit/audit.service';

@Injectable()
export class CiClassService extends MultiTenantServiceBase<CmdbCiClass> {
  constructor(
    @InjectRepository(CmdbCiClass)
    repository: Repository<CmdbCiClass>,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<CmdbCiClass | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async createCiClass(
    tenantId: string,
    userId: string,
    data: Partial<
      Omit<
        CmdbCiClass,
        'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >
    >,
  ): Promise<CmdbCiClass> {
    const entity = await this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'CmdbCiClass',
      entity,
      userId,
      tenantId,
    );

    return entity;
  }

  async updateCiClass(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<CmdbCiClass, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<CmdbCiClass | null> {
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
        'CmdbCiClass',
        id,
        beforeState as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return updated;
  }

  async softDeleteCiClass(
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
    } as Partial<Omit<CmdbCiClass, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'CmdbCiClass',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  /**
   * Get summary counts for classes (total, system, custom, abstract).
   */
  async getClassSummary(tenantId: string): Promise<{
    total: number;
    system: number;
    custom: number;
    abstract: number;
  }> {
    const qb = this.repository.createQueryBuilder('cls');
    qb.where('cls.tenantId = :tenantId', { tenantId });
    qb.andWhere('cls.isDeleted = :isDeleted', { isDeleted: false });

    const allClasses = await qb.getMany();
    const total = allClasses.length;
    const system = allClasses.filter((c) => c.isSystem).length;
    const abstract_ = allClasses.filter((c) => c.isAbstract).length;
    return {
      total,
      system,
      custom: total - system,
      abstract: abstract_,
    };
  }

  async findWithFilters(
    tenantId: string,
    filterDto: CiClassFilterDto,
  ): Promise<PaginatedResponse<CmdbCiClass>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'sortOrder',
      sortOrder = 'ASC',
      search,
      q,
      isActive,
      isSystem,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('cls');

    qb.where('cls.tenantId = :tenantId', { tenantId });
    qb.andWhere('cls.isDeleted = :isDeleted', { isDeleted: false });

    if (isActive !== undefined) {
      qb.andWhere('cls.isActive = :isActive', { isActive });
    }

    if (isSystem !== undefined) {
      qb.andWhere('cls.isSystem = :isSystem', { isSystem });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere(
        '(cls.name ILIKE :search OR cls.label ILIKE :search OR cls.description ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = CI_CLASS_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'sortOrder';
    const validSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    qb.orderBy(`cls.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }
}
