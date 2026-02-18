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
import { ChangeService } from './change.service';
import { CreateChangeDto } from './dto/create-change.dto';
import { UpdateChangeDto } from './dto/update-change.dto';
import { ChangeFilterDto } from './dto/change-filter.dto';
import { Perf } from '../../common/decorators';

@Controller('grc/itsm/changes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}

  @Get()
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ChangeFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.changeService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createChangeDto: CreateChangeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { plannedStartAt, plannedEndAt, ...rest } = createChangeDto;
    return this.changeService.createChange(
      tenantId,
      req.user.id,
      {
        ...rest,
        ...(plannedStartAt ? { plannedStartAt: new Date(plannedStartAt) } : {}),
        ...(plannedEndAt ? { plannedEndAt: new Date(plannedEndAt) } : {}),
      },
    );
  }

  @Get(':id')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const change = await this.changeService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!change) {
      throw new NotFoundException(`Change with ID ${id} not found`);
    }

    return change;
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateChangeDto: UpdateChangeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { plannedStartAt, plannedEndAt, actualStartAt, actualEndAt, ...rest } = updateChangeDto;
    const change = await this.changeService.updateChange(
      tenantId,
      req.user.id,
      id,
      {
        ...rest,
        ...(plannedStartAt ? { plannedStartAt: new Date(plannedStartAt) } : {}),
        ...(plannedEndAt ? { plannedEndAt: new Date(plannedEndAt) } : {}),
        ...(actualStartAt ? { actualStartAt: new Date(actualStartAt) } : {}),
        ...(actualEndAt ? { actualEndAt: new Date(actualEndAt) } : {}),
      },
    );

    if (!change) {
      throw new NotFoundException(`Change with ID ${id} not found`);
    }

    return change;
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
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

    const deleted = await this.changeService.softDeleteChange(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Change with ID ${id} not found`);
    }
  }
}
