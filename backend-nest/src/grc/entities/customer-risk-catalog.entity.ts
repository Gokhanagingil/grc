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
import { CustomerRiskBinding } from './customer-risk-binding.entity';
import { CustomerRiskObservation } from './customer-risk-observation.entity';

@Entity('customer_risk_catalog')
@Index(['tenantId', 'code'], { unique: true, where: 'code IS NOT NULL' })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'category'])
@Index(['tenantId', 'severity'])
@Index(['tenantId', 'signalType'])
export class CustomerRiskCatalog extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ name: 'signal_type', type: 'varchar', length: 50 })
  signalType: string;

  @Column({ type: 'varchar', length: 20 })
  severity: string;

  @Column({ name: 'likelihood_weight', type: 'int', default: 50 })
  likelihoodWeight: number;

  @Column({ name: 'impact_weight', type: 'int', default: 50 })
  impactWeight: number;

  @Column({
    name: 'score_contribution_model',
    type: 'varchar',
    length: 30,
    default: 'FLAT_POINTS',
  })
  scoreContributionModel: string;

  @Column({ name: 'score_value', type: 'numeric', precision: 10, scale: 2, default: 0 })
  scoreValue: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ name: 'owner_group', type: 'varchar', length: 255, nullable: true })
  ownerGroup: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  owner: string | null;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true })
  validTo: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ type: 'varchar', length: 30, default: 'MANUAL' })
  source: string;

  @Column({ name: 'source_ref', type: 'varchar', length: 255, nullable: true })
  sourceRef: string | null;

  @Column({ type: 'text', nullable: true })
  rationale: string | null;

  @Column({ name: 'remediation_guidance', type: 'text', nullable: true })
  remediationGuidance: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => CustomerRiskBinding, (b) => b.catalogRisk)
  bindings: CustomerRiskBinding[];

  @OneToMany(() => CustomerRiskObservation, (o) => o.catalogRisk)
  observations: CustomerRiskObservation[];
}
