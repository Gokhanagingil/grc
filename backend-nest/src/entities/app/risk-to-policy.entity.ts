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
import { RiskCatalogEntity } from './risk-catalog.entity';
import { PolicyEntity } from './policy.entity';

/**
 * Risk-to-Policy Relationship Entity
 * 
 * Many-to-many relationship between risk catalog and policies.
 * A risk can be linked to multiple policies, and a policy can be linked to multiple risks.
 */
@Entity({ name: 'risk_to_policy' })
@Index('idx_risk_to_policy_tenant', ['tenant_id'])
@Index('idx_risk_to_policy_risk', ['risk_id'])
@Index('idx_risk_to_policy_policy', ['policy_id'])
@Index(
  'idx_risk_to_policy_unique',
  ['risk_id', 'policy_id', 'tenant_id'],
  { unique: true },
)
export class RiskToPolicyEntity {
  @PrimaryColumn('uuid') risk_id!: string;
  @ManyToOne(() => RiskCatalogEntity, (risk) => risk.related_policies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk?: RiskCatalogEntity;
  
  @PrimaryColumn('uuid') policy_id!: string;
  @ManyToOne(() => PolicyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy?: PolicyEntity;
  
  @PrimaryColumn('uuid') tenant_id!: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

