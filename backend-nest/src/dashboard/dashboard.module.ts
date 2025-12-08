import { Module } from '@nestjs/common';
import { GrcModule } from '../grc/grc.module';
import { ItsmModule } from '../itsm/itsm.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Dashboard Module
 *
 * Provides aggregated dashboard data for the frontend Dashboard page.
 * This module composes data from GRC and ITSM modules to provide
 * dashboard-ready KPIs and visualizations.
 *
 * Endpoints:
 * - GET /dashboard/overview - Aggregated KPI summary
 * - GET /dashboard/risk-trends - Risk trends data for charts
 * - GET /dashboard/compliance-by-regulation - Compliance breakdown by framework
 *
 * All endpoints require JWT authentication and tenant context.
 */
@Module({
  imports: [GrcModule, ItsmModule, AuthModule, TenantsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
