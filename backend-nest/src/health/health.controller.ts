import { Controller, Get, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Health Controller
 *
 * Provides health check endpoints for monitoring and orchestration.
 * - /health/live: Simple liveness check (app is running)
 * - /health/ready: Readiness check (app can serve traffic, DB connected)
 */
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DataSource)
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Liveness probe
   * Returns 200 if the application is running.
   */
  @Get('live')
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
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
    const dbStatus = await this.checkDatabase();

    const isReady = dbStatus.connected;

    return {
      status: isReady ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'grc-platform-nest',
      checks: {
        database: dbStatus,
      },
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<{
    connected: boolean;
    latencyMs?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return {
        connected: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
