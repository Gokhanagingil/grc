import {
  Controller,
  Get,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { GrcInsightsService } from '../services/grc-insights.service';

/**
 * GRC Insights Controller
 *
 * Provides aggregated GRC metrics and insights for dashboards.
 * All endpoints require JWT authentication and tenant context.
 * Part of Sprint 1E: Lite Reporting feature.
 */
@ApiTags('GRC Insights')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/insights')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcInsightsController {
  constructor(private readonly insightsService: GrcInsightsService) {}

  /**
   * GET /grc/insights/overview
   * Returns aggregated GRC metrics for the tenant
   */
  @Get('overview')
  @ApiOperation({
    summary: 'Get GRC Insights Overview',
    description:
      'Returns aggregated GRC metrics including open issues by severity, ' +
      'overdue CAPAs, recent FAIL test results, and evidence statistics.',
  })
  @ApiResponse({
    status: 200,
    description: 'GRC insights overview retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            openIssuesBySeverity: {
              type: 'object',
              properties: {
                CRITICAL: { type: 'number', example: 2 },
                HIGH: { type: 'number', example: 5 },
                MEDIUM: { type: 'number', example: 8 },
                LOW: { type: 'number', example: 3 },
              },
            },
            overdueCAPAsCount: { type: 'number', example: 4 },
            recentFailTestResults: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  testedAt: { type: 'string', format: 'date-time' },
                  controlTestName: { type: 'string' },
                },
              },
            },
            evidenceStats: {
              type: 'object',
              properties: {
                linked: { type: 'number', example: 15 },
                unlinked: { type: 'number', example: 3 },
                total: { type: 'number', example: 18 },
              },
            },
            summary: {
              type: 'object',
              properties: {
                totalOpenIssues: { type: 'number', example: 18 },
                totalOverdueCAPAs: { type: 'number', example: 4 },
                totalFailedTests: { type: 'number', example: 7 },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Tenant ID is required' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Permissions(Permission.GRC_RISK_READ)
  @Perf()
  async getOverview(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const data = await this.insightsService.getOverview(tenantId);
    return { success: true, data };
  }
}
