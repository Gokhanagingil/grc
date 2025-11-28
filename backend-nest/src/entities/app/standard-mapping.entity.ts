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
import { enumColumnOptions } from '../../common/database/column-types';

export enum MappingRelation {
  SIMILAR = 'similar',
  OVERLAP = 'overlap',
  SUPPORTS = 'supports',
}

@Entity({ name: 'standard_mapping' })
@Index('idx_standard_mapping_tenant', ['tenant_id'])
@Index('idx_standard_mapping_from', ['from_clause_id'])
@Index('idx_standard_mapping_to', ['to_clause_id'])
@Index(
  'idx_standard_mapping_unique',
  ['from_clause_id', 'to_clause_id', 'tenant_id'],
  { unique: true },
)
export class StandardMappingEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('uuid') from_clause_id!: string;
  @ManyToOne(() => StandardClauseEntity)
  @JoinColumn({ name: 'from_clause_id' })
  from_clause?: StandardClauseEntity;
  @Column('uuid') to_clause_id!: string;
  @ManyToOne(() => StandardClauseEntity)
  @JoinColumn({ name: 'to_clause_id' })
  to_clause?: StandardClauseEntity;
  @Column({
    ...enumColumnOptions(MappingRelation, MappingRelation.SIMILAR),
  })
  relation!: MappingRelation;
  @Column({
    type: 'boolean',
    default: false,
    comment: 'Synthetic/placeholder data flag for dev thresholds',
  })
  synthetic: boolean = false;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
