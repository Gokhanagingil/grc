import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Headers,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/user.entity';
import { GrcRequirementService } from '../services/grc-requirement.service';
import { ComplianceFramework } from '../enums';

/**
 * GRC Requirement Controller
 *
 * Read-only API endpoints for exploring compliance requirements.
 * All endpoints require JWT authentication and tenant context.
 */
@Controller('grc/requirements')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class GrcRequirementController {
  constructor(private readonly requirementService: GrcRequirementService) {}

  /**
   * GET /grc/requirements
   * List all requirements for the current tenant
   */
  @Get()
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

    // Return all requirements
    return this.requirementService.findAllForTenant(tenantId, {
      order: { framework: 'ASC', referenceCode: 'ASC' },
    });
  }

  /**
   * GET /grc/requirements/statistics
   * Get requirement statistics for the current tenant
   */
  @Get('statistics')
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const requirement = await this.requirementService.findOneForTenant(
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
