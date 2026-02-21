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
import { PirService } from './pir.service';
import { CreatePirDto } from './dto/create-pir.dto';
import { UpdatePirDto } from './dto/update-pir.dto';
import { PirFilterDto } from './dto/pir-filter.dto';

/**
 * ITSM PIR (Post-Incident Review) Controller
 *
 * REST API for managing post-incident reviews:
 * - Create, update, list, detail, delete
 * - Submit for review
 * - Approve
 * - Find by major incident
 *
 * All endpoints require JWT + tenant context + permissions.
 */
@Controller('grc/itsm/pirs')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class PirController {
  private readonly logger = new Logger(PirController.name);

  constructor(private readonly pirService: PirService) {}

  @Get()
  @Permissions(Permission.ITSM_PIR_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: PirFilterDto,
  ) {
    return this.pirService.findWithFilters(tenantId, filterDto);
  }

  @Get('by-major-incident/:majorIncidentId')
  @Permissions(Permission.ITSM_PIR_READ)
  @Perf()
  async findByMajorIncident(
    @Headers('x-tenant-id') tenantId: string,
    @Param('majorIncidentId') majorIncidentId: string,
  ) {
    const pir = await this.pirService.findByMajorIncident(tenantId, majorIncidentId);
    return { data: pir };
  }

  @Post()
  @Permissions(Permission.ITSM_PIR_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Body() dto: CreatePirDto,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.pirService.create(tenantId, userId, dto);
    return { data: result };
  }

  @Get(':id')
  @Permissions(Permission.ITSM_PIR_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    const pir = await this.pirService.findOne(tenantId, id);
    if (!pir) {
      throw new NotFoundException(`PIR with ID ${id} not found`);
    }
    return { data: pir };
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_PIR_UPDATE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
    @Body() dto: UpdatePirDto,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.pirService.update(tenantId, userId, id, dto);
    return { data: result };
  }

  @Post(':id/approve')
  @Permissions(Permission.ITSM_PIR_APPROVE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async approve(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.pirService.approve(tenantId, userId, id);
    return { data: result };
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_PIR_CREATE)
  @Perf()
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const deleted = await this.pirService.softDelete(tenantId, userId, id);
    if (!deleted) {
      throw new NotFoundException(`PIR with ID ${id} not found`);
    }
    return { data: { deleted: true } };
  }
}
