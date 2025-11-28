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
import { AuditPlanEntity } from './audit-plan.entity';
import { AuditTestEntity } from './audit-test.entity';
import { AuditFindingEntity } from './audit-finding.entity';
import { enumColumnOptions } from '../../common/database/column-types';

export enum AuditEngagementStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'audit_engagements' })
@Index('idx_audit_engagements_tenant', ['tenant_id'])
@Index('idx_audit_engagements_code_tenant', ['code', 'tenant_id'], {
  unique: true,
})
@Index('idx_audit_engagements_plan', ['plan_id'])
export class AuditEngagementEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('uuid') plan_id!: string;
  @ManyToOne(() => AuditPlanEntity)
  @JoinColumn({ name: 'plan_id' })
  plan?: AuditPlanEntity;

  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text', nullable: true }) auditee?: string; // String or can be entity reference later
  @Column('uuid', { nullable: true }) lead_auditor_id?: string;
  @Column({
    ...enumColumnOptions(AuditEngagementStatus, AuditEngagementStatus.PLANNED),
  })
  status!: AuditEngagementStatus;

  @OneToMany(() => AuditTestEntity, (test) => test.engagement)
  tests?: AuditTestEntity[];

  @OneToMany(() => AuditFindingEntity, (finding) => finding.engagement)
  findings?: AuditFindingEntity[];

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
