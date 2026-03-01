import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ItsmIncident } from '../entities/itsm-incident.entity';
import { ItsmService } from '../entities/itsm-service.entity';
import { ItsmIncidentRisk } from '../entities/itsm-incident-risk.entity';
import { ItsmIncidentControl } from '../entities/itsm-incident-control.entity';
import { GrcRisk } from '../entities/grc-risk.entity';
import { GrcControl } from '../entities/grc-control.entity';
import {
  ItsmIncidentState,
  ItsmIncidentPriority,
  ItsmServiceCriticality,
} from '../enums';
import {
  CreateItsmIncidentDto,
  UpdateItsmIncidentDto,
  ItsmIncidentFilterDto,
} from '../dto/itsm.dto';
import { AuditService } from '../../audit/audit.service';
import { CodeGeneratorService, CodePrefix } from './code-generator.service';

const RISK_SIGNAL_INCIDENT_THRESHOLD_DAYS = 30;
const RISK_SIGNAL_INCIDENT_COUNT_THRESHOLD = 3;

/**
 * ITSM Incident Service
 *
 * Manages IT incidents for the ITSM module (ITIL v5 aligned).
 * Includes risk signal logic for GRC Bridge integration.
 */
@Injectable()
export class ItsmIncidentService {
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'number',
    'shortDescription',
    'state',
    'priority',
    'impact',
    'urgency',
    'openedAt',
    'resolvedAt',
    'closedAt',
  ]);

  constructor(
    @InjectRepository(ItsmIncident)
    private readonly incidentRepository: Repository<ItsmIncident>,
    @InjectRepository(ItsmService)
    private readonly serviceRepository: Repository<ItsmService>,
    @InjectRepository(ItsmIncidentRisk)
    private readonly incidentRiskRepository: Repository<ItsmIncidentRisk>,
    @InjectRepository(ItsmIncidentControl)
    private readonly incidentControlRepository: Repository<ItsmIncidentControl>,
    @InjectRepository(GrcRisk)
    private readonly riskRepository: Repository<GrcRisk>,
    @InjectRepository(GrcControl)
    private readonly controlRepository: Repository<GrcControl>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly codeGeneratorService?: CodeGeneratorService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateItsmIncidentDto,
    userId: string,
  ): Promise<ItsmIncident> {
    let service: ItsmService | null = null;

    if (dto.serviceId) {
      service = await this.serviceRepository.findOne({
        where: { id: dto.serviceId, tenantId, isDeleted: false },
      });
      if (!service) {
        throw new NotFoundException(
          `ITSM Service with ID ${dto.serviceId} not found`,
        );
      }
    }

    let number: string | undefined;
    if (this.codeGeneratorService) {
      number = await this.codeGeneratorService.generateCode(
        tenantId,
        CodePrefix.ITSM_INCIDENT,
      );
    } else {
      number = `INC-${Date.now()}`;
    }

    const riskReviewRequired = await this.calculateRiskSignal(
      tenantId,
      dto.priority || ItsmIncidentPriority.P3,
      service,
      dto.serviceId,
    );

    const incident = this.incidentRepository.create({
      ...dto,
      number,
      tenantId,
      riskReviewRequired,
      openedAt: dto.openedAt ? new Date(dto.openedAt) : new Date(),
      createdBy: userId,
    });

    const saved = await this.incidentRepository.save(incident);

    if (this.auditService) {
      await this.auditService.recordCreate(
        'ItsmIncident',
        saved,
        userId,
        tenantId,
      );
    }

    return saved;
  }

  async findAll(
    tenantId: string,
    filter: ItsmIncidentFilterDto,
  ): Promise<{ items: ItsmIncident[]; total: number }> {
    const {
      state,
      priority,
      impact,
      urgency,
      serviceId,
      assigneeId,
      riskReviewRequired,
      q,
      search,
      page = 1,
      pageSize = 20,
      sort,
      customerCompanyId,
      category,
      createdAtAfter,
      createdAtBefore,
    } = filter;

    const queryBuilder = this.incidentRepository
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.service', 'service')
      .leftJoinAndSelect('incident.requester', 'requester')
      .leftJoinAndSelect('incident.assignee', 'assignee')
      .where('incident.tenantId = :tenantId', { tenantId })
      .andWhere('incident.isDeleted = :isDeleted', { isDeleted: false });

    if (state) {
      queryBuilder.andWhere('incident.state = :state', { state });
    }

    if (priority) {
      queryBuilder.andWhere('incident.priority = :priority', { priority });
    }

    if (impact) {
      queryBuilder.andWhere('incident.impact = :impact', { impact });
    }

    if (urgency) {
      queryBuilder.andWhere('incident.urgency = :urgency', { urgency });
    }

    if (serviceId) {
      queryBuilder.andWhere('incident.serviceId = :serviceId', { serviceId });
    }

    if (assigneeId) {
      queryBuilder.andWhere('incident.assigneeId = :assigneeId', {
        assigneeId,
      });
    }

    if (riskReviewRequired !== undefined) {
      queryBuilder.andWhere(
        'incident.riskReviewRequired = :riskReviewRequired',
        {
          riskReviewRequired,
        },
      );
    }

    if (customerCompanyId) {
      queryBuilder.andWhere('incident.customerCompanyId = :customerCompanyId', {
        customerCompanyId,
      });
    }

    if (category) {
      queryBuilder.andWhere(
        'incident.category ILIKE :category',
        { category: `%${category}%` },
      );
    }

    if (createdAtAfter) {
      queryBuilder.andWhere('incident.createdAt >= :createdAtAfter', {
        createdAtAfter,
      });
    }

    if (createdAtBefore) {
      queryBuilder.andWhere('incident.createdAt <= :createdAtBefore', {
        createdAtBefore,
      });
    }

    const searchTerm = q || search;
    if (searchTerm) {
      queryBuilder.andWhere(
        '(incident.number ILIKE :search OR incident.shortDescription ILIKE :search OR incident.description ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    let sortField = 'createdAt';
    let sortOrder: 'ASC' | 'DESC' = 'DESC';

    if (sort) {
      const [field, order] = sort.split(':');
      if (this.allowedSortFields.has(field)) {
        sortField = field;
        sortOrder = order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      }
    }

    const [items, total] = await queryBuilder
      .orderBy(`incident.${sortField}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<ItsmIncident> {
    const incident = await this.incidentRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['service', 'requester', 'assignee'],
    });

    if (!incident) {
      throw new NotFoundException(`ITSM Incident with ID ${id} not found`);
    }

    return incident;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateItsmIncidentDto,
    userId: string,
  ): Promise<ItsmIncident> {
    const incident = await this.findOne(tenantId, id);
    const oldValue = { ...incident };

    let service: ItsmService | null = incident.service;

    if (dto.serviceId && dto.serviceId !== incident.serviceId) {
      service = await this.serviceRepository.findOne({
        where: { id: dto.serviceId, tenantId, isDeleted: false },
      });
      if (!service) {
        throw new NotFoundException(
          `ITSM Service with ID ${dto.serviceId} not found`,
        );
      }
    }

    const newPriority = dto.priority || incident.priority;
    const newServiceId =
      dto.serviceId !== undefined ? dto.serviceId : incident.serviceId;

    if (
      dto.riskReviewRequired === undefined &&
      (dto.priority !== undefined || dto.serviceId !== undefined)
    ) {
      const riskReviewRequired = await this.calculateRiskSignal(
        tenantId,
        newPriority,
        service,
        newServiceId,
      );
      dto.riskReviewRequired = riskReviewRequired;
    }

    if (dto.state === ItsmIncidentState.RESOLVED && !incident.resolvedAt) {
      dto.resolvedAt = new Date().toISOString();
    }

    if (dto.state === ItsmIncidentState.CLOSED && !incident.closedAt) {
      dto.closedAt = new Date().toISOString();
    }

    Object.assign(incident, dto, { updatedBy: userId });

    const saved = await this.incidentRepository.save(incident);

    if (this.auditService) {
      await this.auditService.recordUpdate(
        'ItsmIncident',
        saved.id,
        oldValue as unknown as Record<string, unknown>,
        saved as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    }

    return saved;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const incident = await this.findOne(tenantId, id);

    incident.isDeleted = true;
    incident.updatedBy = userId;

    await this.incidentRepository.save(incident);

    if (this.auditService) {
      await this.auditService.recordDelete(
        'ItsmIncident',
        incident,
        userId,
        tenantId,
      );
    }
  }

  /**
   * Calculate risk signal for an incident
   *
   * Risk signal is triggered when:
   * 1. Priority is P1 AND linked service is CRITICAL
   * 2. OR there are repeated incidents (>= threshold) on the same service within N days
   */
  private async calculateRiskSignal(
    tenantId: string,
    priority: ItsmIncidentPriority,
    service: ItsmService | null,
    serviceId: string | null | undefined,
  ): Promise<boolean> {
    if (
      priority === ItsmIncidentPriority.P1 &&
      service?.criticality === ItsmServiceCriticality.CRITICAL
    ) {
      return true;
    }

    if (serviceId) {
      const thresholdDate = new Date();
      thresholdDate.setDate(
        thresholdDate.getDate() - RISK_SIGNAL_INCIDENT_THRESHOLD_DAYS,
      );

      const recentIncidentCount = await this.incidentRepository.count({
        where: {
          tenantId,
          serviceId,
          isDeleted: false,
          createdAt: MoreThan(thresholdDate),
        },
      });

      if (recentIncidentCount >= RISK_SIGNAL_INCIDENT_COUNT_THRESHOLD) {
        return true;
      }
    }

    return false;
  }

  // ============================================================================
  // GRC Bridge Methods - Link/Unlink Risks and Controls
  // ============================================================================

  async getLinkedRisks(
    tenantId: string,
    incidentId: string,
  ): Promise<GrcRisk[]> {
    await this.findOne(tenantId, incidentId);

    const links = await this.incidentRiskRepository.find({
      where: { tenantId, incidentId },
      relations: ['risk'],
    });

    return links.map((link) => link.risk).filter((risk) => !risk.isDeleted);
  }

  async linkRisk(
    tenantId: string,
    incidentId: string,
    riskId: string,
    userId: string,
  ): Promise<ItsmIncidentRisk> {
    await this.findOne(tenantId, incidentId);

    const risk = await this.riskRepository.findOne({
      where: { id: riskId, tenantId, isDeleted: false },
    });

    if (!risk) {
      throw new NotFoundException(`GRC Risk with ID ${riskId} not found`);
    }

    const existing = await this.incidentRiskRepository.findOne({
      where: { tenantId, incidentId, riskId },
    });

    if (existing) {
      throw new BadRequestException(
        `Risk ${riskId} is already linked to incident ${incidentId}`,
      );
    }

    const link = this.incidentRiskRepository.create({
      tenantId,
      incidentId,
      riskId,
      createdBy: userId,
    });

    const saved = await this.incidentRiskRepository.save(link);

    if (this.auditService) {
      await this.auditService.recordCreate(
        'ItsmIncidentRisk',
        saved,
        userId,
        tenantId,
      );
    }

    return saved;
  }

  async unlinkRisk(
    tenantId: string,
    incidentId: string,
    riskId: string,
    userId: string,
  ): Promise<void> {
    const link = await this.incidentRiskRepository.findOne({
      where: { tenantId, incidentId, riskId },
    });

    if (!link) {
      throw new NotFoundException(
        `Risk ${riskId} is not linked to incident ${incidentId}`,
      );
    }

    await this.incidentRiskRepository.remove(link);

    if (this.auditService) {
      await this.auditService.recordDelete(
        'ItsmIncidentRisk',
        link,
        userId,
        tenantId,
      );
    }
  }

  async getLinkedControls(
    tenantId: string,
    incidentId: string,
  ): Promise<GrcControl[]> {
    await this.findOne(tenantId, incidentId);

    const links = await this.incidentControlRepository.find({
      where: { tenantId, incidentId },
      relations: ['control'],
    });

    return links
      .map((link) => link.control)
      .filter((control) => !control.isDeleted);
  }

  async linkControl(
    tenantId: string,
    incidentId: string,
    controlId: string,
    userId: string,
  ): Promise<ItsmIncidentControl> {
    await this.findOne(tenantId, incidentId);

    const control = await this.controlRepository.findOne({
      where: { id: controlId, tenantId, isDeleted: false },
    });

    if (!control) {
      throw new NotFoundException(`GRC Control with ID ${controlId} not found`);
    }

    const existing = await this.incidentControlRepository.findOne({
      where: { tenantId, incidentId, controlId },
    });

    if (existing) {
      throw new BadRequestException(
        `Control ${controlId} is already linked to incident ${incidentId}`,
      );
    }

    const link = this.incidentControlRepository.create({
      tenantId,
      incidentId,
      controlId,
      createdBy: userId,
    });

    const saved = await this.incidentControlRepository.save(link);

    if (this.auditService) {
      await this.auditService.recordCreate(
        'ItsmIncidentControl',
        saved,
        userId,
        tenantId,
      );
    }

    return saved;
  }

  async unlinkControl(
    tenantId: string,
    incidentId: string,
    controlId: string,
    userId: string,
  ): Promise<void> {
    const link = await this.incidentControlRepository.findOne({
      where: { tenantId, incidentId, controlId },
    });

    if (!link) {
      throw new NotFoundException(
        `Control ${controlId} is not linked to incident ${incidentId}`,
      );
    }

    await this.incidentControlRepository.remove(link);

    if (this.auditService) {
      await this.auditService.recordDelete(
        'ItsmIncidentControl',
        link,
        userId,
        tenantId,
      );
    }
  }
}
