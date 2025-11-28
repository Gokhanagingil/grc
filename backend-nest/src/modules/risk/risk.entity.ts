import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'risks' })
@Index('idx_risks_tenant_id', ['tenant_id'])
export class RiskEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column('uuid') tenant_id!: string;

  @Column({ length: 160 }) title!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ length: 80, nullable: true }) category?: string;
  @Column({ length: 32, default: 'Medium' }) severity!: string;
  @Column({ length: 32, default: 'Medium' }) likelihood!: string;
  @Column({ length: 32, default: 'Medium' }) impact!: string;
  @Column({ type: 'int', default: 0 }) risk_score!: number;
  @Column({ length: 32, default: 'open' }) status!: string;
  @Column({ type: 'text', nullable: true }) mitigation_plan?: string;
  @Column({ type: 'date', nullable: true }) due_date?: string;
  @Column({ length: 80, nullable: true }) owner_first_name?: string;
  @Column({ length: 80, nullable: true }) owner_last_name?: string;
  @Column({ length: 80, nullable: true }) assigned_first_name?: string;
  @Column({ length: 80, nullable: true }) assigned_last_name?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
  @DeleteDateColumn() deleted_at?: Date;
}
