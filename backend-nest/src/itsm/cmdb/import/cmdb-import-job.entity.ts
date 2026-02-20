import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { CmdbImportSource } from './cmdb-import-source.entity';

export enum ImportJobStatus {
  PENDING = 'PENDING',
  PARSING = 'PARSING',
  RECONCILING = 'RECONCILING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  APPLIED = 'APPLIED',
}

@Entity('cmdb_import_job')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
export class CmdbImportJob extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @ManyToOne(() => CmdbImportSource, { nullable: true })
  @JoinColumn({ name: 'source_id' })
  source: CmdbImportSource | null;

  @Column({ type: 'enum', enum: ImportJobStatus, default: ImportJobStatus.PENDING })
  status: ImportJobStatus;

  @Column({ name: 'dry_run', type: 'boolean', default: true })
  dryRun: boolean;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows: number;

  @Column({ name: 'parsed_count', type: 'int', default: 0 })
  parsedCount: number;

  @Column({ name: 'matched_count', type: 'int', default: 0 })
  matchedCount: number;

  @Column({ name: 'created_count', type: 'int', default: 0 })
  createdCount: number;

  @Column({ name: 'updated_count', type: 'int', default: 0 })
  updatedCount: number;

  @Column({ name: 'conflict_count', type: 'int', default: 0 })
  conflictCount: number;

  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount: number;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt: Date | null;
}
