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
import { PolicyEntity } from './policy.entity';
import { StandardEntity } from './standard.entity';

/**
 * Policy-Standard Mapping Entity
 * 
 * Many-to-many relationship between policies and standards
 * A policy can be mapped to multiple standards, and a standard can be mapped to multiple policies
 */
@Entity({ name: 'policy_standards' })
@Index('idx_policy_standards_tenant', ['tenant_id'])
@Index('idx_policy_standards_policy', ['policy_id'])
@Index('idx_policy_standards_standard', ['standard_id'])
@Index(
  'idx_policy_standards_unique',
  ['policy_id', 'standard_id', 'tenant_id'],
  { unique: true },
)
export class PolicyStandardEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  
  @Column('uuid') policy_id!: string;
  @ManyToOne(() => PolicyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy?: PolicyEntity;
  
  @Column('uuid') standard_id!: string;
  @ManyToOne(() => StandardEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'standard_id' })
  standard?: StandardEntity;
  
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

