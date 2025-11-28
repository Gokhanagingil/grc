import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'entity_types' })
@Index('idx_entity_types_tenant', ['tenant_id'])
@Index('idx_entity_types_code_tenant', ['code', 'tenant_id'], { unique: true })
export class EntityTypeEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column({ type: 'varchar', length: 100 }) code!: string; // Application, Database, Service, etc.
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
