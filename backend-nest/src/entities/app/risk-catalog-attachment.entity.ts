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

/**
 * Risk Catalog Attachment Entity
 * 
 * Stores attachments/evidence files for risk catalog entries.
 */
@Entity({ name: 'risk_catalog_attachments' })
@Index('idx_risk_catalog_attachments_tenant', ['tenant_id'])
@Index('idx_risk_catalog_attachments_risk', ['risk_catalog_id'])
export class RiskCatalogAttachmentEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  
  @Column('uuid') risk_catalog_id!: string;
  @ManyToOne(() => RiskCatalogEntity, (riskCatalog) => riskCatalog.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_catalog_id' })
  risk_catalog?: RiskCatalogEntity;
  
  @Column({ type: 'varchar', length: 255 }) file_name!: string;
  @Column({ type: 'text' }) file_url!: string; // URI or path to file
  @Column({ type: 'text', nullable: true }) mime_type?: string;
  @Column({ type: 'integer', nullable: true }) file_size?: number; // bytes
  @Column({ type: 'text', nullable: true }) description?: string;
  
  @Column('uuid', { nullable: true }) uploaded_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

