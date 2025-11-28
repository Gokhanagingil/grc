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
import { StandardClauseEntity } from './standard-clause.entity';
import { jsonColumnType } from '../../common/database/column-types';

@Entity({ name: 'control_library' })
@Index('idx_control_library_tenant', ['tenant_id'])
@Index('idx_control_library_code_tenant', ['code', 'tenant_id'], {
  unique: true,
})
@Index('idx_control_library_family', ['family'])
@Index('idx_control_library_clause', ['clause_id'])
export class ControlLibraryEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) family?: string;
  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0.3,
    comment: 'Control effectiveness (0-1)',
  })
  effectiveness?: number;
  @Column({ type: jsonColumnType, nullable: true, default: '[]' })
  references?: string[];

  // Phase 12: Control-Clause relation
  @Column('uuid', { nullable: true }) clause_id?: string;
  @ManyToOne(() => StandardClauseEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'clause_id' })
  clause?: StandardClauseEntity;

  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
