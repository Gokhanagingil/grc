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
import { AuditEvidenceEntity } from './audit-evidence.entity';
import { enumColumnOptions } from '../../common/database/column-types';

export enum AuditTestStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity({ name: 'audit_tests' })
@Index('idx_audit_tests_tenant', ['tenant_id'])
@Index('idx_audit_tests_code_tenant', ['code', 'tenant_id'], { unique: true })
@Index('idx_audit_tests_engagement', ['engagement_id'])
export class AuditTestEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('uuid') engagement_id!: string;
  @ManyToOne(() => AuditEngagementEntity)
  @JoinColumn({ name: 'engagement_id' })
  engagement?: AuditEngagementEntity;

  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text', nullable: true }) objective?: string;
  @Column({ type: 'text', nullable: true }) population_ref?: string;
  @Column('uuid', { nullable: true }) clause_id?: string; // StandardClause reference
  @Column('uuid', { nullable: true }) control_id?: string; // ProcessControl reference
  @Column({
    ...enumColumnOptions(AuditTestStatus, AuditTestStatus.PLANNED),
  })
  status!: AuditTestStatus;

  @OneToMany(() => AuditEvidenceEntity, (evidence) => evidence.test)
  evidences?: AuditEvidenceEntity[];

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
