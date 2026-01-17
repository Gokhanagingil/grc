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
  HttpCode,
  HttpStatus,
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
import { UpdateIssueStatusDto } from '../dto/closure-loop.dto';
import {
  CreateIssueDto,
  UpdateIssueDto,
  IssueFilterDto,
} from '../dto/issue.dto';
import { IssueType, IssueStatus, IssueSeverity, IssueSource } from '../enums';

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
}
