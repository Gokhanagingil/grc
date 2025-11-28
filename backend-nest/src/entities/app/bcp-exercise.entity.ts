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
import { BCPPlanEntity } from './bcp-plan.entity';

@Entity({ name: 'bcp_exercises' })
@Index('idx_bcp_exercises_tenant', ['tenant_id'])
@Index('idx_bcp_exercises_plan', ['plan_id'])
@Index('idx_bcp_exercises_code_tenant', ['code', 'tenant_id'], { unique: true })
export class BCPExerciseEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;

  @Column('uuid') plan_id!: string;
  @ManyToOne(() => BCPPlanEntity)
  @JoinColumn({ name: 'plan_id' })
  plan?: BCPPlanEntity;

  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'date' }) date!: Date;
  @Column({ type: 'text', nullable: true }) scenario?: string;
  @Column({ type: 'text', nullable: true }) result?: string;

  // Counts for findings and CAPs discovered during exercise
  @Column({ type: 'integer', default: 0 }) findings_count!: number;
  @Column({ type: 'integer', default: 0 }) caps_count!: number;

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
