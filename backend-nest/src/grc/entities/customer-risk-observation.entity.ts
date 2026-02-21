import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { CustomerRiskCatalog } from './customer-risk-catalog.entity';

@Entity('customer_risk_observation')
@Index(['tenantId', 'catalogRiskId'])
@Index(['tenantId', 'targetType', 'targetId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'observedAt'])
export class CustomerRiskObservation extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'catalog_risk_id', type: 'uuid' })
  catalogRiskId: string;

  @ManyToOne(() => CustomerRiskCatalog, (c) => c.observations, { nullable: false })
  @JoinColumn({ name: 'catalog_risk_id' })
  catalogRisk: CustomerRiskCatalog;

  @Column({ name: 'target_type', type: 'varchar', length: 30 })
  targetType: string;

  @Column({ name: 'target_id', type: 'varchar', length: 255 })
  targetId: string;

  @Column({ name: 'observed_at', type: 'timestamptz', default: () => 'NOW()' })
  observedAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: string;

  @Column({ name: 'evidence_type', type: 'varchar', length: 30, default: 'MANUAL' })
  evidenceType: string;

  @Column({ name: 'evidence_ref', type: 'varchar', length: 255, nullable: true })
  evidenceRef: string | null;

  @Column({ name: 'raw_signal', type: 'jsonb', nullable: true })
  rawSignal: Record<string, unknown> | null;

  @Column({ name: 'calculated_score', type: 'numeric', precision: 10, scale: 2, nullable: true })
  calculatedScore: number | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'waived_by', type: 'uuid', nullable: true })
  waivedBy: string | null;

  @Column({ name: 'waived_at', type: 'timestamptz', nullable: true })
  waivedAt: Date | null;

  @Column({ name: 'waiver_reason', type: 'text', nullable: true })
  waiverReason: string | null;
}
