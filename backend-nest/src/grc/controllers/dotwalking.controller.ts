import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { DataModelDictionaryService } from '../services/data-model-dictionary.service';

/**
 * DTO for validate/test requests
 */
interface DotWalkingPathDto {
  path: string;
}

/**
 * Dotwalking Controller
 *
 * Provides endpoints for the Dot-Walking Query Builder feature.
 * These endpoints are under /admin/data-model/dotwalking/ to ensure
 * they are properly proxied by nginx (avoiding 405 errors from static serving).
 *
 * Security:
 * - All routes require JWT authentication (JwtAuthGuard)
 * - All routes require valid tenant access (TenantGuard validates x-tenant-id header)
 * - All routes require GRC_ADMIN permission
 */
@Controller('admin/data-model/dotwalking')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class DotWalkingController {
  constructor(private readonly dictionaryService: DataModelDictionaryService) {}

  /**
   * Get schema for dot-walking query builder
   * Returns entities, fields, and relationships
   */
  @Get('schema')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  getSchema(): {
    success: boolean;
    data: {
      entities: string[];
      fields: Record<string, string[]>;
      relationships: Record<
        string,
        Record<string, { entity: string; foreignKey: string; type: string }>
      >;
    };
  } {
    const schema = this.dictionaryService.getDotWalkingSchema();

    return {
      success: true,
      data: schema,
    };
  }

  /**
   * Get suggestions for dot-walking path completion
   */
  @Get('suggestions')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  getSuggestions(@Query('path') path?: string): {
    success: boolean;
    data: { suggestions: string[] };
  } {
    const suggestions = this.dictionaryService.getDotWalkingSuggestions(
      path || '',
    );

    return {
      success: true,
      data: { suggestions },
    };
  }

  /**
   * Validate a dot-walking path
   */
  @Post('validate')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  validatePath(@Body() dto: DotWalkingPathDto): {
    success: boolean;
    data: {
      valid: boolean;
      error: string | null;
      segments: Array<{
        type: string;
        value: string;
        entity?: string;
        targetEntity?: string;
        relationshipType?: string;
      }>;
      depth: number;
    };
  } {
    const result = this.dictionaryService.validateDotWalkingPath(dto.path);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Test a dot-walking path with sample data
   */
  @Post('test')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  testPath(@Body() dto: DotWalkingPathDto): {
    success: boolean;
    data: {
      valid: boolean;
      error?: string;
      path?: string;
      depth?: number;
      sampleData?: Array<Record<string, unknown>>;
      sampleCount?: number;
      suggestions?: string[];
    };
  } {
    const result = this.dictionaryService.testDotWalkingPath(dto.path);

    return {
      success: true,
      data: result,
    };
  }
}
