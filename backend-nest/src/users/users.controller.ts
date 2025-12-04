import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Users Controller
 * 
 * Provides endpoints for user operations.
 * This is a skeleton implementation for the initial NestJS setup.
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
}
