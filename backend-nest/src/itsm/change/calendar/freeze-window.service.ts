import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FreezeWindow } from './freeze-window.entity';
import {
  FreezeWindowFilterDto,
  FREEZE_WINDOW_SORTABLE_FIELDS,
} from './dto/freeze-window-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { ChoiceService } from '../../choice/choice.service';

@Injectable()
export class FreezeWindowService {
  constructor(
    @InjectRepository(FreezeWindow)
    private readonly repository: Repository<FreezeWindow>,
    @Optional() private readonly choiceService?: ChoiceService,
  ) {}

  async findAll(
    tenantId: string,
    filterDto: FreezeWindowFilterDto,
  ): Promise<PaginatedResponse<FreezeWindow>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'startAt',
      sortOrder = 'ASC',
      scope,
      isActive,
      startFrom,
      startTo,
      search,
      q,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('fw');
    qb.where('fw.tenantId = :tenantId', { tenantId });
    qb.andWhere('fw.isDeleted = :isDeleted', { isDeleted: false });

    if (scope) {
      qb.andWhere('fw.scope = :scope', { scope });
    }
    if (isActive !== undefined) {
      qb.andWhere('fw.isActive = :isActive', {
        isActive: isActive === 'true',
      });
    }
    if (startFrom) {
      qb.andWhere('fw.startAt >= :startFrom', { startFrom });
    }
    if (startTo) {
      qb.andWhere('fw.startAt <= :startTo', { startTo });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere('(fw.name ILIKE :search OR fw.description ILIKE :search)', {
        search: `%${searchTerm}%`,
      });
    }

    const total = await qb.getCount();

    const validSortBy = FREEZE_WINDOW_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'startAt';
    const validSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    qb.orderBy(`fw.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findById(tenantId: string, id: string): Promise<FreezeWindow | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findActiveOverlapping(
    tenantId: string,
    startAt: Date,
    endAt: Date,
    serviceId?: string,
  ): Promise<FreezeWindow[]> {
    const qb = this.repository.createQueryBuilder('fw');
    qb.where('fw.tenantId = :tenantId', { tenantId });
    qb.andWhere('fw.isDeleted = false');
    qb.andWhere('fw.isActive = true');
    qb.andWhere('fw.startAt < :endAt', { endAt });
    qb.andWhere('fw.endAt > :startAt', { startAt });

    if (serviceId) {
      qb.andWhere(
        "(fw.scope = 'GLOBAL' OR (fw.scope = 'SERVICE' AND fw.scopeRefId = :serviceId))",
        { serviceId },
      );
    } else {
      qb.andWhere("fw.scope = 'GLOBAL'");
    }

    return qb.getMany();
  }

  async create(
    tenantId: string,
    userId: string,
    data: Partial<FreezeWindow>,
  ): Promise<FreezeWindow> {
    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_freeze_window',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    const entity = this.repository.create({
      ...data,
      tenantId,
      createdBy: userId,
      isDeleted: false,
    });
    return this.repository.save(entity);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<FreezeWindow>,
  ): Promise<FreezeWindow | null> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return null;

    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_freeze_window',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    const updated = this.repository.merge(existing, {
      ...data,
      updatedBy: userId,
    });
    return this.repository.save(updated);
  }

  async findActiveForRange(
    tenantId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<FreezeWindow[]> {
    return this.findActiveOverlapping(tenantId, startAt, endAt);
  }

  async softDelete(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return false;

    await this.repository.save(
      this.repository.merge(existing, {
        isDeleted: true,
        updatedBy: userId,
      }),
    );
    return true;
  }
}
