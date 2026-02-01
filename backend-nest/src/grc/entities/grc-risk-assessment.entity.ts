import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { GrcRisk } from './grc-risk.entity';
import { AssessmentType, RiskBand } from '../enums';

/**
 * GRC Risk Assessment Entity
 *
 * Represents a point-in-time assessment of a risk.
 * Captures likelihood, impact, and score snapshots for audit trail and trending.
 * Supports both inherent (before controls) and residual (after controls) assessments.
 */
@Entity('grc_risk_assessments')
@Index(['tenantId', 'riskId'])
@Index(['tenantId', 'assessedAt'])
export class GrcRiskAssessment extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'risk_id', type: 'uuid' })
  @Index()
  riskId: string;

  @ManyToOne(() => GrcRisk, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: GrcRisk;

  @Column({
    name: 'assessment_type',
    type: 'enum',
    enum: AssessmentType,
    default: AssessmentType.INHERENT,
  })
  assessmentType: AssessmentType;

  @Column({ type: 'int' })
  likelihood: number;

  @Column({ type: 'int' })
  impact: number;

  @Column({ type: 'int' })
  score: number;

  @Column({
    type: 'enum',
    enum: RiskBand,
    default: RiskBand.MEDIUM,
  })
  band: RiskBand;

  @Column({ type: 'text', nullable: true })
  rationale: string | null;

  @Column({ name: 'assessed_at', type: 'timestamptz' })
  assessedAt: Date;

  @Column({ name: 'assessed_by_user_id', type: 'uuid', nullable: true })
  assessedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assessed_by_user_id' })
  assessedBy: User | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
