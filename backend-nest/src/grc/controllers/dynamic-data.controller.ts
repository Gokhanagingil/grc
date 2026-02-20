import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { DynamicDataService } from '../services/dynamic-data.service';
import { PlatformBuilderService } from '../services/platform-builder.service';
import { CreateRecordDto, UpdateRecordDto, RecordFilterDto } from '../dto';

/**
 * Dynamic Data Controller
 *
 * Provides runtime CRUD endpoints for dynamic table records.
 * All endpoints enforce tenant isolation and validate data against
 * field definitions in SysDictionary.
 *
 * Routes:
 * - GET /grc/data/:tableName - List records with pagination/filter/sort
 * - GET /grc/data/:tableName/:recordId - Get a single record
 * - POST /grc/data/:tableName - Create a new record
 * - PATCH /grc/data/:tableName/:recordId - Update a record
 * - DELETE /grc/data/:tableName/:recordId - Soft delete a record
 */
@ApiTags('Dynamic Data')
@ApiBearerAuth()
@Controller('grc/data')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class DynamicDataController {
  constructor(
    private readonly dynamicDataService: DynamicDataService,
    private readonly platformBuilderService: PlatformBuilderService,
  ) {}

  /**
   * Validate table name to prevent SQL injection
   * Only allows table names that match the pattern u_[a-z0-9_]+
   */
  private validateTableName(tableName: string): void {
    if (!/^u_[a-z0-9_]+$/.test(tableName)) {
      throw new Error('Invalid table name format');
    }
  }

  @Get(':tableName')
  @Permissions(Permission.DATA_RECORDS_READ)
  @ApiOperation({ summary: 'List records in a dynamic table' })
  async listRecords(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
    @Query() filterDto: RecordFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    this.validateTableName(tableName);
    const result = await this.dynamicDataService.listRecordsWithMetadata(
      tenantId,
      tableName,
      filterDto,
    );
    return { success: true, data: result };
  }

  @Get(':tableName/schema')
  @Permissions(Permission.DATA_RECORDS_READ)
  @ApiOperation({ summary: 'Get table schema (fields) for a dynamic table' })
  async getTableSchema(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    this.validateTableName(tableName);

    // Validate table exists
    const table = await this.platformBuilderService.validateTableExists(
      tenantId,
      tableName,
    );

    // Get fields
    const fields = await this.platformBuilderService.getActiveFieldsForTable(
      tenantId,
      tableName,
    );

    return {
      success: true,
      data: {
        table: {
          name: table.name,
          label: table.label,
          description: table.description,
        },
        fields,
      },
    };
  }

  @Get(':tableName/:recordId')
  @Permissions(Permission.DATA_RECORDS_READ)
  @ApiOperation({ summary: 'Get a single record by ID' })
  async getRecord(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    this.validateTableName(tableName);
    const result = await this.dynamicDataService.getRecord(
      tenantId,
      tableName,
      recordId,
    );
    return { success: true, data: result };
  }

  @Post(':tableName')
  @Permissions(Permission.DATA_RECORDS_WRITE)
  @ApiOperation({ summary: 'Create a new record in a dynamic table' })
  async createRecord(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('tableName') tableName: string,
    @Body() dto: CreateRecordDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    this.validateTableName(tableName);
    const record = await this.dynamicDataService.createRecord(
      tenantId,
      req.user.id,
      tableName,
      dto,
    );
    return { success: true, data: record };
  }

  @Patch(':tableName/:recordId')
  @Permissions(Permission.DATA_RECORDS_WRITE)
  @ApiOperation({ summary: 'Update a record in a dynamic table' })
  async updateRecord(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateRecordDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    this.validateTableName(tableName);
    const record = await this.dynamicDataService.updateRecord(
      tenantId,
      req.user.id,
      tableName,
      recordId,
      dto,
    );
    return { success: true, data: record };
  }

  @Delete(':tableName/:recordId')
  @Permissions(Permission.DATA_RECORDS_WRITE)
  @ApiOperation({ summary: 'Delete a record from a dynamic table' })
  async deleteRecord(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    this.validateTableName(tableName);
    await this.dynamicDataService.deleteRecord(
      tenantId,
      req.user.id,
      tableName,
      recordId,
    );
    return { success: true, data: { message: 'Record deleted successfully' } };
  }
}
