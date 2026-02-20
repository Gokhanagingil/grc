import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GrcRisk } from '../grc-risk.entity';
import { RiskSeverity, RiskStatus } from '../../enums';

/**
 * GRC Risk History Entity
 *
 * Stores historical snapshots of risk records for compliance and audit purposes.
 * Each record represents the state of a risk at a specific point in time.
 */
@Entity('grc_risk_history')
@Index(['riskId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class GrcRiskHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'risk_id', type: 'uuid' })
  @Index()
  riskId: string;

  @ManyToOne(() => GrcRisk, { nullable: false })
  @JoinColumn({ name: 'risk_id' })
  risk: GrcRisk;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: RiskSeverity,
  })
  severity: RiskSeverity;

  @Column({
    type: 'enum',
    enum: RiskStatus,
  })
  status: RiskStatus;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @Column({ type: 'int', nullable: true })
  likelihood: number | null;

  @Column({ type: 'int', nullable: true })
  impact: number | null;

  @Column({ name: 'risk_score', type: 'int', nullable: true })
  riskScore: number | null;

  @Column({ type: 'text', nullable: true })
  mitigation: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
