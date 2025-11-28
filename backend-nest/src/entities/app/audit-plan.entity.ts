import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuditEngagementEntity } from './audit-engagement.entity';
import {
  enumColumnOptions,
  timestampColumnType,
} from '../../common/database/column-types';

export enum AuditPlanStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

@Entity({ name: 'audit_plans' })
@Index('idx_audit_plans_tenant', ['tenant_id'])
@Index('idx_audit_plans_code_tenant', ['code', 'tenant_id'], { unique: true })
export class AuditPlanEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'date' }) period_start!: Date;
  @Column({ type: 'date' }) period_end!: Date;
  @Column({ type: 'text', nullable: true }) scope?: string;
  @Column({
    ...enumColumnOptions(AuditPlanStatus, AuditPlanStatus.PLANNED),
  })
  status!: AuditPlanStatus;

  @OneToMany(() => AuditEngagementEntity, (engagement) => engagement.plan)
  engagements?: AuditEngagementEntity[];

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
  @Column({ type: timestampColumnType, nullable: true })
  archived_at?: Date;
}
