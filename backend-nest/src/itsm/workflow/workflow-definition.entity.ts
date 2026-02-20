import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export interface WorkflowState {
  name: string;
  label: string;
  isInitial?: boolean;
  isFinal?: boolean;
}

export interface WorkflowTransition {
  name: string;
  label: string;
  from: string;
  to: string;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  conditions?: TransitionCondition[];
  actions?: TransitionAction[];
}

export interface TransitionCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'is_set' | 'is_empty';
  value?: string | string[];
}

export interface TransitionAction {
  type: 'set_field' | 'set_timestamp' | 'notify';
  field?: string;
  value?: string;
}

@Entity('itsm_workflow_definitions')
@Index(['tenantId', 'tableName', 'isActive'])
@Index(['tenantId', 'name'], { unique: true })
export class WorkflowDefinition extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName: string;

  @Column({ type: 'jsonb' })
  states: WorkflowState[];

  @Column({ type: 'jsonb' })
  transitions: WorkflowTransition[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;
}
