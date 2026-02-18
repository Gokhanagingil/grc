import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { UiAction } from './ui-action.entity';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class UiActionService extends MultiTenantServiceBase<UiAction> {
  constructor(
    @InjectRepository(UiAction)
    repository: Repository<UiAction>,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  async findById(tenantId: string, id: string): Promise<UiAction | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findByTableName(
    tenantId: string,
    tableName: string,
  ): Promise<UiAction[]> {
    return this.repository.find({
      where: { tenantId, tableName, isActive: true, isDeleted: false },
      order: { order: 'ASC' },
    });
  }

  async findAllActive(tenantId: string): Promise<UiAction[]> {
    return this.repository.find({
      where: { tenantId, isDeleted: false },
      order: { order: 'ASC', createdAt: 'DESC' },
    });
  }

  async createAction(
    tenantId: string,
    userId: string,
    data: Partial<UiAction>,
  ): Promise<UiAction> {
    const entity = this.repository.create({
      ...data,
      tenantId,
      createdBy: userId,
      isDeleted: false,
    });
    const saved = await this.repository.save(entity);

    await this.auditService?.recordCreate('UiAction', saved, userId, tenantId);

    return saved;
  }

  async updateAction(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<UiAction>,
  ): Promise<UiAction | null> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return null;

    this.repository.merge(existing, { ...data, updatedBy: userId });
    const saved = await this.repository.save(existing);

    await this.auditService?.recordUpdate(
      'UiAction',
      id,
      existing as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async softDeleteAction(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return false;

    this.repository.merge(existing, { isDeleted: true, updatedBy: userId });
    await this.repository.save(existing);

    await this.auditService?.recordDelete(
      'UiAction',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  getActionsForRecord(
    actions: UiAction[],
    record: Record<string, unknown>,
    userRoles?: string[],
  ): UiAction[] {
    return actions.filter((action) => {
      if (!action.isActive) return false;

      if (
        action.requiredRoles &&
        action.requiredRoles.length > 0 &&
        userRoles
      ) {
        const hasRole = action.requiredRoles.some((r) => userRoles.includes(r));
        if (!hasRole) return false;
      }

      if (action.showConditions && action.showConditions.length > 0) {
        return action.showConditions.every((condition) => {
          const fieldValue = record[condition.field];
          switch (condition.operator) {
            case 'eq':
              return fieldValue === condition.value;
            case 'neq':
              return fieldValue !== condition.value;
            case 'in':
              if (Array.isArray(condition.value)) {
                return condition.value.includes(String(fieldValue));
              }
              return false;
            default:
              return true;
          }
        });
      }

      return true;
    });
  }
}
