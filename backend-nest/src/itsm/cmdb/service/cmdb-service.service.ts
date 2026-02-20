import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbService } from './cmdb-service.entity';
import {
  ServiceFilterDto,
  SERVICE_SORTABLE_FIELDS,
} from './dto/service-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { AuditService } from '../../../audit/audit.service';
import { ChoiceService } from '../../choice/choice.service';

@Injectable()
export class CmdbServiceService extends MultiTenantServiceBase<CmdbService> {
  constructor(
    @InjectRepository(CmdbService)
    repository: Repository<CmdbService>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly choiceService?: ChoiceService,
  ) {
    super(repository);
  }

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<CmdbService | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['offerings'],
    });
  }

  async createService(
    tenantId: string,
    userId: string,
    data: Partial<
      Omit<
        CmdbService,
        'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >
    >,
  ): Promise<CmdbService> {
    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'cmdb_service',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    const entity = await this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'CmdbService',
      entity,
      userId,
      tenantId,
    );

    return this.findOneActiveForTenant(
      tenantId,
      entity.id,
    ) as Promise<CmdbService>;
  }

  async updateService(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<CmdbService, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<CmdbService | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'cmdb_service',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    const updated = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });

    if (updated) {
      await this.auditService?.recordUpdate(
        'CmdbService',
        id,
        beforeState as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return updated ? this.findOneActiveForTenant(tenantId, id) : null;
  }

  async softDeleteService(
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
    } as Partial<Omit<CmdbService, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'CmdbService',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  async findWithFilters(
    tenantId: string,
    filterDto: ServiceFilterDto,
  ): Promise<PaginatedResponse<CmdbService>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search,
      q,
      type,
      status,
      tier,
      criticality,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('svc');

    qb.where('svc.tenantId = :tenantId', { tenantId });
    qb.andWhere('svc.isDeleted = :isDeleted', { isDeleted: false });

    if (type) {
      qb.andWhere('svc.type = :type', { type });
    }

    if (status) {
      qb.andWhere('svc.status = :status', { status });
    }

    if (tier) {
      qb.andWhere('svc.tier = :tier', { tier });
    }

    if (criticality) {
      qb.andWhere('svc.criticality = :criticality', { criticality });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere('(svc.name ILIKE :search OR svc.description ILIKE :search)', {
        search: `%${searchTerm}%`,
      });
    }

    const total = await qb.getCount();

    const validSortBy = SERVICE_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`svc.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }
}
