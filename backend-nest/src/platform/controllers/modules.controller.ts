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
 * Menu item status types for capability-based navigation
 * - active: Feature is available and functional
 * - coming_soon: Feature is planned but not yet implemented
 * - gated: Feature exists but requires configuration (e.g., framework setup)
 * - hidden: Feature should not be shown in menu
 */
type MenuItemStatus = 'active' | 'coming_soon' | 'gated' | 'hidden';

/**
 * Status reason codes for gated items
 */
type StatusReasonCode =
  | 'FRAMEWORK_REQUIRED'
  | 'MATURITY_REQUIRED'
  | 'MODULE_DISABLED'
  | 'ADMIN_ONLY'
  | 'ROUTE_NOT_FOUND';

interface MenuStatusReason {
  code: StatusReasonCode;
  message: string;
  actionLabel?: string;
  actionPath?: string;
}

interface NestedMenuChild {
  key: string;
  title: string;
  route: string;
  status: MenuItemStatus;
  statusReason?: MenuStatusReason;
}

interface NestedMenuItem {
  key: string;
  title: string;
  icon: string;
  route: string;
  moduleKey: string;
  children: NestedMenuChild[];
  gateConditions?: {
    requiresFramework?: boolean;
    requiresMaturity?: string;
    adminOnly?: boolean;
  };
}

interface NestedMenuSuite {
  key: string;
  title: string;
  icon: string;
  items: NestedMenuItem[];
}

/**
 * Known routes in the frontend application
 * Used to determine if a route exists
 */
