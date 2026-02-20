import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

export enum FreezeScope {
  GLOBAL = 'GLOBAL',
  SERVICE = 'SERVICE',
  CLASS = 'CLASS',
}

@Entity('itsm_freeze_window')
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'startAt', 'endAt'])
export class FreezeWindow extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  @Column({ type: 'varchar', length: 50, default: FreezeScope.GLOBAL })
  scope: string;

  @Column({ name: 'scope_ref_id', type: 'uuid', nullable: true })
  scopeRefId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  recurrence: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
