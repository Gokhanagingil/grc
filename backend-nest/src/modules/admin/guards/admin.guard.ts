import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../auth/jwt.guard';

/**
 * AdminGuard - Role-based guard for admin-only endpoints
 * 
 * Requires:
 * 1. JWT authentication (via JwtAuthGuard)
 * 2. User must have 'admin' role in roles array
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard, AdminGuard)
 * @Controller('admin')
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user has 'admin' role
    const roles = user.roles || [];
    if (!Array.isArray(roles) || !roles.includes('admin')) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}

