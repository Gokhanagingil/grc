import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewDto } from './dto/dashboard-overview.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { getTenantId } from '../../common/tenant/tenant.util';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '2' })
@UseGuards(TenantGuard)
export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly config: ConfigService,
  ) {}

  @Get('ping')
  @ApiOkResponse({ description: 'Dashboard ping endpoint' })
  ping() {
    return { ok: true, mod: 'dashboard', ts: new Date().toISOString() };
  }

  @Get('overview')
  @ApiOkResponse({
    type: DashboardOverviewDto,
    description: 'Dashboard overview with data foundation counts',
  })
  async getOverview(
    @Req() req: Request,
  ): Promise<DashboardOverviewDto & { note?: string }> {
    const tenantId = getTenantId(req, this.config);

    try {
      const result = await this.service.getOverview(tenantId);
      // Add note if tenant header was missing
      if (!req.headers['x-tenant-id']) {
        return {
          ...result,
          note: 'no-tenant-header; used default tenant',
        };
      }
      return result;
    } catch (error: any) {
      // Return empty counts on error (200 + empty object)
      return {
        tenantId,
        dataFoundations: {
          standards: 0,
          clauses: 0,
          clausesSynthetic: 0,
          controls: 0,
          risks: 0,
          mappings: 0,
          mappingsSynthetic: 0,
          policies: 0,
          requirements: 0,
          riskCatalog: 0,
          riskInstances: 0,
          entityTypes: 0,
        },
        health: {
          status: 'ok' as const,
          time: new Date().toISOString(),
        },
        note: 'error-loading-counts',
      };
    }
  }
}
