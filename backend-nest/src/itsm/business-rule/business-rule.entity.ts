import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export enum BusinessRuleTrigger {
  BEFORE_INSERT = 'BEFORE_INSERT',
  AFTER_INSERT = 'AFTER_INSERT',
  BEFORE_UPDATE = 'BEFORE_UPDATE',
  AFTER_UPDATE = 'AFTER_UPDATE',
}

export interface BusinessRuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'is_set' | 'is_empty' | 'changed';
  value?: string | string[];
}

export interface BusinessRuleAction {
  type: 'set_field' | 'reject' | 'add_work_note';
  field?: string;
  value?: string;
  message?: string;
}

@Entity('itsm_business_rules')
@Index(['tenantId', 'tableName', 'trigger', 'isActive'])
@Index(['tenantId', 'name'], { unique: true })
export class BusinessRule extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName: string;

  @Column({
    type: 'enum',
    enum: BusinessRuleTrigger,
    default: BusinessRuleTrigger.BEFORE_UPDATE,
  })
  trigger: BusinessRuleTrigger;

  @Column({ type: 'jsonb', nullable: true })
  conditions: BusinessRuleCondition[] | null;

  @Column({ type: 'jsonb' })
  actions: BusinessRuleAction[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 100 })
  order: number;
}
