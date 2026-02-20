import { Injectable, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  ThrottlerException,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

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
 * IMPORTANT: This guard overrides the default NestJS throttler behavior.
 *
 * The default ThrottlerGuard applies ALL configured throttlers to every request,
 * which means if you have throttlers with limits [100, 120, 30, 10], the most
 * restrictive one (10) will effectively limit all requests.
 *
 * This guard implements SCOPE-BASED throttling:
 * - GET /grc/**, /itsm/**, /platform/**, /audit/**, /health/** -> 'read' (120/min)
 * - POST /auth/login -> 'auth' (10/min)
 * - POST/PUT/PATCH/DELETE -> 'write' (30/min)
 * - Everything else -> 'default' (100/min)
 *
 * Each request is only checked against ONE throttler based on its scope,
 * preventing the premature 429 errors that occurred when all throttlers
 * were applied to every request.
 *
 * In test environment, uses very high limits (10000/min) to avoid blocking E2E tests.
 */
@Injectable()
export class MethodBasedThrottlerGuard extends ThrottlerGuard {
  private readonly isTestEnv: boolean;
  private readonly limits: Record<string, number>;
  private readonly ttl: number = 60000; // 60 seconds
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

  /**
   * Override canActivate to implement scope-based throttling.
   *
   * Instead of applying ALL throttlers to every request (default behavior),
   * we only apply the ONE throttler that matches the request's scope.
   *
   * This prevents the issue where the 'auth' throttler (10/min) was being
   * applied to all requests, causing premature 429 errors after 10 requests.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Determine the scope for this request
    const scope = this.getScope(request);
    const limit = this.limits[scope] || this.limits.default;

    // In test environment with high limits, skip throttling entirely
    if (this.isTestEnv && limit >= 10000) {
      return true;
    }

    // Get the tracker key for this request
    const tracker = await this.getTracker(
      request as unknown as Record<string, unknown>,
    );
    const key = `throttle:${scope}:${tracker}`;

    // Increment the counter and check if rate limited
    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(
        key,
        this.ttl,
        limit,
        this.ttl,
        scope,
      );

    // Set rate limit headers for all scopes
    const headerSuffix = scope === 'default' ? '' : `-${scope}`;
    response.header(`X-RateLimit-Limit${headerSuffix}`, String(limit));
    response.header(
      `X-RateLimit-Remaining${headerSuffix}`,
      String(Math.max(0, limit - totalHits)),
    );
    response.header(`X-RateLimit-Reset${headerSuffix}`, String(timeToExpire));

    // Also set the default headers for compatibility
    if (scope !== 'default') {
      response.header('X-RateLimit-Limit', String(this.limits.default));
      response.header(
        'X-RateLimit-Remaining',
        String(Math.max(0, this.limits.default - totalHits)),
      );
      response.header('X-RateLimit-Reset', String(timeToExpire));
    }

    // If blocked, throw throttler exception
    if (isBlocked) {
      response.header(`Retry-After${headerSuffix}`, String(timeToBlockExpire));
      response.header('Retry-After', String(timeToBlockExpire));
      throw new ThrottlerException(
        `Rate limit exceeded for scope '${scope}'. Retry after ${timeToBlockExpire} seconds.`,
      );
    }

    return true;
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
