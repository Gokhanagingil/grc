import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { CmdbImportJob } from './cmdb-import-job.entity';

export enum ReconcileAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  SKIP = 'SKIP',
  CONFLICT = 'CONFLICT',
}

export interface ReconcileDiffField {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  classification: 'safe_update' | 'conflict';
}

export interface ReconcileExplain {
  ruleId: string;
  ruleName: string;
  fieldsUsed: string[];
  confidence: number;
  matchedCiId?: string;
  matchedCiName?: string;
}

@Entity('cmdb_reconcile_result')
@Index(['tenantId', 'jobId'])
@Index(['jobId', 'action'])
export class CmdbReconcileResult extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @ManyToOne(() => CmdbImportJob, { nullable: false })
  @JoinColumn({ name: 'job_id' })
  job: CmdbImportJob;

  @Column({ name: 'row_id', type: 'uuid', nullable: true })
  rowId: string | null;

  @Column({ name: 'ci_id', type: 'uuid', nullable: true })
  ciId: string | null;

  @Column({ type: 'enum', enum: ReconcileAction, default: ReconcileAction.CREATE })
  action: ReconcileAction;

  @Column({ name: 'matched_by', type: 'varchar', length: 255, nullable: true })
  matchedBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  diff: ReconcileDiffField[] | null;

  @Column({ name: 'explain', type: 'jsonb', nullable: true })
  explain: ReconcileExplain | null;
}
