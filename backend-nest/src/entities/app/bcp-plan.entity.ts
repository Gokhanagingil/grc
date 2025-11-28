import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BCPExerciseEntity } from './bcp-exercise.entity';
import {
  enumColumnOptions,
  jsonColumnType,
  timestampColumnType,
} from '../../common/database/column-types';

export enum BCPPlanStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  RETIRED = 'retired',
}

@Entity({ name: 'bcp_plans' })
@Index('idx_bcp_plans_tenant', ['tenant_id'])
@Index('idx_bcp_plans_code_tenant', ['code', 'tenant_id'], { unique: true })
export class BCPPlanEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;

  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) name!: string;

  // Scope: process_id or serviceId (entity_id) - can be JSON or FK
  @Column('uuid', { nullable: true }) process_id?: string; // BIAProcess reference
  @Column('uuid', { nullable: true }) scope_entity_id?: string; // Entity reference (if scope is entity-based)

  @Column({ type: 'varchar', length: 20, default: '1.0' }) version!: string;
  @Column({
    ...enumColumnOptions(BCPPlanStatus, BCPPlanStatus.DRAFT),
  })
  status!: BCPPlanStatus;

  // Steps as JSON array of {step: number, title: string, description: string, owner?: string}
  @Column({ type: jsonColumnType, nullable: true, default: '[]' })
  steps?: Array<{
    step: number;
    title: string;
    description?: string;
    owner?: string;
  }>;

  @Column({ type: timestampColumnType, nullable: true })
  last_tested_at?: Date;

  @OneToMany(() => BCPExerciseEntity, (ex) => ex.plan)
  exercises?: BCPExerciseEntity[];

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
