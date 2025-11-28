import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProcessControlEntity } from './process-control.entity';

@Entity({ name: 'processes' })
@Index('idx_processes_tenant', ['tenant_id'])
@Index('idx_processes_code_tenant', ['code', 'tenant_id'], { unique: true })
export class ProcessEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;

  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;

  @Column('uuid', { nullable: true }) owner_user_id?: string;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;

  @OneToMany(() => ProcessControlEntity, (control) => control.process)
  controls?: ProcessControlEntity[];

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

