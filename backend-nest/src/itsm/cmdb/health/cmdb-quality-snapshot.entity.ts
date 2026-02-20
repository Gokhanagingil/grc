import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../../tenants/tenant.entity';

export interface QualityBreakdown {
  bySeverity: Record<string, number>;
  byRule: { ruleId: string; ruleName: string; count: number }[];
}

@Entity('cmdb_quality_snapshot')
@Index(['tenantId', 'createdAt'])
export class CmdbQualitySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  score: number;

  @Column({ name: 'total_cis', type: 'int', default: 0 })
  totalCis: number;

  @Column({ name: 'total_findings', type: 'int', default: 0 })
  totalFindings: number;

  @Column({ name: 'open_findings', type: 'int', default: 0 })
  openFindings: number;

  @Column({ name: 'waived_findings', type: 'int', default: 0 })
  waivedFindings: number;

  @Column({ name: 'resolved_findings', type: 'int', default: 0 })
  resolvedFindings: number;

  @Column({ type: 'jsonb', default: '{}' })
  breakdown: QualityBreakdown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
