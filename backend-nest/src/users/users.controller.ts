import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
  Headers,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './user.entity';
import { RequestWithUser } from '../common/types';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateRoleDto,
  ChangePasswordDto,
  QueryUsersDto,
} from './dto';

/**
 * Users Controller
 *
 * Provides comprehensive user management endpoints with RBAC.
 * Migrated from Express backend to NestJS.
 *
 * Security:
 * - All endpoints require authentication (JwtAuthGuard)
 * - Role-based access control via RolesGuard
 * - Tenant isolation via x-tenant-id header
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
   * Get user statistics (admin/manager only)
   * Returns counts by role and status
   */
  @Get('statistics/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStatistics(
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.getStatisticsForTenant(effectiveTenantId);
  }

  /**
   * Get list of departments (authenticated users)
   */
  @Get('departments/list')
  @UseGuards(JwtAuthGuard)
  async getDepartments(
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.getDepartmentsForTenant(effectiveTenantId);
  }

  /**
   * Get current user profile (protected route)
   * Requires valid JWT token.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: RequestWithUser) {
    const user = await this.usersService.findById(req.user?.sub || '');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userResponse = { ...user };
    delete (userResponse as { passwordHash?: string }).passwordHash;
    return userResponse;
  }

  /**
   * Get all users (admin/manager only)
   * Supports pagination and filtering
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findAll(
    @Query() query: QueryUsersDto,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.findAllUsersForTenant(effectiveTenantId, query);
  }

  /**
   * Get user by ID
   * Users can view their own profile, admin/manager can view any user
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    const isAdminOrManager = [UserRole.ADMIN, UserRole.MANAGER].includes(
      req.user?.role as UserRole,
    );
    const isSelf = req.user?.sub === id;

    if (!isAdminOrManager && !isSelf) {
      throw new ForbiddenException('Access denied');
    }

    const user = await this.usersService.findOneForTenant(
      effectiveTenantId,
      id,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userResponse = { ...user };
    delete (userResponse as { passwordHash?: string }).passwordHash;
    return userResponse;
  }

  /**
   * Create a new user (admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserDto: CreateUserDto,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.createUserForTenant(
      effectiveTenantId,
      createUserDto,
    );
  }

  /**
   * Update user profile
   * Users can update their own profile (limited fields)
   * Admins can update any user (all fields)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.updateUserForTenant(
      effectiveTenantId,
      id,
      updateUserDto,
      req.user?.sub || '',
      req.user?.role || '',
    );
  }

  /**
   * Update user profile (PUT method for backward compatibility)
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updatePut(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.updateUserForTenant(
      effectiveTenantId,
      id,
      updateUserDto,
      req.user?.sub || '',
      req.user?.role || '',
    );
  }

  /**
   * Update user role (admin only)
   */
  @Put(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.updateUserRole(
      effectiveTenantId,
      id,
      updateRoleDto.role,
    );
  }

  /**
   * Change user password
   * Users can only change their own password
   */
  @Put(':id/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.changePassword(
      effectiveTenantId,
      id,
      changePasswordDto,
      req.user?.sub || '',
    );
  }

  /**
   * Activate user (admin only)
   */
  @Put(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async activate(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.activateUser(effectiveTenantId, id);
  }

  /**
   * Deactivate user (admin only)
   */
  @Put(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deactivate(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return this.usersService.deactivateUser(effectiveTenantId, id);
  }

  /**
   * Delete user (admin only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    await this.usersService.deleteUser(effectiveTenantId, id);
  }
}
