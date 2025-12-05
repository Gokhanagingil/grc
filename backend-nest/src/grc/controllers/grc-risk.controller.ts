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
import { GrcRiskService } from '../services/grc-risk.service';
import { RiskStatus, RiskSeverity } from '../enums';
import { CreateRiskDto, UpdateRiskDto } from '../dto';
import { Perf } from '../../common/decorators';

/**
 * GRC Risk Controller
 *
 * Full CRUD API endpoints for managing risks.
 * All endpoints require JWT authentication and tenant context.
 * Write operations (POST, PATCH, DELETE) require MANAGER or ADMIN role.
 */
@Controller('grc/risks')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class GrcRiskController {
  constructor(private readonly riskService: GrcRiskService) {}

  /**
   * GET /grc/risks
   * List all risks for the current tenant
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Filter by status if provided
    if (status) {
      if (!Object.values(RiskStatus).includes(status as RiskStatus)) {
        throw new BadRequestException(`Invalid status: ${status}`);
      }
      return this.riskService.findByStatus(tenantId, status as RiskStatus);
    }

    // Filter by severity if provided
    if (severity) {
      if (!Object.values(RiskSeverity).includes(severity as RiskSeverity)) {
        throw new BadRequestException(`Invalid severity: ${severity}`);
      }
      return this.riskService.findBySeverity(
        tenantId,
        severity as RiskSeverity,
      );
    }

    // Return all active (non-deleted) risks
    return this.riskService.findAllActiveForTenant(tenantId, {
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * POST /grc/risks
   * Create a new risk for the current tenant
   * Requires MANAGER or ADMIN role
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createRiskDto: CreateRiskDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.riskService.createRisk(tenantId, req.user.id, createRiskDto);
  }

  /**
   * PATCH /grc/risks/:id
   * Update an existing risk
   * Requires MANAGER or ADMIN role
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateRiskDto: UpdateRiskDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const risk = await this.riskService.updateRisk(
      tenantId,
      req.user.id,
      id,
      updateRiskDto,
    );

    if (!risk) {
      throw new NotFoundException(`Risk with ID ${id} not found`);
    }

    return risk;
  }

  /**
   * DELETE /grc/risks/:id
   * Soft delete a risk (marks as deleted, does not remove from database)
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

    const deleted = await this.riskService.softDeleteRisk(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Risk with ID ${id} not found`);
    }
  }

  /**
   * GET /grc/risks/statistics
   * Get risk statistics for the current tenant
   */
  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Perf()
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.riskService.getStatistics(tenantId);
  }

  /**
   * GET /grc/risks/high-severity
   * Get high-severity risks (HIGH or CRITICAL)
   */
  @Get('high-severity')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @Perf()
  async findHighSeverity(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.riskService.findHighSeverityRisks(tenantId);
  }

  /**
   * GET /grc/risks/:id
   * Get a specific risk by ID
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

    const risk = await this.riskService.findOneActiveForTenant(tenantId, id);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${id} not found`);
    }

    return risk;
  }

  /**
   * GET /grc/risks/:id/controls
   * Get a risk with its associated controls
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

    const risk = await this.riskService.findWithControls(tenantId, id);
    if (!risk) {
      throw new NotFoundException(`Risk with ID ${id} not found`);
    }

    return risk;
  }
}
