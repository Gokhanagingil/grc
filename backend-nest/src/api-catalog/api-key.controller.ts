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
import { ApiCatalogService } from './services/api-catalog.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyFilterDto,
} from './dto/api-key.dto';

@Controller('grc/api-keys')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ApiKeyController {
  constructor(private readonly catalogService: ApiCatalogService) {}

  @Get()
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async listKeys(
    @NestRequest() req: RequestWithUser,
    @Query() filter: ApiKeyFilterDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const result = await this.catalogService.findKeysByTenant(tenantId, {
      isActive: filter.isActive,
      page: filter.page,
      pageSize: filter.pageSize,
    });

    return {
      items: result.items.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        isActive: k.isActive,
        expiresAt: k.expiresAt,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })),
      total: result.total,
      page: filter.page || 1,
      pageSize: filter.pageSize || 50,
    };
  }

  @Post()
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async createKey(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const { key, rawKey } = await this.catalogService.createKey(tenantId, dto);

    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      isActive: key.isActive,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      key: rawKey,
      warning: 'Store this key securely. It will not be shown again.',
    };
  }

  @Put(':id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async updateKey(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const key = await this.catalogService.updateKey(tenantId, id, {
      name: dto.name,
      scopes: dto.scopes,
      isActive: dto.isActive,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
    if (!key) throw new NotFoundException('API key not found');

    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      isActive: key.isActive,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
    };
  }

  @Delete(':id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async deleteKey(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const deleted = await this.catalogService.deleteKey(tenantId, id);
    if (!deleted) throw new NotFoundException('API key not found');
    return { deleted: true };
  }
}
