import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'risk_category' })
@Index('idx_risk_category_tenant', ['tenant_id'])
@Index('idx_risk_category_code_tenant', ['code', 'tenant_id'], { unique: true })
export class RiskCategoryEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column({ type: 'varchar', length: 50 }) code!: string;
  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
