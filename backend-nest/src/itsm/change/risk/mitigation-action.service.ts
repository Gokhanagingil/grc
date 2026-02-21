import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MitigationAction,
  MitigationActionStatus,
} from './mitigation-action.entity';
import { CreateMitigationActionDto } from './dto/create-mitigation-action.dto';
import { EventBusService } from '../../../event-bus/event-bus.service';
import { ItsmChange } from '../change.entity';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';

@Injectable()
export class MitigationActionService {
  constructor(
    @InjectRepository(MitigationAction)
    private readonly mitigationRepo: Repository<MitigationAction>,
    @InjectRepository(ItsmChange)
    private readonly changeRepo: Repository<ItsmChange>,
    @Optional() private readonly eventBusService?: EventBusService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    changeId: string,
    dto: CreateMitigationActionDto,
  ): Promise<MitigationAction> {
    const change = await this.changeRepo.findOne({
      where: { id: changeId, tenantId, isDeleted: false },
    });
    if (!change) {
      throw new NotFoundException(`Change ${changeId} not found`);
    }

    const action = this.mitigationRepo.create({
      tenantId,
      changeId,
      catalogRiskId: dto.catalogRiskId || null,
      bindingId: dto.bindingId || null,
      actionType: dto.actionType,
      status: MitigationActionStatus.OPEN,
      title: dto.title,
      description: dto.description || null,
      ownerId: dto.ownerId || null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      comment: dto.comment || null,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.mitigationRepo.save(action);

    if (this.eventBusService) {
      await this.eventBusService.emit({
        tenantId,
        source: 'itsm.change.customer_risk',
        eventName: 'itsm.change.customer_risk.mitigation_created',
        tableName: 'itsm_change_mitigation_actions',
        recordId: saved.id,
        actorId: userId,
        payload: {
          changeId,
          changeNumber: change.number,
          changeTitle: change.title,
          actionType: dto.actionType,
          title: dto.title,
          catalogRiskId: dto.catalogRiskId || null,
          ownerId: dto.ownerId || null,
          dueDate: dto.dueDate || null,
        },
      });
    }

    return saved;
  }

  async listByChange(
    tenantId: string,
    changeId: string,
    params?: { page?: number; pageSize?: number; status?: string },
  ): Promise<PaginatedResponse<MitigationAction>> {
    const page = params?.page || 1;
    const pageSize = Math.min(params?.pageSize || 20, 100);

    const qb = this.mitigationRepo
      .createQueryBuilder('ma')
      .where('ma.tenantId = :tenantId', { tenantId })
      .andWhere('ma.changeId = :changeId', { changeId })
      .andWhere('ma.isDeleted = :isDeleted', { isDeleted: false });

    if (params?.status) {
      qb.andWhere('ma.status = :status', { status: params.status });
    }

    const total = await qb.getCount();

    qb.orderBy('ma.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async getById(tenantId: string, actionId: string): Promise<MitigationAction> {
    const action = await this.mitigationRepo.findOne({
      where: { id: actionId, tenantId, isDeleted: false },
    });
    if (!action) {
      throw new NotFoundException(`Mitigation action ${actionId} not found`);
    }
    return action;
  }

  async updateStatus(
    tenantId: string,
    userId: string,
    actionId: string,
    status: MitigationActionStatus,
    comment?: string,
  ): Promise<MitigationAction> {
    const action = await this.getById(tenantId, actionId);
    const previousStatus = action.status;

    action.status = status;
    action.updatedBy = userId;
    if (comment) {
      action.comment = comment;
    }

    const saved = await this.mitigationRepo.save(action);

    if (this.eventBusService) {
      await this.eventBusService.emit({
        tenantId,
        source: 'itsm.change.customer_risk',
        eventName: 'itsm.change.customer_risk.mitigation_updated',
        tableName: 'itsm_change_mitigation_actions',
        recordId: saved.id,
        actorId: userId,
        payload: {
          changeId: action.changeId,
          actionType: action.actionType,
          oldStatus: previousStatus,
          newStatus: status,
          title: action.title,
        },
      });
    }

    return saved;
  }

  async softDelete(
    tenantId: string,
    userId: string,
    actionId: string,
  ): Promise<void> {
    const action = await this.getById(tenantId, actionId);
    action.isDeleted = true;
    action.updatedBy = userId;
    await this.mitigationRepo.save(action);
  }
}
