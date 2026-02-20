import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { CmdbCi } from '../ci/ci.entity';

@Entity('cmdb_ci_rel')
@Unique(['tenantId', 'sourceCiId', 'targetCiId', 'type'])
@Index(['tenantId', 'sourceCiId'])
@Index(['tenantId', 'targetCiId'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'createdAt'])
export class CmdbCiRel extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'source_ci_id', type: 'uuid' })
  sourceCiId: string;

  @ManyToOne(() => CmdbCi, { nullable: false })
  @JoinColumn({ name: 'source_ci_id' })
  sourceCi: CmdbCi;

  @Column({ name: 'target_ci_id', type: 'uuid' })
  targetCiId: string;

  @ManyToOne(() => CmdbCi, { nullable: false })
  @JoinColumn({ name: 'target_ci_id' })
  targetCi: CmdbCi;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
