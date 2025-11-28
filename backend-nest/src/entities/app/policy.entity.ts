import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'policies' })
@Index('idx_policies_tenant', ['tenant_id'])
export class PolicyEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column({ type: 'text' }) code!: string;
  // Standardized on 'title' column (matches Postgres migrations)
  @Column({ type: 'text' }) title!: string;
  @Column({ type: 'text' }) status!: string;
  @Column({ type: 'text', nullable: true }) owner_first_name?: string;
  @Column({ type: 'text', nullable: true }) owner_last_name?: string;
  @Column({ type: 'date', nullable: true }) effective_date?: string;
  @Column({ type: 'date', nullable: true }) review_date?: string;
  @Column({ type: 'text', nullable: true }) content?: string;
  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
