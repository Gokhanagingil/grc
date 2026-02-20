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
import { ImportMappingService } from './import-mapping.service';
import {
  CreateImportMappingDto,
  UpdateImportMappingDto,
  ImportMappingFilterDto,
} from './dto/import-mapping.dto';

@Controller('grc/cmdb/import-mappings')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ImportMappingController {
  constructor(
    private readonly importMappingService: ImportMappingService,
  ) {}

  @Get()
  @Permissions(Permission.CMDB_IMPORT_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ImportMappingFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    if (filterDto.sourceId) {
      return {
        items: await this.importMappingService.findBySource(
          tenantId,
          filterDto.sourceId,
        ),
      };
    }
    const items = await this.importMappingService.findAllForTenant(tenantId);
    return { items: items.filter((m) => !m.isDeleted) };
  }

  @Post()
  @Permissions(Permission.CMDB_IMPORT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateImportMappingDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    this.validateAllTransforms(dto.transforms, dto.fieldMap);

    return this.importMappingService.createForTenant(tenantId, {
      ...dto,
      createdBy: req.user.id,
    });
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
    const entity = await this.importMappingService.findOneForTenant(
      tenantId,
      id,
    );
    if (!entity || entity.isDeleted) {
      throw new NotFoundException(`Import mapping with ID ${id} not found`);
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
    @Body() dto: UpdateImportMappingDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    this.validateAllTransforms(dto.transforms, dto.fieldMap);

    const entity = await this.importMappingService.updateForTenant(
      tenantId,
      id,
      { ...dto, updatedBy: req.user.id },
    );
    if (!entity) {
      throw new NotFoundException(`Import mapping with ID ${id} not found`);
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
    const entity = await this.importMappingService.updateForTenant(
      tenantId,
      id,
      {
        isDeleted: true,
        updatedBy: req.user.id,
      } as Parameters<typeof this.importMappingService.updateForTenant>[2],
    );
    if (!entity) {
      throw new NotFoundException(`Import mapping with ID ${id} not found`);
    }
  }

  private validateAllTransforms(
    transforms?: CreateImportMappingDto['transforms'],
    fieldMap?: CreateImportMappingDto['fieldMap'],
  ): void {
    if (transforms && transforms.length > 0) {
      const errors = this.importMappingService.validateTransforms(transforms);
      if (errors.length > 0) {
        throw new BadRequestException(errors);
      }
    }

    if (fieldMap) {
      for (const entry of fieldMap) {
        if (entry.transforms && entry.transforms.length > 0) {
          const errors = this.importMappingService.validateTransforms(
            entry.transforms,
          );
          if (errors.length > 0) {
            throw new BadRequestException(errors);
          }
        }
      }
    }
  }
}
