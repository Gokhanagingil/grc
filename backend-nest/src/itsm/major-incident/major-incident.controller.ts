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
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { MajorIncidentService } from './major-incident.service';
import { CreateMajorIncidentDto } from './dto/create-major-incident.dto';
import { UpdateMajorIncidentDto } from './dto/update-major-incident.dto';
import { CreateMajorIncidentUpdateDto } from './dto/create-major-incident-update.dto';
import { CreateMajorIncidentLinkDto } from './dto/major-incident-link.dto';
import { MajorIncidentFilterDto } from './dto/major-incident-filter.dto';

/**
 * ITSM Major Incident Controller
 *
 * REST API for managing major incident coordination:
 * - Declare, update, resolve, close
 * - Timeline updates (internal/external)
 * - Link/unlink related records (incidents, changes, problems, CMDB)
 * - Statistics
 *
 * All endpoints require JWT + tenant context + permissions.
 */
@Controller('grc/itsm/major-incidents')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class MajorIncidentController {
  private readonly logger = new Logger(MajorIncidentController.name);

  constructor(private readonly miService: MajorIncidentService) {}

  // ============================================================================
  // List & Statistics
  // ============================================================================

  @Get()
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: MajorIncidentFilterDto,
  ) {
    return this.miService.findWithFilters(tenantId, filterDto);
  }

  @Get('statistics')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_READ)
  @Perf()
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    const stats = await this.miService.getStatistics(tenantId);
    return { data: stats };
  }

  // ============================================================================
  // Declare (Create)
  // ============================================================================

  @Post()
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async declare(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Body() dto: CreateMajorIncidentDto,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.miService.declare(tenantId, userId, dto);
    return { data: result };
  }

  // ============================================================================
  // Detail
  // ============================================================================

  @Get(':id')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    const mi = await this.miService.findOne(tenantId, id);
    if (!mi) {
      throw new NotFoundException(`Major Incident with ID ${id} not found`);
    }
    return { data: mi };
  }

  // ============================================================================
  // Update
  // ============================================================================

  @Patch(':id')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_UPDATE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
    @Body() dto: UpdateMajorIncidentDto,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.miService.update(tenantId, userId, id, dto);
    return { data: result };
  }

  // ============================================================================
  // Soft Delete
  // ============================================================================

  @Delete(':id')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_CREATE)
  @Perf()
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const deleted = await this.miService.softDelete(tenantId, userId, id);
    if (!deleted) {
      throw new NotFoundException(`Major Incident with ID ${id} not found`);
    }
    return { data: { deleted: true } };
  }

  // ============================================================================
  // Timeline Updates
  // ============================================================================

  @Get(':id/timeline')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_READ)
  @Perf()
  async getTimeline(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const mi = await this.miService.findOne(tenantId, id);
    if (!mi) {
      throw new NotFoundException(`Major Incident with ID ${id} not found`);
    }
    return this.miService.getTimeline(
      tenantId,
      id,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
    );
  }

  @Post(':id/timeline')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async postTimelineUpdate(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
    @Body() dto: CreateMajorIncidentUpdateDto,
  ) {
    const mi = await this.miService.findOne(tenantId, id);
    if (!mi) {
      throw new NotFoundException(`Major Incident with ID ${id} not found`);
    }
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.miService.createTimelineUpdate(
      tenantId,
      userId,
      id,
      dto,
    );
    return { data: result };
  }

  // ============================================================================
  // Links
  // ============================================================================

  @Get(':id/links')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_READ)
  @Perf()
  async getLinks(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Query('linkType') linkType?: string,
  ) {
    const mi = await this.miService.findOne(tenantId, id);
    if (!mi) {
      throw new NotFoundException(`Major Incident with ID ${id} not found`);
    }
    const links = await this.miService.getLinks(
      tenantId,
      id,
      linkType as never,
    );
    return { data: links };
  }

  @Post(':id/links')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_LINK)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkRecord(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
    @Body() dto: CreateMajorIncidentLinkDto,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.miService.linkRecord(tenantId, userId, id, dto);
    return { data: result };
  }

  @Delete(':id/links/:linkId')
  @Permissions(Permission.ITSM_MAJOR_INCIDENT_LINK)
  @Perf()
  async unlinkRecord(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ) {
    const mi = await this.miService.findOne(tenantId, id);
    if (!mi) {
      throw new NotFoundException(`Major Incident with ID ${id} not found`);
    }
    const unlinked = await this.miService.unlinkRecord(tenantId, id, linkId);
    if (!unlinked) {
      throw new NotFoundException(`Link with ID ${linkId} not found`);
    }
    return { data: { deleted: true } };
  }
}
