import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

export interface MatchStrategyField {
  field: string;
  ciField: string;
  weight?: number;
  uniqueRequired?: boolean;
}

export interface MatchStrategy {
  type: 'exact' | 'composite';
  fields: MatchStrategyField[];
}

@Entity('cmdb_reconcile_rule')
@Index(['tenantId', 'precedence'])
@Index(['tenantId', 'enabled'])
export class CmdbReconcileRule extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'target_class_id', type: 'uuid', nullable: true })
  targetClassId: string | null;

  @Column({ name: 'match_strategy', type: 'jsonb', default: '{}' })
  matchStrategy: MatchStrategy;

  @Column({ type: 'int', default: 0 })
  precedence: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
