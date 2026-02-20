import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcRisk } from './grc-risk.entity';
import { GrcRequirement } from './grc-requirement.entity';
import { RelationshipType } from '../enums';

/**
 * GRC Risk-Requirement Mapping Entity
 *
 * Many-to-many relationship between Risks and Requirements.
 * A risk can be related to multiple compliance requirements.
 * A requirement can be related to multiple risks.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('grc_risk_requirements')
@Index(['tenantId', 'riskId', 'requirementId'], { unique: true })
export class GrcRiskRequirement extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'risk_id', type: 'uuid' })
  @Index()
  riskId: string;

  @ManyToOne(() => GrcRisk, (risk) => risk.riskRequirements, {
    nullable: false,
  })
  @JoinColumn({ name: 'risk_id' })
  risk: GrcRisk;

  @Column({ name: 'requirement_id', type: 'uuid' })
  @Index()
  requirementId: string;

  @ManyToOne(
    () => GrcRequirement,
    (requirement) => requirement.riskRequirements,
    {
      nullable: false,
    },
  )
  @JoinColumn({ name: 'requirement_id' })
  requirement: GrcRequirement;

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
