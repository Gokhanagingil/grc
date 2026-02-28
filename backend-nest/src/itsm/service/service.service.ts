import {
  Injectable,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { ItsmService } from './service.entity';
import { CmdbService as CmdbServiceEntity } from '../cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../cmdb/service-offering/cmdb-service-offering.entity';
import {
  ServiceFilterDto,
  SERVICE_SORTABLE_FIELDS,
} from './dto/service-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';
import { ChoiceService } from '../choice/choice.service';

@Injectable()
export class ItsmServiceService extends MultiTenantServiceBase<ItsmService> {
  constructor(
    @InjectRepository(ItsmService)
    repository: Repository<ItsmService>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly choiceService?: ChoiceService,
    @Optional()
    @InjectRepository(CmdbServiceEntity)
    private readonly cmdbServiceRepo?: Repository<CmdbServiceEntity>,
    @Optional()
    @InjectRepository(CmdbServiceOffering)
    private readonly cmdbOfferingRepo?: Repository<CmdbServiceOffering>,
  ) {
    super(repository);
  }

  private async validateServiceOffering(
    tenantId: string,
    serviceId?: string | null,
    offeringId?: string | null,
  ): Promise<void> {
    if (offeringId && !serviceId) {
      throw new BadRequestException(
        'serviceId is required when offeringId is provided',
      );
    }

    if (serviceId && this.cmdbServiceRepo) {
      const svc = await this.cmdbServiceRepo.findOne({
        where: { id: serviceId, tenantId, isDeleted: false },
      });
      if (!svc) {
        throw new NotFoundException(
          `Service with ID ${serviceId} not found in this tenant`,
        );
      }
    }

    if (offeringId && this.cmdbOfferingRepo) {
      const off = await this.cmdbOfferingRepo.findOne({
        where: { id: offeringId, tenantId, isDeleted: false },
      });
      if (!off) {
        throw new NotFoundException(
          `Offering with ID ${offeringId} not found in this tenant`,
        );
      }
      if (serviceId && off.serviceId !== serviceId) {
        throw new BadRequestException(
          `Offering ${offeringId} does not belong to service ${serviceId}`,
        );
      }
    }
  }

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<ItsmService | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['customerCompany'],
    });
  }

  async createService(
    tenantId: string,
    userId: string,
    data: Partial<
      Omit<
        ItsmService,
        'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >
    >,
  ): Promise<ItsmService> {
    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_services',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    await this.validateServiceOffering(
      tenantId,
      data.serviceId,
      data.offeringId,
    );

    const service = await this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'ItsmService',
      service,
      userId,
      tenantId,
    );

    return service;
  }

  async updateService(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<ItsmService, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<ItsmService | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_services',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    if (data.serviceId !== undefined || data.offeringId !== undefined) {
      await this.validateServiceOffering(
        tenantId,
        data.serviceId !== undefined ? data.serviceId : existing.serviceId,
        data.offeringId !== undefined ? data.offeringId : existing.offeringId,
      );
    }

    const service = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });

    if (service) {
      await this.auditService?.recordUpdate(
        'ItsmService',
        id,
        beforeState as unknown as Record<string, unknown>,
        service as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return service;
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
    } as Partial<Omit<ItsmService, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'ItsmService',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  async findWithFilters(
    tenantId: string,
    filterDto: ServiceFilterDto,
  ): Promise<PaginatedResponse<ItsmService>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      status,
      criticality,
      serviceId,
      offeringId,
      customerCompanyId,
      search,
      q,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('service');

    qb.where('service.tenantId = :tenantId', { tenantId });
    qb.andWhere('service.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      qb.andWhere('service.status = :status', { status });
    }

    if (criticality) {
      qb.andWhere('service.criticality = :criticality', { criticality });
    }

    if (serviceId) {
      qb.andWhere('service.serviceId = :serviceId', { serviceId });
    }

    if (offeringId) {
      qb.andWhere('service.offeringId = :offeringId', { offeringId });
    }

    if (customerCompanyId) {
      qb.andWhere('service.customerCompanyId = :customerCompanyId', {
        customerCompanyId,
      });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere(
        '(service.name ILIKE :search OR service.description ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = SERVICE_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`service.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    qb.leftJoinAndSelect('service.customerCompany', 'customerCompany');

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }
}
