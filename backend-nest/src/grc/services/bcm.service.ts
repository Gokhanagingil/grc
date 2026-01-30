import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BcmService,
  BcmBia,
  BcmPlan,
  BcmPlanStep,
  BcmExercise,
} from '../entities';
import {
  CreateBcmServiceDto,
  UpdateBcmServiceDto,
  BcmServiceFilterDto,
  CreateBcmBiaDto,
  UpdateBcmBiaDto,
  BcmBiaFilterDto,
  CreateBcmPlanDto,
  UpdateBcmPlanDto,
  BcmPlanFilterDto,
  CreateBcmPlanStepDto,
  UpdateBcmPlanStepDto,
  BcmPlanStepFilterDto,
  CreateBcmExerciseDto,
  UpdateBcmExerciseDto,
  BcmExerciseFilterDto,
} from '../dto/bcm.dto';
import { BcmCriticalityTier, BcmBiaStatus, BcmServiceStatus } from '../enums';
import { AuditService } from '../../audit/audit.service';
import { parseFilterJson } from '../../common/list-query/list-query.parser';

/**
 * BCM Service - Business Continuity Management
 *
 * Handles all BCM-related operations including Services, BIAs, Plans, Plan Steps, and Exercises.
 * All operations are tenant-scoped for multi-tenant isolation.
 */
@Injectable()
export class BcmModuleService {
  private readonly serviceSortFields = new Set([
    'createdAt',
    'updatedAt',
    'name',
    'status',
    'criticalityTier',
  ]);

  private readonly biaSortFields = new Set([
    'createdAt',
    'updatedAt',
    'status',
    'criticalityTier',
    'rtoMinutes',
    'rpoMinutes',
    'overallImpactScore',
  ]);

  private readonly planSortFields = new Set([
    'createdAt',
    'updatedAt',
    'name',
    'status',
    'planType',
    'approvedAt',
  ]);

  private readonly planStepSortFields = new Set([
    'createdAt',
    'updatedAt',
    'order',
    'title',
    'status',
    'estimatedMinutes',
  ]);

  private readonly exerciseSortFields = new Set([
    'createdAt',
    'updatedAt',
    'name',
    'status',
    'exerciseType',
    'scheduledAt',
    'completedAt',
    'outcome',
  ]);

  constructor(
    @InjectRepository(BcmService)
    private readonly serviceRepository: Repository<BcmService>,
    @InjectRepository(BcmBia)
    private readonly biaRepository: Repository<BcmBia>,
    @InjectRepository(BcmPlan)
    private readonly planRepository: Repository<BcmPlan>,
    @InjectRepository(BcmPlanStep)
    private readonly planStepRepository: Repository<BcmPlanStep>,
    @InjectRepository(BcmExercise)
    private readonly exerciseRepository: Repository<BcmExercise>,
    private readonly auditService: AuditService,
  ) {}

  // ============================================================================
  // BCM Service Operations
  // ============================================================================

  async createService(
    tenantId: string,
    dto: CreateBcmServiceDto,
    userId: string,
  ): Promise<BcmService> {
    const service = this.serviceRepository.create({
      ...dto,
      tenantId,
      createdBy: userId,
      status: dto.status || BcmServiceStatus.DRAFT,
    });

    const saved = await this.serviceRepository.save(service);
    await this.auditService.recordCreate('BcmService', saved, userId, tenantId);

    return this.findServiceById(tenantId, saved.id);
  }

