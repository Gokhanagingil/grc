import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbServiceCi } from './cmdb-service-ci.entity';
import {
  ServiceCiFilterDto,
  SERVICE_CI_SORTABLE_FIELDS,
} from './dto/service-ci-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { AuditService } from '../../../audit/audit.service';
import { ChoiceService } from '../../choice/choice.service';

@Injectable()
export class CmdbServiceCiService extends MultiTenantServiceBase<CmdbServiceCi> {
  constructor(
    @InjectRepository(CmdbServiceCi)
    repository: Repository<CmdbServiceCi>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly choiceService?: ChoiceService,
  ) {
    super(repository);
  }

  async linkServiceToCi(
    tenantId: string,
    userId: string,
    serviceId: string,
    ciId: string,
    relationshipType: string,
    isPrimary: boolean = false,
  ): Promise<CmdbServiceCi> {
    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'cmdb_service_ci',
        { relationship_type: relationshipType } as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    const existing = await this.repository.findOne({
      where: {
        tenantId,
        serviceId,
        ciId,
        relationshipType,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Service-CI link already exists with relationship type '${relationshipType}'`,
      );
    }

    const entity = await this.createForTenant(tenantId, {
      serviceId,
      ciId,
      relationshipType,
      isPrimary,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'CmdbServiceCi',
      entity,
      userId,
      tenantId,
    );

    return this.findOneWithRelations(
      tenantId,
      entity.id,
    ) as Promise<CmdbServiceCi>;
  }

  async unlinkServiceFromCi(
    tenantId: string,
    userId: string,
    serviceId: string,
    ciId: string,
    relationshipType?: string,
  ): Promise<boolean> {
    const where: Record<string, unknown> = {
      tenantId,
      serviceId,
      ciId,
      isDeleted: false,
    };

    if (relationshipType) {
      where.relationshipType = relationshipType;
    }

    const existing = await this.repository.findOne({
      where: where as Record<string, string | boolean>,
    });

    if (!existing) {
      return false;
    }

    await this.updateForTenant(tenantId, existing.id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<CmdbServiceCi, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'CmdbServiceCi',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  async findCisForService(
    tenantId: string,
    serviceId: string,
    filterDto: ServiceCiFilterDto,
  ): Promise<PaginatedResponse<CmdbServiceCi>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      relationshipType,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('sc');
    qb.leftJoinAndSelect('sc.ci', 'ci');
    qb.leftJoinAndSelect('sc.service', 'svc');

    qb.where('sc.tenantId = :tenantId', { tenantId });
    qb.andWhere('sc.serviceId = :serviceId', { serviceId });
    qb.andWhere('sc.isDeleted = :isDeleted', { isDeleted: false });

    if (relationshipType) {
      qb.andWhere('sc.relationshipType = :relationshipType', {
        relationshipType,
      });
    }

    const total = await qb.getCount();

    const validSortBy = SERVICE_CI_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`sc.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findServicesForCi(
    tenantId: string,
    ciId: string,
    filterDto: ServiceCiFilterDto,
  ): Promise<PaginatedResponse<CmdbServiceCi>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      relationshipType,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('sc');
    qb.leftJoinAndSelect('sc.service', 'svc');
    qb.leftJoinAndSelect('sc.ci', 'ci');

    qb.where('sc.tenantId = :tenantId', { tenantId });
    qb.andWhere('sc.ciId = :ciId', { ciId });
    qb.andWhere('sc.isDeleted = :isDeleted', { isDeleted: false });

    if (relationshipType) {
      qb.andWhere('sc.relationshipType = :relationshipType', {
        relationshipType,
      });
    }

    const total = await qb.getCount();

    const validSortBy = SERVICE_CI_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`sc.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  private async findOneWithRelations(
    tenantId: string,
    id: string,
  ): Promise<CmdbServiceCi | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['service', 'ci'],
    });
  }
}
