import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { CmdbService } from '../service/cmdb-service.entity';

@Entity('cmdb_service_offering')
@Index(['tenantId', 'serviceId', 'name'], { unique: true })
@Index(['tenantId', 'serviceId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
export class CmdbServiceOffering extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => CmdbService, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: CmdbService;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'planned' })
  status: string;

  @Column({
    name: 'support_hours',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  supportHours: string | null;

  @Column({ name: 'default_sla_profile_id', type: 'uuid', nullable: true })
  defaultSlaProfileId: string | null;
}
