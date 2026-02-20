import {
  Controller,
  Get,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { DashboardService } from './dashboard.service';
import { Perf } from '../common/decorators';

/**
 * Dashboard Controller
 *
 * Provides aggregated dashboard data for the frontend Dashboard page.
 * All endpoints require JWT authentication and tenant context.
 *
 * Endpoints:
 * - GET /dashboard/overview - Aggregated KPI summary
 * - GET /dashboard/risk-trends - Risk trends data for charts
 * - GET /dashboard/compliance-by-regulation - Compliance breakdown by framework
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/overview
   *
   * Returns aggregated KPI summary for the Dashboard page.
   * Includes:
   * - Risk summary (total, open, high severity, overdue, top 5 open risks)
   * - Compliance summary (total, pending, completed, overdue, coverage %)
   * - Policy summary (total, active, draft, coverage %)
   * - Incident summary (total, open, closed, resolved, avg resolution time)
   * - User summary (total, admins, managers)
   */
  @Get('overview')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
  async getOverview(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.dashboardService.getOverview(tenantId);
  }

  /**
   * GET /dashboard/risk-trends
   *
   * Returns risk trend data for visualization.
   * Currently provides a snapshot breakdown by severity level.
   * Can be extended to provide time-series data in the future.
   */
  @Get('risk-trends')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
  async getRiskTrends(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.dashboardService.getRiskTrends(tenantId);
  }

  /**
   * GET /dashboard/compliance-by-regulation
   *
   * Returns compliance status grouped by regulation/framework.
   * Each item includes completed, pending, and overdue counts.
   */
  @Get('compliance-by-regulation')
  @Permissions(Permission.GRC_STATISTICS_READ)
  @Perf()
  async getComplianceByRegulation(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.dashboardService.getComplianceByRegulation(tenantId);
  }
}
