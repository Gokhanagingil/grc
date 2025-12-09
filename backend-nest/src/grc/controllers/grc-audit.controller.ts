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
import { GrcAuditService } from '../services/grc-audit.service';
import { CreateAuditDto } from '../dto/create-audit.dto';
import { UpdateAuditDto } from '../dto/update-audit.dto';
import { AuditFilterDto } from '../dto/filter-audit.dto';
import { Perf } from '../../common/decorators';

/**
 * GRC Audit Controller
 *
 * Full CRUD API endpoints for managing audits.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require GRC_AUDIT_WRITE permission.
 *
 * Query Parameters for GET /grc/audits:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - sortBy: Field to sort by (e.g., createdAt, name, status)
 * - sortOrder: Sort order (ASC or DESC, default: DESC)
 * - status: Filter by audit status
 * - auditType: Filter by audit type
 * - riskLevel: Filter by risk level
 * - department: Filter by department
 * - search: Search in name and description
 */
@Controller('grc/audits')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcAuditController {
  constructor(private readonly auditService: GrcAuditService) {}

  /**
   * GET /grc/audits
   * List all audits for the current tenant with pagination, sorting, and filtering
   */
  @Get()
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: AuditFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.auditService.findWithFilters(tenantId, filterDto);
    
    // Return in format expected by frontend
    return {
      audits: result.items,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * GET /grc/audits/can/create
   * Check if user can create audits
   */
  @Get('can/create')
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async canCreate() {
    const allowed = await this.auditService.canCreate();
    return { allowed };
  }

  /**
   * GET /grc/audits/distinct/:field
   * Get distinct values for a field (for filter dropdowns)
   */
  @Get('distinct/:field')
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async getDistinctValues(
    @Headers('x-tenant-id') tenantId: string,
    @Param('field') field: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.auditService.getDistinctValues(tenantId, field);
  }

  /**
   * GET /grc/audits/statistics
   * Get audit statistics for the current tenant
   */
  @Get('statistics')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.auditService.getStatistics(tenantId);
  }

  /**
   * POST /grc/audits
   * Create a new audit for the current tenant
   * Requires GRC_AUDIT_WRITE permission
   */
  @Post()
  @Permissions(Permission.GRC_AUDIT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createAuditDto: CreateAuditDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.auditService.createAudit(tenantId, req.user.id, createAuditDto);
  }

  /**
   * GET /grc/audits/:id
   * Get a specific audit by ID
   */
  @Get(':id')
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const audit = await this.auditService.findOneActiveForTenant(tenantId, id);
    if (!audit) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }

    return audit;
  }

  /**
   * GET /grc/audits/:id/permissions
   * Get user's permissions for a specific audit
   */
  @Get(':id/permissions')
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async getPermissions(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const audit = await this.auditService.findOneActiveForTenant(tenantId, id);
    if (!audit) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }

    // Return permissions (can be extended with ACL)
    return {
      read: true,
      write: true,
      delete: true,
      maskedFields: [],
      deniedFields: [],
    };
  }

  /**
   * PATCH /grc/audits/:id
   * Update an existing audit
   * Requires GRC_AUDIT_WRITE permission
   */
  @Patch(':id')
  @Permissions(Permission.GRC_AUDIT_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateAuditDto: UpdateAuditDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const audit = await this.auditService.updateAudit(
      tenantId,
      req.user.id,
      id,
      updateAuditDto,
    );

    if (!audit) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }

    return audit;
  }

  /**
   * PUT /grc/audits/:id
   * Update an existing audit (alias for PATCH)
   * Requires GRC_AUDIT_WRITE permission
   */
  @Patch(':id')
  @Permissions(Permission.GRC_AUDIT_WRITE)
  @Perf()
  async updatePut(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateAuditDto: UpdateAuditDto,
  ) {
    return this.update(tenantId, req, id, updateAuditDto);
  }

  /**
   * DELETE /grc/audits/:id
   * Soft delete an audit (marks as deleted, does not remove from database)
   * Requires GRC_AUDIT_WRITE permission
   */
  @Delete(':id')
  @Permissions(Permission.GRC_AUDIT_WRITE)
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

    const deleted = await this.auditService.softDeleteAudit(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }
  }

  /**
   * GET /grc/audits/:id/findings
   * Get findings for an audit (placeholder - returns empty array for now)
   */
  @Get(':id/findings')
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async getFindings(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const audit = await this.auditService.findOneActiveForTenant(tenantId, id);
    if (!audit) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }

    // Return empty array for now - findings module can be added later
    return [];
  }

  /**
   * GET /grc/audits/:id/criteria
   * Get criteria for an audit (placeholder - returns empty array for now)
   */
  @Get(':id/criteria')
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async getCriteria(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const audit = await this.auditService.findOneActiveForTenant(tenantId, id);
    if (!audit) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }

    // Return empty array for now - criteria module can be added later
    return [];
  }

  /**
   * GET /grc/audits/:id/scope-objects
   * Get scope objects for an audit (placeholder - returns empty array for now)
   */
  @Get(':id/scope-objects')
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async getScopeObjects(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const audit = await this.auditService.findOneActiveForTenant(tenantId, id);
    if (!audit) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }

    // Return empty array for now - scope objects module can be added later
    return [];
  }

  /**
   * GET /grc/audits/:id/reports
   * Get reports for an audit (placeholder - returns empty array for now)
   */
  @Get(':id/reports')
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async getReports(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const audit = await this.auditService.findOneActiveForTenant(tenantId, id);
    if (!audit) {
      throw new NotFoundException(`Audit with ID ${id} not found`);
    }

    // Return empty array for now - reports module can be added later
    return [];
  }
}
