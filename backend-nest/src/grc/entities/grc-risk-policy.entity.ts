import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcRisk } from './grc-risk.entity';
import { GrcPolicy } from './grc-policy.entity';
import { RelationshipType } from '../enums';

/**
 * GRC Risk-Policy Mapping Entity
 *
 * Many-to-many relationship between Risks and Policies.
 * A risk can be addressed by multiple policies.
 * A policy can address multiple risks.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('grc_risk_policies')
@Index(['tenantId', 'riskId', 'policyId'], { unique: true })
export class GrcRiskPolicy extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'risk_id', type: 'uuid' })
  @Index()
  riskId: string;

  @ManyToOne(() => GrcRisk, (risk) => risk.riskPolicies, { nullable: false })
  @JoinColumn({ name: 'risk_id' })
  risk: GrcRisk;

  @Column({ name: 'policy_id', type: 'uuid' })
  @Index()
  policyId: string;

  @ManyToOne(() => GrcPolicy, (policy) => policy.riskPolicies, {
    nullable: false,
  })
  @JoinColumn({ name: 'policy_id' })
  policy: GrcPolicy;

  @Column({
    name: 'relationship_type',
    type: 'enum',
    enum: RelationshipType,
    nullable: true,
  })
  relationshipType: RelationshipType | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
