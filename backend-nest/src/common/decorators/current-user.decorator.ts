import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  role?: string;
  [key: string]: unknown;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Current User Decorator
 *
 * Extracts the current user from the request object.
 * Can optionally extract a specific property from the user.
 *
 * Usage:
 * - @CurrentUser() user - Get the entire user object
 * - @CurrentUser('id') userId - Get just the user ID
 * - @CurrentUser('email') email - Get just the email
 *
 * Requires JwtAuthGuard to be applied to the route.
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
