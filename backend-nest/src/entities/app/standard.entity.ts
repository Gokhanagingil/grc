import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'standard' })
@Index('idx_standard_tenant', ['tenant_id'])
@Index('idx_standard_code_tenant', ['code', 'tenant_id'], { unique: true })
export class StandardEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column({ type: 'varchar', length: 50 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) version?: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) publisher?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
