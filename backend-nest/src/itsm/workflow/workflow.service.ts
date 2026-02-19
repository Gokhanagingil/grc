import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { WorkflowDefinition } from './workflow-definition.entity';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class WorkflowService extends MultiTenantServiceBase<WorkflowDefinition> {
  constructor(
    @InjectRepository(WorkflowDefinition)
    repository: Repository<WorkflowDefinition>,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  async findDefinitionById(
    tenantId: string,
    id: string,
  ): Promise<WorkflowDefinition | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findByTableName(
    tenantId: string,
    tableName: string,
  ): Promise<WorkflowDefinition[]> {
    return this.repository.find({
      where: { tenantId, tableName, isActive: true, isDeleted: false },
      order: { order: 'ASC' },
    });
  }

  async resolveWorkflowForTable(
    tenantId: string,
    tableName: string,
  ): Promise<WorkflowDefinition | null> {
    const workflows = await this.repository.find({
      where: { tenantId, tableName, isActive: true, isDeleted: false },
      order: { order: 'ASC' },
      take: 1,
    });
    return workflows.length > 0 ? workflows[0] : null;
  }

  async findAllActive(tenantId: string): Promise<WorkflowDefinition[]> {
    return this.repository.find({
      where: { tenantId, isDeleted: false },
      order: { order: 'ASC', createdAt: 'DESC' },
    });
  }

  async createDefinition(
    tenantId: string,
    userId: string,
    data: Partial<WorkflowDefinition>,
  ): Promise<WorkflowDefinition> {
    const entity = this.repository.create({
      ...data,
      tenantId,
      createdBy: userId,
      isDeleted: false,
    });
    const saved = await this.repository.save(entity);

    await this.auditService?.recordCreate(
      'WorkflowDefinition',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  async updateDefinition(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<WorkflowDefinition>,
  ): Promise<WorkflowDefinition | null> {
    const existing = await this.findDefinitionById(tenantId, id);
    if (!existing) return null;

    this.repository.merge(existing, { ...data, updatedBy: userId });
    const saved = await this.repository.save(existing);

    await this.auditService?.recordUpdate(
      'WorkflowDefinition',
      id,
      existing as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async softDeleteDefinition(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findDefinitionById(tenantId, id);
    if (!existing) return false;

    this.repository.merge(existing, { isDeleted: true, updatedBy: userId });
    await this.repository.save(existing);

    await this.auditService?.recordDelete(
      'WorkflowDefinition',
      existing,
      userId,
      tenantId,
    );

    return true;
  }
}
