import {
  Controller,
  Get,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { GrcStatusHistoryService } from '../services/grc-status-history.service';
import { StatusHistoryFilterDto } from '../dto/status-history.dto';

@Controller('grc/status-history')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcStatusHistoryController {
  constructor(private readonly statusHistoryService: GrcStatusHistoryService) {}

  @Get()
  @Permissions(Permission.GRC_AUDIT_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: StatusHistoryFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.statusHistoryService.findAll(tenantId, filter);
  }

  @Get(':id')
  @Permissions(Permission.GRC_AUDIT_READ)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.statusHistoryService.findOne(tenantId, id);
  }

  @Get('by-entity/:entityType/:entityId')
  @Permissions(Permission.GRC_AUDIT_READ)
  async findByEntity(
    @Headers('x-tenant-id') tenantId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.statusHistoryService.findByEntity(
      tenantId,
      entityType,
      entityId,
    );
  }

  @Get('timeline/:entityType/:entityId')
  @Permissions(Permission.GRC_AUDIT_READ)
  async getStatusTimeline(
    @Headers('x-tenant-id') tenantId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.statusHistoryService.getStatusTimeline(
      tenantId,
      entityType,
      entityId,
    );
  }
}
