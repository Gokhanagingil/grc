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
import {
  CreateRequirementDto,
  UpdateRequirementDto,
  RequirementFilterDto,
} from '../dto';
import { Perf } from '../../common/decorators';

/**
 * GRC Requirement Controller
 *
 * Full CRUD API endpoints for managing compliance requirements.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require GRC_REQUIREMENT_WRITE permission.
 *
 * Query Parameters for GET /grc/requirements:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - sortBy: Field to sort by (e.g., createdAt, title, framework, referenceCode)
 * - sortOrder: Sort order (ASC or DESC, default: DESC)
 * - framework: Filter by compliance framework (iso27001, soc2, gdpr, hipaa, pci_dss, nist, other)
 * - status: Filter by status
 * - category: Filter by category
 * - priority: Filter by priority
 * - referenceCode: Filter by reference code
 * - ownerUserId: Filter by owner user ID
 * - createdFrom/createdTo: Filter by creation date range
 * - dueDateFrom/dueDateTo: Filter by due date range
 * - search: Search in title, description, and reference code
 */
@Controller('grc/requirements')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcRequirementController {
  constructor(private readonly requirementService: GrcRequirementService) {}

  /**
   * GET /grc/requirements
   * List all requirements for the current tenant with pagination, sorting, and filtering
   */
  @Get()
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: RequirementFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.requirementService.findWithFilters(tenantId, filterDto);
  }

  /**
   * GET /grc/requirements/summary
   * Get summary/reporting data for requirements
   * Returns counts by framework, status, category, priority, plus compliant/non-compliant/in-progress counts
   */
  @Get('summary')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
  async getSummary(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.requirementService.getSummary(tenantId);
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
   * GET /grc/requirements/filters
   * Get available filter options for requirements (families, versions, domains, etc.)
   * Used by Standards Library UI to populate filter dropdowns
   */
  @Get('filters')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async getFilters(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.requirementService.getFilterOptions(tenantId);
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

  // ============================================================================
  // Relationship Management Endpoints
  // ============================================================================

  /**
   * GET /grc/requirements/:id/risks
   * Get risks linked to a requirement
   */
  @Get(':id/risks')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async getLinkedRisks(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.requirementService.getLinkedRisks(tenantId, id);
  }

  /**
   * GET /grc/requirements/:id/issues
   * Get issues (findings) linked to a requirement
   */
  @Get(':id/issues')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async getLinkedIssues(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.requirementService.getLinkedIssues(tenantId, id);
  }
}
