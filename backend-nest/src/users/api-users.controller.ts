import {
  Controller,
  Get,
  UseGuards,
  Request,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './user.entity';
import { RequestWithUser } from '../common/types';

/**
 * API Users Controller (Compatibility)
 *
 * Provides backward compatibility for frontend code that calls
 * /api/users instead of /users.
 *
 * This is a legacy path used by some frontend components.
 */
@Controller('api/users')
export class ApiUsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get all users (admin/manager only)
   * Compatibility endpoint for /api/users
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findAll(
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.findAllUsersForTenant(effectiveTenantId, {});
  }
}
