import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { AuditLogEvent, DomainEventNames } from '../events/domain-events';
import { Request, Response } from 'express';

/**
 * Audit Interceptor
 *
 * Global interceptor that emits audit log events for API requests.
 * Excludes health endpoints and other noisy routes.
 *
 * This interceptor is intentionally thin - it only extracts request data
 * and emits an event. The actual persistence is handled by AuditService.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly isEnabled: boolean;
  private readonly excludedPaths: string[];

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.isEnabled =
      this.configService.get<string>('audit.enabled', 'true') === 'true';

    // Paths to exclude from audit logging (health checks, metrics, etc.)
    this.excludedPaths = [
      '/health',
      '/health/live',
      '/health/ready',
      '/metrics',
      '/favicon.ico',
    ];
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.isEnabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    // Skip excluded paths
    if (this.excludedPaths.some((excluded) => path.startsWith(excluded))) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.emitAuditEvent(context, request, startTime);
        },
        error: () => {
          this.emitAuditEvent(context, request, startTime);
        },
      }),
    );
  }

  private emitAuditEvent(
    context: ExecutionContext,
    request: Request,
    startTime: number,
  ): void {
    const response = context.switchToHttp().getResponse<Response>();

    // Extract user from request (set by JwtAuthGuard)
    const user = request.user as { sub?: string; id?: string } | undefined;
    const userId = user?.sub || user?.id || null;

    // Extract tenant ID from header
    const tenantId = (request.headers['x-tenant-id'] as string) || null;

    // Build action string (METHOD + path)
    const action = `${request.method} ${request.path}`;

    // Extract resource from path (first segment after /api or /)
    const pathSegments = request.path.split('/').filter(Boolean);
    const resource = pathSegments[0] || 'unknown';

    // Try to extract resource ID from path (usually the second segment if it's a UUID or number)
    const potentialId = pathSegments[1];
    const resourceId = this.isValidResourceId(potentialId) ? potentialId : null;

    // Build metadata
    const metadata: Record<string, unknown> = {
      method: request.method,
      path: request.path,
      query: Object.keys(request.query).length > 0 ? request.query : undefined,
      userAgent: request.headers['user-agent'],
      duration: Date.now() - startTime,
    };

    // Get IP address
    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      request.socket?.remoteAddress;

    // Emit the audit log event
    const event = new AuditLogEvent(
      userId,
      tenantId,
      action,
      resource,
      resourceId,
      metadata,
      response.statusCode,
      ipAddress,
    );

    this.eventEmitter.emit(DomainEventNames.AUDIT_LOG, event);
  }

  /**
   * Check if a string looks like a valid resource ID (UUID or numeric)
   */
  private isValidResourceId(value: string | undefined): boolean {
    if (!value) return false;

    // Check for UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(value)) return true;

    // Check for numeric ID
    if (/^\d+$/.test(value)) return true;

    return false;
  }
}
