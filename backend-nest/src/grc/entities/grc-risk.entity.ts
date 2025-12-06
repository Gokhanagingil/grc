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
import { User } from '../../users/user.entity';
import { RiskSeverity, RiskLikelihood, RiskStatus } from '../enums';
import { GrcRiskControl } from './grc-risk-control.entity';
import { GrcIssue } from './grc-issue.entity';

/**
 * GRC Risk Entity
 *
 * Represents an identified risk in the organization's risk register.
 * Risks can be linked to controls via GrcRiskControl mapping.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_risks')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'severity'])
@Index(['tenantId', 'ownerUserId'])
@Index(['tenantId', 'status', 'createdAt'])
export class GrcRisk extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({
    type: 'enum',
    enum: RiskSeverity,
    default: RiskSeverity.MEDIUM,
  })
  severity: RiskSeverity;

  @Column({
    type: 'enum',
    enum: RiskLikelihood,
    default: RiskLikelihood.POSSIBLE,
  })
  likelihood: RiskLikelihood;

  @Column({
    type: 'enum',
    enum: RiskSeverity,
    default: RiskSeverity.MEDIUM,
    name: 'impact',
  })
  impact: RiskSeverity;

  @Column({ type: 'int', nullable: true })
  score: number | null;

  @Column({
    type: 'enum',
    enum: RiskStatus,
    default: RiskStatus.DRAFT,
  })
  status: RiskStatus;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'mitigation_plan', type: 'text', nullable: true })
  mitigationPlan: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => GrcRiskControl, (rc) => rc.risk)
  riskControls: GrcRiskControl[];

  @OneToMany(() => GrcIssue, (issue) => issue.risk)
  issues: GrcIssue[];
}
