import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from './guards/tenant.guard';
import { RequestWithUser } from '../common/types';

/**
 * Tenants Controller
 *
 * Provides tenant-aware endpoints demonstrating multi-tenancy.
 *
 * All routes require:
 * - Valid JWT token (JwtAuthGuard)
 * - Valid x-tenant-id header matching user's tenant (TenantGuard)
 *
 * Example request:
 * curl -H "Authorization: Bearer <token>" \
 *      -H "x-tenant-id: <tenant-uuid>" \
 *      http://localhost:3002/tenants/current
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Get the current tenant
   *
   * Returns the tenant associated with the x-tenant-id header.
   * User must belong to this tenant.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('current')
  async getCurrentTenant(@Request() req: RequestWithUser) {
    const tenant = await this.tenantsService.findById(req.tenantId || '');
    return {
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            description: tenant.description,
            isActive: tenant.isActive,
            createdAt: tenant.createdAt,
          }
        : null,
      requestedBy: {
        userId: req.user?.sub,
        email: req.user?.email,
        role: req.user?.role,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all users for the current tenant
   *
   * Returns users belonging to the tenant specified in x-tenant-id header.
   * User must belong to this tenant.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('users')
  async getTenantUsers(@Request() req: RequestWithUser) {
    const users = await this.tenantsService.getUsersForTenant(
      req.tenantId || '',
    );
    return {
      tenantId: req.tenantId || '',
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      })),
      count: users.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Health check for tenants module
   * No authentication required.
   */
  @Get('health')
  async health() {
    const count = await this.tenantsService.count();
    return {
      status: 'ok',
      module: 'tenants',
      tenantCount: count,
      timestamp: new Date().toISOString(),
    };
  }
}
