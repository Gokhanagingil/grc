import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { SysDbObject } from './sys-db-object.entity';
import { PlatformBuilderFieldType } from '../enums';

/**
 * SysDictionary Entity (sys_field)
 *
 * Represents a field definition for a dynamic table in the Platform Builder v1.
 * Each field belongs to a table (SysDbObject) and defines the schema for
 * data stored in dynamic_records.
 *
 * Field names must follow the pattern: [a-z][a-z0-9_]*
 * Choice fields must reference sys_choice (not inline options).
 */
@Entity('sys_dictionary')
@Index(['tenantId', 'tableName', 'fieldName'], { unique: true })
@Index(['tenantId', 'tableName'])
@Index(['tenantId', 'isActive'])
export class SysDictionary extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName: string;

  @Column({ name: 'field_name', type: 'varchar', length: 100 })
  fieldName: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({
    type: 'enum',
    enum: PlatformBuilderFieldType,
    default: PlatformBuilderFieldType.STRING,
  })
  type: PlatformBuilderFieldType;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ name: 'is_unique', type: 'boolean', default: false })
  isUnique: boolean;

  @Column({ name: 'read_only', type: 'boolean', default: false })
  readOnly: boolean;

  @Column({
    name: 'reference_table',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  referenceTable: string | null;

  @Column({ name: 'choice_options', type: 'jsonb', nullable: true })
  choiceOptions: { label: string; value: string }[] | null;

  @Column({
    name: 'choice_table',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  choiceTable: string | null;

  @Column({
    name: 'default_value',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  defaultValue: string | null;

  @Column({ name: 'max_length', type: 'int', nullable: true })
  maxLength: number | null;

  @Column({ name: 'field_order', type: 'int', default: 0 })
  fieldOrder: number;

  @Column({ name: 'indexed', type: 'boolean', default: false })
  indexed: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => SysDbObject, (dbObject) => dbObject.fields, {
    nullable: true,
  })
  @JoinColumn({ name: 'table_name', referencedColumnName: 'name' })
  dbObject: SysDbObject;
}
