import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { MetricsService } from '../metrics/metrics.service';
import { CalendarService } from '../calendar/calendar.service';
import { CalendarEventType, CalendarEventStatus } from '../../entities/app/calendar-event.entity';
import {
  BIAProcessEntity,
  BIAProcessDependencyEntity,
  BCPPlanEntity,
  BCPExerciseEntity,
  EntityEntity,
} from '../../entities/app';
import { BCPPlanStatus } from '../../entities/app/bcp-plan.entity';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { parsePagination, parseSort } from '../../common/search/pagination.dto';
import {
  CreateBIAProcessDto,
  CreateBIADependencyDto,
  CreateBCPPlanDto,
  CreateBCPExerciseDto,
  QueryBIAProcessDto,
  QueryBIADependencyDto,
  QueryBCPPlanDto,
  QueryBCPExerciseDto,
} from './dto';

@Injectable()
export class BCMService {
  private readonly logger = new Logger(BCMService.name);

  constructor(
    @InjectRepository(BIAProcessEntity)
    private readonly biaProcessRepo: Repository<BIAProcessEntity>,
    @InjectRepository(BIAProcessDependencyEntity)
    private readonly biaDependencyRepo: Repository<BIAProcessDependencyEntity>,
    @InjectRepository(BCPPlanEntity)
    private readonly bcpPlanRepo: Repository<BCPPlanEntity>,
    @InjectRepository(BCPExerciseEntity)
    private readonly bcpExerciseRepo: Repository<BCPExerciseEntity>,
    @InjectRepository(EntityEntity)
    private readonly entityRepo: Repository<EntityEntity>,
    private readonly metricsService: MetricsService,
    private readonly calendarService: CalendarService,
  ) {}

