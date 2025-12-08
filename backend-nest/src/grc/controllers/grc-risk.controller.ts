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
import { GrcRiskService } from '../services/grc-risk.service';
import {
  CreateRiskDto,
  UpdateRiskDto,
  RiskFilterDto,
  LinkPoliciesDto,
  LinkRequirementsDto,
} from '../dto';
import { Perf } from '../../common/decorators';

/**
 * GRC Risk Controller
 *
 * Full CRUD API endpoints for managing risks.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require GRC_RISK_WRITE permission.
 *
 * Query Parameters for GET /grc/risks:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - sortBy: Field to sort by (e.g., createdAt, title, status, severity)
 * - sortOrder: Sort order (ASC or DESC, default: DESC)
 * - status: Filter by risk status
 * - severity: Filter by risk severity
 * - likelihood: Filter by risk likelihood
 * - impact: Filter by risk impact
 * - category: Filter by category
 * - ownerUserId: Filter by owner user ID
 * - createdFrom/createdTo: Filter by creation date range
 * - dueDateFrom/dueDateTo: Filter by due date range
 * - search: Search in title and description
 */
@Controller('grc/risks')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcRiskController {
  constructor(private readonly riskService: GrcRiskService) {}

  /**
   * GET /grc/risks
   * List all risks for the current tenant with pagination, sorting, and filtering
   */
  @Get()
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: RiskFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.riskService.findWithFilters(tenantId, filterDto);
  }

  /**
   * GET /grc/risks/summary
   * Get summary/reporting data for risks
   * Returns counts by status, severity, likelihood, category, plus high priority and overdue counts
   */
  @Get('summary')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
  async getSummary(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.riskService.getSummary(tenantId);
  }

  /**
   * POST /grc/risks
   * Create a new risk for the current tenant
   * Requires GRC_RISK_WRITE permission
   */
  @Post()
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
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
   * Requires GRC_RISK_WRITE permission
   */
  @Patch(':id')
  @Permissions(Permission.GRC_RISK_WRITE)
  @Perf()
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
   * Requires GRC_RISK_WRITE permission
   */
  @Delete(':id')
  @Permissions(Permission.GRC_RISK_WRITE)
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
   * Requires GRC_STATISTICS_READ permission
   */
  @Get('statistics')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
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
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
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
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
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
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
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

  // ============================================================================
  // Relationship Management Endpoints
  // ============================================================================

  /**
   * POST /grc/risks/:id/policies
   * Link policies to a risk (replaces existing links)
   * Requires GRC_RISK_WRITE permission
   */
  @Post(':id/policies')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async linkPolicies(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() linkPoliciesDto: LinkPoliciesDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.riskService.linkPolicies(
      tenantId,
      id,
      linkPoliciesDto.policyIds,
    );

    return { message: 'Policies linked successfully' };
  }

  /**
   * GET /grc/risks/:id/policies
   * Get policies linked to a risk
   */
  @Get(':id/policies')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getLinkedPolicies(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.riskService.getLinkedPolicies(tenantId, id);
  }

  /**
   * POST /grc/risks/:id/requirements
   * Link requirements to a risk (replaces existing links)
   * Requires GRC_RISK_WRITE permission
   */
  @Post(':id/requirements')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async linkRequirements(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() linkRequirementsDto: LinkRequirementsDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.riskService.linkRequirements(
      tenantId,
      id,
      linkRequirementsDto.requirementIds,
    );

    return { message: 'Requirements linked successfully' };
  }

  /**
   * GET /grc/risks/:id/requirements
   * Get requirements linked to a risk
   */
  @Get(':id/requirements')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getLinkedRequirements(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.riskService.getLinkedRequirements(tenantId, id);
  }
}
