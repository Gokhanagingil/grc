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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { ItsmIncidentService } from '../services/itsm-incident.service';
import {
  CreateItsmIncidentDto,
  UpdateItsmIncidentDto,
  ItsmIncidentFilterDto,
} from '../dto/itsm.dto';
import {
  ItsmIncidentState,
  ItsmIncidentPriority,
  ItsmIncidentImpact,
  ItsmIncidentUrgency,
} from '../enums';

/**
 * ITSM Incident Controller
 *
 * Manages IT incidents for the ITSM module (ITIL v5 aligned).
 * Includes GRC Bridge integration for linking to risks and controls.
 * All endpoints require JWT authentication and tenant context.
 */
@ApiTags('ITSM Incidents')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/itsm/incidents')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ItsmIncidentController {
  constructor(private readonly incidentService: ItsmIncidentService) {}

  @Post()
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new ITSM incident' })
  @ApiResponse({ status: 201, description: 'Incident created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateItsmIncidentDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const incident = await this.incidentService.create(
      tenantId,
      dto,
      req.user.id,
    );
    return { success: true, data: incident };
  }

  @Get()
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @ApiOperation({ summary: 'List all ITSM incidents' })
  @ApiResponse({
    status: 200,
    description: 'Incidents retrieved successfully',
  })
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: ItsmIncidentFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const result = await this.incidentService.findAll(tenantId, filter);
    return { success: true, data: result.items, total: result.total };
  }

  @Get('filters')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @ApiOperation({ summary: 'Get incident filter metadata' })
  @ApiResponse({
    status: 200,
    description: 'Filter metadata returned successfully',
  })
  @Perf()
  getFilters(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return {
      success: true,
      data: {
        states: Object.values(ItsmIncidentState),
        priorities: Object.values(ItsmIncidentPriority),
        impacts: Object.values(ItsmIncidentImpact),
        urgencies: Object.values(ItsmIncidentUrgency),
      },
    };
  }

  @Get(':id')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @ApiOperation({ summary: 'Get a single ITSM incident by ID' })
  @ApiResponse({ status: 200, description: 'Incident retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const incident = await this.incidentService.findOne(tenantId, id);
    return { success: true, data: incident };
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @ApiOperation({ summary: 'Update an ITSM incident' })
  @ApiResponse({ status: 200, description: 'Incident updated successfully' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateItsmIncidentDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const incident = await this.incidentService.update(
      tenantId,
      id,
      dto,
      req.user.id,
    );
    return { success: true, data: incident };
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an ITSM incident' })
  @ApiResponse({ status: 204, description: 'Incident deleted successfully' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  @Perf()
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.incidentService.delete(tenantId, id, req.user.id);
  }

  // ============================================================================
  // GRC Bridge Endpoints - Link/Unlink Risks and Controls
  // ============================================================================

  @Get(':id/risks')
  @Permissions(Permission.GRC_RISK_READ)
  @ApiOperation({ summary: 'Get linked risks for an incident' })
  @ApiResponse({ status: 200, description: 'Risks retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  @Perf()
  async getLinkedRisks(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const risks = await this.incidentService.getLinkedRisks(tenantId, id);
    return { success: true, data: risks };
  }

  @Post(':id/risks/:riskId')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a risk to an incident' })
  @ApiResponse({ status: 201, description: 'Risk linked successfully' })
  @ApiResponse({ status: 400, description: 'Risk already linked' })
  @ApiResponse({ status: 404, description: 'Incident or risk not found' })
  @Perf()
  async linkRisk(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const link = await this.incidentService.linkRisk(
      tenantId,
      id,
      riskId,
      req.user.id,
    );
    return { success: true, data: link };
  }

  @Delete(':id/risks/:riskId')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink a risk from an incident' })
  @ApiResponse({ status: 204, description: 'Risk unlinked successfully' })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @Perf()
  async unlinkRisk(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.incidentService.unlinkRisk(tenantId, id, riskId, req.user.id);
  }

  @Get(':id/controls')
  @Permissions(Permission.GRC_CONTROL_READ)
  @ApiOperation({ summary: 'Get linked controls for an incident' })
  @ApiResponse({ status: 200, description: 'Controls retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  @Perf()
  async getLinkedControls(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const controls = await this.incidentService.getLinkedControls(tenantId, id);
    return { success: true, data: controls };
  }

  @Post(':id/controls/:controlId')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a control to an incident' })
  @ApiResponse({ status: 201, description: 'Control linked successfully' })
  @ApiResponse({ status: 400, description: 'Control already linked' })
  @ApiResponse({ status: 404, description: 'Incident or control not found' })
  @Perf()
  async linkControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const link = await this.incidentService.linkControl(
      tenantId,
      id,
      controlId,
      req.user.id,
    );
    return { success: true, data: link };
  }

  @Delete(':id/controls/:controlId')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink a control from an incident' })
  @ApiResponse({ status: 204, description: 'Control unlinked successfully' })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @Perf()
  async unlinkControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.incidentService.unlinkControl(
      tenantId,
      id,
      controlId,
      req.user.id,
    );
  }
}
