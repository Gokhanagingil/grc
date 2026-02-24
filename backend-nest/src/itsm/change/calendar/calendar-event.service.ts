import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEvent } from './calendar-event.entity';
import {
  CalendarEventFilterDto,
  CALENDAR_EVENT_SORTABLE_FIELDS,
} from './dto/calendar-event-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';
import { ChoiceService } from '../../choice/choice.service';

@Injectable()
export class CalendarEventService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly repository: Repository<CalendarEvent>,
    @Optional() private readonly choiceService?: ChoiceService,
  ) {}

  async findAll(
    tenantId: string,
    filterDto: CalendarEventFilterDto,
  ): Promise<PaginatedResponse<CalendarEvent>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'startAt',
      sortOrder = 'ASC',
      type,
      status,
      startFrom,
      startTo,
      search,
      q,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('evt');
    qb.where('evt.tenantId = :tenantId', { tenantId });
    qb.andWhere('evt.isDeleted = :isDeleted', { isDeleted: false });

    if (type) {
      qb.andWhere('evt.type = :type', { type });
    }
    if (status) {
      qb.andWhere('evt.status = :status', { status });
    }
    if (startFrom) {
      qb.andWhere('evt.startAt >= :startFrom', { startFrom });
    }
    if (startTo) {
      qb.andWhere('evt.startAt <= :startTo', { startTo });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere('evt.title ILIKE :search', {
        search: `%${searchTerm}%`,
      });
    }

    qb.leftJoinAndSelect('evt.change', 'change');

    const total = await qb.getCount();

    const validSortBy = CALENDAR_EVENT_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'startAt';
    const validSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    qb.orderBy(`evt.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findById(tenantId: string, id: string): Promise<CalendarEvent | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['change'],
    });
  }

  async findByChangeId(
    tenantId: string,
    changeId: string,
  ): Promise<CalendarEvent | null> {
    return this.repository.findOne({
      where: { changeId, tenantId, isDeleted: false },
    });
  }

  async findOverlapping(
    tenantId: string,
    startAt: Date,
    endAt: Date,
    excludeEventId?: string,
  ): Promise<CalendarEvent[]> {
    const qb = this.repository.createQueryBuilder('evt');
    qb.where('evt.tenantId = :tenantId', { tenantId });
    qb.andWhere('evt.isDeleted = false');
    qb.andWhere('evt.startAt < :endAt', { endAt });
    qb.andWhere('evt.endAt > :startAt', { startAt });

    if (excludeEventId) {
      qb.andWhere('evt.id != :excludeEventId', { excludeEventId });
    }

    return qb.getMany();
  }

  async create(
    tenantId: string,
    userId: string,
    data: Partial<CalendarEvent>,
  ): Promise<CalendarEvent> {
    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_change_calendar_event',
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
    data: Partial<CalendarEvent>,
  ): Promise<CalendarEvent | null> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return null;

    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_change_calendar_event',
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

  async softDeleteByChangeId(
    tenantId: string,
    userId: string,
    changeId: string,
  ): Promise<boolean> {
    const existing = await this.findByChangeId(tenantId, changeId);
    if (!existing) return false;
    return this.softDelete(tenantId, userId, existing.id);
  }

  async upsertForChange(
    tenantId: string,
    userId: string,
    changeId: string,
    title: string,
    startAt: Date,
    endAt: Date,
  ): Promise<CalendarEvent> {
    const existing = await this.findByChangeId(tenantId, changeId);

    if (existing) {
      const updated = await this.update(tenantId, userId, existing.id, {
        title,
        startAt,
        endAt,
      });
      return updated as CalendarEvent;
    }

    return this.create(tenantId, userId, {
      changeId,
      title,
      startAt,
      endAt,
      type: 'CHANGE',
      status: 'SCHEDULED',
    });
  }
}
