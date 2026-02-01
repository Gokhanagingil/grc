import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcRisk } from './grc-risk.entity';

/**
 * GRC Risk Category Entity
 *
 * Represents a risk category for organizing risks in the risk register.
 * Categories are tenant-scoped and can be customized per organization.
 * Examples: Cyber, Compliance, Operational, Strategic, Financial
 */
@Entity('grc_risk_categories')
@Index(['tenantId', 'name'], { unique: true })
export class GrcRiskCategory extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => GrcRisk, (risk) => risk.riskCategory)
  risks: GrcRisk[];
}
