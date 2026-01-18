import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  THROTTLER_OPTIONS,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * User type from JWT payload
 */
interface JwtUser {
  userId?: string;
  id?: string;
}

/**
 * Method-based Rate Limiter Guard
 *
 * Separates rate limiting by HTTP method and route pattern:
 * - GET /grc/** list/detail: readLimiter (120/min in prod, 10000/min in test)
 * - POST/PUT/PATCH/DELETE /grc/**: writeLimiter (30/min in prod, 10000/min in test)
 * - POST /auth/login: authLimiter (10/min in prod, 10000/min in test)
 *
 * This prevents GET list endpoints from hitting the strict 10/min limit
 * that was breaking UI list screens.
 *
 * In test environment, uses very high limits (10000/min) to avoid blocking E2E tests.
 */
@Injectable()
export class MethodBasedThrottlerGuard extends ThrottlerGuard {
  private readonly isTestEnv: boolean;
  private readonly limits: Record<string, number>;

  constructor(
    @Inject(THROTTLER_OPTIONS) options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);

    // Check if we're in test environment
    const nodeEnv = this.configService.get<string>(
      'app.nodeEnv',
      'development',
    );
    this.isTestEnv = nodeEnv === 'test';

    // Set limits based on environment
    // In test environment, use very high limits to avoid blocking E2E tests
    this.limits = {
      auth: this.isTestEnv ? 10000 : 10, // 10/min in prod, 10000/min in test
      read: this.isTestEnv ? 10000 : 120, // 120/min in prod, 10000/min in test
      write: this.isTestEnv ? 10000 : 30, // 30/min in prod, 10000/min in test
      default: this.isTestEnv ? 10000 : 100, // 100/min in prod, 10000/min in test
    };
  }

  protected getTracker(request: Request): string {
    // Get tenant ID and user ID from JWT or request headers
    const tenantId = (request.headers['x-tenant-id'] as string) || 'anonymous';
    const user = request.user as JwtUser | undefined;
    const userId = user?.userId || user?.id || 'anonymous';
    const ip = request.ip || request.socket.remoteAddress || 'unknown';

    // Build scope based on method and route
    const scope = this.getScope(request);

    // Key generator: tenantId + userId/ip + scope
    // This ensures rate limiting is per-tenant/user, not global
    const keyBase = `${tenantId}:${userId !== 'anonymous' ? userId : ip}:${scope}`;

    return keyBase;
  }

  protected getScope(request: Request): string {
    const method = request.method.toUpperCase();
    const path = request.path;

    // Auth endpoints: strict limit (10/min)
    if (path.startsWith('/auth/login') && method === 'POST') {
      return 'auth';
    }

    // GET endpoints: read limiter (120/min) - much higher for list screens
    // Apply to all GET requests under /grc/, /itsm/, /platform/, /audit/, /health/ (except /metrics)
    if (method === 'GET') {
      // Exclude metrics endpoint (may have different rate limit needs)
      if (path === '/metrics') {
        return 'default';
      }

      // All GET requests to GRC, ITSM, Platform, Audit, Health endpoints use read limiter
      if (
        path.startsWith('/grc/') ||
        path.startsWith('/itsm/') ||
        path.startsWith('/platform/') ||
        path.startsWith('/audit/') ||
        path.startsWith('/health/')
      ) {
        return 'read';
      }
    }

    // Write endpoints: write limiter (30/min) - moderate for mutations
    // Apply to all POST/PUT/PATCH/DELETE requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return 'write';
    }

    // Default: use default limiter (100/min)
    return 'default';
  }

  protected generateKey(
    context: ExecutionContext,
    tracker: string,
    limit: number,
    ttl: number,
  ): string {
    const request = context.switchToHttp().getRequest<Request>();
    const scope = this.getScope(request);

    // Use scope-specific key format: scope:tracker:limit:ttl
    return `throttle:${scope}:${tracker}:${limit}:${ttl}`;
  }

  protected getLimit(context: ExecutionContext): number {
    const request = context.switchToHttp().getRequest<Request>();
    const scope = this.getScope(request);

    // Return limit based on scope (respects test environment configuration)
    return this.limits[scope] || this.limits.default;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getTtl(context: ExecutionContext): number {
    // All limiters use 60 second window
    return 60000;
  }
}
