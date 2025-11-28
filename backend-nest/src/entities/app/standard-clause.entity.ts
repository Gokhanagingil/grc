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
import { StandardEntity } from './standard.entity';

@Entity({ name: 'standard_clause' })
@Index('idx_standard_clause_tenant', ['tenant_id'])
@Index('idx_standard_clause_standard', ['standard_id'])
@Index('idx_standard_clause_parent', ['parent_id'])
@Index('idx_standard_clause_code_tenant', ['standard_id', 'clause_code', 'tenant_id'], {
  unique: true,
})
@Index('idx_standard_clause_path', ['path'])
export class StandardClauseEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('uuid') standard_id!: string;
  @ManyToOne(() => StandardEntity)
  @JoinColumn({ name: 'standard_id' })
  standard?: StandardEntity;
  @Column({ type: 'varchar', length: 100 }) clause_code!: string;
  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text', nullable: true }) text?: string;
  @Column('uuid', { nullable: true }) parent_id?: string;
  @ManyToOne(() => StandardClauseEntity, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: StandardClauseEntity;
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: 'Path like ISO27001:5.1.1',
  })
  path?: string;
  @Column({
    type: 'boolean',
    default: false,
    comment: 'Synthetic/placeholder data flag for dev thresholds',
  })
  synthetic: boolean = false;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
