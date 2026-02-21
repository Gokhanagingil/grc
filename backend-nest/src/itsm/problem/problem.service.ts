import {
  Injectable,
  Optional,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { ItsmProblem } from './problem.entity';
import { ItsmProblemIncident } from './problem-incident.entity';
import { ItsmProblemChange } from './problem-change.entity';
import { ItsmIncident } from '../incident/incident.entity';
import { ItsmChange } from '../change/change.entity';
import { CmdbService as CmdbServiceEntity } from '../cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../cmdb/service-offering/cmdb-service-offering.entity';
import {
  ProblemState,
  ProblemImpact,
  ProblemUrgency,
  ProblemIncidentLinkType,
  ProblemChangeLinkType,
  IncidentStatus,
  calculateProblemPriority,
} from '../enums';
import {
  ProblemFilterDto,
  PROBLEM_SORTABLE_FIELDS,
} from './dto/problem-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';

/**
 * ITSM Problem Service
 *
 * Multi-tenant service for managing problems.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 * Implements soft delete - deleted records are marked with isDeleted=true.
 */
@Injectable()
export class ProblemService extends MultiTenantServiceBase<ItsmProblem> {
  constructor(
    @InjectRepository(ItsmProblem)
    repository: Repository<ItsmProblem>,
    @InjectRepository(ItsmProblemIncident)
    private readonly problemIncidentRepo: Repository<ItsmProblemIncident>,
    @InjectRepository(ItsmProblemChange)
    private readonly problemChangeRepo: Repository<ItsmProblemChange>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
    @Optional()
    @InjectRepository(ItsmIncident)
    private readonly incidentRepo?: Repository<ItsmIncident>,
    @Optional()
    @InjectRepository(ItsmChange)
    private readonly changeRepo?: Repository<ItsmChange>,
    @Optional()
    @InjectRepository(CmdbServiceEntity)
    private readonly cmdbServiceRepo?: Repository<CmdbServiceEntity>,
    @Optional()
    @InjectRepository(CmdbServiceOffering)
    private readonly cmdbOfferingRepo?: Repository<CmdbServiceOffering>,
  ) {
    super(repository);
  }

  // ============================================================================
  // Service/Offering Validation
  // ============================================================================

  private async validateServiceOffering(
    tenantId: string,
    serviceId?: string | null,
    offeringId?: string | null,
  ): Promise<void> {
    if (offeringId && !serviceId) {
      throw new BadRequestException(
        'serviceId is required when offeringId is provided',
      );
    }

    if (serviceId && this.cmdbServiceRepo) {
      const svc = await this.cmdbServiceRepo.findOne({
        where: { id: serviceId, tenantId, isDeleted: false },
      });
      if (!svc) {
        throw new NotFoundException(
          `Service with ID ${serviceId} not found in this tenant`,
        );
      }
    }

    if (offeringId && this.cmdbOfferingRepo) {
      const off = await this.cmdbOfferingRepo.findOne({
        where: { id: offeringId, tenantId, isDeleted: false },
      });
      if (!off) {
        throw new NotFoundException(
          `Offering with ID ${offeringId} not found in this tenant`,
        );
      }
      if (serviceId && off.serviceId !== serviceId) {
        throw new BadRequestException(
          `Offering ${offeringId} does not belong to service ${serviceId}`,
        );
      }
    }
  }

  // ============================================================================
  // Number Generation
  // ============================================================================

  private async generateProblemNumber(tenantId: string): Promise<string> {
    const result = await this.repository
      .createQueryBuilder('problem')
      .select('MAX(problem.number)', 'maxNumber')
      .where('problem.tenantId = :tenantId', { tenantId })
      .getRawOne<{ maxNumber: string | null }>();

    let nextNumber = 1;
    if (result?.maxNumber) {
      const currentNumber = parseInt(result.maxNumber.replace('PRB', ''), 10);
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }

    return `PRB${nextNumber.toString().padStart(6, '0')}`;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  async createProblem(
    tenantId: string,
    userId: string,
    data: Partial<ItsmProblem>,
  ): Promise<ItsmProblem> {
    await this.validateServiceOffering(
      tenantId,
      data.serviceId,
      data.offeringId,
    );

    const number = await this.generateProblemNumber(tenantId);
    const impact = data.impact || ProblemImpact.MEDIUM;
    const urgency = data.urgency || ProblemUrgency.MEDIUM;
    const priority = calculateProblemPriority(impact, urgency);

    const problem = await this.createForTenant(tenantId, {
      ...data,
      number,
      priority,
      openedAt: data.openedAt || new Date(),
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'ItsmProblem',
      problem,
      userId,
      tenantId,
    );

    this.eventEmitter.emit('problem.created', {
      problemId: problem.id,
      tenantId,
      userId,
      number: problem.number,
    });

    return problem;
  }

  async updateProblem(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<ItsmProblem>,
  ): Promise<ItsmProblem | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    const beforeState = { ...existing };

    if (data.serviceId !== undefined || data.offeringId !== undefined) {
      await this.validateServiceOffering(
        tenantId,
        data.serviceId !== undefined ? data.serviceId : existing.serviceId,
        data.offeringId !== undefined ? data.offeringId : existing.offeringId,
      );
    }

    const updateData: Partial<ItsmProblem> = {
      ...data,
      updatedBy: userId,
    };

    // Recalculate priority if impact or urgency changes
    if (data.impact !== undefined || data.urgency !== undefined) {
      const impact = data.impact || existing.impact;
      const urgency = data.urgency || existing.urgency;
      updateData.priority = calculateProblemPriority(impact, urgency);
    }

    // Auto-set timestamps based on state transitions
    if (data.state !== undefined && data.state !== existing.state) {
      if (data.state === ProblemState.KNOWN_ERROR && !existing.knownError) {
        updateData.knownError = true;
      }
      if (data.state === ProblemState.RESOLVED && !existing.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
      if (data.state === ProblemState.CLOSED && !existing.closedAt) {
        updateData.closedAt = new Date();
      }
    }

    const problem = await this.updateForTenant(tenantId, id, updateData);

    if (problem) {
      await this.auditService?.recordUpdate(
        'ItsmProblem',
        id,
        beforeState as unknown as Record<string, unknown>,
        problem as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );

      this.eventEmitter.emit('problem.updated', {
        problemId: problem.id,
        tenantId,
        userId,
        changes: data,
      });
    }

    return problem;
  }

  async softDeleteProblem(
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
    } as Partial<Omit<ItsmProblem, 'id' | 'tenantId'>>);

    await this.auditService?.recordDelete(
      'ItsmProblem',
      existing,
      userId,
      tenantId,
    );

    this.eventEmitter.emit('problem.deleted', {
      problemId: id,
      tenantId,
      userId,
      number: existing.number,
    });

    return true;
  }

  // ============================================================================
  // Finders
  // ============================================================================

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<ItsmProblem | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findWithFilters(
    tenantId: string,
    filterDto: ProblemFilterDto,
  ): Promise<PaginatedResponse<ItsmProblem>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      state,
      priority,
      category,
      impact,
      urgency,
      source,
      knownError,
      riskLevel,
      serviceId,
      offeringId,
      assignmentGroup,
      assignedTo,
      createdFrom,
      createdTo,
      search,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('problem');

    qb.where('problem.tenantId = :tenantId', { tenantId });
    qb.andWhere('problem.isDeleted = :isDeleted', { isDeleted: false });

    if (state) {
      qb.andWhere('problem.state = :state', { state });
    }

    if (priority) {
      qb.andWhere('problem.priority = :priority', { priority });
    }

    if (category) {
      qb.andWhere('problem.category = :category', { category });
    }

    if (impact) {
      qb.andWhere('problem.impact = :impact', { impact });
    }

    if (urgency) {
      qb.andWhere('problem.urgency = :urgency', { urgency });
    }

    if (source) {
      qb.andWhere('problem.source = :source', { source });
    }

    if (knownError !== undefined) {
      qb.andWhere('problem.knownError = :knownError', { knownError });
    }

    if (riskLevel) {
      qb.andWhere('problem.problemOperationalRiskLevel = :riskLevel', {
        riskLevel,
      });
    }

    if (serviceId) {
      qb.andWhere('problem.serviceId = :serviceId', { serviceId });
    }

    if (offeringId) {
      qb.andWhere('problem.offeringId = :offeringId', { offeringId });
    }

    if (assignmentGroup) {
      qb.andWhere('problem.assignmentGroup ILIKE :assignmentGroup', {
        assignmentGroup: `%${assignmentGroup}%`,
      });
    }

    if (assignedTo) {
      qb.andWhere('problem.assignedTo = :assignedTo', { assignedTo });
    }

    if (createdFrom) {
      qb.andWhere('problem.createdAt >= :createdFrom', { createdFrom });
    }

    if (createdTo) {
      qb.andWhere('problem.createdAt <= :createdTo', { createdTo });
    }

    if (search) {
      qb.andWhere(
        '(problem.number ILIKE :search OR problem.shortDescription ILIKE :search OR problem.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const validSortBy = PROBLEM_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`problem.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  // ============================================================================
  // Known Error Operations
  // ============================================================================

  async markKnownError(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<ItsmProblem | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    return this.updateProblem(tenantId, userId, id, {
      knownError: true,
      state: ProblemState.KNOWN_ERROR,
    });
  }

  async unmarkKnownError(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<ItsmProblem | null> {
    const existing = await this.findOneActiveForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    return this.updateProblem(tenantId, userId, id, {
      knownError: false,
      state:
        existing.state === ProblemState.KNOWN_ERROR
          ? ProblemState.UNDER_INVESTIGATION
          : existing.state,
    });
  }

  // ============================================================================
  // Incident Linking
  // ============================================================================

  async linkIncident(
    tenantId: string,
    userId: string,
    problemId: string,
    incidentId: string,
    linkType: ProblemIncidentLinkType = ProblemIncidentLinkType.RELATED,
  ): Promise<ItsmProblemIncident> {
    // Verify problem exists in tenant
    const problem = await this.findOneActiveForTenant(tenantId, problemId);
    if (!problem) {
      throw new NotFoundException(`Problem with ID ${problemId} not found`);
    }

    // Verify incident exists in same tenant
    if (this.incidentRepo) {
      const incident = await this.incidentRepo.findOne({
        where: { id: incidentId, tenantId, isDeleted: false },
      });
      if (!incident) {
        throw new NotFoundException(
          `Incident with ID ${incidentId} not found in this tenant`,
        );
      }
    }

    // Check for existing link
    const existing = await this.problemIncidentRepo.findOne({
      where: { tenantId, problemId, incidentId },
    });
    if (existing) {
      throw new ConflictException('Incident is already linked to this problem');
    }

    const link = this.problemIncidentRepo.create({
      tenantId,
      problemId,
      incidentId,
      linkType,
      createdBy: userId,
      isDeleted: false,
    });

    return this.problemIncidentRepo.save(link);
  }

  async unlinkIncident(
    tenantId: string,
    problemId: string,
    incidentId: string,
  ): Promise<boolean> {
    const link = await this.problemIncidentRepo.findOne({
      where: { tenantId, problemId, incidentId },
    });
    if (!link) {
      return false;
    }

    await this.problemIncidentRepo.remove(link);
    return true;
  }

  async getLinkedIncidents(
    tenantId: string,
    problemId: string,
  ): Promise<ItsmProblemIncident[]> {
    return this.problemIncidentRepo.find({
      where: { tenantId, problemId },
      relations: ['incident'],
      order: { createdAt: 'DESC' },
    });
  }

  async getProblemsForIncident(
    tenantId: string,
    incidentId: string,
  ): Promise<ItsmProblemIncident[]> {
    return this.problemIncidentRepo.find({
      where: { tenantId, incidentId },
      relations: ['problem'],
      order: { createdAt: 'DESC' },
    });
  }

  // ============================================================================
  // Change Linking
  // ============================================================================

  async linkChange(
    tenantId: string,
    userId: string,
    problemId: string,
    changeId: string,
    relationType: ProblemChangeLinkType = ProblemChangeLinkType.INVESTIGATES,
  ): Promise<ItsmProblemChange> {
    // Verify problem exists in tenant
    const problem = await this.findOneActiveForTenant(tenantId, problemId);
    if (!problem) {
      throw new NotFoundException(`Problem with ID ${problemId} not found`);
    }

    // Verify change exists in same tenant
    if (this.changeRepo) {
      const change = await this.changeRepo.findOne({
        where: { id: changeId, tenantId, isDeleted: false },
      });
      if (!change) {
        throw new NotFoundException(
          `Change with ID ${changeId} not found in this tenant`,
        );
      }
    }

    // Check for existing link with same relation type
    const existing = await this.problemChangeRepo.findOne({
      where: { tenantId, problemId, changeId, relationType },
    });
    if (existing) {
      throw new ConflictException(
        `Change is already linked to this problem with relation type ${relationType}`,
      );
    }

    const link = this.problemChangeRepo.create({
      tenantId,
      problemId,
      changeId,
      relationType,
      createdBy: userId,
      isDeleted: false,
    });

    return this.problemChangeRepo.save(link);
  }

  async unlinkChange(
    tenantId: string,
    problemId: string,
    changeId: string,
  ): Promise<boolean> {
    const links = await this.problemChangeRepo.find({
      where: { tenantId, problemId, changeId },
    });
    if (links.length === 0) {
      return false;
    }

    await this.problemChangeRepo.remove(links);
    return true;
  }

  async getLinkedChanges(
    tenantId: string,
    problemId: string,
  ): Promise<ItsmProblemChange[]> {
    return this.problemChangeRepo.find({
      where: { tenantId, problemId },
      relations: ['change'],
      order: { createdAt: 'DESC' },
    });
  }

  async getProblemsForChange(
    tenantId: string,
    changeId: string,
  ): Promise<ItsmProblemChange[]> {
    return this.problemChangeRepo.find({
      where: { tenantId, changeId },
      relations: ['problem'],
      order: { createdAt: 'DESC' },
    });
  }

  // ============================================================================
  // Summary / Rollups
  // ============================================================================

  async getProblemSummary(
    tenantId: string,
    problemId: string,
  ): Promise<{
    incidentCount: number;
    openIncidentCount: number;
    changeCount: number;
    permanentFixCount: number;
    workaroundCount: number;
    impactedServices: string[];
  }> {
    const incidentLinks = await this.problemIncidentRepo.find({
      where: { tenantId, problemId },
      relations: ['incident'],
    });

    const incidentCount = incidentLinks.length;
    const openIncidentCount = incidentLinks.filter(
      (link) =>
        link.incident &&
        !link.incident.isDeleted &&
        (link.incident.status === IncidentStatus.OPEN ||
          link.incident.status === IncidentStatus.IN_PROGRESS),
    ).length;

    const changeLinks = await this.problemChangeRepo.find({
      where: { tenantId, problemId },
    });

    const changeCount = changeLinks.length;
    const permanentFixCount = changeLinks.filter(
      (link) => link.relationType === ProblemChangeLinkType.PERMANENT_FIX,
    ).length;
    const workaroundCount = changeLinks.filter(
      (link) => link.relationType === ProblemChangeLinkType.WORKAROUND,
    ).length;

    // Collect impacted services from linked incidents
    const serviceIds = new Set<string>();
    for (const link of incidentLinks) {
      if (link.incident?.serviceId) {
        serviceIds.add(link.incident.serviceId);
      }
    }

    return {
      incidentCount,
      openIncidentCount,
      changeCount,
      permanentFixCount,
      workaroundCount,
      impactedServices: Array.from(serviceIds),
    };
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getStatistics(tenantId: string): Promise<{
    total: number;
    byState: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    knownErrorCount: number;
    openCount: number;
  }> {
    const problems = await this.repository.find({
      where: { tenantId, isDeleted: false },
    });

    const byState: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let knownErrorCount = 0;
    let openCount = 0;

    for (const problem of problems) {
      byState[problem.state] = (byState[problem.state] || 0) + 1;
      byPriority[problem.priority] = (byPriority[problem.priority] || 0) + 1;
      byCategory[problem.category] = (byCategory[problem.category] || 0) + 1;

      if (problem.knownError) {
        knownErrorCount++;
      }

      if (
        problem.state === ProblemState.NEW ||
        problem.state === ProblemState.UNDER_INVESTIGATION ||
        problem.state === ProblemState.KNOWN_ERROR
      ) {
        openCount++;
      }
    }

    return {
      total: problems.length,
      byState,
      byPriority,
      byCategory,
      knownErrorCount,
      openCount,
    };
  }
}
