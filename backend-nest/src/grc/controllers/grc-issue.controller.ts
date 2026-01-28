import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
  Request,
  BadRequestException,
  NotFoundException,
  ConflictException,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
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
import { ClosureLoopService } from '../services/closure-loop.service';
import { GrcIssueService } from '../services/grc-issue.service';
import { GrcCapaService } from '../services/grc-capa.service';
import { UpdateIssueStatusDto } from '../dto/closure-loop.dto';
import {
  CreateIssueDto,
  UpdateIssueDto,
  IssueFilterDto,
} from '../dto/issue.dto';
import { CreateCapaDto, CreateCapaForIssueDto } from '../dto/capa.dto';
import {
  IssueType,
  IssueStatus,
  IssueSeverity,
  IssueSource,
  CapaStatus,
} from '../enums';
import { IssuesListQueryPipe } from '../../common/pipes';

/**
 * GRC Issue Controller
 *
 * Provides full CRUD and linkage endpoints for GRC Issues (findings).
 * All endpoints require JWT authentication and tenant context.
 * Part of the Golden Flow: Control -> Evidence -> TestResult -> Issue
 */
@ApiTags('GRC Issues')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/issues')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcIssueController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly closureLoopService: ClosureLoopService,
    private readonly issueService: GrcIssueService,
    private readonly capaService: GrcCapaService,
  ) {}

  @Post()
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateIssueDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.issueService.create(tenantId, dto, req.user.id);
  }

  @Get()
  @Permissions(Permission.GRC_ISSUE_READ)
  @UsePipes(IssuesListQueryPipe)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: IssueFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.issueService.findAll(tenantId, filter);
  }

  /**
   * GET /grc/issues/filters
   * Returns filter metadata for the Issues list UI
   * Provides safe arrays of available filter values to prevent UI crashes
   */
  @Get('filters')
  @Permissions(Permission.GRC_ISSUE_READ)
  @ApiOperation({
    summary: 'Get issue filter metadata',
    description: 'Returns available filter values for issues list UI',
  })
  @ApiResponse({
    status: 200,
    description: 'Filter metadata returned successfully',
  })
  @Perf()
  getFilters(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return {
      success: true,
      data: {
        statuses: Object.values(IssueStatus),
        severities: Object.values(IssueSeverity),
        types: Object.values(IssueType),
        sources: Object.values(IssueSource),
      },
    };
  }

  @Get(':id')
  @Permissions(Permission.GRC_ISSUE_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.issueService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIssueDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.issueService.update(tenantId, id, dto, req.user.id);
  }

  @Delete(':id')
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.issueService.delete(tenantId, id, req.user.id);
  }

  @Post(':issueId/controls/:controlId')
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async linkToControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
    @Param('controlId') controlId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.issueService.linkToControl(
      tenantId,
      issueId,
      controlId,
      req.user.id,
    );
  }

  @Delete(':issueId/controls/:controlId')
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async unlinkFromControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
    @Param('controlId') controlId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.issueService.unlinkFromControl(
      tenantId,
      issueId,
      controlId,
      req.user.id,
    );
  }

  @Post(':issueId/test-results/:testResultId')
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async linkToTestResult(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
    @Param('testResultId') testResultId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.issueService.linkToTestResult(
      tenantId,
      issueId,
      testResultId,
      req.user.id,
    );
  }

  @Delete(':issueId/test-results/:testResultId')
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async unlinkFromTestResult(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
    @Param('testResultId') testResultId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.issueService.unlinkFromTestResult(
      tenantId,
      issueId,
      testResultId,
      req.user.id,
    );
  }

  @Post(':issueId/evidence/:evidenceId')
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkToEvidence(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
    @Param('evidenceId') evidenceId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.issueService.linkToEvidence(
      tenantId,
      issueId,
      evidenceId,
      req.user.id,
    );
  }

  @Delete(':issueId/evidence/:evidenceId')
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkFromEvidence(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
    @Param('evidenceId') evidenceId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.issueService.unlinkFromEvidence(
      tenantId,
      issueId,
      evidenceId,
      req.user.id,
    );
  }

  @Get(':issueId/evidence')
  @Permissions(Permission.GRC_ISSUE_READ)
  @Perf()
  async getLinkedEvidence(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.issueService.getLinkedEvidence(tenantId, issueId);
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

  /**
   * PATCH /grc/issues/:id/status
   * Update the status of an Issue with validation
   */
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update Issue status',
    description:
      'Updates the status of an Issue with transition validation. ' +
      'Status transitions are validated against allowed transitions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Issue status updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @Perf()
  async updateStatus(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIssueStatusDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.closureLoopService.updateIssueStatus(
      tenantId,
      id,
      dto,
      req.user.id,
    );

    return { success: true, data: result };
  }

  /**
   * GET /grc/issues/:issueId/capas
   * Get all CAPAs linked to an Issue (nested convenience endpoint)
   */
  @Get(':issueId/capas')
  @ApiOperation({
    summary: 'Get CAPAs for Issue',
    description: 'Returns all CAPAs linked to a specific Issue',
  })
  @ApiResponse({ status: 200, description: 'CAPAs retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  @Permissions(Permission.GRC_CAPA_READ)
  @Perf()
  async getCapasForIssue(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.issueService.findOne(tenantId, issueId);

    const capas = await this.capaService.findByIssue(tenantId, issueId);
    return { success: true, data: capas };
  }

  /**
   * POST /grc/issues/:issueId/capas
   * Create a new CAPA linked to an Issue (nested convenience endpoint)
   */
  @Post(':issueId/capas')
  @ApiOperation({
    summary: 'Create CAPA for Issue',
    description: 'Creates a new CAPA linked to a specific Issue',
  })
  @ApiResponse({ status: 201, description: 'CAPA created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  @Permissions(Permission.GRC_CAPA_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createCapaForIssue(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
    @Body() dto: CreateCapaForIssueDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.issueService.findOne(tenantId, issueId);

    const capaDto: CreateCapaDto = {
      ...dto,
      issueId,
    };

    const capa = await this.capaService.create(tenantId, capaDto, req.user.id);
    return { success: true, data: capa };
  }

  /**
   * POST /grc/issues/:issueId/resolve
   * Resolve an Issue only if all related CAPAs are verified or closed
   * This is the Golden Flow signal endpoint
   */
  @Post(':issueId/resolve')
  @ApiOperation({
    summary: 'Resolve Issue',
    description:
      'Resolves an Issue only if ALL related CAPAs are in verified or closed status. ' +
      'Returns 409 Conflict if any CAPA is not yet verified/closed.',
  })
  @ApiResponse({ status: 200, description: 'Issue resolved successfully' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot resolve: not all CAPAs are verified/closed',
  })
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async resolveIssue(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.issueService.findOne(tenantId, issueId);

    const capas = await this.capaService.findByIssue(tenantId, issueId);

    if (capas.length === 0) {
      throw new ConflictException(
        'Cannot resolve issue: no CAPAs are linked to this issue. ' +
          'Create at least one CAPA and verify/close it before resolving.',
      );
    }

    const unresolvedCapas = capas.filter(
      (capa) =>
        capa.status !== CapaStatus.VERIFIED &&
        capa.status !== CapaStatus.CLOSED,
    );

    if (unresolvedCapas.length > 0) {
      const unresolvedTitles = unresolvedCapas
        .map((c) => `"${c.title}" (${c.status})`)
        .join(', ');
      throw new ConflictException(
        `Cannot resolve issue: ${unresolvedCapas.length} CAPA(s) are not yet verified/closed: ${unresolvedTitles}`,
      );
    }

    const result = await this.closureLoopService.updateIssueStatus(
      tenantId,
      issueId,
      { status: IssueStatus.RESOLVED, reason: 'All CAPAs verified/closed' },
      req.user.id,
    );

    return { success: true, data: result };
  }
}
