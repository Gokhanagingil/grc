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
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { Perf } from '../../../common/decorators';
import { FreezeWindowService } from './freeze-window.service';
import { FreezeWindowFilterDto } from './dto/freeze-window-filter.dto';
import { CreateFreezeWindowDto } from './dto/create-freeze-window.dto';
import { UpdateFreezeWindowDto } from './dto/update-freeze-window.dto';

@Controller('grc/itsm/calendar/freeze-windows')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class FreezeWindowController {
  constructor(private readonly freezeWindowService: FreezeWindowService) {}

  @Get()
  @Permissions(Permission.ITSM_FREEZE_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: FreezeWindowFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.freezeWindowService.findAll(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.ITSM_FREEZE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateFreezeWindowDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.freezeWindowService.create(tenantId, req.user.id, {
      name: dto.name,
      description: dto.description || null,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      scope: dto.scope || 'GLOBAL',
      scopeRefId: dto.scopeRefId || null,
      recurrence: dto.recurrence || null,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });
  }

  @Get(':id')
  @Permissions(Permission.ITSM_FREEZE_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const fw = await this.freezeWindowService.findById(tenantId, id);
    if (!fw) {
      throw new NotFoundException(`Freeze window ${id} not found`);
    }
    return fw;
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_FREEZE_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateFreezeWindowDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const fw = await this.freezeWindowService.update(
      tenantId,
      req.user.id,
      id,
      {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.startAt ? { startAt: new Date(dto.startAt) } : {}),
        ...(dto.endAt ? { endAt: new Date(dto.endAt) } : {}),
        ...(dto.scope !== undefined ? { scope: dto.scope } : {}),
        ...(dto.scopeRefId !== undefined
          ? { scopeRefId: dto.scopeRefId }
          : {}),
        ...(dto.recurrence !== undefined
          ? { recurrence: dto.recurrence }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    );
    if (!fw) {
      throw new NotFoundException(`Freeze window ${id} not found`);
    }
    return fw;
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_FREEZE_WRITE)
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
    const deleted = await this.freezeWindowService.softDelete(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Freeze window ${id} not found`);
    }
  }
}
