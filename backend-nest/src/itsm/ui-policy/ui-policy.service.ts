import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { UiPolicy } from './ui-policy.entity';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class UiPolicyService extends MultiTenantServiceBase<UiPolicy> {
  constructor(
    @InjectRepository(UiPolicy)
    repository: Repository<UiPolicy>,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  async findById(tenantId: string, id: string): Promise<UiPolicy | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findByTableName(
    tenantId: string,
    tableName: string,
  ): Promise<UiPolicy[]> {
    return this.repository.find({
      where: { tenantId, tableName, isActive: true, isDeleted: false },
      order: { order: 'ASC' },
    });
  }

  async findAllActive(tenantId: string): Promise<UiPolicy[]> {
    return this.repository.find({
      where: { tenantId, isDeleted: false },
      order: { order: 'ASC', createdAt: 'DESC' },
    });
  }

  async createPolicy(
    tenantId: string,
    userId: string,
    data: Partial<UiPolicy>,
  ): Promise<UiPolicy> {
    const entity = this.repository.create({
      ...data,
      tenantId,
      createdBy: userId,
      isDeleted: false,
    });
    const saved = await this.repository.save(entity);

    await this.auditService?.recordCreate('UiPolicy', saved, userId, tenantId);

    return saved;
  }

  async updatePolicy(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<UiPolicy>,
  ): Promise<UiPolicy | null> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return null;

    this.repository.merge(existing, { ...data, updatedBy: userId });
    const saved = await this.repository.save(existing);

    await this.auditService?.recordUpdate(
      'UiPolicy',
      id,
      existing as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async softDeletePolicy(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return false;

    this.repository.merge(existing, { isDeleted: true, updatedBy: userId });
    await this.repository.save(existing);

    await this.auditService?.recordDelete(
      'UiPolicy',
      existing,
      userId,
      tenantId,
    );

    return true;
  }

  evaluatePolicies(
    policies: UiPolicy[],
    record: Record<string, unknown>,
  ): Array<{
    field: string;
    visible?: boolean;
    mandatory?: boolean;
    readOnly?: boolean;
  }> {
    const effects: Array<{
      field: string;
      visible?: boolean;
      mandatory?: boolean;
      readOnly?: boolean;
    }> = [];

    for (const policy of policies) {
      if (!policy.isActive) continue;

      const conditionsMet = this.evaluateConditions(
        policy.conditions || [],
        record,
      );

      if (conditionsMet) {
        effects.push(...policy.fieldEffects);
      }
    }

    return effects;
  }

  private evaluateConditions(
    conditions: Array<{
      field: string;
      operator: string;
      value?: string | string[];
    }>,
    record: Record<string, unknown>,
  ): boolean {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every((condition) => {
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
        case 'not_in':
          if (Array.isArray(condition.value)) {
            return !condition.value.includes(String(fieldValue));
          }
          return true;
        case 'is_set':
          return (
            fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
          );
        case 'is_empty':
          return (
            fieldValue === null || fieldValue === undefined || fieldValue === ''
          );
        default:
          return true;
      }
    });
  }
}
