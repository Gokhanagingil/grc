import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
  Request,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/user.entity';
import { GrcPolicyService } from '../services/grc-policy.service';
import { PolicyStatus } from '../enums';
import { CreatePolicyDto, UpdatePolicyDto } from '../dto';

/**
 * GRC Policy Controller
 *
 * Full CRUD API endpoints for managing policies.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require MANAGER or ADMIN role.
 */
@ApiTags('GRC Policies')
@ApiBearerAuth('JWT-auth')
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant ID (UUID) for multi-tenant isolation',
  required: true,
  example: '00000000-0000-0000-0000-000000000001',
})
@Controller('grc/policies')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class GrcPolicyController {
  constructor(private readonly policyService: GrcPolicyService) {}

  /**
   * GET /grc/policies
   * List all policies for the current tenant
   */
  @Get()
  @ApiOperation({
    summary: 'List all policies',
    description: 'Retrieve all policies for the current tenant. Supports filtering by status or category.',
  })
  @ApiQuery({ name: 'status', required: false, enum: PolicyStatus, description: 'Filter by policy status' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by policy category' })
  @ApiResponse({ status: 200, description: 'List of policies returned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Filter by status if provided
    if (status) {
      if (!Object.values(PolicyStatus).includes(status as PolicyStatus)) {
        throw new BadRequestException(`Invalid status: ${status}`);
      }
      return this.policyService.findByStatus(tenantId, status as PolicyStatus);
    }

    // Filter by category if provided
    if (category) {
      return this.policyService.findByCategory(tenantId, category);
    }

    // Return all active (non-deleted) policies
    return this.policyService.findAllActiveForTenant(tenantId, {
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * POST /grc/policies
   * Create a new policy for the current tenant
   * Requires MANAGER or ADMIN role
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new policy',
    description: 'Create a new policy for the current tenant. Requires MANAGER or ADMIN role.',
  })
  @ApiResponse({ status: 201, description: 'Policy created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body or missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createPolicyDto: CreatePolicyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.createPolicy(tenantId, req.user.id, createPolicyDto);
  }

  /**
   * PATCH /grc/policies/:id
   * Update an existing policy
   * Requires MANAGER or ADMIN role
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a policy',
    description: 'Update an existing policy. Requires MANAGER or ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'Policy UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Policy updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body or missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updatePolicyDto: UpdatePolicyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const policy = await this.policyService.updatePolicy(
      tenantId,
      req.user.id,
      id,
      updatePolicyDto,
    );

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    return policy;
  }

  /**
   * DELETE /grc/policies/:id
   * Soft delete a policy (marks as deleted, does not remove from database)
   * Requires MANAGER or ADMIN role
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a policy',
    description: 'Soft delete a policy (marks as deleted, does not remove from database). Requires MANAGER or ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'Policy UUID', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Policy deleted successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const deleted = await this.policyService.softDeletePolicy(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }
  }

  /**
   * GET /grc/policies/statistics
   * Get policy statistics for the current tenant
   */
  @Get('statistics')
  @ApiOperation({
    summary: 'Get policy statistics',
    description: 'Get aggregated policy statistics for the current tenant. Requires MANAGER or ADMIN role.',
  })
  @ApiResponse({ status: 200, description: 'Policy statistics returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.getStatistics(tenantId);
  }

  /**
   * GET /grc/policies/active
   * Get active policies for the current tenant
   */
  @Get('active')
  @ApiOperation({
    summary: 'Get active policies',
    description: 'Get all policies with ACTIVE status for the current tenant.',
  })
  @ApiResponse({ status: 200, description: 'Active policies returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findActive(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.findActivePolicies(tenantId);
  }

  /**
   * GET /grc/policies/due-for-review
   * Get policies due for review
   */
  @Get('due-for-review')
  @ApiOperation({
    summary: 'Get policies due for review',
    description: 'Get all policies that are due for review based on their review date. Requires MANAGER or ADMIN role.',
  })
  @ApiResponse({ status: 200, description: 'Policies due for review returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findDueForReview(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.findPoliciesDueForReview(tenantId);
  }

  /**
   * GET /grc/policies/:id
   * Get a specific policy by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a policy by ID',
    description: 'Retrieve a specific policy by its UUID.',
  })
  @ApiParam({ name: 'id', description: 'Policy UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Policy returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const policy = await this.policyService.findOneActiveForTenant(tenantId, id);
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    return policy;
  }

  /**
   * GET /grc/policies/:id/controls
   * Get a policy with its associated controls
   */
  @Get(':id/controls')
  @ApiOperation({
    summary: 'Get a policy with its controls',
    description: 'Retrieve a specific policy along with its associated controls.',
  })
  @ApiParam({ name: 'id', description: 'Policy UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Policy with controls returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findWithControls(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const policy = await this.policyService.findWithControls(tenantId, id);
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    return policy;
  }
}
