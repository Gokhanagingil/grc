import { Injectable, Optional, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { AuditService } from '../../audit/audit.service';
import { SlaDefinition } from './sla-definition.entity';
import { SlaInstance, SlaInstanceStatus } from './sla-instance.entity';
import { SlaEngineService } from './sla-engine.service';
import { RuntimeLoggerService } from '../diagnostics/runtime-logger.service';
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
import { matchPolicies, SlaMatchResult } from './condition/sla-policy-matcher';
import { validateConditionTree, ValidationResult } from './condition/sla-condition-validator';
import { RecordContext } from './condition/sla-condition-evaluator';

@Injectable()
export class SlaService extends MultiTenantServiceBase<SlaDefinition> {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    @InjectRepository(SlaDefinition)
    repository: Repository<SlaDefinition>,
    @InjectRepository(SlaInstance)
    private readonly instanceRepository: Repository<SlaInstance>,
    private readonly engine: SlaEngineService,
    private readonly runtimeLogger: RuntimeLoggerService,
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
      appliesToRecordType,
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

    if (appliesToRecordType) {
      qb.andWhere('def.appliesToRecordType = :appliesToRecordType', {
        appliesToRecordType,
      });
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

      const saved = await this.instanceRepository.save(instance);
      instances.push(saved);

      this.runtimeLogger.logSlaEvent({
        tenantId,
        definitionName: def.name,
        recordType,
        recordId,
        event: 'started',
      });
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

        this.runtimeLogger.logSlaEvent({
          tenantId,
          definitionName: def.name,
          recordType,
          recordId,
          event: breached ? 'breached' : 'met',
          elapsedSeconds: elapsed,
        });
        continue;
      }

      if (this.engine.shouldPause(def, newState)) {
        if (instance.status === SlaInstanceStatus.IN_PROGRESS) {
          instance.pauseAt = currentTime;
          instance.status = SlaInstanceStatus.PAUSED;
          updated.push(await this.instanceRepository.save(instance));

          this.runtimeLogger.logSlaEvent({
            tenantId,
            definitionName: def.name,
            recordType,
            recordId,
            event: 'paused',
          });
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

  async getBreachSummary(
    tenantId: string,
    recordType?: string,
  ): Promise<{
    total: number;
    inProgress: number;
    breached: number;
    met: number;
    paused: number;
    breachingSoon: {
      instanceId: string;
      recordType: string;
      recordId: string;
      definitionName: string;
      remainingSeconds: number;
    }[];
  }> {
    const baseWhere: Record<string, unknown> = {
      tenantId,
      isDeleted: false,
    };
    if (recordType) {
      baseWhere.recordType = recordType;
    }

    const allInstances = await this.instanceRepository.find({
      where: baseWhere,
      relations: ['definition'],
      order: { createdAt: 'DESC' },
    });

    const total = allInstances.length;
    let inProgress = 0;
    let breached = 0;
    let met = 0;
    let paused = 0;
    const breachingSoon: {
      instanceId: string;
      recordType: string;
      recordId: string;
      definitionName: string;
      remainingSeconds: number;
    }[] = [];

    const BREACH_SOON_THRESHOLD = 900;

    for (const inst of allInstances) {
      switch (inst.status) {
        case SlaInstanceStatus.IN_PROGRESS:
          inProgress++;
          if (
            inst.remainingSeconds !== null &&
            inst.remainingSeconds <= BREACH_SOON_THRESHOLD &&
            inst.remainingSeconds > 0
          ) {
            breachingSoon.push({
              instanceId: inst.id,
              recordType: inst.recordType,
              recordId: inst.recordId,
              definitionName: inst.definition?.name || 'Unknown',
              remainingSeconds: inst.remainingSeconds,
            });
          }
          break;
        case SlaInstanceStatus.BREACHED:
          breached++;
          break;
        case SlaInstanceStatus.MET:
          met++;
          break;
        case SlaInstanceStatus.PAUSED:
          paused++;
          break;
      }
    }

    breachingSoon.sort((a, b) => a.remainingSeconds - b.remainingSeconds);

    return { total, inProgress, breached, met, paused, breachingSoon };
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

  // ── SLA Engine 2.0 Methods ──────────────────────────────────────

  /**
   * Validate a condition tree structure (server-side).
   */
  validateConditionTree(
    conditionTree: unknown,
    recordType: string = 'INCIDENT',
  ): ValidationResult {
    return validateConditionTree(conditionTree, recordType);
  }

  /**
   * Evaluate SLA v2 policies against a record context.
   * Returns the match result with explainable output.
   */
  async evaluateV2(
    tenantId: string,
    recordType: string,
    context: RecordContext,
  ): Promise<SlaMatchResult> {
    const definitions = await this.repository.find({
      where: {
        tenantId,
        isActive: true,
        isDeleted: false,
        appliesToRecordType: recordType,
      },
      order: { priorityWeight: 'DESC', order: 'ASC' },
    });

    return matchPolicies(definitions, context);
  }

  /**
   * Start SLA v2 for a record using the condition-based matching engine.
   * Creates SLA instances for the winning policy's objective types.
   * Falls back to v1 logic if no v2 policies match.
   */
  async startSlaV2ForRecord(
    tenantId: string,
    recordType: string,
    recordId: string,
    context: RecordContext,
    now?: Date,
  ): Promise<SlaInstance[]> {
    const startAt = now || new Date();

    try {
      // Attempt v2 matching
      const matchResult = await this.evaluateV2(tenantId, 'INCIDENT', context);

      if (matchResult.matched && matchResult.selectedPolicy) {
        return this.applyV2Match(
          tenantId,
          recordType,
          recordId,
          matchResult,
          startAt,
        );
      }

      // Fall back to v1 matching if no v2 policies matched
      this.logger.debug(
        `No v2 SLA policy matched for ${recordType}/${recordId}, falling back to v1`,
      );
      return this.startSlaForRecord(
        tenantId,
        recordType,
        recordId,
        context.priority as string | undefined,
        context.serviceId as string | undefined,
        startAt,
      );
    } catch (err) {
      // Failure safety: SLA evaluation must not crash incident save path
      this.logger.error(
        `SLA v2 evaluation failed for ${recordType}/${recordId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return [];
    }
  }

  /**
   * Apply a v2 match result: create SLA instances for response + resolution.
   */
  private async applyV2Match(
    tenantId: string,
    recordType: string,
    recordId: string,
    matchResult: SlaMatchResult,
    startAt: Date,
  ): Promise<SlaInstance[]> {
    const policy = matchResult.selectedPolicy!;
    const instances: SlaInstance[] = [];

    // Snapshot for auditability
    const snapshot = {
      policyId: policy.id,
      policyName: policy.name,
      priorityWeight: policy.priorityWeight,
      conditionTree: policy.conditionTree,
      responseTimeSeconds: matchResult.responseTimeSeconds,
      resolutionTimeSeconds: matchResult.resolutionTimeSeconds,
      matchedAt: startAt.toISOString(),
    };

    // Response SLA instance
    if (matchResult.responseTimeSeconds && matchResult.responseTimeSeconds > 0) {
      const inst = await this.createV2Instance(
        tenantId,
        recordType,
        recordId,
        policy,
        'RESPONSE',
        matchResult.responseTimeSeconds,
        startAt,
        snapshot,
        matchResult.matchReason,
      );
      if (inst) instances.push(inst);
    }

    // Resolution SLA instance
    if (
      matchResult.resolutionTimeSeconds &&
      matchResult.resolutionTimeSeconds > 0
    ) {
      const inst = await this.createV2Instance(
        tenantId,
        recordType,
        recordId,
        policy,
        'RESOLUTION',
        matchResult.resolutionTimeSeconds,
        startAt,
        snapshot,
        matchResult.matchReason,
      );
      if (inst) instances.push(inst);
    }

    return instances;
  }

  /**
   * Create a single v2 SLA instance, preventing duplicates.
   */
  private async createV2Instance(
    tenantId: string,
    recordType: string,
    recordId: string,
    policy: SlaDefinition,
    objectiveType: string,
    targetSeconds: number,
    startAt: Date,
    snapshot: Record<string, unknown>,
    matchReason: string,
  ): Promise<SlaInstance | null> {
    // Check for existing active instance of same objective type
    const existing = await this.instanceRepository.findOne({
      where: {
        tenantId,
        recordType,
        recordId,
        objectiveType,
        status: SlaInstanceStatus.IN_PROGRESS,
      },
    });
    if (existing) return null;

    const dueAt = new Date(startAt.getTime() + targetSeconds * 1000);

    const instance = this.instanceRepository.create({
      tenantId,
      recordType,
      recordId,
      definitionId: policy.id,
      objectiveType,
      startAt,
      dueAt,
      breached: false,
      elapsedSeconds: 0,
      remainingSeconds: targetSeconds,
      pausedDurationSeconds: 0,
      status: SlaInstanceStatus.IN_PROGRESS,
      matchedPolicySnapshot: snapshot,
      matchReason,
      isDeleted: false,
    });

    const saved = await this.instanceRepository.save(instance);

    this.runtimeLogger.logSlaEvent({
      tenantId,
      definitionName: policy.name,
      recordType,
      recordId,
      event: `started-v2-${objectiveType.toLowerCase()}`,
    });

    return saved;
  }

  /**
   * Re-evaluate SLA v2 for a record when matching fields change.
   * Cancels current active instances and re-applies.
   */
  async reEvaluateV2(
    tenantId: string,
    recordType: string,
    recordId: string,
    context: RecordContext,
    now?: Date,
  ): Promise<SlaInstance[]> {
    const currentTime = now || new Date();

    try {
      // Cancel existing active v2 instances for this record
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
      });

      for (const inst of activeInstances) {
        inst.status = SlaInstanceStatus.CANCELLED;
        inst.stopAt = currentTime;
        await this.instanceRepository.save(inst);
      }

      // Re-apply using v2
      return this.startSlaV2ForRecord(
        tenantId,
        recordType,
        recordId,
        context,
        currentTime,
      );
    } catch (err) {
      this.logger.error(
        `SLA v2 re-evaluation failed for ${recordType}/${recordId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return [];
    }
  }
}
