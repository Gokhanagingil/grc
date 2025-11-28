import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'regulations' })
@Index('idx_regulations_tenant', ['tenant_id'])
@Index('idx_regulations_code_tenant', ['code', 'tenant_id'], { unique: true })
export class RegulationEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column('uuid') tenant_id!: string;

  @Column({ type: 'varchar', length: 50 }) code!: string;

  @Column({ type: 'text' }) title!: string;

  @Column({ type: 'text', nullable: true }) description?: string;

  @Column({ type: 'varchar', length: 100, nullable: true }) publisher?: string;

  @Column({ type: 'varchar', length: 20, nullable: true }) version?: string;

  @CreateDateColumn() created_at!: Date;

  @UpdateDateColumn() updated_at!: Date;
}

