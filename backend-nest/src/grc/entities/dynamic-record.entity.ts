import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

/**
 * DynamicRecord Entity
 *
 * Stores records for dynamic tables defined in SysDbObject.
 * Data is stored as JSONB, allowing flexible schema based on
 * the field definitions in SysDictionary.
 *
 * Each record has a unique record_id within its table_name scope.
 */
@Entity('dynamic_records')
@Index(['tenantId', 'tableName'])
@Index(['recordId'])
export class DynamicRecord extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({ type: 'jsonb', default: {} })
  data: Record<string, unknown>;
}
