import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { CmdbService } from '../service/cmdb-service.entity';
import { CmdbCi } from '../ci/ci.entity';

@Entity('cmdb_service_ci')
@Unique(['tenantId', 'serviceId', 'ciId', 'relationshipType'])
@Index(['tenantId', 'serviceId'])
@Index(['tenantId', 'ciId'])
@Index(['tenantId', 'relationshipType'])
@Index(['tenantId', 'createdAt'])
export class CmdbServiceCi extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => CmdbService, { nullable: false })
  @JoinColumn({ name: 'service_id' })
  service: CmdbService;

  @Column({ name: 'ci_id', type: 'uuid' })
  ciId: string;

  @ManyToOne(() => CmdbCi, { nullable: false })
  @JoinColumn({ name: 'ci_id' })
  ci: CmdbCi;

  @Column({ name: 'relationship_type', type: 'varchar', length: 50 })
  relationshipType: string;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;
}
