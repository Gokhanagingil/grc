import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export interface UiPolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'is_set' | 'is_empty';
  value?: string | string[];
}

export interface UiPolicyFieldEffect {
  field: string;
  visible?: boolean;
  mandatory?: boolean;
  readOnly?: boolean;
}

@Entity('itsm_ui_policies')
@Index(['tenantId', 'tableName', 'isActive'])
@Index(['tenantId', 'name'], { unique: true })
export class UiPolicy extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName: string;

  @Column({ type: 'jsonb', nullable: true })
  conditions: UiPolicyCondition[] | null;

  @Column({ name: 'field_effects', type: 'jsonb' })
  fieldEffects: UiPolicyFieldEffect[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 100 })
  order: number;
}
