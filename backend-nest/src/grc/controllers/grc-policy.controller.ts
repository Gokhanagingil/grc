import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Headers,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/user.entity';
import { GrcPolicyService } from '../services/grc-policy.service';
import { PolicyStatus } from '../enums';

/**
 * GRC Policy Controller
 *
 * Read-only API endpoints for exploring policies.
 * All endpoints require JWT authentication and tenant context.
 */
@Controller('grc/policies')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class GrcPolicyController {
  constructor(private readonly policyService: GrcPolicyService) {}

  /**
   * GET /grc/policies
   * List all policies for the current tenant
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Filter by status if provided
    if (status) {
      if (!Object.values(PolicyStatus).includes(status as PolicyStatus)) {
        throw new BadRequestException(`Invalid status: ${status}`);
      }
      return this.policyService.findByStatus(tenantId, status as PolicyStatus);
    }

    // Filter by category if provided
    if (category) {
      return this.policyService.findByCategory(tenantId, category);
    }

    // Return all policies
    return this.policyService.findAllForTenant(tenantId, {
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * GET /grc/policies/statistics
   * Get policy statistics for the current tenant
   */
  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findActive(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.policyService.findActivePolicies(tenantId);
  }

  /**
   * GET /grc/policies/due-for-review
   * Get policies due for review
   */
  @Get('due-for-review')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const policy = await this.policyService.findOneForTenant(tenantId, id);
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
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
