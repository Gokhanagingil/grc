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
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import {
  CreateWebhookEndpointDto,
  UpdateWebhookEndpointDto,
  WebhookEndpointFilterDto,
} from './dto/webhook-endpoint.dto';

@Controller('grc/webhook-endpoints')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class WebhookEndpointController {
  constructor(private readonly webhookService: WebhookDeliveryService) {}

  @Get()
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async listEndpoints(
    @NestRequest() req: RequestWithUser,
    @Query() filter: WebhookEndpointFilterDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const result = await this.webhookService.findEndpointsByTenant(tenantId, {
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
  async getEndpoint(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const endpoint = await this.webhookService.findEndpointByTenant(
      tenantId,
      id,
    );
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    return endpoint;
  }

  @Post()
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async createEndpoint(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreateWebhookEndpointDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    try {
      return await this.webhookService.createEndpoint(tenantId, dto);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create endpoint',
      );
    }
  }

  @Put(':id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async updateEndpoint(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    try {
      const endpoint = await this.webhookService.updateEndpoint(
        tenantId,
        id,
        dto,
      );
      if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
      return endpoint;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to update endpoint',
      );
    }
  }

  @Delete(':id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async deleteEndpoint(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const deleted = await this.webhookService.deleteEndpoint(tenantId, id);
    if (!deleted) throw new NotFoundException('Webhook endpoint not found');
    return { deleted: true };
  }

  @Post(':id/test')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async testEndpoint(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    return this.webhookService.testEndpoint(tenantId, id);
  }
}
