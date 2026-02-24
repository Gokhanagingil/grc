import {
  Controller,
  Get,
  Post,
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
import { DeliveryFilterDto } from './dto/delivery-filter.dto';

@Controller('grc/notification-deliveries')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class NotificationDeliveryController {
  constructor(private readonly engineService: NotificationEngineService) {}

  @Get()
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async listDeliveries(
    @NestRequest() req: RequestWithUser,
    @Query() filter: DeliveryFilterDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const result = await this.engineService.findDeliveriesByTenant(tenantId, {
      ruleId: filter.ruleId,
      status: filter.status,
      channel: filter.channel,
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

  @Post(':id/retry')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async retryDelivery(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const delivery = await this.engineService.retryDelivery(tenantId, id);
    if (!delivery)
      throw new NotFoundException('Delivery not found or not in FAILED state');
    return delivery;
  }
}
