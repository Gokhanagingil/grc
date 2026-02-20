import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
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
import { RequestWithUser } from '../common/types';
import { NotificationEngineService } from './services/notification-engine.service';
import {
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
  NotificationRuleFilterDto,
} from './dto/notification-rule.dto';

@Controller('grc/notification-rules')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class NotificationRuleController {
  constructor(
    private readonly engineService: NotificationEngineService,
  ) {}

  @Get()
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async listRules(
    @NestRequest() req: RequestWithUser,
    @Query() filter: NotificationRuleFilterDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const result = await this.engineService.findRulesByTenant(tenantId, {
      eventName: filter.eventName,
      isActive: filter.isActive,
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

  @Get(':id')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getRule(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const rule = await this.engineService.findRuleByTenant(tenantId, id);
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  @Post()
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async createRule(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreateNotificationRuleDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    return this.engineService.createRule(tenantId, dto);
  }

  @Put(':id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async updateRule(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationRuleDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const rule = await this.engineService.updateRule(tenantId, id, dto);
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  @Delete(':id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async deleteRule(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const deleted = await this.engineService.deleteRule(tenantId, id);
    if (!deleted) throw new NotFoundException('Rule not found');
    return { deleted: true };
  }
}
