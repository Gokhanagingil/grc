import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto } from './dto';

/**
 * Closed-Loop Analytics Controller
 *
 * Provides aggregated analytics across the ITSM lifecycle:
 * Problem → Major Incident → PIR → Action → Known Error → Knowledge Candidate
 *
 * All endpoints are read-only and tenant-scoped.
 * No new DB tables — pure aggregation queries on existing entities.
 */
@Controller('grc/itsm/analytics')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Executive Summary — top-level KPIs, trends, closure effectiveness
   */
  @Get('executive-summary')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async getExecutiveSummary(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getExecutiveSummary(tenantId, filter);
  }

  /**
   * Problem Trends — state/priority/category distributions, aging, reopens
   */
  @Get('problem-trends')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async getProblemTrends(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getProblemTrends(tenantId, filter);
  }

  /**
   * Major Incident Metrics — counts, MTTR, bridge duration, PIR rate
   */
  @Get('major-incident-metrics')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async getMajorIncidentMetrics(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getMajorIncidentMetrics(tenantId, filter);
  }

  /**
   * PIR Effectiveness — completion rates, action tracking, knowledge generation
   */
  @Get('pir-effectiveness')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async getPirEffectiveness(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getPirEffectiveness(tenantId, filter);
  }

  /**
   * Known Error Lifecycle — state distribution, publication/retirement rates
   */
  @Get('known-error-lifecycle')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async getKnownErrorLifecycle(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getKnownErrorLifecycle(tenantId, filter);
  }

  /**
   * Closure Effectiveness — closure trends, reopen rates, completion times
   */
  @Get('closure-effectiveness')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async getClosureEffectiveness(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getClosureEffectiveness(tenantId, filter);
  }

  /**
   * Backlog — open items by priority, overdue actions, stale items
   */
  @Get('backlog')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async getBacklog(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getBacklog(tenantId, filter);
  }
}
