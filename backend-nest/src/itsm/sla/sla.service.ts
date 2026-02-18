import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { AuditService } from '../../audit/audit.service';
import { SlaDefinition } from './sla-definition.entity';
import { SlaInstance, SlaInstanceStatus } from './sla-instance.entity';
import { SlaEngineService } from './sla-engine.service';
import {
  SlaDefinitionFilterDto,
  SLA_DEFINITION_SORTABLE_FIELDS,
  SlaInstanceFilterDto,
  SLA_INSTANCE_SORTABLE_FIELDS,
} from './dto/sla-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';

@Injectable()
export class SlaService extends MultiTenantServiceBase<SlaDefinition> {
  constructor(
    @InjectRepository(SlaDefinition)
    repository: Repository<SlaDefinition>,
    @InjectRepository(SlaInstance)
    private readonly instanceRepository: Repository<SlaInstance>,
    private readonly engine: SlaEngineService,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  async findDefinitionById(
    tenantId: string,
    id: string,
  ): Promise<SlaDefinition | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async createDefinition(
    tenantId: string,
    userId: string,
    data: Partial<
      Omit<
        SlaDefinition,
        'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >
    >,
  ): Promise<SlaDefinition> {
    const definition = await this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'SlaDefinition',
      definition,
      userId,
      tenantId,
    );

    return definition;
  }

