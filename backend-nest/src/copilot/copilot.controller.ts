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
  NotFoundException,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { Perf } from '../common/decorators';
import { ServiceNowClientService } from './servicenow';
import { SuggestService } from './suggest';
import { ApplyService } from './apply';
import { LearningService } from './learning';
import { IndexingService } from './indexing';
import {
  CopilotSuggestDto,
  CopilotApplyDto,
  CreateLearningEventDto,
  SnIncidentFilterDto,
} from './dto';

@ApiTags('Copilot')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/copilot')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CopilotController {
  constructor(
    private readonly snClient: ServiceNowClientService,
    private readonly suggestService: SuggestService,
    private readonly applyService: ApplyService,
    private readonly learningService: LearningService,
    private readonly indexingService: IndexingService,
  ) {}

  @Get('incidents')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @ApiOperation({ summary: 'List ServiceNow incidents' })
  @ApiResponse({ status: 200, description: 'Incidents retrieved successfully' })
  @Perf()
  async listIncidents(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: SnIncidentFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    let snQuery = filter.query || '';
    if (filter.state) {
      snQuery = snQuery
        ? `${snQuery}^state=${filter.state}`
        : `state=${filter.state}`;
    }

    const result = await this.snClient.listIncidents(tenantId, {
      limit: pageSize,
      offset,
      query: snQuery || undefined,
    });

    return {
      success: true,
      data: result.items,
      total: result.total,
      page,
      pageSize,
    };
  }

  @Get('incidents/:sysId')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @ApiOperation({ summary: 'Get ServiceNow incident by sys_id' })
  @ApiResponse({ status: 200, description: 'Incident retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  @Perf()
  async getIncident(
    @Headers('x-tenant-id') tenantId: string,
    @Param('sysId') sysId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const incident = await this.snClient.getIncident(tenantId, sysId);
    if (!incident) {
      throw new NotFoundException(`Incident ${sysId} not found`);
    }
    return { success: true, data: incident };
  }

  @Post('incidents/:sysId/suggest')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate AI suggestions for an incident' })
  @ApiResponse({
    status: 200,
    description: 'Suggestions generated successfully',
  })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  @Perf()
  async suggest(
    @Headers('x-tenant-id') tenantId: string,
    @Param('sysId') sysId: string,
    @Body() dto: CopilotSuggestDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    try {
      const result = await this.suggestService.suggest(
        tenantId,
        sysId,
        dto.similarLimit ?? 5,
        dto.kbLimit ?? 5,
      );
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not configured')) {
          throw new BadRequestException(error.message);
        }
        if (error.message.includes('not found')) {
          throw new NotFoundException(error.message);
        }
      }
      throw error;
    }
  }

  @Post('incidents/:sysId/apply')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a copilot action (comment) to ServiceNow' })
  @ApiResponse({ status: 200, description: 'Action applied successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid target field or empty text',
  })
  @Perf()
  async apply(
    @Headers('x-tenant-id') tenantId: string,
    @Param('sysId') sysId: string,
    @Body() dto: CopilotApplyDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const result = await this.applyService.apply(
      tenantId,
      sysId,
      dto.actionType,
      dto.targetField,
      dto.text,
    );

    await this.learningService.recordEvent(tenantId, req.user.id, {
      incidentSysId: sysId,
      eventType: 'SUGGESTION_APPLIED',
      actionType: dto.actionType,
    });

    return { success: true, data: result };
  }

  @Post('learning/events')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a copilot learning event' })
  @ApiResponse({ status: 201, description: 'Event recorded successfully' })
  @Perf()
  async recordLearningEvent(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateLearningEventDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const event = await this.learningService.recordEvent(
      tenantId,
      req.user.id,
      dto,
    );
    return { success: true, data: event };
  }

  @Post('indexing/incidents')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Index resolved incidents from ServiceNow' })
  @ApiResponse({ status: 200, description: 'Indexing completed' })
  @Perf()
  async indexIncidents(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() body: { daysBack?: number },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const result = await this.indexingService.indexResolvedIncidents(
      tenantId,
      req.user.id,
      body.daysBack ?? 180,
    );
    return { success: true, data: result };
  }

  @Post('indexing/kb')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Index KB articles from ServiceNow' })
  @ApiResponse({ status: 200, description: 'Indexing completed' })
  @Perf()
  async indexKb(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const result = await this.indexingService.indexKbArticles(
      tenantId,
      req.user.id,
    );
    return { success: true, data: result };
  }

  @Get('indexing/stats')
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @ApiOperation({ summary: 'Get indexing statistics' })
  @ApiResponse({ status: 200, description: 'Stats retrieved successfully' })
  @Perf()
  async indexStats(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const stats = await this.indexingService.getIndexStats(tenantId);
    return { success: true, data: stats };
  }
}
