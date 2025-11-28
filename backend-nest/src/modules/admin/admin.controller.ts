import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminGuard } from './guards/admin.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import {
  AdminUserListDto,
  AdminCreateUserDto,
  AdminUpdateUserDto,
  AdminListDictionariesDto,
  AdminCreateDictionaryDto,
  AdminUpdateDictionaryDto,
  AdminCreateRoleDto,
  AdminUpdateRoleDto,
  AdminAssignRolesDto,
  AdminListRolesDto,
  AdminCreatePermissionDto,
  AdminUpdatePermissionDto,
  AdminAssignPermissionsDto,
} from './dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin', version: '2' })
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Admin health check',
    description: 'Health check endpoint for admin module (admin only)',
  })
  @ApiOkResponse({ description: 'Admin service is healthy' })
  health() {
    return this.adminService.health();
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get admin summary',
    description: 'Get system statistics and summary (admin only)',
  })
  @ApiOkResponse({ description: 'Admin summary with statistics' })
  async getSummary(@Tenant() tenantId?: string) {
    return this.adminService.getSummary(tenantId);
  }

  // User Management
  @Get('users')
  @ApiOperation({
    summary: 'List users',
    description: 'Get paginated list of users (admin only)',
  })
  @ApiOkResponse({ description: 'List of users' })
  async listUsers(@Query() query: AdminUserListDto) {
    return this.adminService.listUsers(query);
  }

  @Post('users')
  @ApiOperation({
    summary: 'Create user',
    description: 'Create a new user (admin only)',
  })
  @ApiCreatedResponse({ description: 'User created successfully' })
  async createUser(@Body() dto: AdminCreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Get('users/:id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Get user details by ID (admin only)',
  })
  @ApiOkResponse({ description: 'User details' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUser(@Param('id') id: string) {
    // getUser already throws NotFoundException if user not found
    return this.adminService.getUser(id);
  }

  @Patch('users/:id')
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user details (admin only)',
  })
  @ApiOkResponse({ description: 'User updated successfully' })
  async updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  // Tenant Management
  @Get('tenants')
  @ApiOperation({
    summary: 'List tenants',
    description: 'Get list of all tenants (admin only)',
  })
  @ApiOkResponse({ description: 'List of tenants' })
  async listTenants() {
    return this.adminService.listTenants();
  }

  // Dictionary Management
  @Get('dictionaries')
  @ApiOperation({
    summary: 'List dictionaries',
    description: 'Get list of dictionary entries (admin only). Filter by domain, tenantId, isActive.',
  })
  @ApiOkResponse({ description: 'List of dictionary entries' })
  async listDictionaries(
    @Query() query: AdminListDictionariesDto,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.listDictionaries(query, tenantId || '');
  }

  @Post('dictionaries')
  @ApiOperation({
    summary: 'Create dictionary entry',
    description: 'Create a new dictionary entry (admin only)',
  })
  @ApiCreatedResponse({ description: 'Dictionary entry created successfully' })
  async createDictionary(
    @Body() dto: AdminCreateDictionaryDto,
    @Tenant() tenantId?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.userId || req?.user?.sub;
    return this.adminService.createDictionary(dto, tenantId || '', userId);
  }

  @Patch('dictionaries/:id')
  @ApiOperation({
    summary: 'Update dictionary entry',
    description: 'Update dictionary entry details (admin only)',
  })
  @ApiOkResponse({ description: 'Dictionary entry updated successfully' })
  @ApiNotFoundResponse({ description: 'Dictionary entry not found' })
  async updateDictionary(
    @Param('id') id: string,
    @Body() dto: AdminUpdateDictionaryDto,
    @Tenant() tenantId?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.userId || req?.user?.sub;
    return this.adminService.updateDictionary(id, dto, tenantId || '', userId);
  }

  @Delete('dictionaries/:id')
  @ApiOperation({
    summary: 'Delete dictionary entry',
    description: 'Delete a dictionary entry (admin only)',
  })
  @ApiOkResponse({ description: 'Dictionary entry deleted successfully' })
  @ApiNotFoundResponse({ description: 'Dictionary entry not found' })
  async deleteDictionary(
    @Param('id') id: string,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.deleteDictionary(id, tenantId || '');
  }

  // Role Management
  @Get('roles')
  @ApiOperation({
    summary: 'List roles',
    description: 'Get paginated list of roles (admin only)',
  })
  @ApiOkResponse({ description: 'List of roles' })
  async listRoles(
    @Query() query: AdminListRolesDto,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.listRoles(query, tenantId || '');
  }

  // Role-Permission Assignment (must come before generic roles routes to avoid route conflicts)
  @Get('roles/:id/permissions')
  @ApiOperation({
    summary: 'Get role permissions',
    description: 'Get list of permissions assigned to a role (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiOkResponse({ description: 'List of role permissions' })
  async getRolePermissions(
    @Param('id') id: string,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.getRolePermissions(id, tenantId || '');
  }

  @Post('roles/:id/permissions')
  @ApiOperation({
    summary: 'Assign permissions to role',
    description: 'Assign permissions to a role (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiCreatedResponse({ description: 'Permissions assigned successfully' })
  async assignPermissionsToRole(
    @Param('id') id: string,
    @Body() dto: AdminAssignPermissionsDto,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.assignPermissionsToRole(id, dto, tenantId || '');
  }

  @Delete('roles/:id/permissions/:permissionId')
  @ApiOperation({
    summary: 'Remove permission from role',
    description: 'Remove a permission from a role (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @ApiOkResponse({ description: 'Permission removed successfully' })
  async removePermissionFromRole(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.removePermissionFromRole(id, permissionId, tenantId || '');
  }

  @Post('roles')
  @ApiOperation({
    summary: 'Create role',
    description: 'Create a new role (admin only)',
  })
  @ApiCreatedResponse({ description: 'Role created successfully' })
  async createRole(
    @Body() dto: AdminCreateRoleDto,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.createRole(dto, tenantId || '');
  }

  @Patch('roles/:id')
  @ApiOperation({
    summary: 'Update role',
    description: 'Update role details (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiOkResponse({ description: 'Role updated successfully' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: AdminUpdateRoleDto,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.updateRole(id, dto, tenantId || '');
  }

  @Delete('roles/:id')
  @ApiOperation({
    summary: 'Delete role',
    description: 'Delete a role (admin only, cannot delete system roles)',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiOkResponse({ description: 'Role deleted successfully' })
  async deleteRole(
    @Param('id') id: string,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.deleteRole(id, tenantId || '');
  }

  @Post('users/:id/roles')
  @ApiOperation({
    summary: 'Assign roles to user',
    description: 'Assign roles to a user (admin only)',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiCreatedResponse({ description: 'Roles assigned successfully' })
  async assignRolesToUser(
    @Param('id') id: string,
    @Body() dto: AdminAssignRolesDto,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.assignRolesToUser(id, dto, tenantId || '');
  }

  // Permission Management
  @Get('permissions')
  @ApiOperation({
    summary: 'List permissions',
    description: 'Get list of all permissions (admin only)',
  })
  @ApiOkResponse({ description: 'List of permissions' })
  async listPermissions() {
    return this.adminService.listPermissions();
  }

  @Post('permissions')
  @ApiOperation({
    summary: 'Create permission',
    description: 'Create a new permission (admin only)',
  })
  @ApiCreatedResponse({ description: 'Permission created successfully' })
  async createPermission(@Body() dto: AdminCreatePermissionDto) {
    return this.adminService.createPermission(dto);
  }

  @Patch('permissions/:id')
  @ApiOperation({
    summary: 'Update permission',
    description: 'Update permission details (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiOkResponse({ description: 'Permission updated successfully' })
  async updatePermission(
    @Param('id') id: string,
    @Body() dto: AdminUpdatePermissionDto,
  ) {
    return this.adminService.updatePermission(id, dto);
  }

  @Delete('permissions/:id')
  @ApiOperation({
    summary: 'Delete permission',
    description: 'Delete a permission (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiOkResponse({ description: 'Permission deleted successfully' })
  async deletePermission(@Param('id') id: string) {
    return this.adminService.deletePermission(id);
  }


  // User-Role Assignment (Entity-based)
  @Get('users/:id/roles')
  @ApiOperation({
    summary: 'Get user roles',
    description: 'Get list of roles assigned to a user (admin only)',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOkResponse({ description: 'List of user roles' })
  async getUserRoles(
    @Param('id') id: string,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.getUserRoles(id, tenantId || '');
  }

  @Delete('users/:id/roles/:roleId')
  @ApiOperation({
    summary: 'Remove role from user',
    description: 'Remove a role from a user (admin only)',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiOkResponse({ description: 'Role removed successfully' })
  async removeRoleFromUser(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Tenant() tenantId?: string,
  ) {
    return this.adminService.removeRoleFromUser(id, roleId, tenantId || '');
  }

  // Schema Explorer
  @Get('schema/graph')
  @ApiOperation({
    summary: 'Get schema graph',
    description: 'Get dynamic schema graph with all tables and relationships (admin only)',
  })
  @ApiOkResponse({ description: 'Schema graph with nodes and edges' })
  async getSchemaGraph() {
    return this.adminService.getSchemaGraph();
  }
}

