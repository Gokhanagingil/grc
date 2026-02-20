import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { AuditStandard, TemplateLanguage } from '../enums';

/**
 * Template Section Structure
 * Defines the structure of sections within an audit report template
 */
export interface TemplateSectionConfig {
  id: string;
  title: string;
  order: number;
  required: boolean;
  placeholders?: string[];
  subsections?: TemplateSectionConfig[];
}

/**
 * GRC Audit Report Template Entity
 *
 * Represents a template for generating audit reports.
 * Templates contain placeholders that are replaced with actual data during report generation.
 * Supports multiple standards (ISO27001, COBIT, etc.) and languages (EN, TR).
 */
@Entity('grc_audit_report_templates')
@Index(['tenantId', 'standard'])
@Index(['tenantId', 'language'])
@Index(['tenantId', 'name'], { unique: true })
export class GrcAuditReportTemplate extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: AuditStandard,
    default: AuditStandard.CUSTOM,
  })
  standard: AuditStandard;

  @Column({
    type: 'enum',
    enum: TemplateLanguage,
    default: TemplateLanguage.EN,
  })
  language: TemplateLanguage;

  @Column({ name: 'template_body', type: 'text', nullable: true })
  templateBody: string | null;

  @Column({ type: 'jsonb', nullable: true })
  sections: TemplateSectionConfig[] | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
