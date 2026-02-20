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
import { Perf } from '../../../common/decorators';
import { ImportSourceService } from './import-source.service';
import {
  CreateImportSourceDto,
  UpdateImportSourceDto,
  ImportSourceFilterDto,
} from './dto/import-source.dto';

@Controller('grc/cmdb/import-sources')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ImportSourceController {
  constructor(private readonly importSourceService: ImportSourceService) {}

  @Get()
  @Permissions(Permission.CMDB_IMPORT_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ImportSourceFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.importSourceService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.CMDB_IMPORT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateImportSourceDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.importSourceService.createForTenant(tenantId, {
      ...dto,
      createdBy: req.user.id,
      isDeleted: false,
    } as Parameters<typeof this.importSourceService.createForTenant>[1]);
  }

  @Get(':id')
  @Permissions(Permission.CMDB_IMPORT_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.importSourceService.findOneForTenant(
      tenantId,
      id,
    );
    if (!entity || entity.isDeleted) {
      throw new NotFoundException(`Import source with ID ${id} not found`);
    }
    return entity;
  }

  @Patch(':id')
  @Permissions(Permission.CMDB_IMPORT_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateImportSourceDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.importSourceService.updateForTenant(
      tenantId,
      id,
      {
        ...dto,
        updatedBy: req.user.id,
      } as Parameters<typeof this.importSourceService.updateForTenant>[2],
    );
    if (!entity) {
      throw new NotFoundException(`Import source with ID ${id} not found`);
    }
    return entity;
  }

  @Delete(':id')
  @Permissions(Permission.CMDB_IMPORT_WRITE)
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
    const entity = await this.importSourceService.updateForTenant(
      tenantId,
      id,
      {
        isDeleted: true,
        updatedBy: req.user.id,
      } as Parameters<typeof this.importSourceService.updateForTenant>[2],
    );
    if (!entity) {
      throw new NotFoundException(`Import source with ID ${id} not found`);
    }
  }
}
