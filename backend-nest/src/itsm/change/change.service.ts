import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { ItsmChange } from './change.entity';
import {
  ChangeFilterDto,
  CHANGE_SORTABLE_FIELDS,
} from './dto/change-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';
import { ChoiceService } from '../choice/choice.service';

@Injectable()
export class ChangeService extends MultiTenantServiceBase<ItsmChange> {
  private changeCounter = 0;

  constructor(
    @InjectRepository(ItsmChange)
    repository: Repository<ItsmChange>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly choiceService?: ChoiceService,
  ) {
    super(repository);
  }

  private async generateChangeNumber(tenantId: string): Promise<string> {
    const count = await this.countForTenant(tenantId);
    this.changeCounter = count + 1;
    return `CHG${String(this.changeCounter).padStart(6, '0')}`;
  }

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<ItsmChange | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async createChange(
    tenantId: string,
    userId: string,
    data: Partial<
      Omit<
        ItsmChange,
        'id' | 'tenantId' | 'number' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >
    >,
  ): Promise<ItsmChange> {
    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_changes',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    const number = await this.generateChangeNumber(tenantId);

    const change = await this.createForTenant(tenantId, {
      ...data,
      number,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'ItsmChange',
      change,
      userId,
      tenantId,
    );

    return change;
  }

  async updateChange(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<ItsmChange, 'id' | 'tenantId' | 'number' | 'isDeleted'>>,
  ): Promise<ItsmChange | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_changes',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    const change = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });

    if (change) {
      await this.auditService?.recordUpdate(
        'ItsmChange',
        id,
        beforeState as unknown as Record<string, unknown>,
        change as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return change;
  }

  async softDeleteChange(
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
    } as Partial<Omit<ItsmChange, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'ItsmChange',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  async findWithFilters(
    tenantId: string,
    filterDto: ChangeFilterDto,
  ): Promise<PaginatedResponse<ItsmChange>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      state,
      type,
      risk,
      approvalStatus,
      search,
      q,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('change');

    qb.where('change.tenantId = :tenantId', { tenantId });
    qb.andWhere('change.isDeleted = :isDeleted', { isDeleted: false });

    if (state) {
      qb.andWhere('change.state = :state', { state });
    }

    if (type) {
      qb.andWhere('change.type = :type', { type });
    }

    if (risk) {
      qb.andWhere('change.risk = :risk', { risk });
    }

    if (approvalStatus) {
      qb.andWhere('change.approvalStatus = :approvalStatus', {
        approvalStatus,
      });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere(
        '(change.number ILIKE :search OR change.title ILIKE :search OR change.description ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = CHANGE_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`change.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }
}
