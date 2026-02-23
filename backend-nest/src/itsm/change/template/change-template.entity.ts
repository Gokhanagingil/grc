import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

@Entity('itsm_change_templates')
@Index(['tenantId', 'code'], { unique: true })
@Index(['tenantId', 'isActive'])
export class ItsmChangeTemplate extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_global', type: 'boolean', default: false })
  isGlobal: boolean;

  @Column({ type: 'int', default: 1 })
  version: number;
}
