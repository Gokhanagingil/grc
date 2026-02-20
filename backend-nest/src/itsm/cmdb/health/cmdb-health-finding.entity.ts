import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { CmdbHealthRule } from './cmdb-health-rule.entity';
import { CmdbCi } from '../ci/ci.entity';

export enum FindingStatus {
  OPEN = 'OPEN',
  WAIVED = 'WAIVED',
  RESOLVED = 'RESOLVED',
}

@Entity('cmdb_health_finding')
@Index(['tenantId', 'status'])
@Index(['ruleId', 'ciId'])
export class CmdbHealthFinding extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId: string;

  @ManyToOne(() => CmdbHealthRule, { nullable: false })
  @JoinColumn({ name: 'rule_id' })
  rule: CmdbHealthRule;

  @Column({ name: 'ci_id', type: 'uuid' })
  ciId: string;

  @ManyToOne(() => CmdbCi, { nullable: false })
  @JoinColumn({ name: 'ci_id' })
  ci: CmdbCi;

  @Column({ type: 'varchar', length: 20, default: FindingStatus.OPEN })
  status: FindingStatus;

  @Column({ type: 'jsonb', default: '{}' })
  details: Record<string, unknown>;

  @Column({ name: 'first_seen_at', type: 'timestamp', default: () => 'now()' })
  firstSeenAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamp', default: () => 'now()' })
  lastSeenAt: Date;

  @Column({ name: 'waived_by', type: 'uuid', nullable: true })
  waivedBy: string | null;

  @Column({ name: 'waived_at', type: 'timestamp', nullable: true })
  waivedAt: Date | null;

  @Column({ name: 'waive_reason', type: 'text', nullable: true })
  waiveReason: string | null;
}
