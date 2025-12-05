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
import { GrcRequirementService } from '../services/grc-requirement.service';
import { ComplianceFramework } from '../enums';
import { CreateRequirementDto, UpdateRequirementDto } from '../dto';

/**
 * GRC Requirement Controller
 *
 * Full CRUD API endpoints for managing compliance requirements.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require MANAGER or ADMIN role.
 */
@ApiTags('GRC Requirements')
@ApiBearerAuth('JWT-auth')
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant ID (UUID) for multi-tenant isolation',
  required: true,
  example: '00000000-0000-0000-0000-000000000001',
})
@Controller('grc/requirements')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class GrcRequirementController {
  constructor(private readonly requirementService: GrcRequirementService) {}

  /**
   * GET /grc/requirements
   * List all requirements for the current tenant
   */
  @Get()
  @ApiOperation({
    summary: 'List all requirements',
    description: 'Retrieve all compliance requirements for the current tenant. Supports filtering by framework or status.',
  })
  @ApiQuery({ name: 'framework', required: false, enum: ComplianceFramework, description: 'Filter by compliance framework' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by requirement status' })
  @ApiResponse({ status: 200, description: 'List of requirements returned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid framework value' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('framework') framework?: string,
    @Query('status') status?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Filter by framework if provided
    if (framework) {
      if (
        !Object.values(ComplianceFramework).includes(
          framework as ComplianceFramework,
        )
      ) {
        throw new BadRequestException(`Invalid framework: ${framework}`);
      }
      return this.requirementService.findByFramework(
        tenantId,
        framework as ComplianceFramework,
      );
    }

    // Filter by status if provided
    if (status) {
      return this.requirementService.findByStatus(tenantId, status);
    }

    // Return all active (non-deleted) requirements
    return this.requirementService.findAllActiveForTenant(tenantId, {
      order: { framework: 'ASC', referenceCode: 'ASC' },
    });
  }

  /**
   * POST /grc/requirements
   * Create a new requirement for the current tenant
   * Requires MANAGER or ADMIN role
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new requirement',
    description: 'Create a new compliance requirement for the current tenant. Requires MANAGER or ADMIN role.',
  })
  @ApiResponse({ status: 201, description: 'Requirement created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body or missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createRequirementDto: CreateRequirementDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.requirementService.createRequirement(
      tenantId,
      req.user.id,
      createRequirementDto,
    );
  }

  /**
   * PATCH /grc/requirements/:id
   * Update an existing requirement
   * Requires MANAGER or ADMIN role
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a requirement',
    description: 'Update an existing compliance requirement. Requires MANAGER or ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'Requirement UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Requirement updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body or missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @ApiResponse({ status: 404, description: 'Requirement not found' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateRequirementDto: UpdateRequirementDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const requirement = await this.requirementService.updateRequirement(
      tenantId,
      req.user.id,
      id,
      updateRequirementDto,
    );

    if (!requirement) {
      throw new NotFoundException(`Requirement with ID ${id} not found`);
    }

    return requirement;
  }

  /**
   * DELETE /grc/requirements/:id
   * Soft delete a requirement (marks as deleted, does not remove from database)
   * Requires MANAGER or ADMIN role
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a requirement',
    description: 'Soft delete a requirement (marks as deleted, does not remove from database). Requires MANAGER or ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'Requirement UUID', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Requirement deleted successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @ApiResponse({ status: 404, description: 'Requirement not found' })
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

    const deleted = await this.requirementService.softDeleteRequirement(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Requirement with ID ${id} not found`);
    }
  }

  /**
   * GET /grc/requirements/statistics
   * Get requirement statistics for the current tenant
   */
  @Get('statistics')
  @ApiOperation({
    summary: 'Get requirement statistics',
    description: 'Get aggregated compliance requirement statistics for the current tenant. Requires MANAGER or ADMIN role.',
  })
  @ApiResponse({ status: 200, description: 'Requirement statistics returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.requirementService.getStatistics(tenantId);
  }

  /**
   * GET /grc/requirements/frameworks
   * Get all unique frameworks used by the current tenant
   */
  @Get('frameworks')
  @ApiOperation({
    summary: 'Get available frameworks',
    description: 'Get all unique compliance frameworks used by the current tenant.',
  })
  @ApiResponse({ status: 200, description: 'Frameworks list returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async getFrameworks(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.requirementService.getFrameworks(tenantId);
  }

  /**
   * GET /grc/requirements/:id
   * Get a specific requirement by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a requirement by ID',
    description: 'Retrieve a specific compliance requirement by its UUID.',
  })
  @ApiParam({ name: 'id', description: 'Requirement UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Requirement returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Requirement not found' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const requirement = await this.requirementService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!requirement) {
      throw new NotFoundException(`Requirement with ID ${id} not found`);
    }

    return requirement;
  }

  /**
   * GET /grc/requirements/:id/controls
   * Get a requirement with its associated controls
   */
  @Get(':id/controls')
  @ApiOperation({
    summary: 'Get a requirement with its controls',
    description: 'Retrieve a specific compliance requirement along with its associated controls.',
  })
  @ApiParam({ name: 'id', description: 'Requirement UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Requirement with controls returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Requirement not found' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findWithControls(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const requirement = await this.requirementService.findWithControls(
      tenantId,
      id,
    );
    if (!requirement) {
      throw new NotFoundException(`Requirement with ID ${id} not found`);
    }

    return requirement;
  }
}
