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
import { ProcessEntity } from './process.entity';
import { enumColumnOptions } from '../../common/database/column-types';

export enum ProcessControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
}

export enum ProcessControlFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  EVENT_BASED = 'event_based',
  CONTINUOUS = 'continuous',
}

@Entity({ name: 'process_controls' })
@Index('idx_process_controls_tenant', ['tenant_id'])
@Index('idx_process_controls_code_tenant', ['code', 'tenant_id'], { unique: true })
@Index('idx_process_controls_process', ['process_id'])
export class ProcessControlEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;

  @Column('uuid') process_id!: string;
  @ManyToOne(() => ProcessEntity)
  @JoinColumn({ name: 'process_id' })
  process?: ProcessEntity;

  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;

  @Column({
    ...enumColumnOptions(ProcessControlType, ProcessControlType.PREVENTIVE),
  })
  control_type!: ProcessControlType;

  @Column({
    ...enumColumnOptions(ProcessControlFrequency, ProcessControlFrequency.MONTHLY),
  })
  frequency!: ProcessControlFrequency;

  @Column('uuid', { nullable: true }) owner_user_id?: string;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

