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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { CoreCompanyService } from './core-company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyFilterDto } from './dto/company-filter.dto';
import { Perf } from '../common/decorators';

/**
 * Core Company Admin Controller
 *
 * Full CRUD API endpoints for managing companies (shared dimension).
 * All endpoints require JWT authentication and tenant context.
 *
 * RBAC:
 * - Read (GET): ADMIN_COMPANY_READ
 * - Write (POST, PATCH, DELETE): ADMIN_COMPANY_WRITE
 *
 * Route: /grc/admin/companies
 * External: /api/grc/admin/companies (nginx strips /api)
 */
@Controller('grc/admin/companies')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CoreCompanyController {
  constructor(private readonly companyService: CoreCompanyService) {}

  /**
   * GET /grc/admin/companies
   * List all companies for the current tenant with pagination, sorting, and filtering
   */
  @Get()
  @Permissions(Permission.ADMIN_COMPANY_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: CompanyFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.companyService.findWithFilters(tenantId, filterDto);
  }

  /**
   * POST /grc/admin/companies
   * Create a new company
   */
  @Post()
  @Permissions(Permission.ADMIN_COMPANY_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCompanyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.companyService.createCompany(tenantId, req.user.id, dto);
  }

  /**
   * GET /grc/admin/companies/:id
   * Get a specific company by ID
   */
  @Get(':id')
  @Permissions(Permission.ADMIN_COMPANY_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const company = await this.companyService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return company;
  }

  /**
   * PATCH /grc/admin/companies/:id
   * Update an existing company
   */
  @Patch(':id')
  @Permissions(Permission.ADMIN_COMPANY_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const company = await this.companyService.updateCompany(
      tenantId,
      req.user.id,
      id,
      dto,
    );

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return company;
  }

  /**
   * DELETE /grc/admin/companies/:id
   * Soft delete a company
   */
  @Delete(':id')
  @Permissions(Permission.ADMIN_COMPANY_WRITE)
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

    const deleted = await this.companyService.softDeleteCompany(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }
  }
}
