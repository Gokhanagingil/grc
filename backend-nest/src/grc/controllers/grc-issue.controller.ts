import {
  Controller,
  Post,
  Param,
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
import { DataSource } from 'typeorm';
import { GrcIssue } from '../entities/grc-issue.entity';
import { StandardClause } from '../entities/standard-clause.entity';
import { GrcIssueClause } from '../entities/grc-issue-clause.entity';
import { Perf } from '../../common/decorators';

/**
 * GRC Issue Controller
 *
 * Provides endpoints for linking issues (findings) to standard clauses.
 * All endpoints require JWT authentication and tenant context.
 * Write operations require GRC_AUDIT_WRITE permission.
 */
@Controller('grc/issues')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcIssueController {
  constructor(private readonly dataSource: DataSource) {}

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
