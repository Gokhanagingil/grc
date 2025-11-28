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
import { BIAProcessEntity } from './bia-process.entity';
import { EntityEntity } from './entity.entity';
import { enumColumnOptions } from '../../common/database/column-types';

export enum DependencyType {
  APPLICATION = 'app',
  DATABASE = 'db',
  SERVICE = 'service',
  VENDOR = 'vendor',
  OTHER = 'other',
}

@Entity({ name: 'bia_process_dependencies' })
@Index('idx_bia_deps_tenant', ['tenant_id'])
@Index('idx_bia_deps_process', ['process_id'])
@Index('idx_bia_deps_entity', ['entity_id'])
export class BIAProcessDependencyEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;

  @Column('uuid') process_id!: string;
  @ManyToOne(() => BIAProcessEntity)
  @JoinColumn({ name: 'process_id' })
  process?: BIAProcessEntity;

  @Column('uuid') entity_id!: string;
  @ManyToOne(() => EntityEntity)
  @JoinColumn({ name: 'entity_id' })
  entity?: EntityEntity;

  @Column({
    ...enumColumnOptions(DependencyType, DependencyType.OTHER),
  })
  dependency_type!: DependencyType;

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
