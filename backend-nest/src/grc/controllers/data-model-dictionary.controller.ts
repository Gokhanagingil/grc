import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import {
  DataModelDictionaryService,
  DictionaryTable,
  DictionaryRelationship,
  DotWalkPath,
} from '../services/data-model-dictionary.service';

/**
 * Data Model Dictionary Controller
 *
 * API endpoints for the Admin Studio Data Model Explorer.
 * Provides metadata about tables, fields, relationships, and dot-walking paths.
 *
 * All endpoints require admin role for access.
 */
@Controller('admin/data-model')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class DataModelDictionaryController {
  constructor(
    private readonly dictionaryService: DataModelDictionaryService,
  ) {}

  /**
   * GET /admin/data-model/tables
   * List all tables in the data model
   */
  @Get('tables')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async listTables(
    @Query('tenantScopedOnly') tenantScopedOnly?: string,
    @Query('withRelationships') withRelationships?: string,
    @Query('search') search?: string,
  ): Promise<{ success: boolean; data: DictionaryTable[] }> {
    const tables = this.dictionaryService.getFilteredTables({
      tenantScopedOnly: tenantScopedOnly === 'true',
      withRelationships: withRelationships === 'true',
      search,
    });

    return {
      success: true,
      data: tables,
    };
  }

  /**
   * GET /admin/data-model/tables/:name
   * Get a specific table by name
   */
  @Get('tables/:name')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async getTable(
    @Param('name') name: string,
  ): Promise<{ success: boolean; data: DictionaryTable }> {
    const table = this.dictionaryService.getTable(name);

    if (!table) {
      throw new BadRequestException(`Table '${name}' not found`);
    }

    return {
      success: true,
      data: table,
    };
  }

  /**
   * GET /admin/data-model/tables/:name/relationships
   * Get relationships for a specific table
   */
  @Get('tables/:name/relationships')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async getTableRelationships(
    @Param('name') name: string,
  ): Promise<{ success: boolean; data: DictionaryRelationship[] }> {
    const table = this.dictionaryService.getTable(name);

    if (!table) {
      throw new BadRequestException(`Table '${name}' not found`);
    }

    const outgoing = this.dictionaryService.getTableRelationships(name);
    const incoming = this.dictionaryService.getIncomingRelationships(name);

    return {
      success: true,
      data: [...outgoing, ...incoming],
    };
  }

  /**
   * GET /admin/data-model/tables/:name/dot-walking
   * Get dot-walking paths from a base table
   */
  @Get('tables/:name/dot-walking')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async getDotWalkingPaths(
    @Param('name') name: string,
    @Query('maxDepth') maxDepthStr?: string,
  ): Promise<{ success: boolean; data: DotWalkPath[] }> {
    const table = this.dictionaryService.getTable(name);

    if (!table) {
      throw new BadRequestException(`Table '${name}' not found`);
    }

    const maxDepth = maxDepthStr ? parseInt(maxDepthStr, 10) : 3;
    if (isNaN(maxDepth) || maxDepth < 1 || maxDepth > 5) {
      throw new BadRequestException('maxDepth must be between 1 and 5');
    }

    const paths = this.dictionaryService.getDotWalkingPaths(name, maxDepth);

    return {
      success: true,
      data: paths,
    };
  }

  /**
   * GET /admin/data-model/relationships
   * Get all relationships in the data model
   */
  @Get('relationships')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async listRelationships(): Promise<{
    success: boolean;
    data: DictionaryRelationship[];
  }> {
    const relationships = this.dictionaryService.getAllRelationships();

    return {
      success: true,
      data: relationships,
    };
  }

  /**
   * GET /admin/data-model/summary
   * Get data model summary statistics
   */
  @Get('summary')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async getSummary(): Promise<{
    success: boolean;
    data: {
      totalTables: number;
      totalRelationships: number;
      tenantScopedTables: number;
      tablesWithSoftDelete: number;
      relationshipsByType: Record<string, number>;
    };
  }> {
    const summary = this.dictionaryService.getDataModelSummary();

    return {
      success: true,
      data: summary,
    };
  }

  /**
   * GET /admin/data-model/graph
   * Get data model as a graph structure for visualization
   */
  @Get('graph')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async getGraph(): Promise<{
    success: boolean;
    data: {
      nodes: Array<{
        id: string;
        label: string;
        tableName: string;
        fieldCount: number;
        isTenantScoped: boolean;
        hasSoftDelete: boolean;
      }>;
      edges: Array<{
        id: string;
        source: string;
        target: string;
        label: string;
        type: string;
        sourceField: string;
      }>;
    };
  }> {
    const tables = this.dictionaryService.getAllTables();
    const relationships = this.dictionaryService.getAllRelationships();

    const nodes = tables.map((table) => ({
      id: table.name,
      label: table.label,
      tableName: table.tableName,
      fieldCount: table.fields.length,
      isTenantScoped: table.isTenantScoped,
      hasSoftDelete: table.hasSoftDelete,
    }));

    const edges = relationships.map((rel, index) => ({
      id: `edge-${index}`,
      source: rel.sourceTable,
      target: rel.targetTable,
      label: rel.name,
      type: rel.type,
      sourceField: rel.sourceField,
    }));

    return {
      success: true,
      data: { nodes, edges },
    };
  }

  /**
   * POST /admin/data-model/refresh
   * Refresh the dictionary cache
   */
  @Get('refresh')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async refreshCache(): Promise<{ success: boolean; message: string }> {
    this.dictionaryService.refreshCache();

    return {
      success: true,
      message: 'Dictionary cache refreshed successfully',
    };
  }
}
