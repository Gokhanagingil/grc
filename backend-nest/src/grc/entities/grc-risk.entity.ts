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
import { RiskSeverity, RiskLikelihood, RiskStatus } from '../enums';
import { GrcRiskControl } from './grc-risk-control.entity';
import { GrcIssue } from './grc-issue.entity';

/**
 * GRC Risk Entity
 *
 * Represents an identified risk in the organization's risk register.
 * Risks can be linked to controls via GrcRiskControl mapping.
 */
@Entity('grc_risks')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'severity'])
@Index(['tenantId', 'ownerUserId'])
@Index(['tenantId', 'updatedAt'])
export class GrcRisk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

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

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @OneToMany(() => GrcRiskControl, (rc) => rc.risk)
  riskControls: GrcRiskControl[];

  @OneToMany(() => GrcIssue, (issue) => issue.risk)
  issues: GrcIssue[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
