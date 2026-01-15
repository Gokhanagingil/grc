import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
  BadRequestException,
  StreamableFile,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { CurrentUser } from '../../common/decorators';
import { ExportService } from '../services/export.service';

interface ExportRequestDto {
  tableName: string;
  viewId?: string;
  columns?: string[];
  filters?: Record<string, unknown>;
  search?: string;
  sort?: { field: string; order: 'ASC' | 'DESC' };
  format: 'csv' | 'xlsx';
}

@Controller('grc/export')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post()
  @Permissions(Permission.GRC_RISK_READ)
  async export(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ExportRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!dto.tableName) {
      throw new BadRequestException('tableName is required');
    }

    if (!dto.format) {
      throw new BadRequestException('format is required (csv or xlsx)');
    }

    if (dto.format !== 'csv') {
      throw new BadRequestException('Only CSV format is currently supported');
    }

    const result = await this.exportService.export(tenantId, userId, {
      tableName: dto.tableName,
      viewId: dto.viewId,
      columns: dto.columns,
      filters: dto.filters,
      search: dto.search,
      sort: dto.sort,
      format: dto.format,
    });

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.stream);
  }
}
