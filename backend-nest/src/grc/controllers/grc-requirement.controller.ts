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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { GrcRequirementService } from '../services/grc-requirement.service';
import { ComplianceFramework } from '../enums';
import { CreateRequirementDto, UpdateRequirementDto } from '../dto';
import { Perf } from '../../common/decorators';

/**
 * GRC Requirement Controller
 *
 * Full CRUD API endpoints for managing compliance requirements.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require GRC_REQUIREMENT_WRITE permission.
 */
@Controller('grc/requirements')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcRequirementController {
  constructor(private readonly requirementService: GrcRequirementService) {}

  /**
   * GET /grc/requirements
   * List all requirements for the current tenant
   */
  @Get()
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
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
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
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
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @Perf()
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
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
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
   * Requires GRC_STATISTICS_READ permission
   */
  @Get('statistics')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
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
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
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
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
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
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
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
