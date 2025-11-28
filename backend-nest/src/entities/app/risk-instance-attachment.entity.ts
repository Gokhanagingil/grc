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
import { RiskInstanceEntity } from './risk-instance.entity';

/**
 * Risk Instance Attachment Entity
 * 
 * Stores evidence/attachment files for risk instances.
 */
@Entity({ name: 'risk_instance_attachments' })
@Index('idx_risk_instance_attachments_tenant', ['tenant_id'])
@Index('idx_risk_instance_attachments_risk', ['risk_instance_id'])
export class RiskInstanceAttachmentEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  
  @Column('uuid') risk_instance_id!: string;
  @ManyToOne(() => RiskInstanceEntity, (riskInstance) => riskInstance.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_instance_id' })
  risk_instance?: RiskInstanceEntity;
  
  @Column({ type: 'varchar', length: 255 }) file_name!: string;
  @Column({ type: 'text' }) file_url!: string; // URI or path to file
  @Column({ type: 'text', nullable: true }) mime_type?: string;
  @Column({ type: 'integer', nullable: true }) file_size?: number; // bytes
  @Column({ type: 'text', nullable: true }) description?: string;
  
  @Column('uuid', { nullable: true }) uploaded_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

