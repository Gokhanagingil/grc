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

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }
}
