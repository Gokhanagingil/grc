import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

@Entity('itsm_ui_actions')
@Index(['tenantId', 'tableName', 'isActive'])
@Index(['tenantId', 'name'], { unique: true })
export class UiAction extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName: string;

  @Column({
    name: 'workflow_transition',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  workflowTransition: string | null;

  @Column({ name: 'required_roles', type: 'jsonb', nullable: true })
  requiredRoles: string[] | null;

  @Column({ name: 'show_conditions', type: 'jsonb', nullable: true })
  showConditions:
    | { field: string; operator: string; value?: string | string[] }[]
    | null;

  @Column({ type: 'varchar', length: 20, default: 'secondary' })
  style: string;

  @Column({ type: 'int', default: 100 })
  order: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
