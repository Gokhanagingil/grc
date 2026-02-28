import {
  Injectable,
  Optional,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { ItsmChange, ChangeState } from './change.entity';
import { CmdbService as CmdbServiceEntity } from '../cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../cmdb/service-offering/cmdb-service-offering.entity';
import { ItsmChangeRisk } from '../../grc/entities/itsm-change-risk.entity';
import { ItsmChangeControl } from '../../grc/entities/itsm-change-control.entity';
import { GrcRisk } from '../../grc/entities/grc-risk.entity';
import { GrcControl } from '../../grc/entities/grc-control.entity';
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
import { CalendarEventService } from './calendar/calendar-event.service';
import { ConflictDetectionService } from './calendar/conflict-detection.service';
import { RiskScoringService } from './risk/risk-scoring.service';
import { ApprovalService } from './approval/approval.service';

@Injectable()
export class ChangeService extends MultiTenantServiceBase<ItsmChange> {
  private changeCounter = 0;

  constructor(
    @InjectRepository(ItsmChange)
    repository: Repository<ItsmChange>,
    private readonly approvalService: ApprovalService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly choiceService?: ChoiceService,
    @Optional()
    @InjectRepository(CmdbServiceEntity)
    private readonly cmdbServiceRepo?: Repository<CmdbServiceEntity>,
    @Optional()
    @InjectRepository(CmdbServiceOffering)
    private readonly cmdbOfferingRepo?: Repository<CmdbServiceOffering>,
    @Optional() private readonly calendarEventService?: CalendarEventService,
    @Optional()
    private readonly conflictDetectionService?: ConflictDetectionService,
    @Optional()
    private readonly riskScoringService?: RiskScoringService,
    @Optional()
    @InjectRepository(ItsmChangeRisk)
    private readonly changeRiskRepository?: Repository<ItsmChangeRisk>,
    @Optional()
    @InjectRepository(ItsmChangeControl)
    private readonly changeControlRepository?: Repository<ItsmChangeControl>,
    @Optional()
    @InjectRepository(GrcRisk)
    private readonly grcRiskRepository?: Repository<GrcRisk>,
    @Optional()
    @InjectRepository(GrcControl)
    private readonly grcControlRepository?: Repository<GrcControl>,
  ) {
    super(repository);
  }

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

  private async generateChangeNumber(tenantId: string): Promise<string> {
    const count = await this.countForTenant(tenantId);
    this.changeCounter = count + 1;
    return `CHG${String(this.changeCounter).padStart(6, '0')}`;
  }

  private assertValidStateTransition(
    currentState: ChangeState,
    targetState: ChangeState,
  ): void {
    const validTransitions: Record<ChangeState, ChangeState[]> = {
      [ChangeState.DRAFT]: [ChangeState.ASSESS],
      [ChangeState.ASSESS]: [ChangeState.AUTHORIZE, ChangeState.IMPLEMENT],
      [ChangeState.AUTHORIZE]: [ChangeState.IMPLEMENT, ChangeState.ASSESS],
      [ChangeState.IMPLEMENT]: [ChangeState.REVIEW],
      [ChangeState.REVIEW]: [ChangeState.CLOSED],
      [ChangeState.CLOSED]: [],
    };

    const allowed = validTransitions[currentState];
    if (!allowed || !allowed.includes(targetState)) {
      throw new BadRequestException(
        `Invalid state transition from ${currentState} to ${targetState}`,
      );
    }
  }

  async findOneActiveForTenant(
    tenantId: string,
    id: string,
  ): Promise<ItsmChange | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['customerCompany'],
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

    await this.validateServiceOffering(
      tenantId,
      data.serviceId,
      data.offeringId,
    );

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

    if (
      change.plannedStartAt &&
      change.plannedEndAt &&
      this.calendarEventService &&
      this.conflictDetectionService
    ) {
      await this.calendarEventService.upsertForChange(
        tenantId,
        userId,
        change.id,
        `${change.number} - ${change.title}`,
        change.plannedStartAt,
        change.plannedEndAt,
      );
      await this.conflictDetectionService.refreshConflictsForChange(
        tenantId,
        userId,
        change.id,
        change.plannedStartAt,
        change.plannedEndAt,
        change.serviceId || undefined,
      );
    }

    if (this.riskScoringService) {
      await this.riskScoringService.calculateRisk(tenantId, userId, change);
    }

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

    if (data.approvalStatus !== undefined) {
      throw new BadRequestException('approvalStatus is managed by the system');
    }

    const requestedState = data.state;
    if (requestedState !== undefined && requestedState !== existing.state) {
      this.assertValidStateTransition(existing.state, requestedState);

      if (requestedState === ChangeState.AUTHORIZE) {
        throw new BadRequestException(
          'Use /grc/itsm/changes/:id/request-approval to submit for CAB approval',
        );
      }

      if (requestedState === ChangeState.IMPLEMENT) {
        const gate = await this.approvalService.checkTransitionGate(
          tenantId,
          id,
          ChangeState.IMPLEMENT,
        );
        if (!gate.allowed) {
          throw new ConflictException({
            statusCode: 409,
            reasonCode: gate.reasonCode,
            message: gate.reason,
          });
        }

        if (!existing.actualStartAt && data.actualStartAt === undefined) {
          data.actualStartAt = new Date();
        }
      }

      if (requestedState === ChangeState.CLOSED) {
        if (!existing.actualEndAt && data.actualEndAt === undefined) {
          data.actualEndAt = new Date();
        }
      }
    }

    if (this.choiceService) {
      const errors = await this.choiceService.validateChoiceFields(
        tenantId,
        'itsm_changes',
        data as Record<string, unknown>,
      );
      this.choiceService.throwIfInvalidChoices(errors);
    }

    if (data.serviceId !== undefined || data.offeringId !== undefined) {
      await this.validateServiceOffering(
        tenantId,
        data.serviceId !== undefined ? data.serviceId : existing.serviceId,
        data.offeringId !== undefined ? data.offeringId : existing.offeringId,
      );
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

      if (
        (data.plannedStartAt !== undefined ||
          data.plannedEndAt !== undefined ||
          data.title !== undefined) &&
        this.calendarEventService &&
        this.conflictDetectionService
      ) {
        if (change.plannedStartAt && change.plannedEndAt) {
          await this.calendarEventService.upsertForChange(
            tenantId,
            userId,
            change.id,
            `${change.number} - ${change.title}`,
            change.plannedStartAt,
            change.plannedEndAt,
          );
          await this.conflictDetectionService.refreshConflictsForChange(
            tenantId,
            userId,
            change.id,
            change.plannedStartAt,
            change.plannedEndAt,
            change.serviceId || undefined,
          );
        } else {
          await this.calendarEventService.softDeleteByChangeId(
            tenantId,
            userId,
            change.id,
          );
          await this.conflictDetectionService.clearConflictsForChange(
            tenantId,
            userId,
            change.id,
          );
        }
      }

      const shouldRecalcRisk =
        data.plannedStartAt !== undefined ||
        data.plannedEndAt !== undefined ||
        data.serviceId !== undefined ||
        data.offeringId !== undefined ||
        data.type !== undefined;
      if (shouldRecalcRisk && this.riskScoringService) {
        await this.riskScoringService.calculateRisk(tenantId, userId, change);
      }
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

    if (this.calendarEventService && this.conflictDetectionService) {
      await this.calendarEventService.softDeleteByChangeId(
        tenantId,
        userId,
        existing.id,
      );
      await this.conflictDetectionService.clearConflictsForChange(
        tenantId,
        userId,
        existing.id,
      );
    }

    return true;
  }

  /**
   * Calendar time-range query: returns lightweight change summaries
   * with planned windows for the given date range.
   */
  async findForCalendarRange(
    tenantId: string,
    start: Date,
    end: Date,
    filters?: {
      state?: string;
      type?: string;
      risk?: string;
      serviceId?: string;
    },
  ): Promise<
    Array<{
      id: string;
      number: string;
      title: string;
      type: string;
      risk: string;
      state: string;
      plannedStartAt: string | null;
      plannedEndAt: string | null;
      serviceId: string | null;
    }>
  > {
    const qb = this.repository.createQueryBuilder('c');
    qb.select([
      'c.id',
      'c.number',
      'c.title',
      'c.type',
      'c.risk',
      'c.state',
      'c.plannedStartAt',
      'c.plannedEndAt',
      'c.serviceId',
    ]);
    qb.where('c.tenantId = :tenantId', { tenantId });
    qb.andWhere('c.isDeleted = false');
    qb.andWhere('c.plannedStartAt IS NOT NULL');
    qb.andWhere('c.plannedEndAt IS NOT NULL');
    qb.andWhere('c.plannedStartAt < :end', { end });
    qb.andWhere('c.plannedEndAt > :start', { start });

    if (filters?.state)
      qb.andWhere('c.state = :state', { state: filters.state });
    if (filters?.type) qb.andWhere('c.type = :type', { type: filters.type });
    if (filters?.risk) qb.andWhere('c.risk = :risk', { risk: filters.risk });
    if (filters?.serviceId)
      qb.andWhere('c.serviceId = :serviceId', { serviceId: filters.serviceId });

    qb.orderBy('c.plannedStartAt', 'ASC');
    qb.take(500); // Hard limit for calendar view

    const items = await qb.getMany();
    return items.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      type: c.type,
      risk: c.risk,
      state: c.state,
      plannedStartAt: c.plannedStartAt ? c.plannedStartAt.toISOString() : null,
      plannedEndAt: c.plannedEndAt ? c.plannedEndAt.toISOString() : null,
      serviceId: c.serviceId || null,
    }));
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
      serviceId,
      offeringId,
      customerCompanyId,
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

    if (serviceId) {
      qb.andWhere('change.serviceId = :serviceId', { serviceId });
    }

    if (offeringId) {
      qb.andWhere('change.offeringId = :offeringId', { offeringId });
    }

    if (customerCompanyId) {
      qb.andWhere('change.customerCompanyId = :customerCompanyId', {
        customerCompanyId,
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

    qb.leftJoinAndSelect('change.customerCompany', 'customerCompany');

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  // ============================================================================
  // GRC Bridge Methods - Link/Unlink Risks and Controls
  // ============================================================================

  /**
   * Get linked GRC risks for a change request.
   * Returns empty array when change exists but has no linked risks.
   * Throws NotFoundException when change does not exist.
   */
  async getLinkedRisks(tenantId: string, changeId: string): Promise<GrcRisk[]> {
    const change = await this.findOneActiveForTenant(tenantId, changeId);
    if (!change) {
      throw new NotFoundException(`Change with ID ${changeId} not found`);
    }

    if (!this.changeRiskRepository) {
      return [];
    }

    const links = await this.changeRiskRepository.find({
      where: { tenantId, changeId },
      relations: ['risk'],
      order: { createdAt: 'DESC' },
    });

    return links
      .map((link) => link.risk)
      .filter((risk) => risk && !risk.isDeleted);
  }

  /**
   * Link a GRC risk to a change request.
   */
  async linkRisk(
    tenantId: string,
    changeId: string,
    riskId: string,
    userId: string,
  ): Promise<ItsmChangeRisk> {
    const change = await this.findOneActiveForTenant(tenantId, changeId);
    if (!change) {
      throw new NotFoundException(`Change with ID ${changeId} not found`);
    }

    if (!this.changeRiskRepository || !this.grcRiskRepository) {
      throw new BadRequestException('Risk linking is not available');
    }

    const risk = await this.grcRiskRepository.findOne({
      where: { id: riskId, tenantId, isDeleted: false },
    });
    if (!risk) {
      throw new NotFoundException(`GRC Risk with ID ${riskId} not found`);
    }

    const existing = await this.changeRiskRepository.findOne({
      where: { tenantId, changeId, riskId },
    });
    if (existing) {
      throw new ConflictException(
        `Risk ${riskId} is already linked to change ${changeId}`,
      );
    }

    const link = this.changeRiskRepository.create({
      tenantId,
      changeId,
      riskId,
      createdBy: userId,
    });

    return this.changeRiskRepository.save(link);
  }

  /**
   * Unlink a GRC risk from a change request.
   */
  async unlinkRisk(
    tenantId: string,
    changeId: string,
    riskId: string,
  ): Promise<void> {
    if (!this.changeRiskRepository) {
      throw new BadRequestException('Risk linking is not available');
    }

    const link = await this.changeRiskRepository.findOne({
      where: { tenantId, changeId, riskId },
    });
    if (!link) {
      throw new NotFoundException(
        `Risk ${riskId} is not linked to change ${changeId}`,
      );
    }

    await this.changeRiskRepository.remove(link);
  }

  /**
   * Get linked GRC controls for a change request.
   * Returns empty array when change exists but has no linked controls.
   * Throws NotFoundException when change does not exist.
   */
  async getLinkedControls(
    tenantId: string,
    changeId: string,
  ): Promise<GrcControl[]> {
    const change = await this.findOneActiveForTenant(tenantId, changeId);
    if (!change) {
      throw new NotFoundException(`Change with ID ${changeId} not found`);
    }

    if (!this.changeControlRepository) {
      return [];
    }

    const links = await this.changeControlRepository.find({
      where: { tenantId, changeId },
      relations: ['control'],
      order: { createdAt: 'DESC' },
    });

    return links
      .map((link) => link.control)
      .filter((control) => control && !control.isDeleted);
  }

  /**
   * Link a GRC control to a change request.
   */
  async linkControl(
    tenantId: string,
    changeId: string,
    controlId: string,
    userId: string,
  ): Promise<ItsmChangeControl> {
    const change = await this.findOneActiveForTenant(tenantId, changeId);
    if (!change) {
      throw new NotFoundException(`Change with ID ${changeId} not found`);
    }

    if (!this.changeControlRepository || !this.grcControlRepository) {
      throw new BadRequestException('Control linking is not available');
    }

    const control = await this.grcControlRepository.findOne({
      where: { id: controlId, tenantId, isDeleted: false },
    });
    if (!control) {
      throw new NotFoundException(`GRC Control with ID ${controlId} not found`);
    }

    const existing = await this.changeControlRepository.findOne({
      where: { tenantId, changeId, controlId },
    });
    if (existing) {
      throw new ConflictException(
        `Control ${controlId} is already linked to change ${changeId}`,
      );
    }

    const link = this.changeControlRepository.create({
      tenantId,
      changeId,
      controlId,
      createdBy: userId,
    });

    return this.changeControlRepository.save(link);
  }

  /**
   * Unlink a GRC control from a change request.
   */
  async unlinkControl(
    tenantId: string,
    changeId: string,
    controlId: string,
  ): Promise<void> {
    if (!this.changeControlRepository) {
      throw new BadRequestException('Control linking is not available');
    }

    const link = await this.changeControlRepository.findOne({
      where: { tenantId, changeId, controlId },
    });
    if (!link) {
      throw new NotFoundException(
        `Control ${controlId} is not linked to change ${changeId}`,
      );
    }

    await this.changeControlRepository.remove(link);
  }
}
