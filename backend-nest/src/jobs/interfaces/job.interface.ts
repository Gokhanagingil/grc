/**
 * Job Interface
 *
 * Defines the contract for background jobs in the GRC Platform.
 * All jobs must implement this interface to be registered with the JobRunner.
 */

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface JobResult {
  jobId: string;
  jobName: string;
  status: JobStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  messageCode: string;
  summary?: string;
  details?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

export interface JobConfig {
  name: string;
  description: string;
  scheduleIntervalMs?: number;
  enabled: boolean;
  runOnStartup?: boolean;
}

export interface Job {
  readonly config: JobConfig;
  execute(): Promise<JobResult>;
}

export interface JobRunSummary {
  jobId: string;
  jobName: string;
  status: JobStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary?: string;
}

export interface JobRegistryEntry {
  job: Job;
  lastRun: JobResult | null;
  nextRunAt: Date | null;
  runCount: number;
  successCount: number;
  failureCount: number;
}
