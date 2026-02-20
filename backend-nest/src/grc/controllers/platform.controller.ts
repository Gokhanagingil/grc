import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Headers,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { ViewPreferenceService } from '../../common/services/view-preference.service';
import {
  getTableSchema,
  isTableAllowed,
  resolveCanonicalTableName,
  isTableAlias,
} from '../../common/services/table-schema.registry';
import {
  TableSchema,
  SaveViewPreferenceDto,
  ViewPreferenceResponse,
} from '../../common/dto/table-schema.dto';

/**
 * Platform Controller
 *
 * Provides platform-level endpoints for table schema and view preferences.
 * These endpoints support the Universal Views feature.
 *
 * Note: Uses 'grc/platform' path to follow existing routing conventions.
 * External clients call /api/grc/platform/... while backend serves /grc/platform/...
 */
@Controller('grc/platform')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PlatformController {
  constructor(private readonly viewPreferenceService: ViewPreferenceService) {}

  /**
   * GET /grc/platform/tables/:tableName/schema
   * Get table schema for list rendering
   *
   * Supports table name aliases (e.g., grc_controls -> controls).
   * Always returns the canonical table name in the response.
   *
   * Returns field metadata including:
   * - name, label, dataType
   * - enumValues (for enum fields)
   * - searchable, filterable, sortable flags
   * - defaultVisible flag
   */
  @Get('tables/:tableName/schema')
  getTableSchemaEndpoint(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
  ): { success: boolean; data: TableSchema } {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const canonicalName = resolveCanonicalTableName(tableName);

    if (!isTableAllowed(tableName)) {
      const wasAlias = isTableAlias(tableName);
      const resolvedInfo = wasAlias ? ` (resolved as '${canonicalName}')` : '';
      throw new NotFoundException(
        `Table '${tableName}' not found${resolvedInfo}`,
      );
    }

    const schema = getTableSchema(tableName);
    if (!schema) {
      throw new NotFoundException(
        `Schema for table '${tableName}' not found (resolved as '${canonicalName}')`,
      );
    }

    return { success: true, data: schema };
  }

  /**
   * GET /grc/platform/tables
   * List all available tables with schema support
   */
  @Get('tables')
  async listTables(
    @Headers('x-tenant-id') tenantId: string,
  ): Promise<{ success: boolean; data: { tables: string[] } }> {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Import ALLOWED_TABLES from registry
    const { ALLOWED_TABLES } =
      await import('../../common/services/table-schema.registry');
    const tables = Array.from(ALLOWED_TABLES);

    return { success: true, data: { tables } };
  }

  /**
   * GET /grc/platform/views/:tableName
   * Get user's view preference for a table
   *
   * Returns saved preference or default based on schema
   */
  @Get('views/:tableName')
  async getViewPreference(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
    @Request() req: { user: { id: string } },
  ): Promise<{ success: boolean; data: ViewPreferenceResponse }> {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    const preference = await this.viewPreferenceService.getViewPreference(
      tenantId,
      userId,
      tableName,
    );

    return { success: true, data: preference };
  }

  /**
   * PUT /grc/platform/views/:tableName
   * Save user's view preference for a table
   *
   * Accepts partial updates - only provided fields are updated
   */
  @Put('views/:tableName')
  async saveViewPreference(
    @Headers('x-tenant-id') tenantId: string,
    @Param('tableName') tableName: string,
    @Body() dto: SaveViewPreferenceDto,
    @Request() req: { user: { id: string } },
  ): Promise<{ success: boolean; data: ViewPreferenceResponse }> {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    const preference = await this.viewPreferenceService.saveViewPreference(
      tenantId,
      userId,
      tableName,
      dto,
    );

    return { success: true, data: preference };
  }

  /**
   * GET /grc/platform/views
   * Get all view preferences for the current user
   */
  @Get('views')
  async getAllViewPreferences(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
  ): Promise<{ success: boolean; data: ViewPreferenceResponse[] }> {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    const preferences = await this.viewPreferenceService.getAllViewPreferences(
      tenantId,
      userId,
    );

    return { success: true, data: preferences };
  }
}
