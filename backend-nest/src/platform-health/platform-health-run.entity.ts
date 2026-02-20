import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { PlatformHealthCheck } from './platform-health-check.entity';

export enum HealthSuite {
  TIER1 = 'TIER1',
  NIGHTLY = 'NIGHTLY',
  MANUAL = 'MANUAL',
}

export enum HealthRunStatus {
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  ERROR = 'ERROR',
}

@Entity('platform_health_runs')
@Index(['suite', 'startedAt'])
@Index(['status', 'startedAt'])
export class PlatformHealthRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16, default: HealthSuite.TIER1 })
  suite: HealthSuite;

  @Column({ type: 'varchar', length: 16, default: HealthRunStatus.RUNNING })
  status: HealthRunStatus;

  @Column({ type: 'varchar', length: 64, name: 'triggered_by', default: 'ci' })
  triggeredBy: string;

  @Column({ type: 'int', name: 'total_checks', default: 0 })
  totalChecks: number;

  @Column({ type: 'int', name: 'passed_checks', default: 0 })
  passedChecks: number;

  @Column({ type: 'int', name: 'failed_checks', default: 0 })
  failedChecks: number;

  @Column({ type: 'int', name: 'skipped_checks', default: 0 })
  skippedChecks: number;

  @Column({ type: 'int', name: 'duration_ms', default: 0 })
  durationMs: number;

  @Column({ type: 'varchar', length: 64, name: 'git_sha', nullable: true })
  gitSha: string | null;

  @Column({ type: 'varchar', length: 128, name: 'git_ref', nullable: true })
  gitRef: string | null;

  @Column({ type: 'timestamp', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamp', name: 'finished_at', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => PlatformHealthCheck, (check) => check.run, { cascade: true })
  checks: PlatformHealthCheck[];
}
