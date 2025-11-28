import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { StandardClauseEntity } from '../../entities/app/standard-clause.entity';
import { RegulationEntity } from '../../entities/app/regulation.entity';
import { jsonColumnType } from '../../common/database/column-types';

@Entity({ name: 'requirements' })
@Index('idx_requirements_policy', ['policy_id'])
@Index('idx_requirements_clause', ['clause_id'])
@Index('idx_requirements_tenant', ['tenant_id'])
export class RequirementEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column({ length: 160 }) title!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  
  // Regulation reference (optional UUID - for future reference field support)
  @Column('uuid', { nullable: true }) regulation_id?: string;
  @ManyToOne(() => RegulationEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'regulation_id' })
  regulationRef?: RegulationEntity;
  
  // Regulation string field (for backward compatibility - can store code or name)
  // TODO: Migrate to regulation_id reference in future
  @Column({ length: 120, nullable: true }) regulation?: string;
  
  // Category: JSON array for multi-select support (e.g., ['IT', 'Security'])
  // TODO: Migrate from string to array in future
  @Column({ type: jsonColumnType, nullable: true })
  categories?: string[];
  
  // Legacy category string field (for backward compatibility)
  // Note: Frontend can send either 'category' (string) or 'categories' (array)
  @Column({ length: 80, nullable: true }) category?: string;
  
  @Column({ length: 32, default: 'pending' }) status!: string;
  @Column({ type: 'date', nullable: true }) due_date?: string;
  @Column({ type: 'text', nullable: true }) evidence?: string;
  @Column({ length: 80, nullable: true }) owner_first_name?: string;
  @Column({ length: 80, nullable: true }) owner_last_name?: string;
  @Column({ length: 80, nullable: true }) assigned_first_name?: string;
  @Column({ length: 80, nullable: true }) assigned_last_name?: string;

  // Phase 12: Policy-Compliance relation
  @Column('uuid', { nullable: true }) policy_id?: string;
  @ManyToOne(() => PolicyEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'policy_id' })
  policy?: PolicyEntity;

  // Phase 12: Compliance-Clause relation
  @Column('uuid', { nullable: true }) clause_id?: string;
  @ManyToOne(() => StandardClauseEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'clause_id' })
  clause?: StandardClauseEntity;

  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
  @DeleteDateColumn() deleted_at?: Date;
}
