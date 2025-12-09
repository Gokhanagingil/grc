import {
  Controller,
  Get,
  Post,
  Patch,
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
import { GrcPolicyVersionService } from '../services/grc-policy-version.service';
import { Perf } from '../../common/decorators';
import { VersionType } from '../enums';

/**
 * Create Policy Version DTO
 */
class CreatePolicyVersionDto {
  content?: string;
  changeSummary?: string;
  effectiveDate?: Date;
  versionType?: VersionType;
}

/**
 * Update Policy Version DTO
 */
class UpdatePolicyVersionDto {
  content?: string;
  changeSummary?: string;
  effectiveDate?: Date;
}

/**
 * GRC Policy Version Controller
 *
 * API endpoints for managing policy versions.
 * All endpoints require JWT authentication and tenant context.
 * Write operations require GRC_POLICY_WRITE permission.
 */
@Controller('grc/policies/:policyId/versions')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcPolicyVersionController {
  constructor(private readonly policyVersionService: GrcPolicyVersionService) {}

  /**
   * GET /grc/policies/:policyId/versions
   * List all versions for a policy
   */
  @Get()
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async listVersions(
    @Headers('x-tenant-id') tenantId: string,
    @Param('policyId') policyId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyVersionService.getVersionsForPolicy(tenantId, policyId);
  }

  /**
   * GET /grc/policies/:policyId/versions/latest
   * Get the latest version for a policy
   */
  @Get('latest')
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async getLatestVersion(
    @Headers('x-tenant-id') tenantId: string,
    @Param('policyId') policyId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const version = await this.policyVersionService.getLatestVersion(
      tenantId,
      policyId,
    );

    if (!version) {
      throw new NotFoundException('No versions found for this policy');
    }

    return version;
  }

  /**
   * GET /grc/policies/:policyId/versions/published
   * Get the currently published version for a policy
   */
  @Get('published')
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async getPublishedVersion(
    @Headers('x-tenant-id') tenantId: string,
    @Param('policyId') policyId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const version = await this.policyVersionService.getPublishedVersion(
      tenantId,
      policyId,
    );

    if (!version) {
      throw new NotFoundException('No published version found for this policy');
    }

    return version;
  }

  /**
   * GET /grc/policies/:policyId/versions/:versionId
   * Get a specific version by ID
   */
  @Get(':versionId')
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async getVersion(
    @Headers('x-tenant-id') tenantId: string,
    @Param('policyId') policyId: string,
    @Param('versionId') versionId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyVersionService.getVersion(tenantId, policyId, versionId);
  }

  /**
   * POST /grc/policies/:policyId/versions
   * Create a new draft version
   */
  @Post()
  @Permissions(Permission.GRC_POLICY_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createDraftVersion(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('policyId') policyId: string,
    @Body() createDto: CreatePolicyVersionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyVersionService.createDraftVersion(
      tenantId,
      req.user.id,
      policyId,
      createDto,
    );
  }

  /**
   * PATCH /grc/policies/:policyId/versions/:versionId
   * Update a draft version
   */
  @Patch(':versionId')
  @Permissions(Permission.GRC_POLICY_WRITE)
  @Perf()
  async updateDraftVersion(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('policyId') policyId: string,
    @Param('versionId') versionId: string,
    @Body() updateDto: UpdatePolicyVersionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyVersionService.updateDraftVersion(
      tenantId,
      req.user.id,
      policyId,
      versionId,
      updateDto,
    );
  }

  /**
   * POST /grc/policies/:policyId/versions/:versionId/submit-for-review
   * Submit a draft version for review
   */
  @Post(':versionId/submit-for-review')
  @Permissions(Permission.GRC_POLICY_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async submitForReview(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('policyId') policyId: string,
    @Param('versionId') versionId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyVersionService.submitForReview(
      tenantId,
      req.user.id,
      policyId,
      versionId,
    );
  }

  /**
   * POST /grc/policies/:policyId/versions/:versionId/approve
   * Approve a version in review
   */
  @Post(':versionId/approve')
  @Permissions(Permission.GRC_POLICY_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async approveVersion(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('policyId') policyId: string,
    @Param('versionId') versionId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyVersionService.approveVersion(
      tenantId,
      req.user.id,
      policyId,
      versionId,
    );
  }

  /**
   * POST /grc/policies/:policyId/versions/:versionId/publish
   * Publish a version (makes it the active version)
   */
  @Post(':versionId/publish')
  @Permissions(Permission.GRC_POLICY_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async publishVersion(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('policyId') policyId: string,
    @Param('versionId') versionId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyVersionService.publishVersion(
      tenantId,
      req.user.id,
      policyId,
      versionId,
    );
  }

  /**
   * POST /grc/policies/:policyId/versions/:versionId/retire
   * Retire a version
   */
  @Post(':versionId/retire')
  @Permissions(Permission.GRC_POLICY_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async retireVersion(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('policyId') policyId: string,
    @Param('versionId') versionId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyVersionService.retireVersion(
      tenantId,
      req.user.id,
      policyId,
      versionId,
    );
  }
}
