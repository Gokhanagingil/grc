import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request as NestRequest,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { EventBusService } from './event-bus.service';
import { EventLogFilterDto } from './dto/event-log-filter.dto';
import { RequestWithUser } from '../common/types';

@Controller('grc/event-log')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class EventLogController {
  constructor(private readonly eventBusService: EventBusService) {}

  @Get()
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async listEvents(
    @NestRequest() req: RequestWithUser,
    @Query() filter: EventLogFilterDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const result = await this.eventBusService.findByTenant(tenantId, {
      eventName: filter.eventName,
      tableName: filter.tableName,
      status: filter.status,
      from: filter.from ? new Date(filter.from) : undefined,
      to: filter.to ? new Date(filter.to) : undefined,
      page: filter.page,
      pageSize: filter.pageSize,
    });

    return {
      items: result.items,
      total: result.total,
      page: filter.page || 1,
      pageSize: filter.pageSize || 50,
    };
  }

  @Get('event-names')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getEventNames(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.eventBusService.getDistinctEventNames(tenantId);
  }

  @Get('table-names')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getTableNames(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.eventBusService.getDistinctTableNames(tenantId);
  }

  @Get(':id')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getEvent(@NestRequest() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const event = await this.eventBusService.findOneByTenant(tenantId, id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }
}
