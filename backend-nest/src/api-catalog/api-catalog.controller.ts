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
  CreatePublishedApiDto,
  UpdatePublishedApiDto,
  PublishedApiFilterDto,
} from './dto/published-api.dto';

@Controller('grc/published-apis')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ApiCatalogController {
  constructor(private readonly catalogService: ApiCatalogService) {}

  @Get()
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async listApis(
    @NestRequest() req: RequestWithUser,
    @Query() filter: PublishedApiFilterDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const result = await this.catalogService.findApisByTenant(tenantId, {
      isActive: filter.isActive,
      tableName: filter.tableName,
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
  async getApi(@NestRequest() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const api = await this.catalogService.findApiByTenant(tenantId, id);
    if (!api) throw new NotFoundException('Published API not found');
    return api;
  }

  @Get(':id/openapi')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getOpenApiSpec(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const api = await this.catalogService.findApiByTenant(tenantId, id);
    if (!api) throw new NotFoundException('Published API not found');
    return this.catalogService.generateOpenApiSpec(api);
  }

  @Post()
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async createApi(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreatePublishedApiDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    return this.catalogService.createApi(tenantId, dto);
  }

  @Put(':id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async updateApi(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdatePublishedApiDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const api = await this.catalogService.updateApi(tenantId, id, dto);
    if (!api) throw new NotFoundException('Published API not found');
    return api;
  }

  @Delete(':id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async deleteApi(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const deleted = await this.catalogService.deleteApi(tenantId, id);
    if (!deleted) throw new NotFoundException('Published API not found');
    return { deleted: true };
  }
}