  async updateDefinition(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Omit<SlaDefinition, 'id' | 'tenantId' | 'isDeleted'>>,
  ): Promise<SlaDefinition | null> {
    const existing = await this.findDefinitionById(tenantId, id);
    if (!existing) return null;

    const definition = await this.updateForTenant(tenantId, id, {
      ...data,
      updatedBy: userId,
    });

    if (definition) {
      await this.auditService?.recordUpdate(
        'SlaDefinition',
        id,
        existing as unknown as Record<string, unknown>,
        definition as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return definition;
  }

  async softDeleteDefinition(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findDefinitionById(tenantId, id);
    if (!existing) return false;

    await this.updateForTenant(tenantId, id, {
      isDeleted: true,
      updatedBy: userId,
    } as Partial<Omit<SlaDefinition, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'SlaDefinition',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  async findDefinitionsWithFilters(
    tenantId: string,
    filterDto: SlaDefinitionFilterDto,
  ): Promise<PaginatedResponse<SlaDefinition>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'order',
      sortOrder = 'ASC',
      search,
      metric,
      schedule,
      isActive,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('def');
    qb.where('def.tenantId = :tenantId', { tenantId });
    qb.andWhere('def.isDeleted = :isDeleted', { isDeleted: false });

    if (search) {
      qb.andWhere('(def.name ILIKE :search OR def.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (metric) {
      qb.andWhere('def.metric = :metric', { metric });
    }

    if (schedule) {
      qb.andWhere('def.schedule = :schedule', { schedule });
    }

    if (isActive !== undefined) {
      qb.andWhere('def.isActive = :isActive', { isActive });
    }

    const total = await qb.getCount();

    const validSortBy = SLA_DEFINITION_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'order';
    const validSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    qb.orderBy(`def.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async startSlaForRecord(
    tenantId: string,
    recordType: string,
    recordId: string,
    priority: string | undefined,
    serviceId: string | undefined,
    now?: Date,
  ): Promise<SlaInstance[]> {
    const startAt = now || new Date();
    const definitions = await this.repository.find({
      where: { tenantId, isActive: true, isDeleted: false },
      order: { order: 'ASC' },
    });

    const instances: SlaInstance[] = [];
    for (const def of definitions) {
      if (!this.engine.shouldApply(def, priority, serviceId)) continue;

      const existing = await this.instanceRepository.findOne({
        where: {
          tenantId,
          recordType,
          recordId,
          definitionId: def.id,
          status: SlaInstanceStatus.IN_PROGRESS,
        },
      });
      if (existing) continue;

      const dueAt = this.engine.computeDueAt(def, startAt);
      const remaining = this.engine.computeRemainingSeconds(def, 0);

      const instance = this.instanceRepository.create({
        tenantId,
        recordType,
        recordId,
        definitionId: def.id,
        startAt,
        dueAt,
        breached: false,
        elapsedSeconds: 0,
        remainingSeconds: remaining,
        pausedDurationSeconds: 0,
        status: SlaInstanceStatus.IN_PROGRESS,
        isDeleted: false,
      });

      instances.push(await this.instanceRepository.save(instance));
    }

    return instances;
  }

  async evaluateOnStateChange(
    tenantId: string,
    recordType: string,
    recordId: string,
    newState: string,
    now?: Date,
  ): Promise<SlaInstance[]> {
    const currentTime = now || new Date();

    const activeInstances = await this.instanceRepository.find({
      where: [
        {
          tenantId,
          recordType,
          recordId,
          status: SlaInstanceStatus.IN_PROGRESS,
        },
        {
          tenantId,
          recordType,
          recordId,
          status: SlaInstanceStatus.PAUSED,
        },
      ],
      relations: ['definition'],
    });

    const updated: SlaInstance[] = [];
    for (const instance of activeInstances) {
      const def = instance.definition;

      if (this.engine.shouldStop(def, newState)) {
        const elapsed = this.engine.computeElapsedSeconds(
          def,
          instance.startAt,
          currentTime,
          instance.pausedDurationSeconds,
        );
        const breached = this.engine.isBreached(def, elapsed);

        instance.stopAt = currentTime;
        instance.elapsedSeconds = elapsed;
        instance.remainingSeconds = this.engine.computeRemainingSeconds(
          def,
          elapsed,
        );
        instance.breached = breached;
        instance.status = breached
          ? SlaInstanceStatus.BREACHED
          : SlaInstanceStatus.MET;

        updated.push(await this.instanceRepository.save(instance));
        continue;
      }

      if (this.engine.shouldPause(def, newState)) {
        if (instance.status === SlaInstanceStatus.IN_PROGRESS) {
          instance.pauseAt = currentTime;
          instance.status = SlaInstanceStatus.PAUSED;
          updated.push(await this.instanceRepository.save(instance));
        }
        continue;
      }

      if (instance.status === SlaInstanceStatus.PAUSED && instance.pauseAt) {
        const pausedSeconds = Math.floor(
          (currentTime.getTime() - instance.pauseAt.getTime()) / 1000,
        );
        instance.pausedDurationSeconds += pausedSeconds;
        instance.pauseAt = null;
        instance.status = SlaInstanceStatus.IN_PROGRESS;

        const elapsed = this.engine.computeElapsedSeconds(
          def,
          instance.startAt,
          currentTime,
          instance.pausedDurationSeconds,
        );
        instance.elapsedSeconds = elapsed;
        instance.remainingSeconds = this.engine.computeRemainingSeconds(
          def,
          elapsed,
        );
        instance.breached = this.engine.isBreached(def, elapsed);
        if (instance.breached) {
          instance.status = SlaInstanceStatus.BREACHED;
          instance.stopAt = currentTime;
        }

        updated.push(await this.instanceRepository.save(instance));
        continue;
      }

      if (instance.status === SlaInstanceStatus.IN_PROGRESS) {
        const elapsed = this.engine.computeElapsedSeconds(
          def,
          instance.startAt,
          currentTime,
          instance.pausedDurationSeconds,
        );
        instance.elapsedSeconds = elapsed;
        instance.remainingSeconds = this.engine.computeRemainingSeconds(
          def,
          elapsed,
        );
        instance.breached = this.engine.isBreached(def, elapsed);
        if (instance.breached) {
          instance.status = SlaInstanceStatus.BREACHED;
          instance.stopAt = currentTime;
        }

        updated.push(await this.instanceRepository.save(instance));
      }
    }

    return updated;
  }

  async recomputeInstance(
    tenantId: string,
    instanceId: string,
    now?: Date,
  ): Promise<SlaInstance | null> {
    const currentTime = now || new Date();

    const instance = await this.instanceRepository.findOne({
      where: { id: instanceId, tenantId },
      relations: ['definition'],
    });
    if (!instance) return null;

    if (
      instance.status === SlaInstanceStatus.MET ||
      instance.status === SlaInstanceStatus.CANCELLED
    ) {
      return instance;
    }

    const def = instance.definition;
    const elapsed = this.engine.computeElapsedSeconds(
      def,
      instance.startAt,
      instance.stopAt || currentTime,
      instance.pausedDurationSeconds,
    );

    instance.elapsedSeconds = elapsed;
    instance.remainingSeconds = this.engine.computeRemainingSeconds(
      def,
      elapsed,
    );
    instance.breached = this.engine.isBreached(def, elapsed);

    if (
      instance.breached &&
      instance.status === SlaInstanceStatus.IN_PROGRESS
    ) {
      instance.status = SlaInstanceStatus.BREACHED;
      instance.stopAt = currentTime;
    }

    return this.instanceRepository.save(instance);
  }

  async getInstancesForRecord(
    tenantId: string,
    recordType: string,
    recordId: string,
  ): Promise<SlaInstance[]> {
    return this.instanceRepository.find({
      where: { tenantId, recordType, recordId, isDeleted: false },
      relations: ['definition'],
      order: { createdAt: 'DESC' },
    });
  }

  async findInstancesWithFilters(
    tenantId: string,
    filterDto: SlaInstanceFilterDto,
  ): Promise<PaginatedResponse<SlaInstance>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      recordId,
      recordType,
      definitionId,
      status,
      breached,
    } = filterDto;

    const qb = this.instanceRepository.createQueryBuilder('inst');
    qb.leftJoinAndSelect('inst.definition', 'def');
    qb.where('inst.tenantId = :tenantId', { tenantId });
    qb.andWhere('inst.isDeleted = :isDeleted', { isDeleted: false });

    if (recordId) {
      qb.andWhere('inst.recordId = :recordId', { recordId });
    }
    if (recordType) {
      qb.andWhere('inst.recordType = :recordType', { recordType });
    }
    if (definitionId) {
      qb.andWhere('inst.definitionId = :definitionId', { definitionId });
    }
    if (status) {
      qb.andWhere('inst.status = :status', { status });
    }
    if (breached !== undefined) {
      qb.andWhere('inst.breached = :breached', { breached });
    }

    const total = await qb.getCount();

    const validSortBy = SLA_INSTANCE_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`inst.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }
}
