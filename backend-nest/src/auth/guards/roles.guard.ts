import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithUser } from '../../common/types';

/**
 * Roles Guard
 *
 * Checks if the current user has one of the required roles to access a route.
 * Must be used after JwtAuthGuard to ensure req.user is populated.
 *
 * @example
 * ```typescript
 * @Roles(UserRole.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('admin-only')
 * adminOnly() { ... }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // If no user is present (JwtAuthGuard should have set this), deny access
    if (!user) {
      return false;
    }

    // Check if user has one of the required roles
    // Cast user.role to string for comparison since it may be UserRole enum or string
    return requiredRoles.some((role) => String(user.role) === String(role));
  }
}
