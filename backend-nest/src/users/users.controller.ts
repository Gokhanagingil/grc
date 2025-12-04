import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from './user.entity';

/**
 * Users Controller
 * 
 * Provides endpoints for user operations.
 * Demonstrates RBAC with @Roles() decorator and RolesGuard.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get total count of users
   * This endpoint proves DB connectivity via TypeORM.
   */
  @Get('count')
  async count() {
    const count = await this.usersService.count();
    return {
      count,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get current user profile (protected route)
   * Requires valid JWT token.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      return { error: 'User not found' };
    }
    
    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Health check endpoint for users module
   */
  @Get('health')
  health() {
    return {
      status: 'ok',
      module: 'users',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Admin-only endpoint
   * 
   * Demonstrates RBAC with @Roles() decorator and RolesGuard.
   * Only users with ADMIN role can access this endpoint.
   * 
   * @example
   * curl -H "Authorization: Bearer <token>" http://localhost:3002/users/admin-only
   */
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin-only')
  async adminOnly(@Request() req: any) {
    return {
      message: 'Welcome, admin!',
      user: {
        id: req.user.sub,
        email: req.user.email,
        role: req.user.role,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all users (admin/manager only)
   * 
   * Demonstrates RBAC with multiple allowed roles.
   */
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    // Return users without password hashes
    return users.map(({ passwordHash, ...user }) => user);
  }
}
