import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

/**
 * Health Controller
 *
 * Provides health check endpoints for monitoring and orchestration.
 * - /health: Overall health status
 * - /health/live: Simple liveness check (app is running)
 * - /health/ready: Readiness check (app can serve traffic, DB connected)
 * - /health/db: Database health check with migration status
 * - /health/auth: Authentication configuration check
 * - /health/dotwalking: Dot-walking resolver check
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Overall health check
   * Returns combined status of all health checks.
   */
  @Get()
  async getOverallHealth() {
    return this.healthService.getOverallHealth();
  }

  /**
   * Liveness probe
   * Returns 200 if the application is running.
   * Includes uptime in seconds for monitoring.
   */
  @Get('live')
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'grc-platform-nest',
    };
  }

  /**
   * Readiness probe
   * Returns 200 if the application is ready to serve traffic.
   * Checks database connectivity.
   */
  @Get('ready')
  async ready() {
    const dbHealth = await this.healthService.checkDatabase();

    return {
      status: dbHealth.details.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'grc-platform-nest',
      checks: {
        database: dbHealth,
      },
    };
  }

  /**
   * Database health check
   * Verifies database connection, migration status, and last backup timestamp.
   */
  @Get('db')
  async checkDatabase() {
    return this.healthService.checkDatabase();
  }

  /**
   * Authentication health check
   * Verifies JWT config, refresh token settings, and required env variables.
   */
  @Get('auth')
  checkAuth() {
    return this.healthService.checkAuth();
  }

  /**
   * Dot-walking health check
   * Runs a tiny resolver test to verify dot-walking functionality.
   */
  @Get('dotwalking')
  checkDotWalking() {
    return this.healthService.checkDotWalking();
  }

  /**
   * Version endpoint
   * Returns git commit hash and build info for deployment verification.
   * Allows checking deployed version without SSH access.
   *
   * Environment variables (set at build/deploy time):
   * - GIT_COMMIT_SHA: Full git commit hash
   * - GIT_COMMIT_SHORT: Short git commit hash (7 chars)
   * - BUILD_TIMESTAMP: ISO timestamp of build
   */
  @Get('version')
  getVersion() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: {
        commitSha: process.env.GIT_COMMIT_SHA || 'unknown',
        commitShort: process.env.GIT_COMMIT_SHORT || 'unknown',
        buildTimestamp: process.env.BUILD_TIMESTAMP || 'unknown',
      },
      service: 'grc-platform-nest',
    };
  }
}
