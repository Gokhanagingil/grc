import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
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
import { DataSource, FindOptionsWhere } from 'typeorm';
import { GrcIssue } from '../entities/grc-issue.entity';
import { StandardClause } from '../entities/standard-clause.entity';
import { GrcIssueClause } from '../entities/grc-issue-clause.entity';
import { Perf } from '../../common/decorators';

/**
 * GRC Issue Controller
 *
 * Provides list, read, and linking endpoints for GRC Issues (findings).
 * All endpoints require JWT authentication and tenant context.
 * Read operations require GRC_ISSUE_READ permission.
 * Write operations require GRC_AUDIT_WRITE permission.
 */
@Controller('api/grc/issues')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcIssueController {
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'title',
    'status',
    'severity',
    'type',
    'discoveredDate',
    'dueDate',
    'resolvedDate',
  ]);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * GET /api/grc/issues
   * List all issues for the current tenant with pagination and filtering
   */
  @Get()
  @Permissions(Permission.GRC_ISSUE_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC',
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('type') type?: string,
    @Query('auditId') auditId?: string,
    @Query('controlId') controlId?: string,
    @Query('q') search?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const issueRepo = this.dataSource.getRepository(GrcIssue);
    const queryBuilder = issueRepo
      .createQueryBuilder('issue')
      .leftJoinAndSelect('issue.owner', 'owner')
      .leftJoinAndSelect('issue.raisedBy', 'raisedBy')
      .leftJoinAndSelect('issue.control', 'control')
      .leftJoinAndSelect('issue.risk', 'risk')
      .where('issue.tenantId = :tenantId', { tenantId })
      .andWhere('issue.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      queryBuilder.andWhere('issue.status = :status', { status });
    }

    if (severity) {
      queryBuilder.andWhere('issue.severity = :severity', { severity });
    }

    if (type) {
      queryBuilder.andWhere('issue.type = :type', { type });
    }

    if (auditId) {
      queryBuilder.andWhere('issue.auditId = :auditId', { auditId });
    }

    if (controlId) {
      queryBuilder.andWhere('issue.controlId = :controlId', { controlId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(issue.title ILIKE :search OR issue.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [items, total] = await queryBuilder
      .orderBy(`issue.${safeSortBy}`, safeSortOrder)
      .skip((Number(page) - 1) * Number(pageSize))
      .take(Number(pageSize))
      .getManyAndCount();

    return {
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    };
  }

  /**
   * GET /api/grc/issues/:id
   * Get a specific issue by ID
   */
  @Get(':id')
  @Permissions(Permission.GRC_ISSUE_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const issueRepo = this.dataSource.getRepository(GrcIssue);
    const issue = await issueRepo.findOne({
      where: {
        id,
        tenantId,
        isDeleted: false,
      } as FindOptionsWhere<GrcIssue>,
      relations: [
        'owner',
        'raisedBy',
        'closedBy',
        'control',
        'risk',
        'audit',
        'capas',
        'issueEvidence',
        'issueRequirements',
        'issueClauses',
      ],
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${id} not found`);
    }

    return issue;
  }

  /**
   * POST /grc/issues/:issueId/clauses
   * Link an existing issue (finding) to a standard clause
   * Requires GRC_AUDIT_WRITE permission
   */
  @Post(':issueId/clauses')
  @Permissions(Permission.GRC_AUDIT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkClauseToIssue(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
    @Body() body: { clauseId: string; notes?: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!body.clauseId) {
      throw new BadRequestException('clauseId is required');
    }

    // Verify issue exists and belongs to tenant
    const issueRepo = this.dataSource.getRepository(GrcIssue);
    const issue = await issueRepo.findOne({
      where: {
        id: issueId,
        tenantId,
        isDeleted: false,
      },
    });

    if (!issue) {
      throw new NotFoundException(
        `Issue with ID ${issueId} not found for this tenant`,
      );
    }

    // Verify clause exists and belongs to tenant
    const clauseRepo = this.dataSource.getRepository(StandardClause);
    const clause = await clauseRepo.findOne({
      where: {
        id: body.clauseId,
        tenantId,
        isDeleted: false,
      },
    });

    if (!clause) {
      throw new NotFoundException(
        `Clause with ID ${body.clauseId} not found for this tenant`,
      );
    }

    // Check if link already exists
    const issueClauseRepo = this.dataSource.getRepository(GrcIssueClause);
    const existing = await issueClauseRepo.findOne({
      where: {
        tenantId,
        issueId,
        clauseId: body.clauseId,
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
      issueId,
      clauseId: body.clauseId,
      notes: body.notes || null,
    });

    await issueClauseRepo.save(issueClause);

    return issueClause;
  }
}
