import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { BusinessRule, BusinessRuleTrigger } from './business-rule.entity';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class BusinessRuleService extends MultiTenantServiceBase<BusinessRule> {
  constructor(
    @InjectRepository(BusinessRule)
    repository: Repository<BusinessRule>,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  async findById(tenantId: string, id: string): Promise<BusinessRule | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findByTableAndTrigger(
    tenantId: string,
    tableName: string,
    trigger: BusinessRuleTrigger,
  ): Promise<BusinessRule[]> {
    return this.repository.find({
      where: { tenantId, tableName, trigger, isActive: true, isDeleted: false },
      order: { order: 'ASC' },
    });
  }

  async findAllActive(tenantId: string): Promise<BusinessRule[]> {
    return this.repository.find({
      where: { tenantId, isDeleted: false },
      order: { order: 'ASC', createdAt: 'DESC' },
    });
  }

  async createRule(
    tenantId: string,
    userId: string,
    data: Partial<BusinessRule>,
  ): Promise<BusinessRule> {
    const entity = this.repository.create({
      ...data,
      tenantId,
      createdBy: userId,
      isDeleted: false,
    });
    const saved = await this.repository.save(entity);

    await this.auditService?.recordCreate(
      'BusinessRule',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  async updateRule(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<BusinessRule>,
  ): Promise<BusinessRule | null> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return null;

    this.repository.merge(existing, { ...data, updatedBy: userId });
    const saved = await this.repository.save(existing);

    await this.auditService?.recordUpdate(
      'BusinessRule',
      id,
      existing as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async softDeleteRule(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return false;

    this.repository.merge(existing, { isDeleted: true, updatedBy: userId });
    await this.repository.save(existing);

    await this.auditService?.recordDelete(
      'BusinessRule',
      existing,
      userId,
      tenantId,
    );

    return true;
  }
}
