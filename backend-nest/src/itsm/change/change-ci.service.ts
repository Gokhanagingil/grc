import {
  Injectable,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { ItsmChangeCi } from './change-ci.entity';
import { ItsmChange } from './change.entity';
import { CmdbCi } from '../cmdb/ci/ci.entity';
import {
  ChangeCiFilterDto,
  CHANGE_CI_SORTABLE_FIELDS,
} from './dto/change-ci-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';
import { ChoiceService } from '../choice/choice.service';

@Injectable()
export class ChangeCiService extends MultiTenantServiceBase<ItsmChangeCi> {
  constructor(
    @InjectRepository(ItsmChangeCi)
    repository: Repository<ItsmChangeCi>,
    @InjectRepository(ItsmChange)
    private readonly changeRepo: Repository<ItsmChange>,
    @InjectRepository(CmdbCi)
    private readonly ciRepo: Repository<CmdbCi>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly choiceService?: ChoiceService,
  ) {
    super(repository);
  }

  async addAffectedCi(
    tenantId: string,
    userId: string,
    changeId: string,
    ciId: string,
    relationshipType: string,
    impactScope?: string,
  ): Promise<ItsmChangeCi> {
    const change = await this.changeRepo.findOne({
      where: { id: changeId, tenantId, isDeleted: false },
    });
    if (!change) {
      throw new NotFoundException(
        `Change with ID ${changeId} not found in this tenant`,
      );
    }

    const ci = await this.ciRepo.findOne({
      where: { id: ciId, tenantId, isDeleted: false },
    });
    if (!ci) {
      throw new NotFoundException(
        `CI with ID ${ciId} not found in this tenant`,
      );
    }

    if (this.choiceService) {
      const data: Record<string, unknown> = { relationshipType };
      if (impactScope) {
        data.impactScope = impactScope;
      }
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_change_ci',
        data,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    const existing = await this.repository.findOne({
      where: {
        tenantId,
        changeId,
        ciId,
        relationshipType,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `CI link already exists with relationship type '${relationshipType}'`,
      );
    }

    const entity = await this.createForTenant(tenantId, {
      changeId,
      ciId,
      relationshipType,
      impactScope: impactScope || null,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'ItsmChangeCi',
      entity,
      userId,
      tenantId,
    );

    return this.findOneWithRelations(
      tenantId,
      entity.id,
    ) as Promise<ItsmChangeCi>;
  }

  async removeAffectedCi(
    tenantId: string,
    userId: string,
    changeId: string,
    linkId: string,
  ): Promise<boolean> {
    const existing = await this.repository.findOne({
      where: { id: linkId, tenantId, changeId, isDeleted: false },
    });

    if (!existing) {
      return false;
    }

    await this.updateForTenant(tenantId, existing.id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<ItsmChangeCi, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'ItsmChangeCi',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  async findAffectedCis(
    tenantId: string,
    changeId: string,
    filterDto: ChangeCiFilterDto,
  ): Promise<PaginatedResponse<ItsmChangeCi>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search,
      relationshipType,
      impactScope,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('cc');
    qb.leftJoinAndSelect('cc.ci', 'ci');
    qb.leftJoinAndSelect('ci.ciClass', 'ciClass');

    qb.where('cc.tenantId = :tenantId', { tenantId });
    qb.andWhere('cc.changeId = :changeId', { changeId });
    qb.andWhere('cc.isDeleted = :isDeleted', { isDeleted: false });

    if (relationshipType) {
      qb.andWhere('cc.relationshipType = :relationshipType', {
        relationshipType,
      });
    }

    if (impactScope) {
      qb.andWhere('cc.impactScope = :impactScope', { impactScope });
    }

    if (search) {
      qb.andWhere('(ci.name ILIKE :search OR ci.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const total = await qb.getCount();

    const validSortBy = CHANGE_CI_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`cc.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  private async findOneWithRelations(
    tenantId: string,
    id: string,
  ): Promise<ItsmChangeCi | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['ci', 'ci.ciClass'],
    });
  }
}
