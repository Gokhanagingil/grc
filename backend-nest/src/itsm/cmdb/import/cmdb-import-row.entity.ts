import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { CmdbImportJob } from './cmdb-import-job.entity';

export enum ImportRowStatus {
  PARSED = 'PARSED',
  MATCHED = 'MATCHED',
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  CONFLICT = 'CONFLICT',
  ERROR = 'ERROR',
}

@Entity('cmdb_import_row')
@Index(['tenantId', 'jobId'])
@Index(['jobId', 'status'])
export class CmdbImportRow extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @ManyToOne(() => CmdbImportJob, { nullable: false })
  @JoinColumn({ name: 'job_id' })
  job: CmdbImportJob;

  @Column({ name: 'row_no', type: 'int' })
  rowNo: number;

  @Column({ type: 'jsonb', nullable: true })
  raw: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  parsed: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fingerprint: string | null;

  @Column({ type: 'enum', enum: ImportRowStatus, default: ImportRowStatus.PARSED })
  status: ImportRowStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;
}
