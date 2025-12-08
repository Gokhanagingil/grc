import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

/**
 * Health V2 Controller
 *
 * Provides the canonical health check endpoint at /api/v2/health.
 * This is the official health endpoint for monitoring and orchestration.
 *
 * The response is automatically wrapped by ResponseTransformInterceptor into:
 * {
 *   success: true,
 *   data: {
 *     status: 'healthy' | 'degraded' | 'unhealthy',
 *     timestamp: string,
 *     checks: {
 *       db: { status, details },
 *       auth: { status, details },
 *       dotWalking: { status, details }
 *     }
 *   }
 * }
 */
@Controller('api/v2')
export class HealthV2Controller {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Canonical health check endpoint
   *
   * GET /api/v2/health
   *
   * Returns the overall health status of the application including:
   * - Database connectivity and migration status
   * - Authentication configuration (JWT, refresh tokens)
   * - Dot-walking resolver functionality
   *
   * Status values:
   * - healthy: All checks passed
   * - degraded: Some non-critical checks failed (e.g., missing optional config)
   * - unhealthy: Critical checks failed (e.g., database unreachable)
   */
  @Get('health')
  async getHealth() {
    return this.healthService.getOverallHealth();
  }
}
