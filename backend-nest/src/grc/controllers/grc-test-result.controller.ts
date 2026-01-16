import {
  Controller,
  Get,
  Post,
  Put,
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
import { GrcTestResultService } from '../services/grc-test-result.service';
import { GrcIssueService } from '../services/grc-issue.service';
import {
  CreateTestResultDto,
  UpdateTestResultDto,
  ReviewTestResultDto,
  TestResultFilterDto,
} from '../dto/test-result.dto';
import { CreateIssueFromTestResultDto } from '../dto/issue.dto';

@Controller('grc/test-results')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcTestResultController {
  constructor(
    private readonly testResultService: GrcTestResultService,
    private readonly issueService: GrcIssueService,
  ) {}

  @Post()
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateTestResultDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.create(tenantId, dto, req.user.id);
  }

  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: TestResultFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.findAll(tenantId, filter);
  }

  @Get(':id')
  @Permissions(Permission.GRC_CONTROL_READ)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.findOne(tenantId, id);
  }

  @Get('by-control-test/:controlTestId')
  @Permissions(Permission.GRC_CONTROL_READ)
  async findByControlTestId(
    @Headers('x-tenant-id') tenantId: string,
    @Param('controlTestId') controlTestId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.findByControlTestId(tenantId, controlTestId);
  }

  @Put(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTestResultDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.update(tenantId, id, dto, req.user.id);
  }

  @Patch(':id/review')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  async review(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: ReviewTestResultDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.review(tenantId, id, dto, req.user.id);
  }

  @Delete(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.testResultService.softDelete(tenantId, id, req.user.id);
  }

  // ============================================================================
  // Test/Result Sprint: Evidence Linking Endpoints
  // ============================================================================

  /**
   * GET /grc/test-results/:testResultId/evidences
   * Get all evidences linked to a test result
   */
  @Get(':testResultId/evidences')
  @Permissions(Permission.GRC_CONTROL_READ)
  async getEvidences(
    @Headers('x-tenant-id') tenantId: string,
    @Param('testResultId') testResultId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const evidences = await this.testResultService.getEvidences(
      tenantId,
      testResultId,
    );
    return { success: true, data: evidences };
  }

  /**
   * POST /grc/test-results/:testResultId/evidences/:evidenceId
   * Link an evidence to a test result
   */
  @Post(':testResultId/evidences/:evidenceId')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async linkEvidence(
    @Headers('x-tenant-id') tenantId: string,
    @Param('testResultId') testResultId: string,
    @Param('evidenceId') evidenceId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const link = await this.testResultService.linkEvidence(
      tenantId,
      testResultId,
      evidenceId,
      req.user.id,
    );
    return { success: true, data: link };
  }

  /**
   * DELETE /grc/test-results/:testResultId/evidences/:evidenceId
   * Unlink an evidence from a test result
   */
  @Delete(':testResultId/evidences/:evidenceId')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkEvidence(
    @Headers('x-tenant-id') tenantId: string,
    @Param('testResultId') testResultId: string,
    @Param('evidenceId') evidenceId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.testResultService.unlinkEvidence(
      tenantId,
      testResultId,
      evidenceId,
      req.user.id,
    );
  }

  // ============================================================================
  // Issue/Finding Sprint: Create Issue from Test Result
  // ============================================================================

  /**
   * POST /grc/test-results/:testResultId/issues
   * Create an Issue from a Test Result (Golden Flow)
   *
   * This endpoint creates an issue linked to a test result with the following behavior:
   * - Auto-generates title if not provided: "Test failed: <controlName> - <testDate>"
   * - Sets severity based on test result: HIGH for FAIL, MEDIUM for PARTIAL/INCONCLUSIVE
   * - Links issue to the test result's control
   * - Links issue to the test result itself
   * - Auto-links all evidences already linked to the test result
   */
  @Post(':testResultId/issues')
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async createIssueFromTestResult(
    @Headers('x-tenant-id') tenantId: string,
    @Param('testResultId') testResultId: string,
    @Body() dto: CreateIssueFromTestResultDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const issue = await this.issueService.createFromTestResult(
      tenantId,
      testResultId,
      dto,
      req.user.id,
    );
    return { success: true, data: issue };
  }
}
