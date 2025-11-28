import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  Between,
  In,
} from 'typeorm';
import { CalendarEventEntity, CalendarEventType, CalendarEventStatus } from '../../entities/app/calendar-event.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { ListCalendarEventsDto } from './dto/list-calendar-events.dto';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { randomUUID } from 'crypto';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @InjectRepository(CalendarEventEntity)
    private readonly calendarRepo: Repository<CalendarEventEntity>,
  ) {}

  async list(dto: ListCalendarEventsDto, tenantId: string): Promise<CalendarEventEntity[]> {
    try {
      const fromDate = new Date(dto.from);
      const toDate = new Date(dto.to);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new BadRequestException('Invalid date format. Use ISO 8601 format.');
      }

      if (fromDate > toDate) {
        throw new BadRequestException('from date must be before or equal to to date');
      }

      const where: FindOptionsWhere<CalendarEventEntity> = {
        ...tenantWhere(tenantId),
        start_at: Between(fromDate, toDate),
      };

      if (dto.types && dto.types.length > 0) {
        where.event_type = In(dto.types);
      }

      if (dto.status && dto.status.length > 0) {
        where.status = In(dto.status);
      }

      if (dto.ownerId) {
        where.owner_user_id = dto.ownerId;
      }

      const events = await this.calendarRepo.find({
        where,
        order: { start_at: 'ASC' },
      });

      return events;
    } catch (error: any) {
      this.logger.error('Error listing calendar events:', error?.message || error);
      throw error;
    }
  }

  async create(dto: CreateCalendarEventDto, tenantId: string): Promise<CalendarEventEntity> {
    try {
      const startAt = new Date(dto.start_at);
      const endAt = dto.end_at ? new Date(dto.end_at) : null;

      if (isNaN(startAt.getTime())) {
        throw new BadRequestException('Invalid start_at date format. Use ISO 8601 format.');
      }

      if (endAt && isNaN(endAt.getTime())) {
        throw new BadRequestException('Invalid end_at date format. Use ISO 8601 format.');
      }

      if (endAt && endAt < startAt) {
        throw new BadRequestException('end_at must be after or equal to start_at');
      }

      const event = this.calendarRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        title: dto.title,
        description: dto.description,
        event_type: dto.event_type,
        source_module: dto.source_module,
        source_entity: dto.source_entity,
        source_id: dto.source_id,
        start_at: startAt,
        end_at: endAt || undefined,
        status: dto.status || CalendarEventStatus.PLANNED,
        location: dto.location,
        owner_user_id: dto.owner_user_id,
        color_hint: dto.color_hint,
      });

      const saved = await this.calendarRepo.save(event);
      return saved;
    } catch (error: any) {
      this.logger.error('Error creating calendar event:', error?.message || error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCalendarEventDto, tenantId: string): Promise<CalendarEventEntity> {
    try {
      const event = await this.calendarRepo.findOne({
        where: { id, ...tenantWhere(tenantId) },
      });

      if (!event) {
        throw new NotFoundException(`Calendar event ${id} not found`);
      }

      if (dto.start_at) {
        const startAt = new Date(dto.start_at);
        if (isNaN(startAt.getTime())) {
          throw new BadRequestException('Invalid start_at date format. Use ISO 8601 format.');
        }
        event.start_at = startAt;
      }

      if (dto.end_at !== undefined) {
        if (dto.end_at === null) {
          event.end_at = undefined;
        } else {
          const endAt = new Date(dto.end_at);
          if (isNaN(endAt.getTime())) {
            throw new BadRequestException('Invalid end_at date format. Use ISO 8601 format.');
          }
          if (endAt < event.start_at) {
            throw new BadRequestException('end_at must be after or equal to start_at');
          }
          event.end_at = endAt;
        }
      }

      if (dto.title !== undefined) event.title = dto.title;
      if (dto.description !== undefined) event.description = dto.description;
      if (dto.event_type !== undefined) event.event_type = dto.event_type;
      if (dto.source_module !== undefined) event.source_module = dto.source_module;
      if (dto.source_entity !== undefined) event.source_entity = dto.source_entity;
      if (dto.source_id !== undefined) event.source_id = dto.source_id;
      if (dto.status !== undefined) event.status = dto.status;
      if (dto.location !== undefined) event.location = dto.location;
      if (dto.owner_user_id !== undefined) event.owner_user_id = dto.owner_user_id;
      if (dto.color_hint !== undefined) event.color_hint = dto.color_hint;

      const updated = await this.calendarRepo.save(event);
      return updated;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error updating calendar event:', error?.message || error);
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    try {
      const event = await this.calendarRepo.findOne({
        where: { id, ...tenantWhere(tenantId) },
      });

      if (!event) {
        throw new NotFoundException(`Calendar event ${id} not found`);
      }

      await this.calendarRepo.remove(event);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error deleting calendar event:', error?.message || error);
      throw error;
    }
  }

  async getById(id: string, tenantId: string): Promise<CalendarEventEntity> {
    const event = await this.calendarRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
    });

    if (!event) {
      throw new NotFoundException(`Calendar event ${id} not found`);
    }

    return event;
  }
}

