# Platform Background Jobs

## Overview

The Platform Jobs module provides a lightweight in-process job runner for the GRC Platform. It supports job registration, schedule intervals, manual triggering, and job run history tracking.

## Architecture

### Components

1. **JobsService** - Central service for job registration, scheduling, and execution
2. **Job Interface** - Contract for implementing background jobs
3. **JobRun Entity** - TypeORM entity for job execution history
4. **PlatformSelfCheckJob** - Example job that runs platform validation
5. **JobsController** - Admin endpoints for status, triggering, and history

### Job Interface

All jobs implement the `Job` interface:

```typescript
interface Job {
  readonly config: JobConfig;
  execute(): Promise<JobResult>;
}

interface JobConfig {
  name: string;
  description: string;
  scheduleIntervalMs?: number;
  enabled: boolean;
  runOnStartup?: boolean;
}

interface JobResult {
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
```

## Built-in Jobs

### Platform Self-Check Job

The `platform-self-check` job runs the platform validation script and stores the result summary.

**Configuration:**
- Name: `platform-self-check`
- Description: Nightly platform validation running environment, database, and migration checks
- Schedule: Every 24 hours (86400000ms)
- Enabled: Yes
- Run on Startup: No

**What it validates:**
- Environment variables
- Database connectivity
- Migration status
- API health endpoints

## API Endpoints

All endpoints require authentication and `ADMIN_SETTINGS_READ` or `ADMIN_SETTINGS_WRITE` permission.

### GET /admin/jobs/status

Returns jobs status summary including registered jobs and recent runs.

**Response:**
```json
{
  "success": true,
  "data": {
    "registeredJobs": [
      {
        "name": "platform-self-check",
        "description": "Nightly platform validation...",
        "enabled": true,
        "scheduleIntervalMs": 86400000,
        "lastRun": {
          "jobId": "uuid",
          "status": "success",
          "startedAt": "2024-01-15T02:00:00Z",
          "completedAt": "2024-01-15T02:00:15Z",
          "durationMs": 15000,
          "summary": "Platform validation passed: 3/3 checks passed"
        },
        "nextRunAt": "2024-01-16T02:00:00Z",
        "runCount": 10,
        "successCount": 9,
        "failureCount": 1
      }
    ],
    "totalJobs": 1,
    "enabledJobs": 1,
    "recentRuns": [...]
  }
}
```

### GET /admin/jobs/runs

Returns recent job runs.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "jobName": "platform-self-check",
      "status": "success",
      "messageCode": "PLATFORM_VALIDATION_PASSED",
      "summary": "Platform validation passed: 3/3 checks passed",
      "durationMs": 15000,
      "startedAt": "2024-01-15T02:00:00Z",
      "completedAt": "2024-01-15T02:00:15Z"
    }
  ]
}
```

### GET /admin/jobs/platform-validation

Returns the last platform validation result.

**Response:**
```json
{
  "success": true,
  "data": {
    "hasResult": true,
    "result": {
      "success": true,
      "timestamp": "2024-01-15T02:00:15Z",
      "environment": "production",
      "summary": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "skipped": 0,
        "totalDurationMs": 12500
      },
      "scripts": [
        { "name": "validate-env", "status": "passed", "durationMs": 500 },
        { "name": "validate-db", "status": "passed", "durationMs": 2000 },
        { "name": "validate-migrations", "status": "passed", "durationMs": 10000 }
      ]
    }
  }
}
```

### POST /admin/jobs/trigger/:jobName

Manually trigger a job. Requires `ADMIN_SETTINGS_WRITE` permission.

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "jobName": "platform-self-check",
    "status": "success",
    "startedAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:30:15Z",
    "durationMs": 15000,
    "messageCode": "PLATFORM_VALIDATION_PASSED",
    "summary": "Platform validation passed: 3/3 checks passed"
  }
}
```

## Job Status Values

| Status | Description |
|--------|-------------|
| `pending` | Job is queued but not yet started |
| `running` | Job is currently executing |
| `success` | Job completed successfully |
| `failed` | Job failed with an error |
| `skipped` | Job was skipped (e.g., disabled) |

## Message Codes

| Code | Description |
|------|-------------|
| `JOB_NOT_FOUND` | Requested job does not exist |
| `JOB_DISABLED` | Job is disabled and was skipped |
| `JOB_EXECUTION_ERROR` | Job failed during execution |
| `PLATFORM_VALIDATION_PASSED` | Platform validation completed successfully |
| `PLATFORM_VALIDATION_FAILED` | Platform validation found issues |
| `PLATFORM_VALIDATION_ERROR` | Platform validation script error |

## Creating Custom Jobs

To create a new job:

1. Create a new class implementing the `Job` interface:

```typescript
import { Injectable } from '@nestjs/common';
import { Job, JobConfig, JobResult, JobStatus } from '../interfaces/job.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class MyCustomJob implements Job {
  readonly config: JobConfig = {
    name: 'my-custom-job',
    description: 'Description of what this job does',
    scheduleIntervalMs: 3600000, // Every hour
    enabled: true,
    runOnStartup: false,
  };

  async execute(): Promise<JobResult> {
    const jobId = randomUUID();
    const startedAt = new Date();

    try {
      // Your job logic here
      const result = await this.doWork();

      return {
        jobId,
        jobName: this.config.name,
        status: JobStatus.SUCCESS,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        messageCode: 'MY_JOB_COMPLETED',
        summary: `Processed ${result.count} items`,
        details: result,
      };
    } catch (error) {
      return {
        jobId,
        jobName: this.config.name,
        status: JobStatus.FAILED,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        messageCode: 'MY_JOB_FAILED',
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async doWork(): Promise<{ count: number }> {
    // Implementation
    return { count: 42 };
  }
}
```

2. Register the job in `JobsModule`:

```typescript
@Module({
  providers: [JobsService, PlatformSelfCheckJob, MyCustomJob],
})
export class JobsModule implements OnModuleInit {
  constructor(
    private readonly jobsService: JobsService,
    private readonly platformSelfCheckJob: PlatformSelfCheckJob,
    private readonly myCustomJob: MyCustomJob,
  ) {}

  onModuleInit(): void {
    this.jobsService.registerJob(this.platformSelfCheckJob);
    this.jobsService.registerJob(this.myCustomJob);
  }
}
```

## Job Run History

All job executions are persisted to the `job_runs` table with:

- `id` - Unique run identifier
- `jobName` - Name of the job
- `status` - Execution status
- `messageCode` - i18n-ready message code
- `summary` - Human-readable summary
- `details` - JSON details/metadata
- `errorCode` / `errorMessage` - Error details if failed
- `durationMs` - Execution duration
- `startedAt` / `completedAt` - Timestamps
- `createdAt` - Record creation timestamp

## Admin UI

The Admin System page includes a "Background Jobs" section showing:

- Platform Validation Summary (last validation result)
- Registered Jobs list with status, schedule, and run counts
- Manual trigger button for each enabled job
- Recent Job Runs history

## Security Considerations

1. **Permission Guard**: Admin endpoints require `ADMIN_SETTINGS_READ` or `ADMIN_SETTINGS_WRITE` permission
2. **Timeout Protection**: Long-running jobs have timeout limits
3. **Audit Trail**: All job executions are logged for compliance and debugging
4. **Graceful Shutdown**: Jobs are properly terminated on application shutdown

## Future Enhancements

The current implementation is an in-process job runner suitable for single-instance deployments. Future enhancements may include:

- Distributed job execution (Redis/queue-based)
- Job dependencies and chaining
- Retry policies with exponential backoff
- Job priority queues
- Cron expression support
