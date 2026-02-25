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
import { IncidentService } from './incident.service';
import { IncidentCiService } from './incident-ci.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentFilterDto } from './dto/incident-filter.dto';
import { CreateIncidentCiDto } from './dto/create-incident-ci.dto';
import { IncidentCiFilterDto } from './dto/incident-ci-filter.dto';
import { Perf } from '../../common/decorators';

/**
 * ITSM Incident Controller
 *
 * Full CRUD API endpoints for managing incidents.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require ITSM_INCIDENT_WRITE permission.
 *
 * Query Parameters for GET /itsm/incidents:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - sortBy: Field to sort by (e.g., createdAt, number, status, priority)
 * - sortOrder: Sort order (ASC or DESC, default: DESC)
 * - status: Filter by incident status
 * - priority: Filter by incident priority
 * - category: Filter by incident category
 * - assignmentGroup: Filter by assignment group (partial match)
 * - assignedTo: Filter by assignee user ID
 * - createdFrom/createdTo: Filter by creation date range
 * - search: Search in number, shortDescription, description
 */
@Controller('grc/itsm/incidents')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class IncidentController {
  constructor(
    private readonly incidentService: IncidentService,
    private readonly incidentCiService: IncidentCiService,
  ) {}

  /**
   * GET /itsm/incidents
   * List all incidents for the current tenant with pagination, sorting, and filtering
   */
  @Get()
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: IncidentFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.incidentService.findWithFilters(
      tenantId,
      filterDto,
    );
    return result;
  }

  /**
   * GET /itsm/incidents/statistics
   * Get incident statistics for the current tenant
   */
  @Get('statistics')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const stats = await this.incidentService.getStatistics(tenantId);
    return stats;
  }

  /**
   * GET /itsm/incidents/summary
   * Get summary/reporting data for incidents
   */
  @Get('summary')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async getSummary(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const summary = await this.incidentService.getSummary(tenantId);
    return summary;
  }

  /**
   * POST /itsm/incidents
   * Create a new incident for the current tenant
   */
  @Post()
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createIncidentDto: CreateIncidentDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const incident = await this.incidentService.createIncident(
      tenantId,
      req.user.id,
      createIncidentDto,
    );
    return incident;
  }

  /**
   * GET /itsm/incidents/:id
   * Get a specific incident by ID
   */
  @Get(':id')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const incident = await this.incidentService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    return incident;
  }

  /**
   * PATCH /itsm/incidents/:id
   * Update an existing incident
   */
  @Patch(':id')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateIncidentDto: UpdateIncidentDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const incident = await this.incidentService.updateIncident(
      tenantId,
      req.user.id,
      id,
      updateIncidentDto,
    );

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    return incident;
  }

  /**
   * DELETE /itsm/incidents/:id
   * Soft delete an incident
   */
  @Delete(':id')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
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

    const deleted = await this.incidentService.softDeleteIncident(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }
  }

  /**
   * POST /itsm/incidents/:id/resolve
   * Resolve an incident
   */
  @Post(':id/resolve')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @Perf()
  async resolve(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { resolutionNotes?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const incident = await this.incidentService.resolveIncident(
      tenantId,
      req.user.id,
      id,
      body.resolutionNotes,
    );

    if (!incident) {
      throw new NotFoundException(
        `Incident with ID ${id} not found or cannot be resolved`,
      );
    }

    return incident;
  }

  /**
   * POST /itsm/incidents/:id/close
   * Close a resolved incident
   */
  @Post(':id/close')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @Perf()
  async close(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const incident = await this.incidentService.closeIncident(
      tenantId,
      req.user.id,
      id,
    );

    if (!incident) {
      throw new NotFoundException(
        `Incident with ID ${id} not found or must be resolved before closing`,
      );
    }

    return incident;
  }

  /**
   * GET /itsm/incidents/:id/affected-cis
   * List affected CIs for an incident
   */
  @Get(':id/affected-cis')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @Perf()
  async listAffectedCis(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Query() filterDto: IncidentCiFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.incidentCiService.findAffectedCis(
      tenantId,
      id,
      filterDto,
    );
    return result;
  }

  /**
   * POST /itsm/incidents/:id/affected-cis
   * Add an affected CI to an incident
   */
  @Post(':id/affected-cis')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async addAffectedCi(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: CreateIncidentCiDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const ci = await this.incidentCiService.addAffectedCi(
      tenantId,
      req.user.id,
      id,
      dto.ciId,
      dto.relationshipType,
      dto.impactScope,
    );
    return ci;
  }

  /**
   * DELETE /itsm/incidents/:id/affected-cis/:linkId
   * Remove an affected CI link
   */
  @Delete(':id/affected-cis/:linkId')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async removeAffectedCi(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const deleted = await this.incidentCiService.removeAffectedCi(
      tenantId,
      req.user.id,
      id,
      linkId,
    );

    if (!deleted) {
      throw new NotFoundException(
        `Affected CI link with ID ${linkId} not found`,
      );
    }
  }

  /**
   * GET /itsm/incidents/:id/impact-summary
   * Get impact/blast radius summary for an incident
   */
  @Get(':id/impact-summary')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @Perf()
  async getImpactSummary(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const summary = await this.incidentCiService.getImpactSummary(tenantId, id);
    return summary;
  }
}
