import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BcmExercise } from '../entities/bcm-exercise.entity';
import { GrcCapa } from '../entities/grc-capa.entity';
import { GrcCapaTask } from '../entities/grc-capa-task.entity';
import { CalendarEventSourceType } from '../enums';

export interface CalendarEvent {
  id: string;
  sourceType: CalendarEventSourceType;
  sourceId: string;
  title: string;
  startAt: string;
  endAt: string | null;
  status: string;
  severity: string | null;
  priority: string | null;
  ownerUserId: string | null;
  url: string;
  metadata: Record<string, unknown> | null;
}

export interface CalendarEventsParams {
  tenantId: string;
  start: string;
  end: string;
  types?: CalendarEventSourceType[];
  ownerUserId?: string;
  status?: string;
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(BcmExercise)
    private readonly bcmExerciseRepository: Repository<BcmExercise>,
    @InjectRepository(GrcCapa)
    private readonly capaRepository: Repository<GrcCapa>,
    @InjectRepository(GrcCapaTask)
    private readonly capaTaskRepository: Repository<GrcCapaTask>,
  ) {}

  async getEvents(params: CalendarEventsParams): Promise<CalendarEvent[]> {
    const { tenantId, start, end, types, ownerUserId, status } = params;

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format for start or end');
    }

    const daysDiff =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 366) {
      throw new BadRequestException('Date range cannot exceed 366 days');
    }

    if (daysDiff < 0) {
      throw new BadRequestException('End date must be after start date');
    }

    const events: CalendarEvent[] = [];

    const shouldIncludeType = (type: CalendarEventSourceType): boolean => {
      if (!types || types.length === 0) return true;
      return types.includes(type);
    };

    if (shouldIncludeType(CalendarEventSourceType.BCM_EXERCISE)) {
      const bcmExercises = await this.getBcmExerciseEvents(
        tenantId,
        startDate,
        endDate,
        ownerUserId,
        status,
      );
      events.push(...bcmExercises);
    }

    if (shouldIncludeType(CalendarEventSourceType.CAPA)) {
      const capas = await this.getCapaEvents(
        tenantId,
        startDate,
        endDate,
        ownerUserId,
        status,
      );
      events.push(...capas);
    }

    if (shouldIncludeType(CalendarEventSourceType.CAPA_TASK)) {
      const capaTasks = await this.getCapaTaskEvents(
        tenantId,
        startDate,
        endDate,
        ownerUserId,
        status,
      );
      events.push(...capaTasks);
    }

    events.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );

    return events;
  }

  private async getBcmExerciseEvents(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    ownerUserId?: string,
    status?: string,
  ): Promise<CalendarEvent[]> {
    const queryBuilder = this.bcmExerciseRepository
      .createQueryBuilder('exercise')
      .where('exercise.tenantId = :tenantId', { tenantId })
      .andWhere('exercise.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('exercise.scheduledAt IS NOT NULL')
      .andWhere('exercise.scheduledAt >= :startDate', { startDate })
      .andWhere('exercise.scheduledAt <= :endDate', { endDate });

    if (status) {
      queryBuilder.andWhere('exercise.status = :status', {
        status: status.toUpperCase(),
      });
    }

    const exercises = await queryBuilder.getMany();

    return exercises.map((exercise) => ({
      id: `${CalendarEventSourceType.BCM_EXERCISE}:${exercise.id}`,
      sourceType: CalendarEventSourceType.BCM_EXERCISE,
      sourceId: exercise.id,
      title: exercise.name,
      startAt: exercise.scheduledAt?.toISOString() || '',
      endAt: exercise.completedAt?.toISOString() || null,
      status: exercise.status,
      severity: null,
      priority: null,
      ownerUserId: null,
      url: `/bcm/services/${exercise.serviceId}?tab=exercises`,
      metadata: {
        exerciseType: exercise.exerciseType,
        outcome: exercise.outcome,
        serviceId: exercise.serviceId,
      },
    }));
  }

  private async getCapaEvents(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    ownerUserId?: string,
    status?: string,
  ): Promise<CalendarEvent[]> {
    const queryBuilder = this.capaRepository
      .createQueryBuilder('capa')
      .where('capa.tenantId = :tenantId', { tenantId })
      .andWhere('capa.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('capa.dueDate IS NOT NULL')
      .andWhere('capa.dueDate >= :startDate', { startDate })
      .andWhere('capa.dueDate <= :endDate', { endDate });

    if (ownerUserId) {
      queryBuilder.andWhere('capa.ownerUserId = :ownerUserId', { ownerUserId });
    }

    if (status) {
      queryBuilder.andWhere('capa.status = :status', {
        status: status.toLowerCase(),
      });
    }

    const capas = await queryBuilder.getMany();

    return capas.map((capa) => ({
      id: `${CalendarEventSourceType.CAPA}:${capa.id}`,
      sourceType: CalendarEventSourceType.CAPA,
      sourceId: capa.id,
      title: capa.title,
      startAt: capa.dueDate?.toISOString() || '',
      endAt: null,
      status: capa.status,
      severity: null,
      priority: capa.priority,
      ownerUserId: capa.ownerUserId,
      url: `/capa/${capa.id}`,
      metadata: {
        type: capa.type,
        issueId: capa.issueId,
      },
    }));
  }

  private async getCapaTaskEvents(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    ownerUserId?: string,
    status?: string,
  ): Promise<CalendarEvent[]> {
    const queryBuilder = this.capaTaskRepository
      .createQueryBuilder('task')
      .where('task.tenantId = :tenantId', { tenantId })
      .andWhere('task.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('task.dueDate IS NOT NULL')
      .andWhere('task.dueDate >= :startDate', { startDate })
      .andWhere('task.dueDate <= :endDate', { endDate });

    if (ownerUserId) {
      queryBuilder.andWhere('task.assigneeUserId = :ownerUserId', {
        ownerUserId,
      });
    }

    if (status) {
      queryBuilder.andWhere('task.status = :status', {
        status: status.toLowerCase(),
      });
    }

    const tasks = await queryBuilder.getMany();

    return tasks.map((task) => ({
      id: `${CalendarEventSourceType.CAPA_TASK}:${task.id}`,
      sourceType: CalendarEventSourceType.CAPA_TASK,
      sourceId: task.id,
      title: task.title,
      startAt: task.dueDate?.toISOString() || '',
      endAt: null,
      status: task.status,
      severity: null,
      priority: null,
      ownerUserId: task.assigneeUserId,
      url: `/capa/${task.capaId}`,
      metadata: {
        capaId: task.capaId,
      },
    }));
  }
}
