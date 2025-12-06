import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcPolicy } from './grc-policy.entity';
import { GrcControl } from './grc-control.entity';
import { CoverageLevel } from '../enums';

/**
 * GRC Policy-Control Mapping Entity
 *
 * Many-to-many relationship between Policies and Controls.
 * A policy can be implemented by multiple controls.
 * A control can implement multiple policies.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('grc_policy_controls')
@Index(['tenantId', 'policyId', 'controlId'], { unique: true })
export class GrcPolicyControl extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'policy_id', type: 'uuid' })
  @Index()
  policyId: string;

  @ManyToOne(() => GrcPolicy, (policy) => policy.policyControls, {
    nullable: false,
  })
  @JoinColumn({ name: 'policy_id' })
  policy: GrcPolicy;

  @Column({ name: 'control_id', type: 'uuid' })
  @Index()
  controlId: string;

  @ManyToOne(() => GrcControl, (control) => control.policyControls, {
    nullable: false,
  })
  @JoinColumn({ name: 'control_id' })
  control: GrcControl;

  @Column({
    name: 'coverage_level',
    type: 'enum',
    enum: CoverageLevel,
    nullable: true,
  })
  coverageLevel: CoverageLevel | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