const KNOWN_ROUTES = new Set([
  '/dashboard',
  '/todos',
  '/risk',
  '/governance',
  '/compliance',
  '/audits',
  '/findings',
  '/incidents',
  '/processes',
  '/violations',
  '/users',
  '/admin',
  '/admin/users',
  '/admin/roles',
  '/admin/settings',
  '/admin/frameworks',
  '/admin/tenants',
  '/admin/audit-logs',
  '/admin/system',
  '/admin/data-model',
  '/dotwalking',
  '/profile',
  '/standards',
  '/dashboards/audit',
  '/dashboards/compliance',
  '/dashboards/grc-health',
  // Coming soon routes (exist but show placeholder)
  '/risk-assessments',
  '/risk-treatments',
  '/policy-templates',
  '/policy-reviews',
  '/controls',
  '/control-testing',
  '/audit-reports',
  '/sla-dashboard',
  '/problems',
  '/changes',
]);

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
   * Returns default menu structure (flat format for backward compatibility)
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
   * Get nested menu structure for capability-based navigation
   * Returns suites with nested items and sub-items, with status resolution
   *
   * Status resolution priority:
   * 1. Route exists (frontend route registry)
   * 2. Module enabled (enabledModules)
   * 3. Gate conditions (framework required, maturity required)
   * 4. RBAC (admin-only)
   *
   * Status values: active | coming_soon | gated | hidden
   */
  @Get('menu/nested')
  getNestedMenu(
    @Request() req: RequestWithUser,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const effectiveTenantId = tenantId || req.tenantId || 'default';
    const userRole = req.user?.role || 'user';

    // For now, all modules are enabled by default (stub behavior)
    // In production, this would come from tenant configuration
    const enabledModules = new Set([
      'grc',
      'itsm',
      'audit',
      'risk',
      'compliance',
      'policy',
    ]);

    // Helper to resolve child item status
    const resolveChildStatus = (
      child: { route: string; baseStatus: MenuItemStatus },
      parentModuleKey: string,
      gateConditions?: NestedMenuItem['gateConditions'],
    ): NestedMenuChild => {
      // Priority 1: Check if route exists
      if (!KNOWN_ROUTES.has(child.route)) {
        return {
          key: '',
          title: '',
          route: child.route,
          status: 'hidden',
          statusReason: {
            code: 'ROUTE_NOT_FOUND',
            message: 'This page is not yet available',
          },
        };
      }

      // Priority 2: Check if module is enabled
      if (!enabledModules.has(parentModuleKey)) {
        return {
          key: '',
          title: '',
          route: child.route,
          status: 'hidden',
          statusReason: {
            code: 'MODULE_DISABLED',
            message: `The ${parentModuleKey} module is not enabled for your organization`,
          },
        };
      }

      // Priority 3: Check gate conditions (framework required)
      if (gateConditions?.requiresFramework) {
        // For audit module, framework is required
        // In production, this would check actual tenant configuration
        // For now, we return 'active' but include the gate info for frontend to use
        return {
          key: '',
          title: '',
          route: child.route,
          status: child.baseStatus,
          // Note: Frontend will check actual framework status and may override to 'gated'
        };
      }

      // Priority 4: Check RBAC (admin-only)
      if (gateConditions?.adminOnly && userRole !== 'admin') {
        return {
          key: '',
          title: '',
          route: child.route,
          status: 'hidden',
          statusReason: {
            code: 'ADMIN_ONLY',
            message: 'This feature requires administrator access',
          },
        };
      }

      // Default: use base status
      return {
        key: '',
        title: '',
        route: child.route,
        status: child.baseStatus,
      };
    };

    // Build menu structure with status resolution
    const suites: NestedMenuSuite[] = [
      {
        key: 'GRC_SUITE',
        title: 'GRC',
        icon: 'Folder',
        items: [
          {
            key: 'risk',
            title: 'Risk',
            icon: 'Security',
            route: '/risk',
            moduleKey: 'risk',
            children: [
              {
                ...resolveChildStatus(
                  { route: '/risk', baseStatus: 'active' },
                  'risk',
                ),
                key: 'risk_register',
                title: 'Risk Register',
              },
              {
                ...resolveChildStatus(
                  { route: '/risk-assessments', baseStatus: 'coming_soon' },
                  'risk',
                ),
                key: 'risk_assessments',
                title: 'Assessments',
              },
              {
                ...resolveChildStatus(
                  { route: '/risk-treatments', baseStatus: 'coming_soon' },
                  'risk',
                ),
                key: 'risk_treatments',
                title: 'Treatments',
              },
            ],
          },
          {
            key: 'policy',
            title: 'Policy',
            icon: 'AccountBalance',
            route: '/governance',
            moduleKey: 'policy',
            gateConditions: { requiresFramework: true },
            children: [
              {
                ...resolveChildStatus(
                  { route: '/governance', baseStatus: 'active' },
                  'policy',
                  { requiresFramework: true },
                ),
                key: 'policy_list',
                title: 'Policy List',
              },
              {
                ...resolveChildStatus(
                  { route: '/policy-templates', baseStatus: 'coming_soon' },
                  'policy',
                  { requiresFramework: true },
                ),
                key: 'policy_templates',
                title: 'Templates',
              },
              {
                ...resolveChildStatus(
                  { route: '/policy-reviews', baseStatus: 'coming_soon' },
                  'policy',
                  { requiresFramework: true },
                ),
                key: 'policy_reviews',
                title: 'Reviews',
              },
            ],
          },
          {
            key: 'control',
            title: 'Control',
            icon: 'VerifiedUser',
            route: '/compliance',
            moduleKey: 'compliance',
            children: [
              {
                ...resolveChildStatus(
                  { route: '/compliance', baseStatus: 'active' },
                  'compliance',
                ),
                key: 'requirements',
                title: 'Requirements',
              },
              {
                ...resolveChildStatus(
                  { route: '/controls', baseStatus: 'coming_soon' },
                  'compliance',
                ),
                key: 'control_library',
                title: 'Control Library',
              },
              {
                ...resolveChildStatus(
                  { route: '/control-testing', baseStatus: 'coming_soon' },
                  'compliance',
                ),
                key: 'control_testing',
                title: 'Testing',
              },
            ],
          },
          {
            key: 'audit',
            title: 'Audit',
            icon: 'FactCheck',
            route: '/audits',
            moduleKey: 'audit',
            gateConditions: { requiresFramework: true },
            children: [
              {
                ...resolveChildStatus(
                  { route: '/audits', baseStatus: 'active' },
                  'audit',
                  { requiresFramework: true },
                ),
                key: 'audit_list',
                title: 'Audit List',
              },
              {
                ...resolveChildStatus(
                  { route: '/findings', baseStatus: 'active' },
                  'audit',
                  { requiresFramework: true },
                ),
                key: 'audit_findings',
                title: 'Findings',
              },
              {
                ...resolveChildStatus(
                  { route: '/audit-reports', baseStatus: 'coming_soon' },
                  'audit',
                  { requiresFramework: true },
                ),
                key: 'audit_reports',
                title: 'Reports',
              },
            ],
          },
          {
            key: 'process',
            title: 'Process',
            icon: 'AccountTree',
            route: '/processes',
            moduleKey: 'grc',
            children: [
              {
                ...resolveChildStatus(
                  { route: '/processes', baseStatus: 'active' },
                  'grc',
                ),
                key: 'process_list',
                title: 'Process List',
              },
            ],
          },
          {
            key: 'violations',
            title: 'Violations',
            icon: 'Warning',
            route: '/violations',
            moduleKey: 'grc',
            children: [
              {
                ...resolveChildStatus(
                  { route: '/violations', baseStatus: 'active' },
                  'grc',
                ),
                key: 'violations_list',
                title: 'Violations List',
              },
            ],
          },
        ],
      },
      {
        key: 'ITSM_SUITE',
        title: 'ITSM',
        icon: 'Build',
        items: [
          {
            key: 'incidents',
            title: 'Incidents',
            icon: 'ReportProblem',
            route: '/incidents',
            moduleKey: 'itsm',
            children: [
              {
                ...resolveChildStatus(
                  { route: '/incidents', baseStatus: 'active' },
                  'itsm',
                ),
                key: 'incident_list',
                title: 'Incident List',
              },
              {
                ...resolveChildStatus(
                  { route: '/sla-dashboard', baseStatus: 'coming_soon' },
                  'itsm',
                ),
                key: 'sla_dashboard',
                title: 'SLA Dashboard',
              },
            ],
          },
          {
            key: 'problems',
            title: 'Problems',
            icon: 'BugReport',
            route: '/problems',
            moduleKey: 'itsm',
            children: [
              {
                ...resolveChildStatus(
                  { route: '/problems', baseStatus: 'coming_soon' },
                  'itsm',
                ),
                key: 'problem_list',
                title: 'Problem List',
              },
            ],
          },
          {
            key: 'changes',
            title: 'Changes',
            icon: 'SwapHoriz',
            route: '/changes',
            moduleKey: 'itsm',
            children: [
              {
                ...resolveChildStatus(
                  { route: '/changes', baseStatus: 'coming_soon' },
                  'itsm',
                ),
                key: 'change_list',
                title: 'Change List',
              },
            ],
          },
        ],
      },
    ];

    return {
      tenantId: effectiveTenantId,
      suites,
      // Include metadata for frontend decision making
      meta: {
        enabledModules: Array.from(enabledModules),
        userRole,
        // Recommended frameworks for gating messages
        recommendedFrameworks: ['ISO27001', 'SOC2', 'NIST', 'GDPR'],
      },
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
