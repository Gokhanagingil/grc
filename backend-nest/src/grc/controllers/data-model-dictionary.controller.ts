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

@Controller('admin/data-model')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class DataModelDictionaryController {
  constructor(private readonly dictionaryService: DataModelDictionaryService) {}

  @Get('tables')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  listTables(
    @Query('tenantScopedOnly') tenantScopedOnly?: string,
    @Query('withRelationships') withRelationships?: string,
    @Query('search') search?: string,
  ): { success: boolean; data: DictionaryTable[] } {
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

  @Get('tables/:name')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  getTable(@Param('name') name: string): {
    success: boolean;
    data: DictionaryTable;
  } {
    const table = this.dictionaryService.getTable(name);

    if (!table) {
      throw new BadRequestException(`Table '${name}' not found`);
    }

    return {
      success: true,
      data: table,
    };
  }

  @Get('tables/:name/relationships')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  getTableRelationships(@Param('name') name: string): {
    success: boolean;
    data: DictionaryRelationship[];
  } {
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

  @Get('tables/:name/dot-walking')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  getDotWalkingPaths(
    @Param('name') name: string,
    @Query('maxDepth') maxDepthStr?: string,
  ): { success: boolean; data: DotWalkPath[] } {
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

  @Get('relationships')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  listRelationships(): {
    success: boolean;
    data: DictionaryRelationship[];
  } {
    const relationships = this.dictionaryService.getAllRelationships();

    return {
      success: true,
      data: relationships,
    };
  }

  @Get('summary')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  getSummary(): {
    success: boolean;
    data: {
      totalTables: number;
      totalRelationships: number;
      tenantScopedTables: number;
      tablesWithSoftDelete: number;
      relationshipsByType: Record<string, number>;
    };
  } {
    const summary = this.dictionaryService.getDataModelSummary();

    return {
      success: true,
      data: summary,
    };
  }

  @Get('graph')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  getGraph(): {
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
  } {
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

  @Get('refresh')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  refreshCache(): { success: boolean; message: string } {
    this.dictionaryService.refreshCache();

    return {
      success: true,
      message: 'Dictionary cache refreshed successfully',
    };
  }
}
