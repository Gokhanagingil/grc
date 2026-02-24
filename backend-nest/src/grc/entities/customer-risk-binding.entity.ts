import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { CustomerRiskCatalog } from './customer-risk-catalog.entity';

@Entity('customer_risk_binding')
@Unique(['tenantId', 'catalogRiskId', 'targetType', 'targetId'])
@Index(['tenantId', 'catalogRiskId'])
@Index(['tenantId', 'targetType', 'targetId'])
@Index(['tenantId', 'enabled'])
export class CustomerRiskBinding extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'catalog_risk_id', type: 'uuid' })
  catalogRiskId: string;

  @ManyToOne(() => CustomerRiskCatalog, (c) => c.bindings, { nullable: false })
  @JoinColumn({ name: 'catalog_risk_id' })
  catalogRisk: CustomerRiskCatalog;

  @Column({ name: 'target_type', type: 'varchar', length: 30 })
  targetType: string;

  @Column({ name: 'target_id', type: 'varchar', length: 255 })
  targetId: string;

  @Column({
    name: 'scope_mode',
    type: 'varchar',
    length: 20,
    default: 'DIRECT',
  })
  scopeMode: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
