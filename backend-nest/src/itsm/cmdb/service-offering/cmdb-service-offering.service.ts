import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbServiceOffering } from './cmdb-service-offering.entity';
import {
  OfferingFilterDto,
  OFFERING_SORTABLE_FIELDS,
} from './dto/offering-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { AuditService } from '../../../audit/audit.service';
import { ChoiceService } from '../../choice/choice.service';

@Injectable()
export class CmdbServiceOfferingService extends MultiTenantServiceBase<CmdbServiceOffering> {
  constructor(
    @InjectRepository(CmdbServiceOffering)
    repository: Repository<CmdbServiceOffering>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly choiceService?: ChoiceService,
  ) {
    super(repository);
  }

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<CmdbServiceOffering | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['service'],
    });
  }

  async createOffering(
    tenantId: string,
    userId: string,
    data: Partial<
      Omit<
        CmdbServiceOffering,
        'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >
    >,
  ): Promise<CmdbServiceOffering> {
    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'cmdb_service_offering',
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
      'CmdbServiceOffering',
      entity,
      userId,
      tenantId,
    );

    return this.findOneActiveForTenant(
      tenantId,
      entity.id,
    ) as Promise<CmdbServiceOffering>;
  }

  async updateOffering(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<CmdbServiceOffering, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<CmdbServiceOffering | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'cmdb_service_offering',
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
        'CmdbServiceOffering',
        id,
        beforeState as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return updated ? this.findOneActiveForTenant(tenantId, id) : null;
  }

  async softDeleteOffering(
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
    } as Partial<Omit<CmdbServiceOffering, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'CmdbServiceOffering',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  async findWithFilters(
    tenantId: string,
    filterDto: OfferingFilterDto,
  ): Promise<PaginatedResponse<CmdbServiceOffering>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search,
      q,
      serviceId,
      status,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('off');
    qb.leftJoinAndSelect('off.service', 'svc');

    qb.where('off.tenantId = :tenantId', { tenantId });
    qb.andWhere('off.isDeleted = :isDeleted', { isDeleted: false });

    if (serviceId) {
      qb.andWhere('off.serviceId = :serviceId', { serviceId });
    }

    if (status) {
      qb.andWhere('off.status = :status', { status });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere('(off.name ILIKE :search)', { search: `%${searchTerm}%` });
    }

    const total = await qb.getCount();

    const validSortBy = OFFERING_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`off.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }
}
