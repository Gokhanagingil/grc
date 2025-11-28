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
import { EntityTypeEntity } from './entity-type.entity';
import { jsonColumnType } from '../../common/database/column-types';

@Entity({ name: 'entities' })
@Index('idx_entities_tenant', ['tenant_id'])
@Index('idx_entities_type', ['entity_type_id'])
@Index('idx_entities_code_tenant', ['code', 'tenant_id'], { unique: true })
@Index('idx_entities_owner', ['owner_user_id'])
export class EntityEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;

  @Column('uuid') entity_type_id!: string;
  @ManyToOne(() => EntityTypeEntity)
  @JoinColumn({ name: 'entity_type_id' })
  entity_type?: EntityTypeEntity;

  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'integer', default: 3, comment: 'Criticality level (1-5)' })
  criticality!: number;
  @Column('uuid', { nullable: true }) owner_user_id?: string;
  @Column({
    type: jsonColumnType,
    nullable: true,
    default: '{}',
    comment: 'Flexible attributes (tier, repo, etc.)',
  })
  attributes?: Record<string, any>;

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
