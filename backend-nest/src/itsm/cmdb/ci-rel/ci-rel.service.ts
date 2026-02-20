import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbCiRel } from './ci-rel.entity';
import {
  CiRelFilterDto,
  CI_REL_SORTABLE_FIELDS,
} from './dto/ci-rel-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { AuditService } from '../../../audit/audit.service';
import { ChoiceService } from '../../choice/choice.service';

@Injectable()
export class CiRelService extends MultiTenantServiceBase<CmdbCiRel> {
  constructor(
    @InjectRepository(CmdbCiRel)
    repository: Repository<CmdbCiRel>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly choiceService?: ChoiceService,
  ) {
    super(repository);
  }

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<CmdbCiRel | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['sourceCi', 'targetCi'],
    });
  }

  async createCiRel(
    tenantId: string,
    userId: string,
    data: Partial<
      Omit<
        CmdbCiRel,
        'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >
    >,
  ): Promise<CmdbCiRel> {
    if (data.sourceCiId === data.targetCiId) {
      throw new BadRequestException('A CI cannot relate to itself');
    }

    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'cmdb_ci_rel',
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
      'CmdbCiRel',
      entity,
      userId,
      tenantId,
    );

    return this.findOneActiveForTenant(
      tenantId,
      entity.id,
    ) as Promise<CmdbCiRel>;
  }

  async updateCiRel(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<CmdbCiRel, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<CmdbCiRel | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'cmdb_ci_rel',
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
        'CmdbCiRel',
        id,
        beforeState as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return updated
      ? this.findOneActiveForTenant(tenantId, id)
      : null;
  }

  async softDeleteCiRel(
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
    } as Partial<Omit<CmdbCiRel, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'CmdbCiRel',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  async findWithFilters(
    tenantId: string,
    filterDto: CiRelFilterDto,
  ): Promise<PaginatedResponse<CmdbCiRel>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      sourceCiId,
      targetCiId,
      ciId,
      type,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('rel');
    qb.leftJoinAndSelect('rel.sourceCi', 'src');
    qb.leftJoinAndSelect('rel.targetCi', 'tgt');

    qb.where('rel.tenantId = :tenantId', { tenantId });
    qb.andWhere('rel.isDeleted = :isDeleted', { isDeleted: false });

    if (sourceCiId) {
      qb.andWhere('rel.sourceCiId = :sourceCiId', { sourceCiId });
    }

    if (targetCiId) {
      qb.andWhere('rel.targetCiId = :targetCiId', { targetCiId });
    }

    if (ciId) {
      qb.andWhere(
        '(rel.sourceCiId = :ciId OR rel.targetCiId = :ciId)',
        { ciId },
      );
    }

    if (type) {
      qb.andWhere('rel.type = :type', { type });
    }

    const total = await qb.getCount();

    const validSortBy = CI_REL_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`rel.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findRelationshipsForCi(
    tenantId: string,
    ciId: string,
  ): Promise<CmdbCiRel[]> {
    return this.repository.find({
      where: [
        { tenantId, sourceCiId: ciId, isDeleted: false },
        { tenantId, targetCiId: ciId, isDeleted: false },
      ],
      relations: ['sourceCi', 'targetCi'],
      order: { createdAt: 'DESC' },
    });
  }
}
