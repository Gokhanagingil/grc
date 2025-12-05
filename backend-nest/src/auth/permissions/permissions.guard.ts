import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from './permission.enum';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionService } from './permission.service';
import { StructuredLoggerService } from '../../common/logger';
import { RequestWithUser } from '../../common/types';
import { UserRole } from '../../users/user.entity';

/**
 * Permissions Guard
 *
 * Checks if the current user has ALL required permissions to access a route.
 * Must be used after JwtAuthGuard to ensure req.user is populated.
 *
 * On access denied:
 * - Returns 403 Forbidden with standardized error payload
 * - Logs structured JSON event: "access.denied"
 *
 * @example
 * ```typescript
 * @Permissions(Permission.GRC_RISK_READ)
 * @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
 * @Get()
 * findAll() { ... }
 * ```
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new StructuredLoggerService();

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {
    this.logger.setContext('PermissionsGuard');
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // If no user is present (JwtAuthGuard should have set this), deny access
    if (!user) {
      this.logAccessDenied(
        request,
        requiredPermissions,
        [],
        'No user in request',
      );
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Authentication required',
        code: 'ACCESS_DENIED_NO_USER',
      });
    }

    // Get user's permissions based on their role
    const userPermissions = this.permissionService.getPermissionsForRole(
      user.role as UserRole,
    );

    // Check if user has ALL required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        (permission) => !userPermissions.includes(permission),
      );

      this.logAccessDenied(
        request,
        requiredPermissions,
        userPermissions,
        `Missing permissions: ${missingPermissions.join(', ')}`,
      );

      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied: Insufficient permissions',
        code: 'ACCESS_DENIED_INSUFFICIENT_PERMISSIONS',
        requiredPermissions,
        missingPermissions,
      });
    }

    return true;
  }

  /**
   * Log access denied event with structured JSON
   */
  private logAccessDenied(
    request: RequestWithUser,
    requiredPermissions: Permission[],
    userPermissions: Permission[],
    reason: string,
  ): void {
    const tenantIdHeader = request.headers?.['x-tenant-id'];
    const tenantId = Array.isArray(tenantIdHeader)
      ? tenantIdHeader[0]
      : (tenantIdHeader ?? null);
    const userId = request.user?.sub ?? null;
    const userRole = request.user?.role ?? null;
    const correlationIdHeader = request.headers?.['x-correlation-id'];
    const correlationId =
      request.correlationId ??
      (Array.isArray(correlationIdHeader)
        ? correlationIdHeader[0]
        : correlationIdHeader) ??
      null;

    this.logger.warn('access.denied', {
      correlationId,
      tenantId,
      userId,
      userRole,
      path: request.path,
      method: request.method,
      requiredPermissions,
      userPermissions,
      reason,
    });
  }
}
