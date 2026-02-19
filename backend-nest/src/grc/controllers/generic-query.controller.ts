import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { GenericQueryService } from '../services/generic-query.service';
import { GenericQueryDto } from '../dto/generic-query.dto';

@ApiTags('Generic Query')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/platform/tables')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GenericQueryController {
  constructor(private readonly genericQueryService: GenericQueryService) {}

  @Get(':tableName/records')
  @Permissions(Permission.DATA_RECORDS_READ)
  @ApiOperation({ summary: 'Query records with advanced filter tree' })
  async queryRecords(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
    @Query() queryDto: GenericQueryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.genericQueryService.query(
      tenantId,
      tableName,
      queryDto,
    );

    return {
      success: true,
      data: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  @Get(':tableName/records/count')
  @Permissions(Permission.DATA_RECORDS_READ)
  @ApiOperation({ summary: 'Count records matching filter criteria' })
  async countRecords(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
    @Query() queryDto: GenericQueryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.genericQueryService.count(
      tenantId,
      tableName,
      queryDto,
    );

    return { success: true, data: result };
  }

  @Get(':tableName/records/:recordId/dotwalk/:refField')
  @Permissions(Permission.DATA_RECORDS_READ)
  @ApiOperation({ summary: 'Dot-walk a reference field (1 hop)' })
  async dotWalk(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
    @Param('refField') refField: string,
    @Query('fields') fields?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const targetFields = fields
      ? fields.split(',').map((f) => f.trim())
      : undefined;

    const result = await this.genericQueryService.dotWalk(
      tenantId,
      tableName,
      recordId,
      refField,
      targetFields,
    );

    return { success: true, data: result };
  }
}
