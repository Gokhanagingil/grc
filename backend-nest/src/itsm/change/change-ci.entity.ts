import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { ItsmChange } from './change.entity';
import { CmdbCi } from '../cmdb/ci/ci.entity';

@Entity('itsm_change_ci')
@Unique(['tenantId', 'changeId', 'ciId', 'relationshipType'])
@Index(['tenantId', 'changeId'])
@Index(['tenantId', 'ciId'])
@Index(['tenantId', 'createdAt'])
export class ItsmChangeCi extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'change_id', type: 'uuid' })
  changeId: string;

  @ManyToOne(() => ItsmChange, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'change_id' })
  change: ItsmChange;

  @Column({ name: 'ci_id', type: 'uuid' })
  ciId: string;

  @ManyToOne(() => CmdbCi, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ci_id' })
  ci: CmdbCi;

  @Column({ name: 'relationship_type', type: 'varchar', length: 50 })
  relationshipType: string;

  @Column({ name: 'impact_scope', type: 'varchar', length: 50, nullable: true })
  impactScope: string | null;
}
