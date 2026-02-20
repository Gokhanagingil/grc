import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
  Request,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { CmdbServiceService } from './cmdb-service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceFilterDto } from './dto/service-filter.dto';
import { Perf } from '../../../common/decorators';

@Controller('grc/cmdb/services')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CmdbServiceController {
  constructor(private readonly cmdbServiceService: CmdbServiceService) {}

  @Get()
  @Permissions(Permission.CMDB_SERVICE_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ServiceFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.cmdbServiceService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.CMDB_SERVICE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateServiceDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.cmdbServiceService.createService(tenantId, req.user.id, dto);
  }

  @Get(':id')
  @Permissions(Permission.CMDB_SERVICE_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.cmdbServiceService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!entity) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
    return entity;
  }

  @Patch(':id')
  @Permissions(Permission.CMDB_SERVICE_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.cmdbServiceService.updateService(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!entity) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
    return entity;
  }

  @Delete(':id')
  @Permissions(Permission.CMDB_SERVICE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const deleted = await this.cmdbServiceService.softDeleteService(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
  }
}
