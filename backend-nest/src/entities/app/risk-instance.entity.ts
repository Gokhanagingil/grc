import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RiskCatalogEntity } from './risk-catalog.entity';
import {
  enumColumnOptions,
  timestampColumnType,
} from '../../common/database/column-types';
import { RiskInstanceAttachmentEntity } from './risk-instance-attachment.entity';
import { EntityEntity } from './entity.entity';

/**
 * Risk Instance Entity
 * Represents an actual risk occurrence for a specific entity (Application, Database, Process, etc.)
 */
export enum EntityType {
  APPLICATION = 'Application',
  DATABASE = 'Database',
  PROCESS = 'Process',
  SERVICE = 'Service',
  VENDOR = 'Vendor',
  FACILITY = 'Facility',
  DATA_ASSET = 'DataAsset',
  NETWORK = 'Network',
  USER = 'User',
  OTHER = 'Other',
}

export enum RiskStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  MITIGATED = 'mitigated',
  ACCEPTED = 'accepted',
  TRANSFERRED = 'transferred',
  CLOSED = 'closed',
}

@Entity({ name: 'risk_instances' })
@Index('idx_risk_instances_tenant', ['tenant_id'])
@Index('idx_risk_instances_catalog', ['catalog_id'])
@Index('idx_risk_instances_entity', ['entity_id'])
@Index('idx_risk_instances_status', ['status'])
@Index('idx_risk_instances_unique', ['catalog_id', 'entity_id', 'tenant_id'], {
  unique: true,
})
export class RiskInstanceEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;

  @Column('uuid') catalog_id!: string;
  @ManyToOne(() => RiskCatalogEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalog_id' })
  catalog?: RiskCatalogEntity;

  @Column('uuid') entity_id!: string; // ID of the entity from entity registry
  @ManyToOne(() => EntityEntity, { nullable: true })
  @JoinColumn({ name: 'entity_id' })
  entity?: EntityEntity;
  
  // Keep entity_type for backward compatibility and filtering
  @Column({
    ...enumColumnOptions(EntityType),
    nullable: true,
  })
  entity_type?: EntityType;

  @Column({ type: 'text', nullable: true }) description?: string;

  // Inherent Risk Scoring (before controls)
  @Column('integer', { default: 3, comment: 'Inherent likelihood (1-5)' })
  inherent_likelihood!: number;
  @Column('integer', { default: 3, comment: 'Inherent impact (1-5)' })
  inherent_impact!: number;
  @Column('integer', { default: 9, comment: 'Auto-calculated: inherent_likelihood × inherent_impact' })
  inherent_score!: number;

  // Residual Risk Scoring (after controls)
  @Column('integer', { nullable: true, comment: 'Residual likelihood (1-5)' })
  residual_likelihood?: number;
  @Column('integer', { nullable: true, comment: 'Residual impact (1-5)' })
  residual_impact?: number;
  @Column('integer', { nullable: true, comment: 'Auto-calculated: residual_likelihood × residual_impact' })
  residual_score?: number;

  // Legacy fields (deprecated, use inherent_*)
  @Column('integer', { default: 3, nullable: true })
  likelihood?: number;
  @Column('integer', { default: 3, nullable: true })
  impact?: number;
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  residual_risk?: number; // Legacy decimal field

  // Treatment Plan
  @Column({ type: 'text', nullable: true }) treatment_action?: string;
  @Column('uuid', { nullable: true }) treatment_owner_id?: string;
  @Column({ type: timestampColumnType, nullable: true }) treatment_due_date?: Date;
  @Column({ type: 'text', nullable: true }) expected_reduction?: string;

  // Lifecycle Status
  @Column({
    ...enumColumnOptions(RiskStatus, RiskStatus.DRAFT),
  })
  status!: RiskStatus;

  @Column('uuid', { nullable: true }) owner_id?: string; // User who owns/manages this risk instance
  @Column('uuid', { nullable: true }) assigned_to?: string; // User assigned to mitigate

  // Legacy control links (deprecated, but kept for backward compatibility)
  @Column('simple-array', { nullable: true, default: '' })
  controls_linked?: string[]; // Control IDs
  
  @Column('text', { nullable: true }) notes?: string;
  @Column({ type: timestampColumnType, nullable: true })
  last_assessed_at?: Date;

  // Attachments
  @OneToMany(() => RiskInstanceAttachmentEntity, (att) => att.risk_instance)
  attachments?: RiskInstanceAttachmentEntity[];

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
