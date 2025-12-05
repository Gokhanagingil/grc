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
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/user.entity';
import { GrcPolicyService } from '../services/grc-policy.service';
import { PolicyStatus } from '../enums';
import { CreatePolicyDto, UpdatePolicyDto } from '../dto';
import { Perf } from '../../common/decorators';

/**
 * GRC Policy Controller
 *
 * Full CRUD API endpoints for managing policies.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require MANAGER or ADMIN role.
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
  @Perf()
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

    // Return all active (non-deleted) policies
    return this.policyService.findAllActiveForTenant(tenantId, {
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * POST /grc/policies
   * Create a new policy for the current tenant
   * Requires MANAGER or ADMIN role
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
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

    return this.policyService.createPolicy(tenantId, req.user.id, createPolicyDto);
  }

  /**
   * PATCH /grc/policies/:id
   * Update an existing policy
   * Requires MANAGER or ADMIN role
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
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
   */
  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
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
   */
  @Get('due-for-review')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
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
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const policy = await this.policyService.findOneActiveForTenant(tenantId, id);
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
