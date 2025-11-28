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
import { RequirementEntity } from '../../modules/compliance/comp.entity';

/**
 * Risk-to-Requirement Relationship Entity
 * 
 * Many-to-many relationship between risk catalog and compliance requirements.
 * A risk can be linked to multiple requirements, and a requirement can be linked to multiple risks.
 */
@Entity({ name: 'risk_to_requirement' })
@Index('idx_risk_to_requirement_tenant', ['tenant_id'])
@Index('idx_risk_to_requirement_risk', ['risk_id'])
@Index('idx_risk_to_requirement_requirement', ['requirement_id'])
@Index(
  'idx_risk_to_requirement_unique',
  ['risk_id', 'requirement_id', 'tenant_id'],
  { unique: true },
)
export class RiskToRequirementEntity {
  @PrimaryColumn('uuid') risk_id!: string;
  @ManyToOne(() => RiskCatalogEntity, (risk) => risk.related_requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk?: RiskCatalogEntity;
  
  @PrimaryColumn('uuid') requirement_id!: string;
  @ManyToOne(() => RequirementEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requirement_id' })
  requirement?: RequirementEntity;
  
  @PrimaryColumn('uuid') tenant_id!: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

