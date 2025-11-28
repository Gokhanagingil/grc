import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('diagnostics')
@Controller({ path: '_routes', version: '2' })
export class RoutesController {
  @Get()
  @ApiOkResponse({ description: 'List of all mapped routes (simplified)' })
  getRoutes(@Req() req: Request) {
    // Simplified route list - returns expected routes
    // Full introspection requires HttpAdapter which is complex
    const routes = [
      { method: 'GET', path: '/health', controller: 'RootHealthController' },
      { method: 'HEAD', path: '/health', controller: 'RootHealthController' },
      { method: 'GET', path: '/api/v2/health', controller: 'HealthController' },
      { method: 'GET', path: '/api/v2/dashboard/ping', controller: 'DashboardController' },
      { method: 'GET', path: '/api/v2/dashboard/overview', controller: 'DashboardController' },
      { method: 'GET', path: '/api/v2/governance/ping', controller: 'GovernanceController' },
      { method: 'GET', path: '/api/v2/governance/policies', controller: 'GovernanceController' },
      { method: 'GET', path: '/api/v2/compliance/ping', controller: 'ComplianceController' },
      { method: 'GET', path: '/api/v2/compliance/requirements', controller: 'ComplianceController' },
      { method: 'GET', path: '/api/v2/risk-catalog/ping', controller: 'RiskCatalogController' },
      { method: 'GET', path: '/api/v2/risk-catalog', controller: 'RiskCatalogController' },
      { method: 'GET', path: '/api/v2/risk-instances/ping', controller: 'RiskInstanceController' },
      { method: 'GET', path: '/api/v2/risk-instances', controller: 'RiskInstanceController' },
      { method: 'GET', path: '/api/v2/entity-registry/ping', controller: 'EntityRegistryController' },
      { method: 'GET', path: '/api/v2/entity-registry/entity-types', controller: 'EntityRegistryController' },
      { method: 'GET', path: '/api/v2/_routes', controller: 'RoutesController' },
    ];

    return {
      timestamp: new Date().toISOString(),
      total: routes.length,
      note: 'This is a simplified list. For full introspection, check Swagger at /api-docs',
      routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
    };
  }
}

