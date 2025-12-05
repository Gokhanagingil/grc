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
import { GrcRiskService } from '../services/grc-risk.service';
import { RiskStatus, RiskSeverity } from '../enums';
import { CreateRiskDto, UpdateRiskDto } from '../dto';

/**
 * GRC Risk Controller
 *
 * Full CRUD API endpoints for managing risks.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require MANAGER or ADMIN role.
 */
@ApiTags('GRC Risks')
@ApiBearerAuth('JWT-auth')
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant ID (UUID) for multi-tenant isolation',
  required: true,
  example: '00000000-0000-0000-0000-000000000001',
})
@Controller('grc/risks')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class GrcRiskController {
  constructor(private readonly riskService: GrcRiskService) {}

  /**
   * GET /grc/risks
   * List all risks for the current tenant
   */
  @Get()
  @ApiOperation({
    summary: 'List all risks',
    description: 'Retrieve all risks for the current tenant. Supports filtering by status or severity.',
  })
  @ApiQuery({ name: 'status', required: false, enum: RiskStatus, description: 'Filter by risk status' })
  @ApiQuery({ name: 'severity', required: false, enum: RiskSeverity, description: 'Filter by risk severity' })
  @ApiResponse({ status: 200, description: 'List of risks returned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status or severity value' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Filter by status if provided
    if (status) {
      if (!Object.values(RiskStatus).includes(status as RiskStatus)) {
        throw new BadRequestException(`Invalid status: ${status}`);
      }
      return this.riskService.findByStatus(tenantId, status as RiskStatus);
    }

    // Filter by severity if provided
    if (severity) {
      if (!Object.values(RiskSeverity).includes(severity as RiskSeverity)) {
        throw new BadRequestException(`Invalid severity: ${severity}`);
      }
      return this.riskService.findBySeverity(
        tenantId,
        severity as RiskSeverity,
      );
    }

    // Return all active (non-deleted) risks
    return this.riskService.findAllActiveForTenant(tenantId, {
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * POST /grc/risks
   * Create a new risk for the current tenant
   * Requires MANAGER or ADMIN role
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new risk',
    description: 'Create a new risk for the current tenant. Requires MANAGER or ADMIN role.',
  })
  @ApiResponse({ status: 201, description: 'Risk created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body or missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createRiskDto: CreateRiskDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.riskService.createRisk(tenantId, req.user.id, createRiskDto);
  }

  /**
   * PATCH /grc/risks/:id
   * Update an existing risk
   * Requires MANAGER or ADMIN role
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a risk',
    description: 'Update an existing risk. Requires MANAGER or ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'Risk UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Risk updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body or missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @ApiResponse({ status: 404, description: 'Risk not found' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateRiskDto: UpdateRiskDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const risk = await this.riskService.updateRisk(
      tenantId,
      req.user.id,
      id,
      updateRiskDto,
    );

    if (!risk) {
      throw new NotFoundException(`Risk with ID ${id} not found`);
    }

    return risk;
  }

  /**
   * DELETE /grc/risks/:id
   * Soft delete a risk (marks as deleted, does not remove from database)
   * Requires MANAGER or ADMIN role
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a risk',
    description: 'Soft delete a risk (marks as deleted, does not remove from database). Requires MANAGER or ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'Risk UUID', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Risk deleted successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @ApiResponse({ status: 404, description: 'Risk not found' })
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

    const deleted = await this.riskService.softDeleteRisk(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Risk with ID ${id} not found`);
    }
  }

  /**
   * GET /grc/risks/statistics
   * Get risk statistics for the current tenant
   */
  @Get('statistics')
  @ApiOperation({
    summary: 'Get risk statistics',
    description: 'Get aggregated risk statistics for the current tenant. Requires MANAGER or ADMIN role.',
  })
  @ApiResponse({ status: 200, description: 'Risk statistics returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.riskService.getStatistics(tenantId);
  }

  /**
   * GET /grc/risks/high-severity
   * Get high-severity risks (HIGH or CRITICAL)
   */
  @Get('high-severity')
  @ApiOperation({
    summary: 'Get high-severity risks',
    description: 'Get all risks with HIGH or CRITICAL severity for the current tenant.',
  })
  @ApiResponse({ status: 200, description: 'High-severity risks returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findHighSeverity(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.riskService.findHighSeverityRisks(tenantId);
  }

  /**
   * GET /grc/risks/:id
   * Get a specific risk by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a risk by ID',
    description: 'Retrieve a specific risk by its UUID.',
  })
  @ApiParam({ name: 'id', description: 'Risk UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Risk returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Risk not found' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const risk = await this.riskService.findOneActiveForTenant(tenantId, id);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${id} not found`);
    }

    return risk;
  }

  /**
   * GET /grc/risks/:id/controls
   * Get a risk with its associated controls
   */
  @Get(':id/controls')
  @ApiOperation({
    summary: 'Get a risk with its controls',
    description: 'Retrieve a specific risk along with its associated controls.',
  })
  @ApiParam({ name: 'id', description: 'Risk UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Risk with controls returned successfully' })
  @ApiResponse({ status: 400, description: 'Missing tenant header' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Risk not found' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findWithControls(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const risk = await this.riskService.findWithControls(tenantId, id);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${id} not found`);
    }

    return risk;
  }
}
