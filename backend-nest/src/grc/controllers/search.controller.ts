import {
  Controller,
  Post,
  Body,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { SearchService, SearchQueryDto, SearchableEntity } from '../services/search.service';
import { QueryDSL } from '../services/query-dsl.service';
import { Perf } from '../../common/decorators';
import { LogicalOperator } from '../enums';

/**
 * Search Request DTO
 */
class SearchRequestDto {
  entity: SearchableEntity;
  query?: string;
  dsl?: {
    conditions: Array<{
      field: string;
      op: string;
      value?: unknown;
      values?: unknown[];
    }>;
    logical?: 'AND' | 'OR';
  };
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  searchFields?: string[];
}

/**
 * Search Controller
 *
 * Unified search API endpoint for all GRC entities.
 * Supports text search and Query DSL filtering.
 */
@Controller('grc/search')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * POST /grc/search
   * Search across GRC entities
   */
  @Post()
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async search(
    @Headers('x-tenant-id') tenantId: string,
    @Body() searchRequest: SearchRequestDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!searchRequest.entity) {
      throw new BadRequestException('entity is required');
    }

    const validEntities: SearchableEntity[] = ['risk', 'policy', 'requirement'];
    if (!validEntities.includes(searchRequest.entity)) {
      throw new BadRequestException(
        `Invalid entity. Must be one of: ${validEntities.join(', ')}`,
      );
    }

    let dsl: QueryDSL | undefined;
    if (searchRequest.dsl) {
      dsl = {
        conditions: searchRequest.dsl.conditions,
        logical: searchRequest.dsl.logical === 'AND' ? LogicalOperator.AND : 
                 searchRequest.dsl.logical === 'OR' ? LogicalOperator.OR : undefined,
      };
    }

    const searchQuery: SearchQueryDto = {
      query: searchRequest.query,
      dsl,
      page: searchRequest.page,
      pageSize: searchRequest.pageSize,
      sortBy: searchRequest.sortBy,
      sortOrder: searchRequest.sortOrder,
      searchFields: searchRequest.searchFields,
    };

    return this.searchService.search(tenantId, searchRequest.entity, searchQuery);
  }

  /**
   * POST /grc/search/risks
   * Search risks specifically
   */
  @Post('risks')
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async searchRisks(
    @Headers('x-tenant-id') tenantId: string,
    @Body() searchQuery: SearchQueryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.searchService.searchRisks(tenantId, searchQuery);
  }

  /**
   * POST /grc/search/policies
   * Search policies specifically
   */
  @Post('policies')
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async searchPolicies(
    @Headers('x-tenant-id') tenantId: string,
    @Body() searchQuery: SearchQueryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.searchService.searchPolicies(tenantId, searchQuery);
  }

  /**
   * POST /grc/search/requirements
   * Search requirements specifically
   */
  @Post('requirements')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async searchRequirements(
    @Headers('x-tenant-id') tenantId: string,
    @Body() searchQuery: SearchQueryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.searchService.searchRequirements(tenantId, searchQuery);
  }
}
