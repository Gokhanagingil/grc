import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { SuiteType } from './tenant-active-suite.entity';

export enum ModuleType {
  RISK = 'risk',
  POLICY = 'policy',
  CONTROL = 'control',
  AUDIT = 'audit',
  INCIDENT = 'incident',
  REQUEST = 'request',
  CHANGE = 'change',
  PROBLEM = 'problem',
  CMDB = 'cmdb',
}

@Entity('tenant_enabled_module')
@Index(['tenantId', 'moduleType'], { unique: true })
export class TenantEnabledModule extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    name: 'suite_type',
    type: 'enum',
    enum: SuiteType,
  })
  suiteType: SuiteType;

  @Column({
    name: 'module_type',
    type: 'enum',
    enum: ModuleType,
  })
  moduleType: ModuleType;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ name: 'enabled_at', type: 'timestamp', nullable: true })
  enabledAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
