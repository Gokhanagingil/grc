import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbCi } from './ci.entity';
import { CiFilterDto, CI_SORTABLE_FIELDS } from './dto/ci-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { AuditService } from '../../../audit/audit.service';
import { ChoiceService } from '../../choice/choice.service';
import { CiAttributeValidationService } from './ci-attribute-validation.service';

@Injectable()
export class CiService extends MultiTenantServiceBase<CmdbCi> {
  constructor(
    @InjectRepository(CmdbCi)
    repository: Repository<CmdbCi>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly choiceService?: ChoiceService,
    @Optional()
    private readonly attributeValidationService?: CiAttributeValidationService,
  ) {
    super(repository);
  }

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<CmdbCi | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['ciClass'],
    });
  }

  async createCi(
    tenantId: string,
    userId: string,
    data: Partial<
      Omit<CmdbCi, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'>
    >,
  ): Promise<CmdbCi> {
    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'cmdb_ci',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    // Validate attributes against class effective schema
    if (this.attributeValidationService && data.classId && data.attributes) {
      await this.attributeValidationService.validateAndThrow(
        tenantId,
        data.classId,
        data.attributes,
        false, // isUpdate = false
      );
    }

    const entity = await this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate('CmdbCi', entity, userId, tenantId);

    return this.findOneActiveForTenant(tenantId, entity.id) as Promise<CmdbCi>;
  }

  async updateCi(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<CmdbCi, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<CmdbCi | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'cmdb_ci',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    // Validate attributes against class effective schema
    if (this.attributeValidationService && data.attributes) {
      const classId = data.classId ?? existing.classId;
      await this.attributeValidationService.validateAndThrow(
        tenantId,
        classId,
        data.attributes,
        true, // isUpdate = true (partial update, skip required checks for missing keys)
      );
    }

    const updated = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });

    if (updated) {
      await this.auditService?.recordUpdate(
        'CmdbCi',
        id,
        beforeState as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return updated ? this.findOneActiveForTenant(tenantId, id) : null;
  }

  async softDeleteCi(
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
    } as Partial<Omit<CmdbCi, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete('CmdbCi', existing, userId, tenantId);

    return true;
  }

  async findWithFilters(
    tenantId: string,
    filterDto: CiFilterDto,
  ): Promise<PaginatedResponse<CmdbCi>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search,
      q,
      classId,
      lifecycle,
      environment,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('ci');
    qb.leftJoinAndSelect('ci.ciClass', 'cls');

    qb.where('ci.tenantId = :tenantId', { tenantId });
    qb.andWhere('ci.isDeleted = :isDeleted', { isDeleted: false });

    if (classId) {
      qb.andWhere('ci.classId = :classId', { classId });
    }

    if (lifecycle) {
      qb.andWhere('ci.lifecycle = :lifecycle', { lifecycle });
    }

    if (environment) {
      qb.andWhere('ci.environment = :environment', { environment });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere(
        '(ci.name ILIKE :search OR ci.description ILIKE :search OR ci.assetTag ILIKE :search OR ci.serialNumber ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = CI_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`ci.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }
}
