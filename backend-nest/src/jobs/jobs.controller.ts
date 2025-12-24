/**
 * Jobs Controller
 *
 * Provides endpoints for job management:
 * - Jobs status endpoint (ADMIN only)
 * - Manual trigger endpoint (ADMIN only)
 * - Recent job runs (ADMIN only)
 * - Last platform validation summary (ADMIN only)
 */

import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { JobsService, JobsStatusSummary } from './jobs.service';
import { JobResult } from './interfaces/job.interface';
import { JobRun } from './entities/job-run.entity';
import { PlatformSelfCheckJob } from './jobs/platform-self-check.job';

@Controller('admin/jobs')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly platformSelfCheckJob: PlatformSelfCheckJob,
  ) {}

  /**
   * Get jobs status summary
   * Returns all registered jobs with their status and recent runs
   */
  @Get('status')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getJobsStatus(): Promise<JobsStatusSummary> {
    return this.jobsService.getJobsStatus();
  }

  /**
   * Get recent job runs
   */
  @Get('runs')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getRecentRuns(): Promise<JobRun[]> {
    return this.jobsService.getRecentRuns(20);
  }

  /**
   * Get last platform validation summary
   */
  @Get('platform-validation')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  getLastPlatformValidation(): {
    hasResult: boolean;
    result: unknown;
  } {
    const result = this.platformSelfCheckJob.getLastValidationResult();
    return {
      hasResult: result !== null,
      result,
    };
  }

  /**
   * Manually trigger a job
   * ADMIN only
   */
  @Post('trigger/:jobName')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async triggerJob(@Param('jobName') jobName: string): Promise<JobResult> {
    if (!jobName) {
      throw new BadRequestException('Job name is required');
    }

    return this.jobsService.triggerJob(jobName);
  }
}
