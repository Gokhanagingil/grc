import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

/**
 * Field definition within a CI class schema.
 * Each field has a key, display label, data type, and optional constraints.
 * Fields defined on a class are "local" to that class; inherited fields come from ancestors.
 */
export interface CiClassFieldDefinition {
  /** Unique key within the class (snake_case recommended) */
  key: string;
  /** Human-readable label */
  label: string;
  /** Data type: string, number, boolean, date, enum, reference, text, json */
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'reference' | 'text' | 'json';
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Maximum length for string/text fields */
  maxLength?: number;
  /** Default value */
  defaultValue?: unknown;
  /** Allowed values for enum type */
  choices?: string[];
  /** Reference target class name for reference type */
  referenceClassName?: string;
  /** Display order within the form */
  order?: number;
  /** Grouping/section label for form layout */
  group?: string;
  /** Tooltip/help text */
  helpText?: string;
}

/**
 * Effective field = local field + provenance info for UI rendering.
 */
export interface EffectiveFieldDefinition extends CiClassFieldDefinition {
  /** The class that originally defined this field */
  sourceClassId: string;
  /** The class name that originally defined this field */
  sourceClassName: string;
  /** Whether this field is inherited (true) or locally defined (false) */
  inherited: boolean;
  /** Depth from the current class (0 = local, 1 = parent, 2 = grandparent, etc.) */
  inheritanceDepth: number;
}

@Entity('cmdb_ci_class')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'parentClassId'])
export class CmdbCiClass extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  @Column({ name: 'parent_class_id', type: 'uuid', nullable: true })
  parentClassId: string | null;

  @ManyToOne(() => CmdbCiClass, (cls) => cls.children, { nullable: true })
  @JoinColumn({ name: 'parent_class_id' })
  parentClass: CmdbCiClass | null;

  @OneToMany(() => CmdbCiClass, (cls) => cls.parentClass)
  children: CmdbCiClass[];

  @Column({ name: 'is_abstract', type: 'boolean', default: false })
  isAbstract: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Whether this is a system-defined class (baseline content pack managed) */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /**
   * Local fields schema defined on THIS class only.
   * Effective schema = ancestor fields + local fields (child overrides parent on key collision).
   */
  @Column({ name: 'fields_schema', type: 'jsonb', nullable: true })
  fieldsSchema: CiClassFieldDefinition[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
