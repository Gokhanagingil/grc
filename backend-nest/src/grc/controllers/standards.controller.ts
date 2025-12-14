import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Headers,
  Request,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { StandardsService } from '../services/standards.service';
import { Perf } from '../../common/decorators';

@Controller('grc/standards')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class StandardsController {
  constructor(private readonly standardsService: StandardsService) {}

  @Get()
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async findAll(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.standardsService.findAllActiveForTenant(tenantId);
  }

  @Get('summary')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
  async getSummary(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.standardsService.getSummary(tenantId);
  }

  @Post()
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body()
    createStandardDto: {
      code: string;
      name: string;
      shortName?: string;
      version: string;
      description?: string;
      publisher?: string;
      effectiveDate?: string;
      domain?: string;
      isActive?: boolean;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const data = {
      ...createStandardDto,
      effectiveDate: createStandardDto.effectiveDate
        ? new Date(createStandardDto.effectiveDate)
        : undefined,
    };

    return this.standardsService.createStandard(tenantId, req.user.id, data);
  }

  @Get(':id')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const standard = await this.standardsService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!standard) {
      throw new NotFoundException(`Standard with ID ${id} not found`);
    }

    return standard;
  }

  @Get(':id/with-clauses')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async findOneWithClauses(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const standard = await this.standardsService.getStandardWithClauseTree(
      tenantId,
      id,
    );
    if (!standard) {
      throw new NotFoundException(`Standard with ID ${id} not found`);
    }

    return standard;
  }

  @Patch(':id')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body()
    updateStandardDto: {
      code?: string;
      name?: string;
      shortName?: string;
      version?: string;
      description?: string;
      publisher?: string;
      effectiveDate?: string;
      domain?: string;
      isActive?: boolean;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const data = {
      ...updateStandardDto,
      effectiveDate: updateStandardDto.effectiveDate
        ? new Date(updateStandardDto.effectiveDate)
        : undefined,
    };

    const standard = await this.standardsService.updateStandard(
      tenantId,
      req.user.id,
      id,
      data,
    );

    if (!standard) {
      throw new NotFoundException(`Standard with ID ${id} not found`);
    }

    return standard;
  }

  @Delete(':id')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const deleted = await this.standardsService.softDeleteStandard(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Standard with ID ${id} not found`);
    }
  }

  @Get(':id/clauses')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async getClauses(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.standardsService.getClausesFlat(tenantId, id);
  }

  @Get(':id/clauses/tree')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async getClausesTree(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.standardsService.getClausesTree(tenantId, id);
  }

  @Post(':id/clauses')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createClause(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') standardId: string,
    @Body()
    createClauseDto: {
      code: string;
      title: string;
      description?: string;
      descriptionLong?: string;
      parentClauseId?: string;
      level?: number;
      sortOrder?: number;
      path?: string;
      isAuditable?: boolean;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.standardsService.createClause(
      tenantId,
      req.user.id,
      standardId,
      createClauseDto,
    );
  }

  @Get('clauses/:clauseId')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async getClause(
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

  @Patch('clauses/:clauseId')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @Perf()
  async updateClause(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('clauseId') clauseId: string,
    @Body()
    updateClauseDto: {
      code?: string;
      title?: string;
      description?: string;
      descriptionLong?: string;
      parentClauseId?: string;
      level?: number;
      sortOrder?: number;
      path?: string;
      isAuditable?: boolean;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const clause = await this.standardsService.updateClause(
      tenantId,
      req.user.id,
      clauseId,
      updateClauseDto,
    );

    if (!clause) {
      throw new NotFoundException(`Clause with ID ${clauseId} not found`);
    }

    return clause;
  }
}

@Controller('grc/audits')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AuditScopeController {
  constructor(private readonly standardsService: StandardsService) {}

  @Get(':auditId/scope')
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async getAuditScope(
    @Headers('x-tenant-id') tenantId: string,
    @Param('auditId') auditId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.standardsService.getAuditScope(tenantId, auditId);
  }

  @Post(':auditId/scope')
  @Permissions(Permission.GRC_AUDIT_WRITE)
  @Perf()
  async setAuditScope(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('auditId') auditId: string,
    @Body()
    setScopeDto: {
      standardIds: string[];
      clauseIds?: string[];
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.standardsService.setAuditScope(
      tenantId,
      req.user.id,
      auditId,
      setScopeDto.standardIds,
      setScopeDto.clauseIds,
    );
  }

  @Post(':auditId/scope/lock')
  @Permissions(Permission.GRC_AUDIT_WRITE)
  @Perf()
  async lockAuditScope(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('auditId') auditId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.standardsService.lockAuditScope(tenantId, req.user.id, auditId);
  }

  @Get(':auditId/clauses/:clauseId/findings')
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async getClauseFindings(
    @Headers('x-tenant-id') tenantId: string,
    @Param('auditId') auditId: string,
    @Param('clauseId') clauseId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.standardsService.getClauseFindings(tenantId, auditId, clauseId);
  }

  @Post(':auditId/clauses/:clauseId/findings')
  @Permissions(Permission.GRC_AUDIT_WRITE)
  @Perf()
  async linkFindingToClause(
    @Headers('x-tenant-id') tenantId: string,
    @Param('auditId') auditId: string,
    @Param('clauseId') clauseId: string,
    @Body()
    linkDto: {
      issueId: string;
      notes?: string;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.standardsService.linkFindingToClause(
      tenantId,
      linkDto.issueId,
      clauseId,
      linkDto.notes,
    );
  }

  @Delete(':auditId/clauses/:clauseId/findings/:issueId')
  @Permissions(Permission.GRC_AUDIT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkFindingFromClause(
    @Headers('x-tenant-id') tenantId: string,
    @Param('auditId') auditId: string,
    @Param('clauseId') clauseId: string,
    @Param('issueId') issueId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const unlinked = await this.standardsService.unlinkFindingFromClause(
      tenantId,
      issueId,
      clauseId,
    );

    if (!unlinked) {
      throw new NotFoundException('Finding-clause link not found');
    }
  }
}
