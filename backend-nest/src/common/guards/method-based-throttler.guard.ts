import { Injectable, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
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
  private configService: ConfigService;

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.configService = configService;

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

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    // Get tenant ID and user ID from JWT or request headers
    const tenantId = (request.headers['x-tenant-id'] as string) || 'anonymous';
    const user = request.user as JwtUser | undefined;
    const userId = user?.userId || user?.id || 'anonymous';
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';

    // Build scope based on method and route
    const scope = this.getScope(request);

    // Key generator: tenantId + userId/ip + scope
    // This ensures rate limiting is per-tenant/user, not global
    const keyBase = `${tenantId}:${userId !== 'anonymous' ? userId : ip}:${scope}`;

    return Promise.resolve(keyBase);
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
    suffix: string,
    name: string,
  ): string {
    const request = context.switchToHttp().getRequest<Request>();
    const scope = this.getScope(request);

    // Use scope-specific key format: scope:name:suffix
    return `throttle:${scope}:${name}:${suffix}`;
  }

  /**
   * Override shouldSkip to implement custom rate limiting logic based on scope
   */
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const scope = this.getScope(request);

    // In test environment with high limits, we can skip throttling entirely
    // to avoid any potential issues with E2E tests
    if (this.isTestEnv && this.limits[scope] >= 10000) {
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  /**
   * Get the limit for the current request based on scope
   * This is used by the parent class to determine the rate limit
   */
  public getLimitForScope(context: ExecutionContext): number {
    const request = context.switchToHttp().getRequest<Request>();
    const scope = this.getScope(request);

    // Return limit based on scope (respects test environment configuration)
    return this.limits[scope] || this.limits.default;
  }

  /**
   * Get the TTL (time-to-live) for rate limiting
   * All limiters use 60 second window
   */
  public getTtlForScope(): number {
    return 60000;
  }
}
