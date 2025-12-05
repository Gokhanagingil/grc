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
import { GrcPolicyService } from '../services/grc-policy.service';
import { CreatePolicyDto, UpdatePolicyDto, PolicyFilterDto } from '../dto';
import { Perf } from '../../common/decorators';

/**
 * GRC Policy Controller
 *
 * Full CRUD API endpoints for managing policies.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require GRC_POLICY_WRITE permission.
 *
 * Query Parameters for GET /grc/policies:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - sortBy: Field to sort by (e.g., createdAt, name, status)
 * - sortOrder: Sort order (ASC or DESC, default: DESC)
 * - status: Filter by policy status
 * - category: Filter by category
 * - code: Filter by policy code
 * - ownerUserId: Filter by owner user ID
 * - approvedByUserId: Filter by approver user ID
 * - createdFrom/createdTo: Filter by creation date range
 * - effectiveDateFrom/effectiveDateTo: Filter by effective date range
 * - reviewDateFrom/reviewDateTo: Filter by review date range
 * - search: Search in name, summary, and code
 */
@Controller('grc/policies')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcPolicyController {
  constructor(private readonly policyService: GrcPolicyService) {}

  /**
   * GET /grc/policies
   * List all policies for the current tenant with pagination, sorting, and filtering
   */
  @Get()
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: PolicyFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.findWithFilters(tenantId, filterDto);
  }

  /**
   * GET /grc/policies/summary
   * Get summary/reporting data for policies
   * Returns counts by status, category, plus due for review, active, and draft counts
   */
  @Get('summary')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
  async getSummary(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.getSummary(tenantId);
  }

  /**
   * POST /grc/policies
   * Create a new policy for the current tenant
   * Requires MANAGER or ADMIN role
   */
  @Post()
  @Permissions(Permission.GRC_POLICY_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createPolicyDto: CreatePolicyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.createPolicy(
      tenantId,
      req.user.id,
      createPolicyDto,
    );
  }

  /**
   * PATCH /grc/policies/:id
   * Update an existing policy
   * Requires MANAGER or ADMIN role
   */
  @Patch(':id')
  @Permissions(Permission.GRC_POLICY_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updatePolicyDto: UpdatePolicyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const policy = await this.policyService.updatePolicy(
      tenantId,
      req.user.id,
      id,
      updatePolicyDto,
    );

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    return policy;
  }

  /**
   * DELETE /grc/policies/:id
   * Soft delete a policy (marks as deleted, does not remove from database)
   * Requires MANAGER or ADMIN role
   */
  @Delete(':id')
  @Permissions(Permission.GRC_POLICY_WRITE)
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

    const deleted = await this.policyService.softDeletePolicy(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }
  }

  /**
   * GET /grc/policies/statistics
   * Get policy statistics for the current tenant
   * Requires GRC_STATISTICS_READ permission
   */
  @Get('statistics')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.getStatistics(tenantId);
  }

  /**
   * GET /grc/policies/active
   * Get active policies for the current tenant
   */
  @Get('active')
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async findActive(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.findActivePolicies(tenantId);
  }

  /**
   * GET /grc/policies/due-for-review
   * Get policies due for review
   * Requires GRC_STATISTICS_READ permission
   */
  @Get('due-for-review')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
  async findDueForReview(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.findPoliciesDueForReview(tenantId);
  }

  /**
   * GET /grc/policies/:id
   * Get a specific policy by ID
   */
  @Get(':id')
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const policy = await this.policyService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    return policy;
  }

  /**
   * GET /grc/policies/:id/controls
   * Get a policy with its associated controls
   */
  @Get(':id/controls')
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async findWithControls(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const policy = await this.policyService.findWithControls(tenantId, id);
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    return policy;
  }
}
