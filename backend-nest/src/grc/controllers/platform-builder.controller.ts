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
  ParseUUIDPipe,
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
import { PlatformBuilderService } from '../services/platform-builder.service';
import {
  CreateTableDto,
  UpdateTableDto,
  TableFilterDto,
  CreateFieldDto,
  UpdateFieldDto,
  FieldFilterDto,
} from '../dto';

/**
 * Platform Builder Admin Controller
 *
 * Provides admin-only endpoints for managing dynamic table and field definitions.
 * All endpoints require admin permissions and enforce tenant isolation.
 *
 * Routes:
 * - GET/POST /grc/admin/tables
 * - GET/PATCH/DELETE /grc/admin/tables/:id
 * - GET/POST /grc/admin/tables/:tableId/fields
 * - GET/PATCH/DELETE /grc/admin/fields/:fieldId
 */
@ApiTags('Platform Builder - Admin')
@ApiBearerAuth()
@Controller('grc/admin')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class PlatformBuilderController {
  constructor(
    private readonly platformBuilderService: PlatformBuilderService,
  ) {}

  // ============================================================================
  // Table Endpoints
  // ============================================================================

  @Get('tables')
  @Permissions(Permission.ADMIN_TABLES_READ)
  @ApiOperation({ summary: 'List all dynamic tables' })
  async listTables(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: TableFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const result = await this.platformBuilderService.listTables(
      tenantId,
      filterDto,
    );
    return { success: true, data: result };
  }

  @Post('tables')
  @Permissions(Permission.ADMIN_TABLES_WRITE)
  @ApiOperation({ summary: 'Create a new dynamic table' })
  async createTable(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateTableDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const table = await this.platformBuilderService.createTable(
      tenantId,
      req.user.id,
      dto,
    );
    return { success: true, data: table };
  }

  @Get('tables/:id')
  @Permissions(Permission.ADMIN_TABLES_READ)
  @ApiOperation({ summary: 'Get a dynamic table by ID' })
  async getTable(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const table = await this.platformBuilderService.getTableWithCounts(
      tenantId,
      id,
    );
    return { success: true, data: table };
  }

  @Patch('tables/:id')
  @Permissions(Permission.ADMIN_TABLES_WRITE)
  @ApiOperation({ summary: 'Update a dynamic table' })
  async updateTable(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const table = await this.platformBuilderService.updateTable(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    return { success: true, data: table };
  }

  @Delete('tables/:id')
  @Permissions(Permission.ADMIN_TABLES_WRITE)
  @ApiOperation({ summary: 'Delete a dynamic table' })
  async deleteTable(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    await this.platformBuilderService.deleteTable(tenantId, req.user.id, id);
    return { success: true, data: { message: 'Table deleted successfully' } };
  }

  // ============================================================================
  // Field Endpoints
  // ============================================================================

  @Get('tables/:tableId/fields')
  @Permissions(Permission.ADMIN_TABLES_READ)
  @ApiOperation({ summary: 'List fields for a dynamic table' })
  async listFields(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query() filterDto: FieldFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const result = await this.platformBuilderService.listFields(
      tenantId,
      tableId,
      filterDto,
    );
    return { success: true, data: result };
  }

  @Post('tables/:tableId/fields')
  @Permissions(Permission.ADMIN_TABLES_WRITE)
  @ApiOperation({ summary: 'Create a new field for a dynamic table' })
  async createField(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body() dto: CreateFieldDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const field = await this.platformBuilderService.createField(
      tenantId,
      req.user.id,
      tableId,
      dto,
    );
    return { success: true, data: field };
  }

  @Get('fields/:fieldId')
  @Permissions(Permission.ADMIN_TABLES_READ)
  @ApiOperation({ summary: 'Get a field by ID' })
  async getField(
    @Headers('x-tenant-id') tenantId: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const field = await this.platformBuilderService.findFieldById(
      tenantId,
      fieldId,
    );
    return { success: true, data: field };
  }

  @Patch('fields/:fieldId')
  @Permissions(Permission.ADMIN_TABLES_WRITE)
  @ApiOperation({ summary: 'Update a field' })
  async updateField(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: UpdateFieldDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const field = await this.platformBuilderService.updateField(
      tenantId,
      req.user.id,
      fieldId,
      dto,
    );
    return { success: true, data: field };
  }

  @Delete('fields/:fieldId')
  @Permissions(Permission.ADMIN_TABLES_WRITE)
  @ApiOperation({ summary: 'Delete a field' })
  async deleteField(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    await this.platformBuilderService.deleteField(
      tenantId,
      req.user.id,
      fieldId,
    );
    return { success: true, data: { message: 'Field deleted successfully' } };
  }
}
