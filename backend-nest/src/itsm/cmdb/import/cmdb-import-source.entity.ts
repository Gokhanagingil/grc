import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

export enum ImportSourceType {
  CSV = 'CSV',
  HTTP = 'HTTP',
  WEBHOOK = 'WEBHOOK',
  JSON = 'JSON',
}

@Entity('cmdb_import_source')
@Index(['tenantId', 'name'])
export class CmdbImportSource extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: ImportSourceType,
    default: ImportSourceType.JSON,
  })
  type: ImportSourceType;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'schedule_enabled', type: 'boolean', default: false })
  scheduleEnabled: boolean;

  @Column({ name: 'cron_expr', type: 'varchar', length: 100, nullable: true })
  cronExpr: string | null;

  @Column({ name: 'timezone', type: 'varchar', length: 64, default: 'UTC' })
  timezone: string;

  @Column({ name: 'max_runs_per_day', type: 'int', default: 24 })
  maxRunsPerDay: number;

  @Column({ name: 'dry_run_by_default', type: 'boolean', default: true })
  dryRunByDefault: boolean;

  @Column({ name: 'last_run_at', type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  @Column({ name: 'next_run_at', type: 'timestamp', nullable: true })
  nextRunAt: Date | null;

  @Column({ name: 'run_count_today', type: 'int', default: 0 })
  runCountToday: number;

  @Column({ name: 'run_count_reset_date', type: 'date', nullable: true })
  runCountResetDate: string | null;
}
