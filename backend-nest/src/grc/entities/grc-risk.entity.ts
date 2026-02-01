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
import {
  RiskSeverity,
  RiskLikelihood,
  RiskStatus,
  RiskType,
  RiskAppetite,
  TreatmentStrategy,
  RiskBand,
} from '../enums';
import { GrcRiskControl } from './grc-risk-control.entity';
import { GrcIssue } from './grc-issue.entity';
import { GrcRiskPolicy } from './grc-risk-policy.entity';
import { GrcRiskRequirement } from './grc-risk-requirement.entity';
import { GrcRiskCategory } from './grc-risk-category.entity';
import { GrcRiskAssessment } from './grc-risk-assessment.entity';

/**
 * GRC Risk Entity
 *
 * Represents an identified risk in the organization's risk register.
 * Supports both inherent (before controls) and residual (after controls) scoring.
 * Risks can be linked to controls via GrcRiskControl mapping.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_risks')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'severity'])
@Index(['tenantId', 'ownerUserId'])
@Index(['tenantId', 'code'], { unique: true, where: 'code IS NOT NULL' })
@Index(['tenantId', 'status', 'createdAt'])
@Index(['tenantId', 'riskCategoryId'])
@Index(['tenantId', 'riskType'])
@Index(['tenantId', 'inherentScore'])
@Index(['tenantId', 'residualScore'])
export class GrcRisk extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'risk_category_id', type: 'uuid', nullable: true })
  riskCategoryId: string | null;

  @ManyToOne(() => GrcRiskCategory, (cat) => cat.risks, { nullable: true })
  @JoinColumn({ name: 'risk_category_id' })
  riskCategory: GrcRiskCategory | null;

  @Column({
    name: 'risk_type',
    type: 'enum',
    enum: RiskType,
    nullable: true,
  })
  riskType: RiskType | null;

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

  @Column({ name: 'inherent_likelihood', type: 'int', nullable: true })
  inherentLikelihood: number | null;

  @Column({ name: 'inherent_impact', type: 'int', nullable: true })
  inherentImpact: number | null;

  @Column({ name: 'inherent_score', type: 'int', nullable: true })
  inherentScore: number | null;

  @Column({
    name: 'inherent_band',
    type: 'enum',
    enum: RiskBand,
    nullable: true,
  })
  inherentBand: RiskBand | null;

  @Column({ name: 'residual_likelihood', type: 'int', nullable: true })
  residualLikelihood: number | null;

  @Column({ name: 'residual_impact', type: 'int', nullable: true })
  residualImpact: number | null;

  @Column({ name: 'residual_score', type: 'int', nullable: true })
  residualScore: number | null;

  @Column({
    name: 'residual_band',
    type: 'enum',
    enum: RiskBand,
    nullable: true,
  })
  residualBand: RiskBand | null;

  @Column({
    name: 'risk_appetite',
    type: 'enum',
    enum: RiskAppetite,
    nullable: true,
  })
  riskAppetite: RiskAppetite | null;

  @Column({
    name: 'treatment_strategy',
    type: 'enum',
    enum: TreatmentStrategy,
    nullable: true,
  })
  treatmentStrategy: TreatmentStrategy | null;

  @Column({ name: 'treatment_plan', type: 'text', nullable: true })
  treatmentPlan: string | null;

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

  @Column({
    name: 'owner_display_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ownerDisplayName: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate: Date | null;

  @Column({ name: 'last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt: Date | null;

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

  @OneToMany(() => GrcRiskPolicy, (rp) => rp.risk)
  riskPolicies: GrcRiskPolicy[];

  @OneToMany(() => GrcRiskRequirement, (rr) => rr.risk)
  riskRequirements: GrcRiskRequirement[];

  @OneToMany(() => GrcRiskAssessment, (assessment) => assessment.risk)
  assessments: GrcRiskAssessment[];
}