  async findAllServices(
    tenantId: string,
    filter: BcmServiceFilterDto,
  ): Promise<{ items: BcmService[]; total: number }> {
    const {
      status,
      criticalityTier,
      businessOwnerUserId,
      itOwnerUserId,
      search,
      page = 1,
      pageSize = 20,
      sort,
      filter: filterJson,
    } = filter;

    const queryBuilder = this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.businessOwner', 'businessOwner')
      .leftJoinAndSelect('service.itOwner', 'itOwner')
      .where('service.tenantId = :tenantId', { tenantId })
      .andWhere('service.isDeleted = :isDeleted', { isDeleted: false });

    // Apply advanced filter tree if provided
    if (filterJson) {
      try {
        const parsed = parseFilterJson(filterJson);
        if (parsed.tree) {
          this.applyServiceFilterTree(queryBuilder, parsed.tree);
        }
      } catch (error) {
        throw new BadRequestException({
          message: 'Invalid filter JSON',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Legacy individual filters
    if (status) {
      queryBuilder.andWhere('service.status = :status', { status });
    }
    if (criticalityTier) {
      queryBuilder.andWhere('service.criticalityTier = :criticalityTier', {
        criticalityTier,
      });
    }
    if (businessOwnerUserId) {
      queryBuilder.andWhere(
        'service.businessOwnerUserId = :businessOwnerUserId',
        { businessOwnerUserId },
      );
    }
    if (itOwnerUserId) {
      queryBuilder.andWhere('service.itOwnerUserId = :itOwnerUserId', {
        itOwnerUserId,
      });
    }

    // Search
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(service.name) LIKE LOWER(:search) OR LOWER(service.description) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    // Sorting
    let sortField = 'createdAt';
    let sortOrder: 'ASC' | 'DESC' = 'DESC';
    if (sort) {
      const [field, order] = sort.split(':');
      if (this.serviceSortFields.has(field)) {
        sortField = field;
      }
      if (order?.toUpperCase() === 'ASC' || order?.toUpperCase() === 'DESC') {
        sortOrder = order.toUpperCase() as 'ASC' | 'DESC';
      }
    }

    const [items, total] = await queryBuilder
      .orderBy(`service.${sortField}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findServiceById(tenantId: string, id: string): Promise<BcmService> {
    const service = await this.serviceRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['businessOwner', 'itOwner'],
    });

    if (!service) {
      throw new NotFoundException(`BCM Service with ID ${id} not found`);
    }

    return service;
  }

  async updateService(
    tenantId: string,
    id: string,
    dto: UpdateBcmServiceDto,
    userId: string,
  ): Promise<BcmService> {
    const service = await this.findServiceById(tenantId, id);
    const oldValue = { ...service };

    Object.assign(service, dto, { updatedBy: userId });

    const saved = await this.serviceRepository.save(service);

    await this.auditService.recordUpdate(
      'BcmService',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return this.findServiceById(tenantId, saved.id);
  }

  async deleteService(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const service = await this.findServiceById(tenantId, id);

    service.isDeleted = true;
    service.updatedBy = userId;

    await this.serviceRepository.save(service);
    await this.auditService.recordDelete(
      'BcmService',
      service,
      userId,
      tenantId,
    );
  }

  private applyServiceFilterTree(
    queryBuilder: ReturnType<Repository<BcmService>['createQueryBuilder']>,
    tree: { and?: unknown[]; or?: unknown[] },
  ): void {
    const allowedFields = ['name', 'status', 'criticalityTier', 'createdAt'];
    this.applyGenericFilterTree(queryBuilder, tree, allowedFields, 'service');
  }

  // ============================================================================
  // BCM BIA Operations
  // ============================================================================

  async createBia(
    tenantId: string,
    dto: CreateBcmBiaDto,
    userId: string,
  ): Promise<BcmBia> {
    // Verify service exists
    await this.findServiceById(tenantId, dto.serviceId);

    // Calculate impact score and tier
    const overallImpactScore = this.calculateOverallImpactScore(dto);
    const criticalityTier = this.calculateCriticalityTier(
      overallImpactScore,
      dto.rtoMinutes,
    );

    const bia = this.biaRepository.create({
      ...dto,
      tenantId,
      createdBy: userId,
      overallImpactScore,
      criticalityTier,
      status: dto.status || BcmBiaStatus.DRAFT,
    });

    const saved = await this.biaRepository.save(bia);
    await this.auditService.recordCreate('BcmBia', saved, userId, tenantId);

    return this.findBiaById(tenantId, saved.id);
  }

  async findAllBias(
    tenantId: string,
    filter: BcmBiaFilterDto,
  ): Promise<{ items: BcmBia[]; total: number }> {
    const {
      serviceId,
      status,
      criticalityTier,
      search,
      page = 1,
      pageSize = 20,
      sort,
      filter: filterJson,
    } = filter;

    const queryBuilder = this.biaRepository
      .createQueryBuilder('bia')
      .leftJoinAndSelect('bia.service', 'service')
      .where('bia.tenantId = :tenantId', { tenantId })
      .andWhere('bia.isDeleted = :isDeleted', { isDeleted: false });

    // Apply advanced filter tree if provided
    if (filterJson) {
      try {
        const parsed = parseFilterJson(filterJson);
        if (parsed.tree) {
          this.applyBiaFilterTree(queryBuilder, parsed.tree);
        }
      } catch (error) {
        throw new BadRequestException({
          message: 'Invalid filter JSON',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Legacy individual filters
    if (serviceId) {
      queryBuilder.andWhere('bia.serviceId = :serviceId', { serviceId });
    }
    if (status) {
      queryBuilder.andWhere('bia.status = :status', { status });
    }
    if (criticalityTier) {
      queryBuilder.andWhere('bia.criticalityTier = :criticalityTier', {
        criticalityTier,
      });
    }

    // Search
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(bia.assumptions) LIKE LOWER(:search) OR LOWER(bia.dependencies) LIKE LOWER(:search) OR LOWER(bia.notes) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    // Sorting
    let sortField = 'createdAt';
    let sortOrder: 'ASC' | 'DESC' = 'DESC';
    if (sort) {
      const [field, order] = sort.split(':');
      if (this.biaSortFields.has(field)) {
        sortField = field;
      }
      if (order?.toUpperCase() === 'ASC' || order?.toUpperCase() === 'DESC') {
        sortOrder = order.toUpperCase() as 'ASC' | 'DESC';
      }
    }

    const [items, total] = await queryBuilder
      .orderBy(`bia.${sortField}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findBiaById(tenantId: string, id: string): Promise<BcmBia> {
    const bia = await this.biaRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['service'],
    });

    if (!bia) {
      throw new NotFoundException(`BCM BIA with ID ${id} not found`);
    }

    return bia;
  }

  async findBiasByService(
    tenantId: string,
    serviceId: string,
  ): Promise<BcmBia[]> {
    await this.findServiceById(tenantId, serviceId);

    return this.biaRepository.find({
      where: { serviceId, tenantId, isDeleted: false },
      relations: ['service'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateBia(
    tenantId: string,
    id: string,
    dto: UpdateBcmBiaDto,
    userId: string,
  ): Promise<BcmBia> {
    const bia = await this.findBiaById(tenantId, id);
    const oldValue = { ...bia };

    // Recalculate impact score and tier if relevant fields changed
    const updatedDto = { ...dto };
    if (
      dto.impactOperational !== undefined ||
      dto.impactFinancial !== undefined ||
      dto.impactRegulatory !== undefined ||
      dto.impactReputational !== undefined ||
      dto.rtoMinutes !== undefined
    ) {
      const mergedData = {
        impactOperational: dto.impactOperational ?? bia.impactOperational,
        impactFinancial: dto.impactFinancial ?? bia.impactFinancial,
        impactRegulatory: dto.impactRegulatory ?? bia.impactRegulatory,
        impactReputational: dto.impactReputational ?? bia.impactReputational,
        rtoMinutes: dto.rtoMinutes ?? bia.rtoMinutes,
      };
      const overallImpactScore = this.calculateOverallImpactScore(mergedData);
      const criticalityTier = this.calculateCriticalityTier(
        overallImpactScore,
        mergedData.rtoMinutes,
      );
      Object.assign(updatedDto, { overallImpactScore, criticalityTier });
    }

    Object.assign(bia, updatedDto, { updatedBy: userId });

    const saved = await this.biaRepository.save(bia);

    await this.auditService.recordUpdate(
      'BcmBia',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return this.findBiaById(tenantId, saved.id);
  }

  async deleteBia(tenantId: string, id: string, userId: string): Promise<void> {
    const bia = await this.findBiaById(tenantId, id);

    bia.isDeleted = true;
    bia.updatedBy = userId;

    await this.biaRepository.save(bia);
    await this.auditService.recordDelete('BcmBia', bia, userId, tenantId);
  }

  /**
   * Calculate overall impact score from individual impact fields.
   * Uses simple sum of all impact scores (0-5 each, max 20).
   */
  private calculateOverallImpactScore(data: {
    impactOperational?: number;
    impactFinancial?: number;
    impactRegulatory?: number;
    impactReputational?: number;
  }): number {
    return (
      (data.impactOperational || 0) +
      (data.impactFinancial || 0) +
      (data.impactRegulatory || 0) +
      (data.impactReputational || 0)
    );
  }

  /**
   * Calculate criticality tier based on impact score and RTO.
   *
   * Deterministic tier calculation rules:
   * - TIER_0 (Critical): Impact >= 16 OR RTO <= 60 minutes (1 hour)
   * - TIER_1 (High): Impact >= 12 OR RTO <= 240 minutes (4 hours)
   * - TIER_2 (Medium): Impact >= 8 OR RTO <= 1440 minutes (24 hours)
   * - TIER_3 (Low): Everything else
   */
  private calculateCriticalityTier(
    overallImpactScore: number,
    rtoMinutes: number,
  ): BcmCriticalityTier {
    if (overallImpactScore >= 16 || rtoMinutes <= 60) {
      return BcmCriticalityTier.TIER_0;
    }
    if (overallImpactScore >= 12 || rtoMinutes <= 240) {
      return BcmCriticalityTier.TIER_1;
    }
    if (overallImpactScore >= 8 || rtoMinutes <= 1440) {
      return BcmCriticalityTier.TIER_2;
    }
    return BcmCriticalityTier.TIER_3;
  }

  private applyBiaFilterTree(
    queryBuilder: ReturnType<Repository<BcmBia>['createQueryBuilder']>,
    tree: { and?: unknown[]; or?: unknown[] },
  ): void {
    const allowedFields = [
      'status',
      'criticalityTier',
      'rtoMinutes',
      'rpoMinutes',
      'overallImpactScore',
      'createdAt',
    ];
    this.applyGenericFilterTree(queryBuilder, tree, allowedFields, 'bia');
  }

  // ============================================================================
  // BCM Plan Operations
  // ============================================================================

  async createPlan(
    tenantId: string,
    dto: CreateBcmPlanDto,
    userId: string,
  ): Promise<BcmPlan> {
    // Verify service exists
    await this.findServiceById(tenantId, dto.serviceId);

    const plan = this.planRepository.create({
      ...dto,
      tenantId,
      createdBy: userId,
    });

    const saved = await this.planRepository.save(plan);
    await this.auditService.recordCreate('BcmPlan', saved, userId, tenantId);

    return this.findPlanById(tenantId, saved.id);
  }

  async findAllPlans(
    tenantId: string,
    filter: BcmPlanFilterDto,
  ): Promise<{ items: BcmPlan[]; total: number }> {
    const {
      serviceId,
      planType,
      status,
      ownerUserId,
      search,
      page = 1,
      pageSize = 20,
      sort,
      filter: filterJson,
    } = filter;

    const queryBuilder = this.planRepository
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.service', 'service')
      .leftJoinAndSelect('plan.owner', 'owner')
      .leftJoinAndSelect('plan.approver', 'approver')
      .where('plan.tenantId = :tenantId', { tenantId })
      .andWhere('plan.isDeleted = :isDeleted', { isDeleted: false });

    // Apply advanced filter tree if provided
    if (filterJson) {
      try {
        const parsed = parseFilterJson(filterJson);
        if (parsed.tree) {
          this.applyPlanFilterTree(queryBuilder, parsed.tree);
        }
      } catch (error) {
        throw new BadRequestException({
          message: 'Invalid filter JSON',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Legacy individual filters
    if (serviceId) {
      queryBuilder.andWhere('plan.serviceId = :serviceId', { serviceId });
    }
    if (planType) {
      queryBuilder.andWhere('plan.planType = :planType', { planType });
    }
    if (status) {
      queryBuilder.andWhere('plan.status = :status', { status });
    }
    if (ownerUserId) {
      queryBuilder.andWhere('plan.ownerUserId = :ownerUserId', { ownerUserId });
    }

    // Search
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(plan.name) LIKE LOWER(:search) OR LOWER(plan.summary) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    // Sorting
    let sortField = 'createdAt';
    let sortOrder: 'ASC' | 'DESC' = 'DESC';
    if (sort) {
      const [field, order] = sort.split(':');
      if (this.planSortFields.has(field)) {
        sortField = field;
      }
      if (order?.toUpperCase() === 'ASC' || order?.toUpperCase() === 'DESC') {
        sortOrder = order.toUpperCase() as 'ASC' | 'DESC';
      }
    }

    const [items, total] = await queryBuilder
      .orderBy(`plan.${sortField}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findPlanById(tenantId: string, id: string): Promise<BcmPlan> {
    const plan = await this.planRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['service', 'owner', 'approver', 'steps'],
    });

    if (!plan) {
      throw new NotFoundException(`BCM Plan with ID ${id} not found`);
    }

    return plan;
  }

  async findPlansByService(
    tenantId: string,
    serviceId: string,
  ): Promise<BcmPlan[]> {
    await this.findServiceById(tenantId, serviceId);

    return this.planRepository.find({
      where: { serviceId, tenantId, isDeleted: false },
      relations: ['service', 'owner', 'approver'],
      order: { createdAt: 'DESC' },
    });
  }

  async updatePlan(
    tenantId: string,
    id: string,
    dto: UpdateBcmPlanDto,
    userId: string,
  ): Promise<BcmPlan> {
    const plan = await this.findPlanById(tenantId, id);
    const oldValue = { ...plan };

    Object.assign(plan, dto, { updatedBy: userId });

    const saved = await this.planRepository.save(plan);

    await this.auditService.recordUpdate(
      'BcmPlan',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return this.findPlanById(tenantId, saved.id);
  }

  async deletePlan(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const plan = await this.findPlanById(tenantId, id);

    plan.isDeleted = true;
    plan.updatedBy = userId;

    await this.planRepository.save(plan);
    await this.auditService.recordDelete('BcmPlan', plan, userId, tenantId);
  }

  private applyPlanFilterTree(
    queryBuilder: ReturnType<Repository<BcmPlan>['createQueryBuilder']>,
    tree: { and?: unknown[]; or?: unknown[] },
  ): void {
    const allowedFields = [
      'name',
      'status',
      'planType',
      'approvedAt',
      'createdAt',
    ];
    this.applyGenericFilterTree(queryBuilder, tree, allowedFields, 'plan');
  }

  // ============================================================================
  // BCM Plan Step Operations
  // ============================================================================

  async createPlanStep(
    tenantId: string,
    dto: CreateBcmPlanStepDto,
    userId: string,
  ): Promise<BcmPlanStep> {
    // Verify plan exists
    await this.findPlanById(tenantId, dto.planId);

    const step = this.planStepRepository.create({
      ...dto,
      tenantId,
      createdBy: userId,
    });

    const saved = await this.planStepRepository.save(step);
    await this.auditService.recordCreate(
      'BcmPlanStep',
      saved,
      userId,
      tenantId,
    );

    return this.findPlanStepById(tenantId, saved.id);
  }

  async findAllPlanSteps(
    tenantId: string,
    filter: BcmPlanStepFilterDto,
  ): Promise<{ items: BcmPlanStep[]; total: number }> {
    const { planId, status, search, page = 1, pageSize = 20, sort } = filter;

    const queryBuilder = this.planStepRepository
      .createQueryBuilder('step')
      .leftJoinAndSelect('step.plan', 'plan')
      .where('step.tenantId = :tenantId', { tenantId })
      .andWhere('step.isDeleted = :isDeleted', { isDeleted: false });

    // Legacy individual filters
    if (planId) {
      queryBuilder.andWhere('step.planId = :planId', { planId });
    }
    if (status) {
      queryBuilder.andWhere('step.status = :status', { status });
    }

    // Search
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(step.title) LIKE LOWER(:search) OR LOWER(step.description) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    // Sorting
    let sortField = 'order';
    let sortOrder: 'ASC' | 'DESC' = 'ASC';
    if (sort) {
      const [field, order] = sort.split(':');
      if (this.planStepSortFields.has(field)) {
        sortField = field;
      }
      if (order?.toUpperCase() === 'ASC' || order?.toUpperCase() === 'DESC') {
        sortOrder = order.toUpperCase() as 'ASC' | 'DESC';
      }
    }

    const [items, total] = await queryBuilder
      .orderBy(`step.${sortField}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findPlanStepById(tenantId: string, id: string): Promise<BcmPlanStep> {
    const step = await this.planStepRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['plan'],
    });

    if (!step) {
      throw new NotFoundException(`BCM Plan Step with ID ${id} not found`);
    }

    return step;
  }

  async findStepsByPlan(
    tenantId: string,
    planId: string,
  ): Promise<BcmPlanStep[]> {
    await this.findPlanById(tenantId, planId);

    return this.planStepRepository.find({
      where: { planId, tenantId, isDeleted: false },
      order: { order: 'ASC' },
    });
  }

  async updatePlanStep(
    tenantId: string,
    id: string,
    dto: UpdateBcmPlanStepDto,
    userId: string,
  ): Promise<BcmPlanStep> {
    const step = await this.findPlanStepById(tenantId, id);
    const oldValue = { ...step };

    Object.assign(step, dto, { updatedBy: userId });

    const saved = await this.planStepRepository.save(step);

    await this.auditService.recordUpdate(
      'BcmPlanStep',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return this.findPlanStepById(tenantId, saved.id);
  }

  async deletePlanStep(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const step = await this.findPlanStepById(tenantId, id);

    step.isDeleted = true;
    step.updatedBy = userId;

    await this.planStepRepository.save(step);
    await this.auditService.recordDelete('BcmPlanStep', step, userId, tenantId);
  }

  // ============================================================================
  // BCM Exercise Operations
  // ============================================================================

  async createExercise(
    tenantId: string,
    dto: CreateBcmExerciseDto,
    userId: string,
  ): Promise<BcmExercise> {
    // Verify service exists
    await this.findServiceById(tenantId, dto.serviceId);

    // Verify plan exists if provided
    if (dto.planId) {
      await this.findPlanById(tenantId, dto.planId);
    }

    const exercise = this.exerciseRepository.create({
      ...dto,
      tenantId,
      createdBy: userId,
    });

    const saved = await this.exerciseRepository.save(exercise);
    await this.auditService.recordCreate(
      'BcmExercise',
      saved,
      userId,
      tenantId,
    );

    return this.findExerciseById(tenantId, saved.id);
  }

  async findAllExercises(
    tenantId: string,
    filter: BcmExerciseFilterDto,
  ): Promise<{ items: BcmExercise[]; total: number }> {
    const {
      serviceId,
      planId,
      exerciseType,
      status,
      outcome,
      scheduledFrom,
      scheduledTo,
      search,
      page = 1,
      pageSize = 20,
      sort,
      filter: filterJson,
    } = filter;

    const queryBuilder = this.exerciseRepository
      .createQueryBuilder('exercise')
      .leftJoinAndSelect('exercise.service', 'service')
      .leftJoinAndSelect('exercise.plan', 'plan')
      .where('exercise.tenantId = :tenantId', { tenantId })
      .andWhere('exercise.isDeleted = :isDeleted', { isDeleted: false });

    // Apply advanced filter tree if provided
    if (filterJson) {
      try {
        const parsed = parseFilterJson(filterJson);
        if (parsed.tree) {
          this.applyExerciseFilterTree(queryBuilder, parsed.tree);
        }
      } catch (error) {
        throw new BadRequestException({
          message: 'Invalid filter JSON',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Legacy individual filters
    if (serviceId) {
      queryBuilder.andWhere('exercise.serviceId = :serviceId', { serviceId });
    }
    if (planId) {
      queryBuilder.andWhere('exercise.planId = :planId', { planId });
    }
    if (exerciseType) {
      queryBuilder.andWhere('exercise.exerciseType = :exerciseType', {
        exerciseType,
      });
    }
    if (status) {
      queryBuilder.andWhere('exercise.status = :status', { status });
    }
    if (outcome) {
      queryBuilder.andWhere('exercise.outcome = :outcome', { outcome });
    }
    if (scheduledFrom) {
      queryBuilder.andWhere('exercise.scheduledAt >= :scheduledFrom', {
        scheduledFrom,
      });
    }
    if (scheduledTo) {
      queryBuilder.andWhere('exercise.scheduledAt <= :scheduledTo', {
        scheduledTo,
      });
    }

    // Search
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(exercise.name) LIKE LOWER(:search) OR LOWER(exercise.summary) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    // Sorting
    let sortField = 'createdAt';
    let sortOrder: 'ASC' | 'DESC' = 'DESC';
    if (sort) {
      const [field, order] = sort.split(':');
      if (this.exerciseSortFields.has(field)) {
        sortField = field;
      }
      if (order?.toUpperCase() === 'ASC' || order?.toUpperCase() === 'DESC') {
        sortOrder = order.toUpperCase() as 'ASC' | 'DESC';
      }
    }

    const [items, total] = await queryBuilder
      .orderBy(`exercise.${sortField}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findExerciseById(tenantId: string, id: string): Promise<BcmExercise> {
    const exercise = await this.exerciseRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['service', 'plan'],
    });

    if (!exercise) {
      throw new NotFoundException(`BCM Exercise with ID ${id} not found`);
    }

    return exercise;
  }

  async findExercisesByService(
    tenantId: string,
    serviceId: string,
  ): Promise<BcmExercise[]> {
    await this.findServiceById(tenantId, serviceId);

    return this.exerciseRepository.find({
      where: { serviceId, tenantId, isDeleted: false },
      relations: ['service', 'plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateExercise(
    tenantId: string,
    id: string,
    dto: UpdateBcmExerciseDto,
    userId: string,
  ): Promise<BcmExercise> {
    const exercise = await this.findExerciseById(tenantId, id);
    const oldValue = { ...exercise };

    // Verify plan exists if being updated
    if (dto.planId) {
      await this.findPlanById(tenantId, dto.planId);
    }

    Object.assign(exercise, dto, { updatedBy: userId });

    const saved = await this.exerciseRepository.save(exercise);

    await this.auditService.recordUpdate(
      'BcmExercise',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return this.findExerciseById(tenantId, saved.id);
  }

  async deleteExercise(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const exercise = await this.findExerciseById(tenantId, id);

    exercise.isDeleted = true;
    exercise.updatedBy = userId;

    await this.exerciseRepository.save(exercise);
    await this.auditService.recordDelete(
      'BcmExercise',
      exercise,
      userId,
      tenantId,
    );
  }

  private applyExerciseFilterTree(
    queryBuilder: ReturnType<Repository<BcmExercise>['createQueryBuilder']>,
    tree: { and?: unknown[]; or?: unknown[] },
  ): void {
    const allowedFields = [
      'name',
      'status',
      'exerciseType',
      'outcome',
      'scheduledAt',
      'completedAt',
      'createdAt',
    ];
    this.applyGenericFilterTree(queryBuilder, tree, allowedFields, 'exercise');
  }

  // ============================================================================
  // Generic Filter Tree Helper
  // ============================================================================

  private applyGenericFilterTree(
    queryBuilder: ReturnType<Repository<unknown>['createQueryBuilder']>,
    tree: { and?: unknown[]; or?: unknown[] },
    allowedFields: string[],
    alias: string,
  ): void {
    const buildCondition = (
      condition: { field: string; op: string; value: unknown },
      paramIndex: number,
    ): { sql: string; params: Record<string, unknown> } | null => {
      if (!allowedFields.includes(condition.field)) {
        return null;
      }

      const paramName = `filter_${paramIndex}`;
      const fieldRef = `${alias}.${condition.field}`;

      switch (condition.op) {
        case 'is':
        case 'eq':
          return {
            sql: `${fieldRef} = :${paramName}`,
            params: { [paramName]: condition.value },
          };
        case 'is_not':
        case 'neq':
          return {
            sql: `${fieldRef} != :${paramName}`,
            params: { [paramName]: condition.value },
          };
        case 'contains':
          return {
            sql: `LOWER(${fieldRef}) LIKE LOWER(:${paramName})`,
            params: { [paramName]: `%${String(condition.value)}%` },
          };
        case 'gt':
          return {
            sql: `${fieldRef} > :${paramName}`,
            params: { [paramName]: condition.value },
          };
        case 'gte':
          return {
            sql: `${fieldRef} >= :${paramName}`,
            params: { [paramName]: condition.value },
          };
        case 'lt':
          return {
            sql: `${fieldRef} < :${paramName}`,
            params: { [paramName]: condition.value },
          };
        case 'lte':
          return {
            sql: `${fieldRef} <= :${paramName}`,
            params: { [paramName]: condition.value },
          };
        case 'in':
          return {
            sql: `${fieldRef} IN (:...${paramName})`,
            params: { [paramName]: condition.value },
          };
        default:
          return null;
      }
    };

    let paramCounter = 0;

    const processGroup = (group: {
      and?: unknown[];
      or?: unknown[];
    }): { sql: string; params: Record<string, unknown> } | null => {
      const conditions: { sql: string; params: Record<string, unknown> }[] = [];

      const items = group.and || group.or || [];
      const operator = group.and ? ' AND ' : ' OR ';

      for (const item of items) {
        const typedItem = item as {
          field?: string;
          op?: string;
          value?: unknown;
          and?: unknown[];
          or?: unknown[];
        };
        if (typedItem.field && typedItem.op) {
          const result = buildCondition(
            typedItem as { field: string; op: string; value: unknown },
            paramCounter++,
          );
          if (result) {
            conditions.push(result);
          }
        } else if (typedItem.and || typedItem.or) {
          const nested = processGroup(typedItem);
          if (nested) {
            conditions.push(nested);
          }
        }
      }

      if (conditions.length === 0) {
        return null;
      }

      const sql = conditions.map((c) => `(${c.sql})`).join(operator);
      const params = conditions.reduce(
        (acc, c) => ({ ...acc, ...c.params }),
        {},
      );

      return { sql, params };
    };

    const result = processGroup(tree);
    if (result) {
      queryBuilder.andWhere(`(${result.sql})`, result.params);
    }
  }
}
