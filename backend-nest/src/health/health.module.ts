import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthV2Controller } from './health-v2.controller';
import { HealthService } from './health.service';

/**
 * Health Module
 *
 * Provides health check endpoints for monitoring and orchestration.
 * Includes checks for database, authentication, and dot-walking.
 *
 * Endpoints:
 * - /health/* - Legacy health endpoints (kept for backward compatibility)
 * - /api/v2/health - Canonical health endpoint (recommended)
 */
@Module({
  controllers: [HealthController, HealthV2Controller],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
