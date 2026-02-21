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
import { ProblemService } from './problem.service';
import { CreateProblemDto, RcaEntryDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { ProblemFilterDto } from './dto/problem-filter.dto';
import { LinkIncidentDto } from './dto/problem-link.dto';
import { LinkChangeDto } from './dto/problem-link.dto';
import { Perf } from '../../common/decorators';
import { RcaEntry } from './problem.entity';

/**
 * ITSM Problem Controller
 *
 * Full CRUD API endpoints for managing problems, known errors,
 * incident/change linking, and RCA.
 * All endpoints require JWT authentication and tenant context.
 */
@Controller('grc/itsm/problems')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ProblemController {
  constructor(private readonly problemService: ProblemService) {}

  // ============================================================================
  // Core CRUD
  // ============================================================================

  /**
   * GET /grc/itsm/problems
   * List all problems with pagination, sorting, and filtering
   */
  @Get()
  @Permissions(Permission.ITSM_PROBLEM_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ProblemFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.problemService.findWithFilters(tenantId, filterDto);
  }

  /**
   * GET /grc/itsm/problems/statistics
   * Get problem statistics for the current tenant
   */
  @Get('statistics')
  @Permissions(Permission.ITSM_PROBLEM_READ)
  @Perf()
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.problemService.getStatistics(tenantId);
  }

  /**
   * POST /grc/itsm/problems
   * Create a new problem
   */
  @Post()
  @Permissions(Permission.ITSM_PROBLEM_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateProblemDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.problemService.createProblem(tenantId, req.user.id, {
      shortDescription: dto.shortDescription,
      description: dto.description || null,
      category: dto.category,
      subcategory: dto.subcategory || null,
      state: dto.state,
      impact: dto.impact,
      urgency: dto.urgency,
      source: dto.source,
      symptomSummary: dto.symptomSummary || null,
      workaroundSummary: dto.workaroundSummary || null,
      rootCauseSummary: dto.rootCauseSummary || null,
      knownError: dto.knownError,
      errorCondition: dto.errorCondition || null,
      assignmentGroup: dto.assignmentGroup || null,
      assignedTo: dto.assignedTo || null,
      serviceId: dto.serviceId || null,
      offeringId: dto.offeringId || null,
      detectedAt: dto.detectedAt ? new Date(dto.detectedAt) : null,
      openedAt: dto.openedAt ? new Date(dto.openedAt) : null,
      rcaEntries: dto.rcaEntries
        ? ProblemController.mapRcaEntries(dto.rcaEntries)
        : null,
      metadata: dto.metadata || null,
    });
  }

  /**
   * Map RcaEntryDto[] to RcaEntry[] with default order values
   */
  private static mapRcaEntries(entries: RcaEntryDto[]): RcaEntry[] {
    return entries.map((entry, index) => ({
      type: entry.type,
      content: entry.content,
      order: entry.order ?? index,
    }));
  }

  /**
   * GET /grc/itsm/problems/:id
   * Get a specific problem by ID
   */
  @Get(':id')
  @Permissions(Permission.ITSM_PROBLEM_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const problem = await this.problemService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!problem) {
      throw new NotFoundException(`Problem with ID ${id} not found`);
    }

    return problem;
  }

  /**
   * PATCH /grc/itsm/problems/:id
   * Update an existing problem
   */
  @Patch(':id')
  @Permissions(Permission.ITSM_PROBLEM_UPDATE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateProblemDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const problem = await this.problemService.updateProblem(
      tenantId,
      req.user.id,
      id,
      {
        ...(dto.shortDescription !== undefined && {
          shortDescription: dto.shortDescription,
        }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.subcategory !== undefined && {
          subcategory: dto.subcategory,
        }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.impact !== undefined && { impact: dto.impact }),
        ...(dto.urgency !== undefined && { urgency: dto.urgency }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.symptomSummary !== undefined && {
          symptomSummary: dto.symptomSummary,
        }),
        ...(dto.workaroundSummary !== undefined && {
          workaroundSummary: dto.workaroundSummary,
        }),
        ...(dto.rootCauseSummary !== undefined && {
          rootCauseSummary: dto.rootCauseSummary,
        }),
        ...(dto.knownError !== undefined && { knownError: dto.knownError }),
        ...(dto.errorCondition !== undefined && {
          errorCondition: dto.errorCondition,
        }),
        ...(dto.assignmentGroup !== undefined && {
          assignmentGroup: dto.assignmentGroup,
        }),
        ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
        ...(dto.serviceId !== undefined && { serviceId: dto.serviceId }),
        ...(dto.offeringId !== undefined && { offeringId: dto.offeringId }),
        ...(dto.detectedAt !== undefined && {
          detectedAt: dto.detectedAt ? new Date(dto.detectedAt) : null,
        }),
        ...(dto.openedAt !== undefined && {
          openedAt: dto.openedAt ? new Date(dto.openedAt) : null,
        }),
        ...(dto.resolvedAt !== undefined && {
          resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : null,
        }),
        ...(dto.closedAt !== undefined && {
          closedAt: dto.closedAt ? new Date(dto.closedAt) : null,
        }),
        ...(dto.rcaEntries !== undefined && {
          rcaEntries: dto.rcaEntries
            ? ProblemController.mapRcaEntries(dto.rcaEntries)
            : null,
        }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
      },
    );

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${id} not found`);
    }

    return problem;
  }

  /**
   * DELETE /grc/itsm/problems/:id
   * Soft delete a problem
   */
  @Delete(':id')
  @Permissions(Permission.ITSM_PROBLEM_UPDATE)
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

    const deleted = await this.problemService.softDeleteProblem(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Problem with ID ${id} not found`);
    }
  }

  // ============================================================================
  // Known Error Operations
  // ============================================================================

  /**
   * POST /grc/itsm/problems/:id/mark-known-error
   * Mark a problem as a Known Error
   */
  @Post(':id/mark-known-error')
  @Permissions(Permission.ITSM_PROBLEM_UPDATE)
  @Perf()
  async markKnownError(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const problem = await this.problemService.markKnownError(
      tenantId,
      req.user.id,
      id,
    );

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${id} not found`);
    }

    return problem;
  }

  /**
   * POST /grc/itsm/problems/:id/unmark-known-error
   * Remove Known Error status from a problem
   */
  @Post(':id/unmark-known-error')
  @Permissions(Permission.ITSM_PROBLEM_UPDATE)
  @Perf()
  async unmarkKnownError(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const problem = await this.problemService.unmarkKnownError(
      tenantId,
      req.user.id,
      id,
    );

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${id} not found`);
    }

    return problem;
  }

  // ============================================================================
  // Incident Linking
  // ============================================================================

  /**
   * GET /grc/itsm/problems/:id/incidents
   * List incidents linked to a problem
   */
  @Get(':id/incidents')
  @Permissions(Permission.ITSM_PROBLEM_READ)
  @Perf()
  async listLinkedIncidents(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.problemService.getLinkedIncidents(tenantId, id);
  }

  /**
   * POST /grc/itsm/problems/:id/incidents/:incidentId
   * Link an incident to a problem
   */
  @Post(':id/incidents/:incidentId')
  @Permissions(Permission.ITSM_PROBLEM_LINK_INCIDENT)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkIncident(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('incidentId') incidentId: string,
    @Body() dto: LinkIncidentDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.problemService.linkIncident(
      tenantId,
      req.user.id,
      id,
      incidentId,
      dto.linkType,
    );
  }

  /**
   * DELETE /grc/itsm/problems/:id/incidents/:incidentId
   * Unlink an incident from a problem
   */
  @Delete(':id/incidents/:incidentId')
  @Permissions(Permission.ITSM_PROBLEM_LINK_INCIDENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkIncident(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('incidentId') incidentId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const unlinked = await this.problemService.unlinkIncident(
      tenantId,
      id,
      incidentId,
    );

    if (!unlinked) {
      throw new NotFoundException('Incident link not found');
    }
  }

  // ============================================================================
  // Change Linking
  // ============================================================================

  /**
   * GET /grc/itsm/problems/:id/changes
   * List changes linked to a problem
   */
  @Get(':id/changes')
  @Permissions(Permission.ITSM_PROBLEM_READ)
  @Perf()
  async listLinkedChanges(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.problemService.getLinkedChanges(tenantId, id);
  }

  /**
   * POST /grc/itsm/problems/:id/changes/:changeId
   * Link a change to a problem
   */
  @Post(':id/changes/:changeId')
  @Permissions(Permission.ITSM_PROBLEM_LINK_CHANGE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkChange(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('changeId') changeId: string,
    @Body() dto: LinkChangeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.problemService.linkChange(
      tenantId,
      req.user.id,
      id,
      changeId,
      dto.relationType,
    );
  }

  /**
   * DELETE /grc/itsm/problems/:id/changes/:changeId
   * Unlink a change from a problem
   */
  @Delete(':id/changes/:changeId')
  @Permissions(Permission.ITSM_PROBLEM_LINK_CHANGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkChange(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('changeId') changeId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const unlinked = await this.problemService.unlinkChange(
      tenantId,
      id,
      changeId,
    );

    if (!unlinked) {
      throw new NotFoundException('Change link not found');
    }
  }

  // ============================================================================
  // Summary / Rollups
  // ============================================================================

  /**
   * GET /grc/itsm/problems/:id/summary
   * Get rollup summary for a problem (incident count, change count, etc.)
   */
  @Get(':id/summary')
  @Permissions(Permission.ITSM_PROBLEM_READ)
  @Perf()
  async getSummary(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const problem = await this.problemService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!problem) {
      throw new NotFoundException(`Problem with ID ${id} not found`);
    }

    return this.problemService.getProblemSummary(tenantId, id);
  }

  // ============================================================================
  // RCA
  // ============================================================================

  /**
   * GET /grc/itsm/problems/:id/rca
   * Get RCA entries for a problem
   */
  @Get(':id/rca')
  @Permissions(Permission.ITSM_PROBLEM_READ)
  @Perf()
  async getRca(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const problem = await this.problemService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!problem) {
      throw new NotFoundException(`Problem with ID ${id} not found`);
    }

    return {
      problemId: problem.id,
      rcaEntries: problem.rcaEntries || [],
      rootCauseSummary: problem.rootCauseSummary,
    };
  }
}
