import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { jsonColumnType } from '../../common/database/column-types';

/**
 * DictionaryEntity - Metadata/Dictionary entries for tenant-aware key-value pairs
 * 
 * Used for managing dropdown options, status values, categories, etc.
 * Examples:
 * - Domain: 'POLICY_STATUS' → codes: 'draft', 'approved', 'retired'
 * - Domain: 'REQUIREMENT_CATEGORY' → codes: 'legal', 'technical', 'business'
 * - Domain: 'RISK_TYPE' → codes: 'operational', 'financial', 'strategic'
 */
@Entity({ name: 'dictionaries' })
@Index('idx_dictionaries_tenant', ['tenant_id'])
@Index('idx_dictionaries_domain', ['domain'])
@Index('idx_dictionaries_code_domain_tenant', ['code', 'domain', 'tenant_id'], { unique: true })
@Index('idx_dictionaries_active', ['is_active'])
export class DictionaryEntity {
  @PrimaryColumn('uuid') id!: string;

  @Column('uuid') tenant_id!: string;

  /**
   * Domain: Category/group of dictionary entries
   * Examples: 'POLICY_STATUS', 'REQUIREMENT_CATEGORY', 'RISK_TYPE'
   */
  @Column({ type: 'varchar', length: 100 }) domain!: string;

  /**
   * Code: Machine-friendly identifier (unique per tenant + domain)
   * Examples: 'draft', 'approved', 'legal', 'technical'
   */
  @Column({ type: 'varchar', length: 100 }) code!: string;

  /**
   * Label: Human-readable display text
   */
  @Column({ type: 'text' }) label!: string;

  /**
   * Description: Optional detailed description
   */
  @Column({ type: 'text', nullable: true }) description?: string;

  /**
   * Order: Display order (lower numbers appear first)
   */
  @Column({ type: 'integer', nullable: true, default: 0 }) order?: number;

  /**
   * Is Active: Whether this entry is active/available
   */
  @Column({ type: 'boolean', default: true }) is_active!: boolean;

  /**
   * Meta: Flexible JSON field for additional attributes
   * Examples: { color: '#ff0000', icon: 'check', category: 'primary' }
   */
  @Column({
    type: jsonColumnType,
    nullable: true,
    default: '{}',
    comment: 'Flexible attributes (color, icon, etc.)',
  })
  meta?: Record<string, any>;

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

