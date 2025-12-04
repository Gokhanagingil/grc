import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import {
  ControlType,
  ControlImplementationType,
  ControlStatus,
  ControlFrequency,
} from '../enums';
import { GrcRiskControl } from './grc-risk-control.entity';
import { GrcPolicyControl } from './grc-policy-control.entity';
import { GrcRequirementControl } from './grc-requirement-control.entity';
import { GrcIssue } from './grc-issue.entity';

/**
 * GRC Control Entity
 *
 * Represents a control activity that mitigates risks and implements policies.
 * Controls are the central hub linking Risks, Policies, and Requirements.
 */
@Entity('grc_controls')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'code'], { unique: true, where: 'code IS NOT NULL' })
export class GrcControl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ControlType,
    default: ControlType.PREVENTIVE,
  })
  type: ControlType;

  @Column({
    name: 'implementation_type',
    type: 'enum',
    enum: ControlImplementationType,
    default: ControlImplementationType.MANUAL,
  })
  implementationType: ControlImplementationType;

  @Column({
    type: 'enum',
    enum: ControlStatus,
    default: ControlStatus.DRAFT,
  })
  status: ControlStatus;

  @Column({
    type: 'enum',
    enum: ControlFrequency,
    nullable: true,
  })
  frequency: ControlFrequency | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: Date | null;

  @Column({ name: 'last_tested_date', type: 'date', nullable: true })
  lastTestedDate: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => GrcRiskControl, (rc) => rc.control)
  riskControls: GrcRiskControl[];

  @OneToMany(() => GrcPolicyControl, (pc) => pc.control)
  policyControls: GrcPolicyControl[];

  @OneToMany(() => GrcRequirementControl, (rc) => rc.control)
  requirementControls: GrcRequirementControl[];

  @OneToMany(() => GrcIssue, (issue) => issue.control)
  issues: GrcIssue[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
