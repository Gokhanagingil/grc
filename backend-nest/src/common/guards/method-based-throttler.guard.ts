import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/**
 * Method-based Rate Limiter Guard
 * 
 * Separates rate limiting by HTTP method and route pattern:
 * - GET /grc/** list/detail: readLimiter (120/min)
 * - POST/PUT/PATCH/DELETE /grc/**: writeLimiter (30/min)
 * - POST /auth/login: authLimiter (10/min)
 * 
 * This prevents GET list endpoints from hitting the strict 10/min limit
 * that was breaking UI list screens.
 */
@Injectable()
export class MethodBasedThrottlerGuard extends ThrottlerGuard {
  constructor(options: ThrottlerOptions, reflector: Reflector) {
    super(options, reflector);
  }

  protected async getTracker(request: Request): Promise<string> {
    // Get tenant ID and user ID from JWT or request headers
    const tenantId = (request.headers['x-tenant-id'] as string) || 'anonymous';
    const userId = (request.user as any)?.userId || (request.user as any)?.id || 'anonymous';
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
      if (path.startsWith('/grc/') ||
          path.startsWith('/itsm/') ||
          path.startsWith('/platform/') ||
          path.startsWith('/audit/') ||
          path.startsWith('/health/')) {
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

  protected async generateKey(context: ExecutionContext, tracker: string, limit: number, ttl: number): Promise<string> {
    const request = context.switchToHttp().getRequest<Request>();
    const scope = this.getScope(request);
    
    // Use scope-specific key format: scope:tracker:limit:ttl
    return `throttle:${scope}:${tracker}:${limit}:${ttl}`;
  }

  protected async getLimit(context: ExecutionContext): Promise<number> {
    const request = context.switchToHttp().getRequest<Request>();
    const scope = this.getScope(request);

    // Return limit based on scope
    switch (scope) {
      case 'auth':
        return 10; // 10 requests per minute for auth
      case 'read':
        return 120; // 120 requests per minute for GET list/detail
      case 'write':
        return 30; // 30 requests per minute for mutations
      default:
        return 100; // Default: 100 requests per minute
    }
  }

  protected async getTtl(context: ExecutionContext): Promise<number> {
    // All limiters use 60 second window
    return 60000;
  }
}
