import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { IncidentCopilotService } from './incident-copilot.service';
import { AnalyzeIncidentDto } from './dto/analyze-incident.dto';

/**
 * Incident Copilot Controller
 *
 * AI-powered analysis endpoints for ITSM incidents.
 * All endpoints require JWT authentication, tenant context, and ITSM_INCIDENT_READ permission.
 *
 * Endpoints:
 * - POST /grc/itsm/incidents/:id/ai/analyze — Run AI analysis on an incident
 * - GET  /grc/itsm/incidents/:id/ai/analyses — List analysis snapshots
 * - GET  /grc/itsm/incidents/:id/ai/analyses/:analysisId — Get single analysis
 * - GET  /grc/itsm/incidents/:id/ai/status — Get copilot status (policies, last analysis)
 */
@Controller('grc/itsm/incidents')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class IncidentCopilotController {
  constructor(private readonly copilotService: IncidentCopilotService) {}

  /**
   * POST /grc/itsm/incidents/:id/ai/analyze
   * Run AI analysis on an incident.
   * Returns the analysis snapshot with structured results.
   */
  @Post(':id/ai/analyze')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async analyzeIncident(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') incidentId: string,
    @Body() dto: AnalyzeIncidentDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.copilotService.analyzeIncident(
      tenantId,
      incidentId,
      req.user?.id ?? null,
      dto,
    );

    return { data: result };
  }

  /**
   * GET /grc/itsm/incidents/:id/ai/analyses
   * List analysis snapshots for an incident (paginated).
   */
  @Get(':id/ai/analyses')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @Perf()
  async listAnalyses(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') incidentId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const parsedPageSize = Math.max(1, Math.min(parseInt(pageSize ?? '10', 10) || 10, 50));

    const result = await this.copilotService.listAnalyses(
      tenantId,
      incidentId,
      { page: parsedPage, pageSize: parsedPageSize },
    );

    return {
      data: {
        items: result.items,
        total: result.total,
        page: parsedPage,
        pageSize: parsedPageSize,
        totalPages: Math.ceil(result.total / parsedPageSize),
      },
    };
  }

  /**
   * GET /grc/itsm/incidents/:id/ai/analyses/:analysisId
   * Get a single analysis snapshot by ID.
   */
  @Get(':id/ai/analyses/:analysisId')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @Perf()
  async getAnalysis(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') incidentId: string,
    @Param('analysisId') analysisId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.copilotService.getAnalysis(
      tenantId,
      incidentId,
      analysisId,
    );

    return { data: result };
  }

  /**
   * GET /grc/itsm/incidents/:id/ai/status
   * Get copilot status: policy info, tool availability, last analysis summary.
   */
  @Get(':id/ai/status')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @Perf()
  async getCopilotStatus(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') incidentId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const status = await this.copilotService.getCopilotStatus(
      tenantId,
      incidentId,
    );

    return { data: status };
  }
}
