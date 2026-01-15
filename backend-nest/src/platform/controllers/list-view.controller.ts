import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { CurrentUser } from '../../common/decorators';
import { ListViewService } from '../services/list-view.service';
import { ListViewScope } from '../entities/list-view.entity';

interface CreateListViewDto {
  tableName: string;
  name: string;
  scope?: ListViewScope;
  roleId?: string;
  isDefault?: boolean;
  columns?: Array<{
    columnName: string;
    orderIndex: number;
    visible?: boolean;
    width?: number;
    pinned?: 'left' | 'right';
  }>;
}

interface UpdateListViewDto {
  name?: string;
  isDefault?: boolean;
}

interface UpdateColumnsDto {
  columns: Array<{
    columnName: string;
    orderIndex: number;
    visible?: boolean;
    width?: number;
    pinned?: 'left' | 'right';
  }>;
}

@Controller('grc/list-views')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ListViewController {
  constructor(private readonly listViewService: ListViewService) {}

  @Get()
  @Permissions(Permission.GRC_RISK_READ)
  async list(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Query('tableName') tableName: string,
    @Query('roleId') roleId?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!tableName) {
      throw new BadRequestException('tableName query parameter is required');
    }

    const result = await this.listViewService.listByTable(
      tenantId,
      tableName,
      userId,
      roleId,
    );

    return { data: result };
  }

  @Get(':id')
  @Permissions(Permission.GRC_RISK_READ)
  async getById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const view = await this.listViewService.getById(tenantId, id);

    return { data: view };
  }

  @Post()
  @Permissions(Permission.GRC_RISK_WRITE)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateListViewDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!dto.tableName) {
      throw new BadRequestException('tableName is required');
    }

    if (!dto.name) {
      throw new BadRequestException('name is required');
    }

    const view = await this.listViewService.create(tenantId, userId, dto);

    return { data: view };
  }

  @Put(':id')
  @Permissions(Permission.GRC_RISK_WRITE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListViewDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const view = await this.listViewService.update(tenantId, userId, id, dto);

    return { data: view };
  }

  @Put(':id/columns')
  @Permissions(Permission.GRC_RISK_WRITE)
  async updateColumns(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateColumnsDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!dto.columns || !Array.isArray(dto.columns)) {
      throw new BadRequestException('columns array is required');
    }

    const view = await this.listViewService.updateColumns(
      tenantId,
      userId,
      id,
      dto.columns,
    );

    return { data: view };
  }

  @Delete(':id')
  @Permissions(Permission.GRC_RISK_WRITE)
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.listViewService.delete(tenantId, userId, id);

    return { data: { success: true } };
  }
}
