import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PlatformHealthRun } from './platform-health-run.entity';

export enum CheckStatus {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

@Entity('platform_health_checks')
@Index(['runId', 'module'])
export class PlatformHealthCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'run_id' })
  runId: string;

  @Column({ type: 'varchar', length: 64 })
  module: string;

  @Column({ type: 'varchar', length: 128, name: 'check_name' })
  checkName: string;

  @Column({ type: 'varchar', length: 16, default: CheckStatus.PASSED })
  status: CheckStatus;

  @Column({ type: 'int', name: 'duration_ms', default: 0 })
  durationMs: number;

  @Column({ type: 'int', name: 'http_status', nullable: true })
  httpStatus: number | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'text', name: 'request_url', nullable: true })
  requestUrl: string | null;

  @Column({ type: 'jsonb', name: 'response_snippet', nullable: true })
  responseSnippet: Record<string, unknown> | null;

  @ManyToOne(() => PlatformHealthRun, (run) => run.checks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'run_id' })
  run: PlatformHealthRun;
}
