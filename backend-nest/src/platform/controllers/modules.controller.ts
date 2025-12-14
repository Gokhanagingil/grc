import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/types';

/**
 * Modules Controller (Stub)
 *
 * Provides minimal stub endpoints for platform module management.
 * Returns safe defaults to prevent 404 errors on staging.
 */
@Controller('platform/modules')
@UseGuards(JwtAuthGuard)
export class ModulesController {
  /**
   * Get available modules
   * Returns a default list of GRC platform modules
   */
  @Get('available')
  getAvailable() {
    return {
      modules: [
        {
          key: 'grc',
          name: 'GRC',
          description: 'Governance, Risk, and Compliance',
          category: 'core',
        },
        {
          key: 'itsm',
          name: 'ITSM',
          description: 'IT Service Management',
          category: 'core',
        },
        {
          key: 'audit',
          name: 'Audit',
          description: 'Audit Management',
          category: 'grc',
        },
        {
          key: 'risk',
          name: 'Risk Management',
          description: 'Risk Assessment and Mitigation',
          category: 'grc',
        },
        {
          key: 'compliance',
          name: 'Compliance',
          description: 'Compliance Tracking',
          category: 'grc',
        },
        {
          key: 'policy',
          name: 'Policy Management',
          description: 'Policy Lifecycle Management',
          category: 'grc',
        },
      ],
    };
  }

  /**
   * Get enabled modules for current tenant
   * Returns all core modules as enabled by default
   */
  @Get('enabled')
  getEnabled(
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId || 'default';
    return {
      tenantId: effectiveTenantId,
      enabledModules: ['grc', 'itsm', 'audit', 'risk', 'compliance', 'policy'],
    };
  }

  /**
   * Get module status for current tenant
   * Returns all modules as enabled
   */
  @Get('status')
  getStatus(
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId || 'default';
    return {
      tenantId: effectiveTenantId,
      modules: [
        {
          key: 'grc',
          name: 'GRC',
          description: 'Governance, Risk, and Compliance',
          category: 'core',
          status: 'enabled',
          config: null,
          tenant_id: effectiveTenantId,
        },
        {
          key: 'itsm',
          name: 'ITSM',
          description: 'IT Service Management',
          category: 'core',
          status: 'enabled',
          config: null,
          tenant_id: effectiveTenantId,
        },
        {
          key: 'audit',
          name: 'Audit',
          description: 'Audit Management',
          category: 'grc',
          status: 'enabled',
          config: null,
          tenant_id: effectiveTenantId,
        },
        {
          key: 'risk',
          name: 'Risk Management',
          description: 'Risk Assessment and Mitigation',
          category: 'grc',
          status: 'enabled',
          config: null,
          tenant_id: effectiveTenantId,
        },
        {
          key: 'compliance',
          name: 'Compliance',
          description: 'Compliance Tracking',
          category: 'grc',
          status: 'enabled',
          config: null,
          tenant_id: effectiveTenantId,
        },
        {
          key: 'policy',
          name: 'Policy Management',
          description: 'Policy Lifecycle Management',
          category: 'grc',
          status: 'enabled',
          config: null,
          tenant_id: effectiveTenantId,
        },
      ],
    };
  }

  /**
   * Get menu items for enabled modules
   * Returns default menu structure
   */
  @Get('menu')
  getMenu(
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId || 'default';
    return {
      tenantId: effectiveTenantId,
      menuItems: [
        {
          moduleKey: 'grc',
          path: '/dashboard',
          icon: 'Dashboard',
          label: 'Dashboard',
        },
        {
          moduleKey: 'risk',
          path: '/risk',
          icon: 'Warning',
          label: 'Risk Management',
        },
        {
          moduleKey: 'compliance',
          path: '/compliance',
          icon: 'CheckCircle',
          label: 'Compliance',
        },
        {
          moduleKey: 'policy',
          path: '/governance',
          icon: 'Policy',
          label: 'Governance',
        },
        {
          moduleKey: 'audit',
          path: '/audits',
          icon: 'Assessment',
          label: 'Audits',
        },
        {
          moduleKey: 'itsm',
          path: '/incidents',
          icon: 'BugReport',
          label: 'Incidents',
        },
      ],
    };
  }

