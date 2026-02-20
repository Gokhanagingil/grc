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
  UsePipes,
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
  CreateRiskAssessmentDto,
  LinkRiskControlDto,
  CreateTreatmentActionDto,
  UpdateTreatmentActionDto,
  UpdateEffectivenessOverrideDto,
} from '../dto';
import { Perf } from '../../common/decorators';
import { RisksListQueryPipe } from '../../common/pipes';
import { AssessmentType } from '../enums';

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
  @UsePipes(RisksListQueryPipe)
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
   * GET /grc/risks/heatmap
   * Get heatmap data for risks (5x5 grid aggregation)
   * NOTE: This route MUST be defined before :id routes to prevent "heatmap" being matched as a UUID
   */
  @Get('heatmap')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getHeatmap(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const heatmap = await this.riskService.getHeatmap(tenantId);
    return { success: true, data: heatmap };
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

    const policies = await this.riskService.getLinkedPolicies(tenantId, id);
    return { success: true, data: policies };
  }

  /**
   * POST /grc/risks/:riskId/policies/:policyId
   * Link a single policy to a risk (idempotent)
   * Requires GRC_RISK_WRITE permission
   */
  @Post(':riskId/policies/:policyId')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async linkPolicy(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
    @Param('policyId') policyId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.riskService.linkPolicy(tenantId, riskId, policyId);
    return { success: true, message: 'Policy linked successfully' };
  }

  /**
   * DELETE /grc/risks/:riskId/policies/:policyId
   * Unlink a single policy from a risk
   * Requires GRC_RISK_WRITE permission
   */
  @Delete(':riskId/policies/:policyId')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkPolicy(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
    @Param('policyId') policyId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.riskService.unlinkPolicy(tenantId, riskId, policyId);
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

    const requirements = await this.riskService.getLinkedRequirements(
      tenantId,
      id,
    );
    return { success: true, data: requirements };
  }

  // ============================================================================
  // Control Relationship Management Endpoints
  // ============================================================================

  /**
   * POST /grc/risks/:riskId/controls/:controlId
   * Link a control to a risk
   * Requires GRC_RISK_WRITE permission
   */
  @Post(':riskId/controls/:controlId')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async linkControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
    @Param('controlId') controlId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.riskService.linkControl(tenantId, riskId, controlId);
    return { success: true, message: 'Control linked successfully' };
  }

  /**
   * DELETE /grc/risks/:riskId/controls/:controlId
   * Unlink a control from a risk
   * Requires GRC_RISK_WRITE permission
   */
  @Delete(':riskId/controls/:controlId')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
    @Param('controlId') controlId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.riskService.unlinkControl(tenantId, riskId, controlId);
  }

  /**
   * GET /grc/risks/:id/controls
   * Get controls linked to a risk
   */
  @Get(':id/controls/list')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getLinkedControls(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const controls = await this.riskService.getLinkedControls(tenantId, id);
    return { success: true, data: controls };
  }

  // ============================================================================
  // MVP+ Risk Assessment Endpoints
  // ============================================================================

  /**
   * GET /grc/risks/:id/detail
   * Get risk detail with assessments and linked controls
   */
  @Get(':id/detail')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getRiskDetail(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const detail = await this.riskService.getRiskDetail(tenantId, id);
    if (!detail) {
      throw new NotFoundException(`Risk with ID ${id} not found`);
    }

    return { success: true, data: detail };
  }

  /**
   * POST /grc/risks/:id/assessments
   * Create a new risk assessment
   */
  @Post(':id/assessments')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createAssessment(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() createAssessmentDto: CreateRiskAssessmentDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const assessment = await this.riskService.createAssessment(
      tenantId,
      req.user.id,
      id,
      createAssessmentDto,
    );

    return { success: true, data: assessment };
  }

  /**
   * GET /grc/risks/:id/assessments
   * Get assessment history for a risk
   */
  @Get(':id/assessments')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getAssessments(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Query('type') assessmentType?: AssessmentType,
    @Query('limit') limit?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const assessments = await this.riskService.getAssessments(tenantId, id, {
      assessmentType,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return { success: true, data: assessments };
  }

  /**
   * POST /grc/risks/:riskId/controls/:controlId/link
   * Link a control to a risk with effectiveness rating
   */
  @Post(':riskId/controls/:controlId/link')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async linkControlWithEffectiveness(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
    @Param('controlId') controlId: string,
    @Body() linkDto: LinkRiskControlDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const link = await this.riskService.linkControlWithEffectiveness(
      tenantId,
      riskId,
      controlId,
      linkDto.effectivenessRating,
      linkDto.notes,
    );

    return { success: true, data: link };
  }

  /**
   * PATCH /grc/risks/:riskId/controls/:controlId/effectiveness
   * Update control link effectiveness
   */
  @Patch(':riskId/controls/:controlId/effectiveness')
  @Permissions(Permission.GRC_RISK_WRITE)
  @Perf()
  async updateControlEffectiveness(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
    @Param('controlId') controlId: string,
    @Body() linkDto: LinkRiskControlDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!linkDto.effectivenessRating) {
      throw new BadRequestException('effectivenessRating is required');
    }

    const link = await this.riskService.updateControlEffectiveness(
      tenantId,
      riskId,
      controlId,
      linkDto.effectivenessRating,
      linkDto.notes,
    );

    if (!link) {
      throw new NotFoundException(
        `Control link not found for risk ${riskId} and control ${controlId}`,
      );
    }

    return { success: true, data: link };
  }

  /**
   * PATCH /grc/risks/:riskId/controls/:controlId/effectiveness-override
   * Update effectiveness override on a risk-control link
   *
   * Sets or clears the overrideEffectivenessPercent for a specific risk-control link.
   * When set, this value takes precedence over the control's global effectivenessPercent.
   * When null, the control's global effectivenessPercent is used.
   *
   * Body: { overrideEffectivenessPercent: number | null }
   * - number (0-100): Set override effectiveness
   * - null: Clear override, use control's global effectiveness
   */
  @Patch(':riskId/controls/:controlId/effectiveness-override')
  @Permissions(Permission.GRC_RISK_WRITE)
  @Perf()
  async updateEffectivenessOverride(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
    @Param('controlId') controlId: string,
    @Body() dto: UpdateEffectivenessOverrideDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Validate range if not null
    if (
      dto.overrideEffectivenessPercent !== null &&
      dto.overrideEffectivenessPercent !== undefined
    ) {
      if (
        dto.overrideEffectivenessPercent < 0 ||
        dto.overrideEffectivenessPercent > 100
      ) {
        throw new BadRequestException(
          'overrideEffectivenessPercent must be between 0 and 100',
        );
      }
    }

    const link = await this.riskService.updateEffectivenessOverride(
      tenantId,
      riskId,
      controlId,
      dto.overrideEffectivenessPercent ?? null,
    );

    if (!link) {
      throw new NotFoundException(
        `Control link not found for risk ${riskId} and control ${controlId}`,
      );
    }

    return { success: true, data: link };
  }

  /**
   * POST /grc/risks/:riskId/recalculate-residual
   * Recalculate residual risk based on linked controls
   * Requires GRC_RISK_WRITE permission
   */
  @Post(':riskId/recalculate-residual')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async recalculateResidualRisk(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const risk = await this.riskService.recalculateResidualRisk(
      tenantId,
      riskId,
    );

    if (!risk) {
      throw new NotFoundException(`Risk with ID ${riskId} not found`);
    }

    return { success: true, data: risk };
  }

  /**
   * GET /grc/risks/:riskId/controls/effectiveness
   * Get linked controls with effectiveness ratings for residual calculation display
   */
  @Get(':riskId/controls/effectiveness')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getLinkedControlsWithEffectiveness(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const controls = await this.riskService.getLinkedControlsWithEffectiveness(
      tenantId,
      riskId,
    );

    return { success: true, data: controls };
  }

  // ============================================================================
  // Treatment Action Endpoints
  // ============================================================================

  /**
   * GET /grc/risks/:riskId/treatment/actions
   * Get all treatment actions for a risk
   */
  @Get(':riskId/treatment/actions')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getTreatmentActions(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const actions = await this.riskService.getTreatmentActions(
      tenantId,
      riskId,
    );
    return { success: true, data: actions };
  }

  /**
   * POST /grc/risks/:riskId/treatment/actions
   * Create a new treatment action for a risk
   */
  @Post(':riskId/treatment/actions')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createTreatmentAction(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('riskId') riskId: string,
    @Body() createDto: CreateTreatmentActionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const action = await this.riskService.createTreatmentAction(
      tenantId,
      req.user.id,
      riskId,
      {
        title: createDto.title,
        description: createDto.description,
        status: createDto.status,
        ownerUserId: createDto.ownerUserId,
        ownerDisplayName: createDto.ownerDisplayName,
        dueDate: createDto.dueDate ? new Date(createDto.dueDate) : undefined,
        progressPct: createDto.progressPct,
        evidenceLink: createDto.evidenceLink,
        sortOrder: createDto.sortOrder,
        notes: createDto.notes,
      },
    );

    return { success: true, data: action };
  }

  /**
   * GET /grc/risks/:riskId/treatment/actions/:actionId
   * Get a specific treatment action
   */
  @Get(':riskId/treatment/actions/:actionId')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getTreatmentAction(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
    @Param('actionId') actionId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const action = await this.riskService.getTreatmentAction(
      tenantId,
      riskId,
      actionId,
    );

    if (!action) {
      throw new NotFoundException(
        `Treatment action with ID ${actionId} not found`,
      );
    }

    return { success: true, data: action };
  }

  /**
   * PATCH /grc/risks/:riskId/treatment/actions/:actionId
   * Update a treatment action
   */
  @Patch(':riskId/treatment/actions/:actionId')
  @Permissions(Permission.GRC_RISK_WRITE)
  @Perf()
  async updateTreatmentAction(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('riskId') riskId: string,
    @Param('actionId') actionId: string,
    @Body() updateDto: UpdateTreatmentActionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const action = await this.riskService.updateTreatmentAction(
      tenantId,
      req.user.id,
      riskId,
      actionId,
      {
        title: updateDto.title,
        description: updateDto.description,
        status: updateDto.status,
        ownerUserId: updateDto.ownerUserId,
        ownerDisplayName: updateDto.ownerDisplayName,
        dueDate: updateDto.dueDate ? new Date(updateDto.dueDate) : undefined,
        completedAt: updateDto.completedAt
          ? new Date(updateDto.completedAt)
          : undefined,
        progressPct: updateDto.progressPct,
        evidenceLink: updateDto.evidenceLink,
        sortOrder: updateDto.sortOrder,
        notes: updateDto.notes,
      },
    );

    if (!action) {
      throw new NotFoundException(
        `Treatment action with ID ${actionId} not found`,
      );
    }

    return { success: true, data: action };
  }

  /**
   * DELETE /grc/risks/:riskId/treatment/actions/:actionId
   * Delete a treatment action (soft delete)
   */
  @Delete(':riskId/treatment/actions/:actionId')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deleteTreatmentAction(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('riskId') riskId: string,
    @Param('actionId') actionId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const deleted = await this.riskService.deleteTreatmentAction(
      tenantId,
      req.user.id,
      riskId,
      actionId,
    );

    if (!deleted) {
      throw new NotFoundException(
        `Treatment action with ID ${actionId} not found`,
      );
    }
  }

  /**
   * GET /grc/risks/:riskId/treatment/summary
   * Get treatment action summary/counts for a risk
   */
  @Get(':riskId/treatment/summary')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getTreatmentSummary(
    @Headers('x-tenant-id') tenantId: string,
    @Param('riskId') riskId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const summary = await this.riskService.getTreatmentActionCount(
      tenantId,
      riskId,
    );

    return { success: true, data: summary };
  }

  /**
   * GET /grc/risks/above-appetite
   * Get risks above the tenant's risk appetite threshold
   * Query params: appetiteScore (required), page, pageSize, sortBy, sortOrder
   */
  @Get('above-appetite')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getRisksAboveAppetite(
    @Headers('x-tenant-id') tenantId: string,
    @Query('appetiteScore') appetiteScoreStr: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const appetiteScore = parseInt(appetiteScoreStr, 10);
    if (isNaN(appetiteScore) || appetiteScore < 1 || appetiteScore > 25) {
      throw new BadRequestException(
        'appetiteScore must be a number between 1 and 25',
      );
    }

    const result = await this.riskService.getRisksAboveAppetite(
      tenantId,
      appetiteScore,
      {
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        sortBy: sortBy || 'residualScore',
        sortOrder: sortOrder || 'DESC',
      },
    );

    return { success: true, ...result };
  }

  /**
   * GET /grc/risks/stats-with-appetite
   * Get risk statistics including above-appetite count
   * Query params: appetiteScore (required)
   */
  @Get('stats-with-appetite')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getStatsWithAppetite(
    @Headers('x-tenant-id') tenantId: string,
    @Query('appetiteScore') appetiteScoreStr: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const appetiteScore = parseInt(appetiteScoreStr, 10);
    if (isNaN(appetiteScore) || appetiteScore < 1 || appetiteScore > 25) {
      throw new BadRequestException(
        'appetiteScore must be a number between 1 and 25',
      );
    }

    const stats = await this.riskService.getStatsWithAppetite(
      tenantId,
      appetiteScore,
    );

    return { success: true, data: stats };
  }
}
