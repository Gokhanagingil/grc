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
import { RequestWithUser } from '../common/types';
import { NotificationEngineService } from './services/notification-engine.service';
import { UserNotificationFilterDto } from './dto/user-notification.dto';

@Controller('grc/user-notifications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UserNotificationController {
  constructor(
    private readonly engineService: NotificationEngineService,
  ) {}

  @Get()
  async listNotifications(
    @NestRequest() req: RequestWithUser,
    @Query() filter: UserNotificationFilterDto,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    const result = await this.engineService.getUserNotifications(
      tenantId,
      userId,
      {
        unreadOnly: filter.unreadOnly,
        page: filter.page,
        pageSize: filter.pageSize,
      },
    );

    return {
      items: result.items,
      total: result.total,
      unreadCount: result.unreadCount,
      page: filter.page || 1,
      pageSize: filter.pageSize || 20,
    };
  }

  @Post(':id/read')
  async markRead(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    const success = await this.engineService.markNotificationRead(tenantId, userId, id);
    if (!success) throw new NotFoundException('Notification not found');
    return { read: true };
  }

  @Post('read-all')
  async markAllRead(
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    const count = await this.engineService.markAllNotificationsRead(tenantId, userId);
    return { markedRead: count };
  }
}
