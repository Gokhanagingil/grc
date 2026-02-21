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
import { PirActionService } from './pir-action.service';
import { CreatePirActionDto } from './dto/create-pir-action.dto';
import { UpdatePirActionDto } from './dto/update-pir-action.dto';
import { PirActionFilterDto } from './dto/pir-filter.dto';

/**
 * ITSM PIR Action Controller
 *
 * REST API for managing PIR action items:
 * - Create, update, list, detail, delete
 * - Filter by PIR, status, owner, overdue
 *
 * All endpoints require JWT + tenant context + permissions.
 */
@Controller('grc/itsm/pir-actions')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class PirActionController {
  private readonly logger = new Logger(PirActionController.name);

  constructor(private readonly actionService: PirActionService) {}

  @Get()
  @Permissions(Permission.ITSM_PIR_ACTION_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: PirActionFilterDto,
  ) {
    return this.actionService.findWithFilters(tenantId, filterDto);
  }

  @Get('overdue')
  @Permissions(Permission.ITSM_PIR_ACTION_READ)
  @Perf()
  async findOverdue(@Headers('x-tenant-id') tenantId: string) {
    const items = await this.actionService.findOverdue(tenantId);
    return { data: items };
  }

  @Post()
  @Permissions(Permission.ITSM_PIR_ACTION_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Body() dto: CreatePirActionDto,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.actionService.create(tenantId, userId, dto);
    return { data: result };
  }

  @Get(':id')
  @Permissions(Permission.ITSM_PIR_ACTION_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    const action = await this.actionService.findOne(tenantId, id);
    if (!action) {
      throw new NotFoundException(`PIR Action with ID ${id} not found`);
    }
    return { data: action };
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_PIR_ACTION_UPDATE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
    @Body() dto: UpdatePirActionDto,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const result = await this.actionService.update(tenantId, userId, id, dto);
    return { data: result };
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_PIR_ACTION_CREATE)
  @Perf()
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user?: { id?: string; sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'system';
    const deleted = await this.actionService.softDelete(tenantId, userId, id);
    if (!deleted) {
      throw new NotFoundException(`PIR Action with ID ${id} not found`);
    }
    return { data: { deleted: true } };
  }
}
