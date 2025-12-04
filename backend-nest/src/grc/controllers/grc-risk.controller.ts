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
import { GrcRiskService } from '../services/grc-risk.service';
import { RiskStatus, RiskSeverity } from '../enums';

/**
 * GRC Risk Controller
 *
 * Read-only API endpoints for exploring risks.
 * All endpoints require JWT authentication and tenant context.
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

    // Return all risks
    return this.riskService.findAllForTenant(tenantId, {
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * GET /grc/risks/statistics
   * Get risk statistics for the current tenant
   */
  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
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
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const risk = await this.riskService.findOneForTenant(tenantId, id);
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
