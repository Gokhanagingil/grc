/**
 * Notifications Controller
 *
 * Provides endpoints for notification management:
 * - Test notification endpoint (ADMIN only, tenant-scoped)
 * - Notification status endpoint (ADMIN only)
 * - Recent notification logs (ADMIN only)
 */

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request as NestRequest,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { NotificationsService, NotificationStatusSummary } from './notifications.service';
import { NotificationResult } from './interfaces/notification-provider.interface';
import { NotificationLog } from './entities/notification-log.entity';
import { RequestWithUser } from '../common/types';

class TestNotificationDto {
  provider: 'email' | 'webhook';
}

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get notification status for current tenant
   * Returns provider status and recent log summary
   */
  @Get('status')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getNotificationStatus(
    @NestRequest() req: RequestWithUser,
  ): Promise<NotificationStatusSummary> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.notificationsService.getNotificationStatus(tenantId);
  }

  /**
   * Get recent notification logs for current tenant
   */
  @Get('logs')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getRecentLogs(
    @NestRequest() req: RequestWithUser,
  ): Promise<NotificationLog[]> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.notificationsService.getRecentLogs(tenantId, 20);
  }

  /**
   * Send a test notification
   * ADMIN only, tenant-scoped
   */
  @Post('test')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async sendTestNotification(
    @NestRequest() req: RequestWithUser,
    @Body() dto: TestNotificationDto,
  ): Promise<NotificationResult> {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    if (!userId) {
      throw new BadRequestException('User ID required');
    }

    if (!dto.provider || !['email', 'webhook'].includes(dto.provider)) {
      throw new BadRequestException('Provider must be "email" or "webhook"');
    }

    return this.notificationsService.sendTestNotification(
      tenantId,
      userId,
      dto.provider,
    );
  }
}
