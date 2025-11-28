import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BIAProcessDependencyEntity } from './bia-process-dependency.entity';

@Entity({ name: 'bia_processes' })
@Index('idx_bia_processes_tenant', ['tenant_id'])
@Index('idx_bia_processes_code_tenant', ['code', 'tenant_id'], { unique: true })
export class BIAProcessEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;

  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;

  @Column('uuid', { nullable: true }) owner_user_id?: string;
  @Column({ type: 'integer', default: 3, comment: 'Criticality level (1-5)' })
  criticality!: number;

  // RTO: Recovery Time Objective (hours)
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 24,
    comment: 'RTO in hours',
  })
  rto_hours!: number;

  // RPO: Recovery Point Objective (hours)
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 8,
    comment: 'RPO in hours',
  })
  rpo_hours!: number;

  // MTPD: Maximum Tolerable Period of Disruption (hours)
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 48,
    comment: 'MTPD in hours',
  })
  mtpd_hours!: number;

  @OneToMany(() => BIAProcessDependencyEntity, (dep) => dep.process)
  dependencies?: BIAProcessDependencyEntity[];

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
