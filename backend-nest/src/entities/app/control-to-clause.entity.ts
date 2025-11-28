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
import { ControlLibraryEntity } from './control-library.entity';
import { StandardClauseEntity } from './standard-clause.entity';

@Entity({ name: 'control_to_clause' })
@Index('idx_control_to_clause_tenant', ['tenant_id'])
@Index('idx_control_to_clause_control', ['control_id'])
@Index('idx_control_to_clause_clause', ['clause_id'])
@Index(
  'idx_control_to_clause_unique',
  ['control_id', 'clause_id', 'tenant_id'],
  { unique: true },
)
export class ControlToClauseEntity {
  @PrimaryColumn('uuid') control_id!: string;
  @ManyToOne(() => ControlLibraryEntity)
  @JoinColumn({ name: 'control_id' })
  control?: ControlLibraryEntity;
  @PrimaryColumn('uuid') clause_id!: string;
  @ManyToOne(() => StandardClauseEntity)
  @JoinColumn({ name: 'clause_id' })
  clause?: StandardClauseEntity;
  @PrimaryColumn('uuid') tenant_id!: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
