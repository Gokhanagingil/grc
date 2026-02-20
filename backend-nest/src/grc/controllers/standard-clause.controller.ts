import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Headers,
  BadRequestException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { DataSource } from 'typeorm';
import { GrcIssue } from '../entities/grc-issue.entity';
import { StandardClause } from '../entities/standard-clause.entity';
import { GrcIssueClause } from '../entities/grc-issue-clause.entity';
import { Perf } from '../../common/decorators';
import {
  UniversalListService,
  ListQueryDto,
  UniversalListConfig,
  ListResponse,
} from '../../common';
import { StandardsService } from '../services/standards.service';

/**
 * Standard Clause Controller
 *
 * Provides endpoints for linking issues (findings) to standard clauses.
 * All endpoints require JWT authentication and tenant context.
 * Write operations require GRC_AUDIT_WRITE permission.
 */
/**
 * Universal List Configuration for Standard Clauses
 * Defines searchable columns, sortable fields, and filters
 */
const CLAUSE_LIST_CONFIG: UniversalListConfig = {
  searchableColumns: [
    { column: 'code' },
    { column: 'title' },
    { column: 'description' },
  ],
  sortableFields: [
    { field: 'createdAt' },
    { field: 'updatedAt' },
    { field: 'code' },
    { field: 'title' },
    { field: 'level' },
    { field: 'sortOrder' },
  ],
  filters: [
    {
      field: 'standardId',
      type: 'uuid',
    },
    {
      field: 'level',
      type: 'number',
    },
  ],
  defaultSort: { field: 'sortOrder', direction: 'ASC' },
};

@Controller('grc/clauses')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class StandardClauseController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly universalListService: UniversalListService,
    private readonly standardsService: StandardsService,
  ) {}

  /**
   * GET /grc/clauses
   * List all standard clauses for the current tenant with pagination and filtering
   *
   * List Contract compliant endpoint using UniversalListService:
   * - page, pageSize (or limit): pagination
   * - sort: field:dir format (e.g., sortOrder:ASC)
   * - search: text search in code, title, description (case-insensitive)
   * - standardId: filter by standard ID
   * - level: filter by hierarchy level
   *
   * Requires GRC_REQUIREMENT_READ permission
   */
  @Get()
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy = 'sortOrder',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'ASC',
    @Query('sort') sort?: string,
    @Query('search') search?: string,
    @Query('standardId') standardId?: string,
    @Query('level') level?: string,
  ): Promise<ListResponse<StandardClause>> {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const listQuery = new ListQueryDto();
    listQuery.page = Number(page);
    listQuery.pageSize = Number(pageSize);
    listQuery.limit = limit ? Number(limit) : undefined;
    listQuery.search = search;
    listQuery.sort = sort;
    listQuery.sortBy = sortBy;
    listQuery.sortOrder = sortOrder;

    const clauseRepo = this.dataSource.getRepository(StandardClause);
    const queryBuilder = clauseRepo
      .createQueryBuilder('clause')
      .leftJoinAndSelect('clause.standard', 'standard');

    this.universalListService.applyTenantFilter(
      queryBuilder,
      tenantId,
      'clause',
    );
    this.universalListService.applySoftDeleteFilter(queryBuilder, 'clause');

    // Apply filters
    const filters: Record<string, unknown> = {};
    if (standardId) {
      filters.standardId = standardId;
    }
    if (level) {
      filters.level = Number(level);
    }

    return this.universalListService.executeListQuery(
      queryBuilder,
      listQuery,
      CLAUSE_LIST_CONFIG,
      'clause',
      filters,
    );
  }

  /**
   * GET /grc/clauses/:clauseId
   * Get a specific clause by ID
   * Returns 404 if not found for tenant
   *
   * Requires GRC_REQUIREMENT_READ permission
   */
  @Get(':clauseId')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('clauseId') clauseId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const clause = await this.standardsService.getClause(tenantId, clauseId);
    if (!clause) {
      throw new NotFoundException(`Clause with ID ${clauseId} not found`);
    }

    return clause;
  }

  /**
   * POST /grc/clauses/:clauseId/issues
   * Link an existing issue (finding) to a standard clause
   * Requires GRC_AUDIT_WRITE permission
   */
  @Post(':clauseId/issues')
  @Permissions(Permission.GRC_AUDIT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkIssueToClause(
    @Headers('x-tenant-id') tenantId: string,
    @Param('clauseId') clauseId: string,
    @Body() body: { issueId: string; notes?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!body.issueId) {
      throw new BadRequestException('issueId is required');
    }

    // Verify clause exists and belongs to tenant
    const clauseRepo = this.dataSource.getRepository(StandardClause);
    const clause = await clauseRepo.findOne({
      where: {
        id: clauseId,
        tenantId,
        isDeleted: false,
      },
    });

    if (!clause) {
      throw new NotFoundException(
        `Clause with ID ${clauseId} not found for this tenant`,
      );
    }

    // Verify issue exists and belongs to tenant
    const issueRepo = this.dataSource.getRepository(GrcIssue);
    const issue = await issueRepo.findOne({
      where: {
        id: body.issueId,
        tenantId,
        isDeleted: false,
      },
    });

    if (!issue) {
      throw new NotFoundException(
        `Issue with ID ${body.issueId} not found for this tenant`,
      );
    }

    // Check if link already exists
    const issueClauseRepo = this.dataSource.getRepository(GrcIssueClause);
    const existing = await issueClauseRepo.findOne({
      where: {
        tenantId,
        issueId: body.issueId,
        clauseId,
      },
    });

    if (existing) {
      // Update notes if provided
      if (body.notes !== undefined) {
        existing.notes = body.notes || null;
        await issueClauseRepo.save(existing);
      }
      return existing;
    }

    // Create new link
    const issueClause = issueClauseRepo.create({
      tenantId,
      issueId: body.issueId,
      clauseId,
      notes: body.notes || null,
    });

    await issueClauseRepo.save(issueClause);

    return issueClause;
  }
}
