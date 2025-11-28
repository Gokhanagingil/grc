import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuditEngagementEntity } from './audit-engagement.entity';
import { AuditTestEntity } from './audit-test.entity';
import { CorrectiveActionEntity } from './corrective-action.entity';
import { enumColumnOptions } from '../../common/database/column-types';

export enum AuditFindingSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AuditFindingStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed',
}

@Entity({ name: 'audit_findings' })
@Index('idx_audit_findings_tenant', ['tenant_id'])
@Index('idx_audit_findings_engagement', ['engagement_id'])
@Index('idx_audit_findings_test', ['test_id'])
@Index('idx_audit_findings_status', ['status'])
export class AuditFindingEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('uuid') engagement_id!: string;
  @ManyToOne(() => AuditEngagementEntity)
  @JoinColumn({ name: 'engagement_id' })
  engagement?: AuditEngagementEntity;

  @Column('uuid', { nullable: true }) test_id?: string;
  @ManyToOne(() => AuditTestEntity, { nullable: true })
  @JoinColumn({ name: 'test_id' })
  test?: AuditTestEntity;

  @Column({
    ...enumColumnOptions(
      AuditFindingSeverity,
      AuditFindingSeverity.MEDIUM,
    ),
  })
  severity!: AuditFindingSeverity;

  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'text', nullable: true }) details?: string; // Alias for description
  @Column({ type: 'text', nullable: true }) root_cause?: string;
  @Column({
    ...enumColumnOptions(AuditFindingStatus, AuditFindingStatus.OPEN),
  })
  status!: AuditFindingStatus;

  @Column({ type: 'date', nullable: true }) due_date?: Date;

  // GRC Links (optional)
  @Column('uuid', { nullable: true }) policy_id?: string;
  @Column('uuid', { nullable: true }) clause_id?: string;
  @Column('uuid', { nullable: true }) control_id?: string;
  @Column('uuid', { nullable: true }) risk_instance_id?: string;
  @Column('uuid', { nullable: true }) bia_process_id?: string; // BCM link

  @OneToMany(() => CorrectiveActionEntity, (cap) => cap.finding)
  corrective_actions?: CorrectiveActionEntity[];

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
