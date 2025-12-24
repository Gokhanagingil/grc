/**
 * Jobs Module
 *
 * Provides background job infrastructure for the GRC Platform:
 * - Lightweight in-process job runner
 * - Job registry with schedule interval support
 * - Manual trigger capability
 * - Job run history tracking
 * - Platform self-check job (nightly validation)
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobRun } from './entities/job-run.entity';
import { PlatformSelfCheckJob } from './jobs/platform-self-check.job';

@Module({
  imports: [TypeOrmModule.forFeature([JobRun])],
  controllers: [JobsController],
  providers: [JobsService, PlatformSelfCheckJob],
  exports: [JobsService],
})
export class JobsModule implements OnModuleInit {
  constructor(
    private readonly jobsService: JobsService,
    private readonly platformSelfCheckJob: PlatformSelfCheckJob,
  ) {}

  onModuleInit(): void {
    this.jobsService.registerJob(this.platformSelfCheckJob);
  }
}
