import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

@Entity('cmdb_service')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'type'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'tier'])
@Index(['tenantId', 'criticality'])
@Index(['tenantId', 'createdAt'])
export class CmdbService extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'varchar', length: 50, default: 'planned' })
  status: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tier: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  criticality: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @Column({ name: 'owner_email', type: 'varchar', length: 255, nullable: true })
  ownerEmail: string | null;

  @OneToMany(
    'CmdbServiceOffering',
    (offering: { service: CmdbService }) => offering.service,
  )
  offerings: unknown[];
}