  // BIA Processes
  async listBIAProcesses(tenantId: string, query: QueryBIAProcessDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { created_at: 'DESC' };

      const qb = this.biaProcessRepo
        .createQueryBuilder('process')
        .where('process.tenant_id = :tenantId', { tenantId })
        .skip(skip)
        .take(pageSize);

      if (query.search) {
        qb.andWhere(
          '(process.code ILIKE :search OR process.name ILIKE :search)',
          {
            search: `%${query.search}%`,
          },
        );
      }

      if (query.owner_user_id) {
        qb.andWhere('process.owner_user_id = :ownerId', {
          ownerId: query.owner_user_id,
        });
      }

      if (query.criticalityOp && query.criticalityVal !== undefined) {
        const op = query.criticalityOp;
        if (op === '=') {
          qb.andWhere('process.criticality = :critVal', {
            critVal: query.criticalityVal,
          });
        } else if (op === '>') {
          qb.andWhere('process.criticality > :critVal', {
            critVal: query.criticalityVal,
          });
        } else if (op === '>=') {
          qb.andWhere('process.criticality >= :critVal', {
            critVal: query.criticalityVal,
          });
        } else if (op === '<') {
          qb.andWhere('process.criticality < :critVal', {
            critVal: query.criticalityVal,
          });
        } else if (op === '<=') {
          qb.andWhere('process.criticality <= :critVal', {
            critVal: query.criticalityVal,
          });
        }
      }

      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`process.${field}`, dir);
      });

      const [items, total] = await qb.getManyAndCount();

      return { items, total, page, pageSize };
    } catch (error: any) {
      this.logger.warn('Error listing BIA processes:', error?.message || error);
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async getBIAProcess(id: string, tenantId: string) {
    const process = await this.biaProcessRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
      relations: ['dependencies', 'dependencies.entity'],
    });
    if (!process) throw new NotFoundException(`BIA Process ${id} not found`);
    return process;
  }

  async createBIAProcess(dto: CreateBIAProcessDto, tenantId: string) {
    const existing = await this.biaProcessRepo.findOne({
      where: { code: dto.code, ...tenantWhere(tenantId) },
    });
    if (existing)
      throw new ConflictException(
        `BIA Process with code ${dto.code} already exists`,
      );

    if (
      dto.criticality !== undefined &&
      (dto.criticality < 1 || dto.criticality > 5)
    ) {
      throw new BadRequestException('Criticality must be between 1 and 5');
    }
    if (dto.rto_hours !== undefined && dto.rto_hours < 0) {
      throw new BadRequestException('RTO hours must be >= 0');
    }
    if (dto.rpo_hours !== undefined && dto.rpo_hours < 0) {
      throw new BadRequestException('RPO hours must be >= 0');
    }
    if (dto.mtpd_hours !== undefined && dto.mtpd_hours < 0) {
      throw new BadRequestException('MTPD hours must be >= 0');
    }

    const process = this.biaProcessRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      code: dto.code,
      name: dto.name,
      description: dto.description,
      // NormalizationPipe handles empty string → undefined automatically
      owner_user_id: dto.owner_user_id,
      criticality: dto.criticality ?? 3,
      rto_hours: dto.rto_hours ?? 24,
      rpo_hours: dto.rpo_hours ?? 8,
      mtpd_hours: dto.mtpd_hours ?? 48,
    });

    return this.biaProcessRepo.save(process);
  }

  async updateBIAProcess(
    id: string,
    dto: Partial<CreateBIAProcessDto>,
    tenantId: string,
  ) {
    const process = await this.getBIAProcess(id, tenantId);
    if (dto.code && dto.code !== process.code) {
      const existing = await this.biaProcessRepo.findOne({
        where: { code: dto.code, ...tenantWhere(tenantId) },
      });
      if (existing)
        throw new ConflictException(
          `BIA Process with code ${dto.code} already exists`,
        );
    }

    if (dto.name !== undefined) process.name = dto.name;
    if (dto.description !== undefined) process.description = dto.description;
    // NormalizationPipe handles empty string → undefined automatically
    if (dto.owner_user_id !== undefined) {
      process.owner_user_id = dto.owner_user_id;
    }
    if (dto.criticality !== undefined) {
      if (dto.criticality < 1 || dto.criticality > 5) {
        throw new BadRequestException('Criticality must be between 1 and 5');
      }
      process.criticality = dto.criticality;
    }
    if (dto.rto_hours !== undefined) {
      if (dto.rto_hours < 0)
        throw new BadRequestException('RTO hours must be >= 0');
      process.rto_hours = dto.rto_hours;
    }
    if (dto.rpo_hours !== undefined) {
      if (dto.rpo_hours < 0)
        throw new BadRequestException('RPO hours must be >= 0');
      process.rpo_hours = dto.rpo_hours;
    }
    if (dto.mtpd_hours !== undefined) {
      if (dto.mtpd_hours < 0)
        throw new BadRequestException('MTPD hours must be >= 0');
      process.mtpd_hours = dto.mtpd_hours;
    }

    return this.biaProcessRepo.save(process);
  }

  async deleteBIAProcess(id: string, tenantId: string) {
    const process = await this.getBIAProcess(id, tenantId);
    await this.biaProcessRepo.remove(process);
    return { success: true, id };
  }

  // BIA Dependencies
  async listBIADependencies(tenantId: string, query: QueryBIADependencyDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { created_at: 'DESC' };

      const qb = this.biaDependencyRepo
        .createQueryBuilder('dep')
        .leftJoinAndSelect('dep.process', 'process')
        .leftJoinAndSelect('dep.entity', 'entity')
        .where('dep.tenant_id = :tenantId', { tenantId })
        .skip(skip)
        .take(pageSize);

      if (query.process_id) {
        qb.andWhere('dep.process_id = :processId', {
          processId: query.process_id,
        });
      }

      if (query.entity_id) {
        qb.andWhere('dep.entity_id = :entityId', { entityId: query.entity_id });
      }

      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`dep.${field}`, dir);
      });

      const [items, total] = await qb.getManyAndCount();

      return { items, total, page, pageSize };
    } catch (error: any) {
      this.logger.warn(
        'Error listing BIA dependencies:',
        error?.message || error,
      );
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async createBIADependency(dto: CreateBIADependencyDto, tenantId: string) {
    const process = await this.biaProcessRepo.findOne({
      where: { id: dto.process_id, ...tenantWhere(tenantId) },
    });
    if (!process)
      throw new NotFoundException(`BIA Process ${dto.process_id} not found`);

    const entity = await this.entityRepo.findOne({
      where: { id: dto.entity_id, ...tenantWhere(tenantId) },
    });
    if (!entity)
      throw new NotFoundException(`Entity ${dto.entity_id} not found`);

    // Check if dependency already exists
    const existing = await this.biaDependencyRepo.findOne({
      where: {
        process_id: dto.process_id,
        entity_id: dto.entity_id,
        ...tenantWhere(tenantId),
      },
    });
    if (existing) throw new ConflictException('Dependency already exists');

    const dependency = this.biaDependencyRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      process_id: dto.process_id,
      entity_id: dto.entity_id,
      dependency_type: dto.dependency_type,
    });

    return this.biaDependencyRepo.save(dependency);
  }

  async deleteBIADependency(id: string, tenantId: string) {
    const dependency = await this.biaDependencyRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
    });
    if (!dependency)
      throw new NotFoundException(`BIA Dependency ${id} not found`);
    await this.biaDependencyRepo.remove(dependency);
    return { success: true, id };
  }

  // BCP Plans
  async listBCPPlans(tenantId: string, query: QueryBCPPlanDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { created_at: 'DESC' };

      const qb = this.bcpPlanRepo
        .createQueryBuilder('plan')
        .where('plan.tenant_id = :tenantId', { tenantId })
        .skip(skip)
        .take(pageSize);

      if (query.search) {
        qb.andWhere('(plan.code ILIKE :search OR plan.name ILIKE :search)', {
          search: `%${query.search}%`,
        });
      }

      if (query.process_id) {
        qb.andWhere('plan.process_id = :processId', {
          processId: query.process_id,
        });
      }

      if (query.status) {
        qb.andWhere('plan.status = :status', { status: query.status });
      }

      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`plan.${field}`, dir);
      });

      const [items, total] = await qb.getManyAndCount();

      return { items, total, page, pageSize };
    } catch (error: any) {
      this.logger.warn('Error listing BCP plans:', error?.message || error);
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async getBCPPlan(id: string, tenantId: string) {
    const plan = await this.bcpPlanRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
      relations: ['exercises'],
    });
    if (!plan) throw new NotFoundException(`BCP Plan ${id} not found`);
    return plan;
  }

  async createBCPPlan(dto: CreateBCPPlanDto, tenantId: string) {
    const existing = await this.bcpPlanRepo.findOne({
      where: { code: dto.code, ...tenantWhere(tenantId) },
    });
    if (existing)
      throw new ConflictException(
        `BCP Plan with code ${dto.code} already exists`,
      );

    // NormalizationPipe handles empty string → undefined automatically
    const processId = dto.process_id;
    const scopeEntityId = dto.scope_entity_id;

    if (processId) {
      const process = await this.biaProcessRepo.findOne({
        where: { id: processId, ...tenantWhere(tenantId) },
      });
      if (!process)
        throw new NotFoundException(`BIA Process ${processId} not found`);
    }

    if (scopeEntityId) {
      const entity = await this.entityRepo.findOne({
        where: { id: scopeEntityId, ...tenantWhere(tenantId) },
      });
      if (!entity)
        throw new NotFoundException(`Entity ${scopeEntityId} not found`);
    }

    const plan = this.bcpPlanRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      code: dto.code,
      name: dto.name,
      process_id: processId,
      scope_entity_id: scopeEntityId,
      version: dto.version || '1.0',
      status: dto.status || BCPPlanStatus.DRAFT,
      steps: dto.steps || [],
    });

    return this.bcpPlanRepo.save(plan);
  }

  async updateBCPPlan(
    id: string,
    dto: Partial<CreateBCPPlanDto>,
    tenantId: string,
  ) {
    const plan = await this.getBCPPlan(id, tenantId);
    if (dto.code && dto.code !== plan.code) {
      const existing = await this.bcpPlanRepo.findOne({
        where: { code: dto.code, ...tenantWhere(tenantId) },
      });
      if (existing)
        throw new ConflictException(
          `BCP Plan with code ${dto.code} already exists`,
        );
    }

    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.version !== undefined) plan.version = dto.version;
    if (dto.status !== undefined) plan.status = dto.status;
    if (dto.steps !== undefined) plan.steps = dto.steps;
    // NormalizationPipe handles empty string → undefined automatically
    if (dto.process_id !== undefined) {
      plan.process_id = dto.process_id;
    }
    if (dto.scope_entity_id !== undefined) {
      plan.scope_entity_id = dto.scope_entity_id;
    }

    return this.bcpPlanRepo.save(plan);
  }

  async deleteBCPPlan(id: string, tenantId: string) {
    const plan = await this.getBCPPlan(id, tenantId);
    await this.bcpPlanRepo.remove(plan);
    return { success: true, id };
  }

  // BCP Exercises
  async listBCPExercises(tenantId: string, query: QueryBCPExerciseDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { date: 'DESC' };

      const qb = this.bcpExerciseRepo
        .createQueryBuilder('exercise')
        .leftJoinAndSelect('exercise.plan', 'plan')
        .where('exercise.tenant_id = :tenantId', { tenantId })
        .skip(skip)
        .take(pageSize);

      if (query.plan_id) {
        qb.andWhere('exercise.plan_id = :planId', { planId: query.plan_id });
      }

      if (query.search) {
        qb.andWhere(
          '(exercise.code ILIKE :search OR exercise.name ILIKE :search)',
          {
            search: `%${query.search}%`,
          },
        );
      }

      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`exercise.${field}`, dir);
      });

      const [items, total] = await qb.getManyAndCount();

      // Update metrics: BCP exercise count
      if (this.metricsService) {
        try {
          const gauge = this.metricsService.getGauge('bcm_exercise_count');
          if (gauge) {
            gauge.set({ tenant_id: tenantId }, total);
          }
        } catch (error: any) {
          // Metrics not available, ignore
        }
      }

      return { items, total, page, pageSize };
    } catch (error: any) {
      this.logger.warn('Error listing BCP exercises:', error?.message || error);
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async getBCPExercise(id: string, tenantId: string) {
    const exercise = await this.bcpExerciseRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
      relations: ['plan'],
    });
    if (!exercise) throw new NotFoundException(`BCP Exercise ${id} not found`);
    return exercise;
  }

  async createBCPExercise(dto: CreateBCPExerciseDto, tenantId: string) {
    // NormalizationPipe handles empty string → undefined automatically
    const planId = dto.plan_id;
    if (!planId) throw new BadRequestException('plan_id is required');

    const plan = await this.bcpPlanRepo.findOne({
      where: { id: planId, ...tenantWhere(tenantId) },
    });
    if (!plan) throw new NotFoundException(`BCP Plan ${planId} not found`);

    const existing = await this.bcpExerciseRepo.findOne({
      where: { code: dto.code, ...tenantWhere(tenantId) },
    });
    if (existing)
      throw new ConflictException(
        `BCP Exercise with code ${dto.code} already exists`,
      );

    const exercise = this.bcpExerciseRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      plan_id: planId,
      code: dto.code,
      name: dto.name,
      date: new Date(dto.date),
      scenario: dto.scenario,
      result: dto.result,
      findings_count: dto.findings_count ?? 0,
      caps_count: dto.caps_count ?? 0,
    });

    const saved = await this.bcpExerciseRepo.save(exercise);

    // Create calendar event for BCP exercise
    try {
      const exerciseDate = new Date(dto.date);
      // Use exercise date as start, and same day + 1 day as end (or same day if end not needed)
      const startAt = new Date(exerciseDate);
      startAt.setHours(9, 0, 0, 0); // Default to 9 AM
      const endAt = new Date(exerciseDate);
      endAt.setHours(17, 0, 0, 0); // Default to 5 PM

      // Status: if result exists, it's completed; otherwise planned
      const calendarStatus = saved.result
        ? CalendarEventStatus.COMPLETED
        : CalendarEventStatus.PLANNED;

      await this.calendarService.create(
        {
          title: `${saved.code}: ${saved.name}`,
          description: saved.scenario,
          event_type: CalendarEventType.BCP_EXERCISE,
          source_module: 'bcm',
          source_entity: 'BCPExercise',
          source_id: saved.id,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          status: calendarStatus,
        },
        tenantId,
      );
    } catch (error: any) {
      // Log error but don't fail exercise creation
      this.logger.warn('Failed to create calendar event for BCP exercise:', error?.message || error);
    }

    return saved;
  }

  async updateBCPExercise(
    id: string,
    dto: Partial<CreateBCPExerciseDto>,
    tenantId: string,
  ) {
    const exercise = await this.getBCPExercise(id, tenantId);
    if (dto.code && dto.code !== exercise.code) {
      const existing = await this.bcpExerciseRepo.findOne({
        where: { code: dto.code, ...tenantWhere(tenantId) },
      });
      if (existing)
        throw new ConflictException(
          `BCP Exercise with code ${dto.code} already exists`,
        );
    }

    if (dto.name !== undefined) exercise.name = dto.name;
    if (dto.date !== undefined) exercise.date = new Date(dto.date);
    if (dto.scenario !== undefined) exercise.scenario = dto.scenario;
    if (dto.result !== undefined) exercise.result = dto.result;
    if (dto.findings_count !== undefined)
      exercise.findings_count = dto.findings_count;
    if (dto.caps_count !== undefined) exercise.caps_count = dto.caps_count;
    if (dto.code !== undefined) exercise.code = dto.code;

    const updated = await this.bcpExerciseRepo.save(exercise);

    // Update calendar event for BCP exercise
    try {
      const exerciseDate = updated.date;
      const startAt = new Date(exerciseDate);
      startAt.setHours(9, 0, 0, 0); // Default to 9 AM
      const endAt = new Date(exerciseDate);
      endAt.setHours(17, 0, 0, 0); // Default to 5 PM

      // Find existing calendar event
      const calendarEvents = await this.calendarService.list(
        {
          from: new Date(startAt.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 1 day before
          to: new Date(endAt.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 1 day after
          types: [CalendarEventType.BCP_EXERCISE],
        },
        tenantId,
      );
      const existingEvent = calendarEvents.find(
        (e) => e.source_id === updated.id && e.source_entity === 'BCPExercise',
      );

      // Status: if result exists, it's completed; otherwise planned
      const calendarStatus = updated.result
        ? CalendarEventStatus.COMPLETED
        : CalendarEventStatus.PLANNED;

      if (existingEvent) {
        // Update existing event
        await this.calendarService.update(
          existingEvent.id,
          {
            title: `${updated.code}: ${updated.name}`,
            description: updated.scenario,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: calendarStatus,
          },
          tenantId,
        );
      } else {
        // Create new event if it doesn't exist
        await this.calendarService.create(
          {
            title: `${updated.code}: ${updated.name}`,
            description: updated.scenario,
            event_type: CalendarEventType.BCP_EXERCISE,
            source_module: 'bcm',
            source_entity: 'BCPExercise',
            source_id: updated.id,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: calendarStatus,
          },
          tenantId,
        );
      }
    } catch (error: any) {
      // Log error but don't fail exercise update
      this.logger.warn('Failed to update calendar event for BCP exercise:', error?.message || error);
    }

    return updated;
  }

  async deleteBCPExercise(id: string, tenantId: string) {
    const exercise = await this.getBCPExercise(id, tenantId);
    await this.bcpExerciseRepo.remove(exercise);
    return { success: true, id };
  }
}
