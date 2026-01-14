import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { GrcEvidenceService } from '../services/grc-evidence.service';
import {
  CreateEvidenceDto,
  UpdateEvidenceDto,
  EvidenceFilterDto,
  LinkEvidenceTestResultDto,
} from '../dto/evidence.dto';

/**
 * GRC Evidence Controller
 *
 * Provides full CRUD and linkage endpoints for GRC Evidence.
 * All endpoints require JWT authentication and tenant context.
 * Part of the Golden Flow: Control -> Evidence -> TestResult -> Issue
 */
@Controller('grc/evidence')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcEvidenceController {
  constructor(private readonly evidenceService: GrcEvidenceService) {}

  @Post()
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateEvidenceDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.evidenceService.create(tenantId, dto, req.user.id);
  }

  @Get()
  @Permissions(Permission.GRC_EVIDENCE_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: EvidenceFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.evidenceService.findAll(tenantId, filter);
  }

  @Get(':id')
  @Permissions(Permission.GRC_EVIDENCE_READ)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.evidenceService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEvidenceDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.evidenceService.update(tenantId, id, dto, req.user.id);
  }

  @Delete(':id')
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.evidenceService.delete(tenantId, id, req.user.id);
  }

  @Post(':evidenceId/controls/:controlId')
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async linkToControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('evidenceId') evidenceId: string,
    @Param('controlId') controlId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.evidenceService.linkToControl(
      tenantId,
      evidenceId,
      controlId,
      req.user.id,
    );
  }

  @Delete(':evidenceId/controls/:controlId')
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkFromControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('evidenceId') evidenceId: string,
    @Param('controlId') controlId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.evidenceService.unlinkFromControl(
      tenantId,
      evidenceId,
      controlId,
      req.user.id,
    );
  }

  @Post(':evidenceId/test-results/:testResultId')
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async linkToTestResult(
    @Headers('x-tenant-id') tenantId: string,
    @Param('evidenceId') evidenceId: string,
    @Param('testResultId') testResultId: string,
    @Body() dto: LinkEvidenceTestResultDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.evidenceService.linkToTestResult(
      tenantId,
      evidenceId,
      testResultId,
      req.user.id,
      dto,
    );
  }

  @Delete(':evidenceId/test-results/:testResultId')
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkFromTestResult(
    @Headers('x-tenant-id') tenantId: string,
    @Param('evidenceId') evidenceId: string,
    @Param('testResultId') testResultId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.evidenceService.unlinkFromTestResult(
      tenantId,
      evidenceId,
      testResultId,
      req.user.id,
    );
  }

  @Post(':evidenceId/issues/:issueId')
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async linkToIssue(
    @Headers('x-tenant-id') tenantId: string,
    @Param('evidenceId') evidenceId: string,
    @Param('issueId') issueId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.evidenceService.linkToIssue(
      tenantId,
      evidenceId,
      issueId,
      req.user.id,
    );
  }

  @Delete(':evidenceId/issues/:issueId')
  @Permissions(Permission.GRC_EVIDENCE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkFromIssue(
    @Headers('x-tenant-id') tenantId: string,
    @Param('evidenceId') evidenceId: string,
    @Param('issueId') issueId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.evidenceService.unlinkFromIssue(
      tenantId,
      evidenceId,
      issueId,
      req.user.id,
    );
  }

  @Get(':evidenceId/controls')
  @Permissions(Permission.GRC_EVIDENCE_READ)
  async getLinkedControls(
    @Headers('x-tenant-id') tenantId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.evidenceService.getLinkedControls(tenantId, evidenceId);
  }

  @Get(':evidenceId/test-results')
  @Permissions(Permission.GRC_EVIDENCE_READ)
  async getLinkedTestResults(
    @Headers('x-tenant-id') tenantId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.evidenceService.getLinkedTestResults(tenantId, evidenceId);
  }

  @Get(':evidenceId/issues')
  @Permissions(Permission.GRC_EVIDENCE_READ)
  async getLinkedIssues(
    @Headers('x-tenant-id') tenantId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.evidenceService.getLinkedIssues(tenantId, evidenceId);
  }
}
