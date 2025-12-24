import { Request } from 'express';
import { UserRole } from '../../users/user.entity';

/**
 * Authenticated user payload attached to request by JwtStrategy
 */
export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole | string;
  tenantId?: string;
}

/**
 * Extended Express Request with authenticated user and tenant context
 */
export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
  tenantId?: string;
  correlationId?: string;
}
