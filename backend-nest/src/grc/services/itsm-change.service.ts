import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ItsmChange,
  ItsmService,
  ItsmChangeRisk,
  ItsmChangeControl,
  GrcRisk,
  GrcControl,
} from '../entities';
import { ItsmChangeState } from '../enums';
import {
  CreateItsmChangeDto,
  UpdateItsmChangeDto,
  ItsmChangeFilterDto,
} from '../dto/itsm.dto';
import { AuditService } from '../../audit/audit.service';
import { CodeGeneratorService, CodePrefix } from './code-generator.service';

/**
 * ITSM Change Service
 *
 * Manages IT change requests for the ITSM module (ITIL v5 aligned).
 * Includes GRC Bridge integration for linking to risks and controls.
 */
@Injectable()
export class ItsmChangeService {
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'number',
    'title',
    'type',
    'state',
    'risk',
    'approvalStatus',
    'plannedStartAt',
    'plannedEndAt',
  ]);

  constructor(
    @InjectRepository(ItsmChange)
    private readonly changeRepository: Repository<ItsmChange>,
    @InjectRepository(ItsmService)
    private readonly serviceRepository: Repository<ItsmService>,
    @InjectRepository(ItsmChangeRisk)
    private readonly changeRiskRepository: Repository<ItsmChangeRisk>,
    @InjectRepository(ItsmChangeControl)
    private readonly changeControlRepository: Repository<ItsmChangeControl>,
    @InjectRepository(GrcRisk)
    private readonly riskRepository: Repository<GrcRisk>,
    @InjectRepository(GrcControl)
    private readonly controlRepository: Repository<GrcControl>,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly codeGeneratorService?: CodeGeneratorService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateItsmChangeDto,
    userId: string,
  ): Promise<ItsmChange> {
    if (dto.serviceId) {
      const service = await this.serviceRepository.findOne({
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
        CodePrefix.ITSM_CHANGE,
      );
    } else {
      number = `CHG-${Date.now()}`;
    }

    const change = this.changeRepository.create({
      ...dto,
      number,
      tenantId,
      createdBy: userId,
    });

    const saved = await this.changeRepository.save(change);

    if (this.auditService) {
      await this.auditService.recordCreate(
        'ItsmChange',
        saved,
        userId,
        tenantId,
      );
    }

    return saved;
  }

  async findAll(
    tenantId: string,
    filter: ItsmChangeFilterDto,
  ): Promise<{ items: ItsmChange[]; total: number }> {
    const {
      state,
      type,
      risk,
      approvalStatus,
      serviceId,
      assigneeId,
      q,
      search,
      page = 1,
      pageSize = 20,
      sort,
    } = filter;

    const queryBuilder = this.changeRepository
      .createQueryBuilder('change')
      .leftJoinAndSelect('change.service', 'service')
      .leftJoinAndSelect('change.requester', 'requester')
      .leftJoinAndSelect('change.assignee', 'assignee')
      .where('change.tenantId = :tenantId', { tenantId })
      .andWhere('change.isDeleted = :isDeleted', { isDeleted: false });

    if (state) {
      queryBuilder.andWhere('change.state = :state', { state });
    }

    if (type) {
      queryBuilder.andWhere('change.type = :type', { type });
    }

    if (risk) {
      queryBuilder.andWhere('change.risk = :risk', { risk });
    }

    if (approvalStatus) {
      queryBuilder.andWhere('change.approvalStatus = :approvalStatus', {
        approvalStatus,
      });
    }

    if (serviceId) {
      queryBuilder.andWhere('change.serviceId = :serviceId', { serviceId });
    }

    if (assigneeId) {
      queryBuilder.andWhere('change.assigneeId = :assigneeId', { assigneeId });
    }

    const searchTerm = q || search;
    if (searchTerm) {
      queryBuilder.andWhere(
        '(change.number ILIKE :search OR change.title ILIKE :search OR change.description ILIKE :search)',
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
      .orderBy(`change.${sortField}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<ItsmChange> {
    const change = await this.changeRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['service', 'requester', 'assignee'],
    });

    if (!change) {
      throw new NotFoundException(`ITSM Change with ID ${id} not found`);
    }

    return change;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateItsmChangeDto,
    userId: string,
  ): Promise<ItsmChange> {
    const change = await this.findOne(tenantId, id);
    const oldValue = { ...change };

    if (dto.serviceId && dto.serviceId !== change.serviceId) {
      const service = await this.serviceRepository.findOne({
        where: { id: dto.serviceId, tenantId, isDeleted: false },
      });
      if (!service) {
        throw new NotFoundException(
          `ITSM Service with ID ${dto.serviceId} not found`,
        );
      }
    }

    if (dto.state === ItsmChangeState.IMPLEMENT && !change.actualStartAt) {
      dto.actualStartAt = new Date().toISOString();
    }

    if (dto.state === ItsmChangeState.CLOSED && !change.actualEndAt) {
      dto.actualEndAt = new Date().toISOString();
    }

    Object.assign(change, dto, { updatedBy: userId });

    const saved = await this.changeRepository.save(change);

    if (this.auditService) {
      await this.auditService.recordUpdate(
        'ItsmChange',
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
    const change = await this.findOne(tenantId, id);

    change.isDeleted = true;
    change.updatedBy = userId;

    await this.changeRepository.save(change);

    if (this.auditService) {
      await this.auditService.recordDelete(
        'ItsmChange',
        change,
        userId,
        tenantId,
      );
    }
  }

  // ============================================================================
  // GRC Bridge Methods - Link/Unlink Risks and Controls
  // ============================================================================

  async getLinkedRisks(tenantId: string, changeId: string): Promise<GrcRisk[]> {
    await this.findOne(tenantId, changeId);

    const links = await this.changeRiskRepository.find({
      where: { tenantId, changeId },
      relations: ['risk'],
    });

    return links.map((link) => link.risk).filter((risk) => !risk.isDeleted);
  }

  async linkRisk(
    tenantId: string,
    changeId: string,
    riskId: string,
    userId: string,
  ): Promise<ItsmChangeRisk> {
    await this.findOne(tenantId, changeId);

    const risk = await this.riskRepository.findOne({
      where: { id: riskId, tenantId, isDeleted: false },
    });

    if (!risk) {
      throw new NotFoundException(`GRC Risk with ID ${riskId} not found`);
    }

    const existing = await this.changeRiskRepository.findOne({
      where: { tenantId, changeId, riskId },
    });

    if (existing) {
      throw new BadRequestException(
        `Risk ${riskId} is already linked to change ${changeId}`,
      );
    }

    const link = this.changeRiskRepository.create({
      tenantId,
      changeId,
      riskId,
      createdBy: userId,
    });

    const saved = await this.changeRiskRepository.save(link);

    if (this.auditService) {
      await this.auditService.recordCreate(
        'ItsmChangeRisk',
        saved,
        userId,
        tenantId,
      );
    }

    return saved;
  }

  async unlinkRisk(
    tenantId: string,
    changeId: string,
    riskId: string,
    userId: string,
  ): Promise<void> {
    const link = await this.changeRiskRepository.findOne({
      where: { tenantId, changeId, riskId },
    });

    if (!link) {
      throw new NotFoundException(
        `Risk ${riskId} is not linked to change ${changeId}`,
      );
    }

    await this.changeRiskRepository.remove(link);

    if (this.auditService) {
      await this.auditService.recordDelete(
        'ItsmChangeRisk',
        link,
        userId,
        tenantId,
      );
    }
  }

  async getLinkedControls(
    tenantId: string,
    changeId: string,
  ): Promise<GrcControl[]> {
    await this.findOne(tenantId, changeId);

    const links = await this.changeControlRepository.find({
      where: { tenantId, changeId },
      relations: ['control'],
    });

    return links
      .map((link) => link.control)
      .filter((control) => !control.isDeleted);
  }

  async linkControl(
    tenantId: string,
    changeId: string,
    controlId: string,
    userId: string,
  ): Promise<ItsmChangeControl> {
    await this.findOne(tenantId, changeId);

    const control = await this.controlRepository.findOne({
      where: { id: controlId, tenantId, isDeleted: false },
    });

    if (!control) {
      throw new NotFoundException(`GRC Control with ID ${controlId} not found`);
    }

    const existing = await this.changeControlRepository.findOne({
      where: { tenantId, changeId, controlId },
    });

    if (existing) {
      throw new BadRequestException(
        `Control ${controlId} is already linked to change ${changeId}`,
      );
    }

    const link = this.changeControlRepository.create({
      tenantId,
      changeId,
      controlId,
      createdBy: userId,
    });

    const saved = await this.changeControlRepository.save(link);

    if (this.auditService) {
      await this.auditService.recordCreate(
        'ItsmChangeControl',
        saved,
        userId,
        tenantId,
      );
    }

    return saved;
  }

  async unlinkControl(
    tenantId: string,
    changeId: string,
    controlId: string,
    userId: string,
  ): Promise<void> {
    const link = await this.changeControlRepository.findOne({
      where: { tenantId, changeId, controlId },
    });

    if (!link) {
      throw new NotFoundException(
        `Control ${controlId} is not linked to change ${changeId}`,
      );
    }

    await this.changeControlRepository.remove(link);

    if (this.auditService) {
      await this.auditService.recordDelete(
        'ItsmChangeControl',
        link,
        userId,
        tenantId,
      );
    }
  }
}
