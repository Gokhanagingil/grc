import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { SysDbObject } from './sys-db-object.entity';
import { DictionaryFieldType } from '../enums';

/**
 * SysDictionary Entity
 *
 * Represents a field definition for a dynamic table in the Platform Builder.
 * Each field belongs to a table (SysDbObject) and defines the schema for
 * data stored in dynamic_records.
 *
 * Field names must follow the pattern: [a-z][a-z0-9_]*
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
    enum: DictionaryFieldType,
    default: DictionaryFieldType.STRING,
  })
  type: DictionaryFieldType;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ name: 'is_unique', type: 'boolean', default: false })
  isUnique: boolean;

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
    name: 'default_value',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  defaultValue: string | null;

  @Column({ name: 'field_order', type: 'int', default: 0 })
  fieldOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => SysDbObject, (dbObject) => dbObject.fields, {
    nullable: true,
  })
  @JoinColumn({ name: 'table_name', referencedColumnName: 'name' })
  dbObject: SysDbObject;
}
