import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuditFindingEntity } from './audit-finding.entity';
import {
  enumColumnOptions,
  timestampColumnType,
} from '../../common/database/column-types';

export enum CorrectiveActionStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'corrective_actions' })
@Index('idx_corrective_actions_tenant', ['tenant_id'])
@Index('idx_corrective_actions_finding', ['finding_id'])
@Index('idx_corrective_actions_status', ['status'])
export class CorrectiveActionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('uuid') finding_id!: string;
  @ManyToOne(() => AuditFindingEntity)
  @JoinColumn({ name: 'finding_id' })
  finding?: AuditFindingEntity;

  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column('uuid', { nullable: true }) assignee_user_id?: string;
  @Column({ type: 'date', nullable: true }) due_date?: Date;
  @Column({
    ...enumColumnOptions(CorrectiveActionStatus, CorrectiveActionStatus.OPEN),
  })
  status!: CorrectiveActionStatus;

  @Column({ type: timestampColumnType, nullable: true })
  closed_at?: Date;

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