  /**
   * Check if a specific module is enabled
   */
  @Get('check/:moduleKey')
  checkModule(
    @Param('moduleKey') moduleKey: string,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId || 'default';
    const availableModules = [
      'grc',
      'itsm',
      'audit',
      'risk',
      'compliance',
      'policy',
    ];
    const isEnabled = availableModules.includes(moduleKey);
    return {
      tenantId: effectiveTenantId,
      moduleKey,
      isEnabled,
      module: isEnabled
        ? {
            key: moduleKey,
            name: moduleKey.toUpperCase(),
            description: `${moduleKey} module`,
            category: 'core',
          }
        : null,
    };
  }

  /**
   * Get modules by category
   */
  @Get('category/:category')
  getByCategory(@Param('category') category: string) {
    const allModules = [
      {
        key: 'grc',
        name: 'GRC',
        description: 'Governance, Risk, and Compliance',
        category: 'core',
      },
      {
        key: 'itsm',
        name: 'ITSM',
        description: 'IT Service Management',
        category: 'core',
      },
      {
        key: 'audit',
        name: 'Audit',
        description: 'Audit Management',
        category: 'grc',
      },
      {
        key: 'risk',
        name: 'Risk Management',
        description: 'Risk Assessment and Mitigation',
        category: 'grc',
      },
      {
        key: 'compliance',
        name: 'Compliance',
        description: 'Compliance Tracking',
        category: 'grc',
      },
      {
        key: 'policy',
        name: 'Policy Management',
        description: 'Policy Lifecycle Management',
        category: 'grc',
      },
    ];
    return {
      category,
      modules: allModules.filter((m) => m.category === category),
    };
  }

  /**
   * Get module config (stub - returns null config)
   */
  @Get(':moduleKey/config')
  getConfig(
    @Param('moduleKey') moduleKey: string,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId || 'default';
    return {
      tenantId: effectiveTenantId,
      moduleKey,
      config: null,
    };
  }

  /**
   * Enable a module (stub - no-op, returns success)
   */
  @Post(':moduleKey/enable')
  enableModule(
    @Param('moduleKey') moduleKey: string,
    @Body() body: { config?: Record<string, unknown> },
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId || 'default';
    return {
      message: `Module ${moduleKey} enabled`,
      tenantId: effectiveTenantId,
      moduleKey,
      config: body.config || null,
    };
  }

  /**
   * Disable a module (stub - no-op, returns success)
   */
  @Post(':moduleKey/disable')
  disableModule(
    @Param('moduleKey') moduleKey: string,
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId || 'default';
    return {
      message: `Module ${moduleKey} disabled`,
      tenantId: effectiveTenantId,
      moduleKey,
    };
  }

  /**
   * Update module config (stub - no-op, returns success)
   */
  @Put(':moduleKey/config')
  updateConfig(
    @Param('moduleKey') moduleKey: string,
    @Body() body: { config: Record<string, unknown> },
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId || 'default';
    return {
      message: `Module ${moduleKey} config updated`,
      tenantId: effectiveTenantId,
      moduleKey,
      config: body.config,
    };
  }

  /**
   * Initialize modules for tenant (stub - no-op, returns success)
   */
  @Post('initialize')
  initialize(@Body() body: { tenantId: string; enabledModules?: string[] }) {
    return {
      message: 'Modules initialized',
      tenantId: body.tenantId,
      enabledModules: body.enabledModules || [
        'grc',
        'itsm',
        'audit',
        'risk',
        'compliance',
        'policy',
      ],
    };
  }
}
