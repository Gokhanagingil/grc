import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request as NestRequest,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { RequestWithUser } from '../common/types';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { UpdateNotificationPreferenceDto } from './dto/user-notification.dto';

@Controller('grc/notification-preferences')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationPreferenceController {
  constructor(
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  @Get()
  async getPreferences(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    return this.preferenceService.getOrCreate(tenantId, userId);
  }

  @Put()
  async updatePreferences(
    @NestRequest() req: RequestWithUser,
    @Body() body: UpdateNotificationPreferenceDto,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    return this.preferenceService.update(tenantId, userId, body);
  }
}
