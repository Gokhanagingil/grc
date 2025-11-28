import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RiskCategoryEntity } from './risk-category.entity';
import { EntityType } from './risk-instance.entity';
import { jsonColumnType } from '../../common/database/column-types';
import { RiskToControlEntity } from './risk-to-control.entity';
import { RiskToPolicyEntity } from './risk-to-policy.entity';
import { RiskToRequirementEntity } from './risk-to-requirement.entity';
import { RiskInstanceEntity } from './risk-instance.entity';
import { RiskCatalogAttachmentEntity } from './risk-catalog-attachment.entity';

export enum ImpactArea {
  CONFIDENTIALITY = 'Confidentiality',
  INTEGRITY = 'Integrity',
  AVAILABILITY = 'Availability',
  FINANCE = 'Finance',
  LEGAL = 'Legal',
  COMPLIANCE = 'Compliance',
  REPUTATION = 'Reputation',
  OPERATIONAL = 'Operational',
}

@Entity({ name: 'risk_catalog' })
@Index('idx_risk_catalog_tenant', ['tenant_id'])
@Index('idx_risk_catalog_category', ['category_id'])
@Index('idx_risk_catalog_code_tenant', ['code', 'tenant_id'], { unique: true })
export class RiskCatalogEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  
  @Column({ type: 'varchar', length: 100 }) code!: string;
  @Column({ type: 'text' }) title!: string; // Renamed from name to title
  @Column({ type: 'text', nullable: true }) name?: string; // Keep for backward compatibility
  @Column({ type: 'text', nullable: true }) risk_statement?: string;
  @Column({ type: 'text', nullable: true }) root_cause?: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  
  @Column('uuid', { nullable: true }) category_id?: string;
  @ManyToOne(() => RiskCategoryEntity, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: RiskCategoryEntity;
  
  @Column({ type: jsonColumnType, nullable: true, default: '[]' })
  impact_areas?: ImpactArea[];
  
  @Column({ type: 'int', default: 3, comment: 'Default inherent likelihood 1-5' })
  default_inherent_likelihood!: number;
  @Column({ type: 'int', default: 3, comment: 'Default inherent impact 1-5' })
  default_inherent_impact!: number;
  @Column({ type: 'int', default: 9, comment: 'Auto-calculated: default_inherent_likelihood × default_inherent_impact' })
  default_inherent_score!: number;
  
  // Backward compatibility fields (deprecated, use default_inherent_*)
  @Column({ type: 'int', default: 3, comment: 'Deprecated: use default_inherent_likelihood' })
  default_likelihood!: number;
  @Column({ type: 'int', default: 3, comment: 'Deprecated: use default_inherent_impact' })
  default_impact!: number;
  
  // N:N Relationships via junction tables
  @OneToMany(() => RiskToControlEntity, (rtc) => rtc.risk)
  related_controls?: RiskToControlEntity[];
  
  @OneToMany(() => RiskToPolicyEntity, (rtp) => rtp.risk)
  related_policies?: RiskToPolicyEntity[];
  
  @OneToMany(() => RiskToRequirementEntity, (rtr) => rtr.risk)
  related_requirements?: RiskToRequirementEntity[];
  
  // Legacy control_refs (deprecated, use related_controls)
  @Column({ type: jsonColumnType, nullable: true, default: '[]' })
  control_refs?: string[];
  
  @Column({ type: jsonColumnType, nullable: true, default: '[]' })
  tags?: string[];
  
  @Column({
    type: 'text',
    nullable: true,
    comment: 'Default owner role for risk instances',
  })
  owner_role?: string;
  
  @Column({ type: 'int', default: 1 }) schema_version!: number;

  // Phase 12: Auto-generation fields
  @Column({ type: 'varchar', length: 50, nullable: true })
  entity_type?: string;
  @Column({
    type: 'text',
    nullable: true,
    comment: 'Boolean query filter for entities (e.g., criticality>4)',
  })
  entity_filter?: string;

  // Attachments
  @OneToMany(() => RiskCatalogAttachmentEntity, (att) => att.risk_catalog)
  attachments?: RiskCatalogAttachmentEntity[];

  // Risk Instances
  @OneToMany(() => RiskInstanceEntity, (inst) => inst.catalog)
  instances?: RiskInstanceEntity[];

  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
