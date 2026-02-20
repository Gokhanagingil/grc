/**
 * useMenuDecision Hook
 *
 * Unified decision service for menu item status resolution.
 * This is the SINGLE SOURCE OF TRUTH for determining menu item visibility
 * and gating status. Both the sidebar (Layout.tsx) and ModuleGuard use this.
 *
 * Status resolution priority:
 * 1. Route exists (frontend route registry)
 * 2. Module enabled (from useModules)
 * 3. Gate conditions (framework required - from OnboardingContext)
 * 4. RBAC (admin-only - from AuthContext)
 */

import { useCallback, useMemo } from 'react';
import { useModules } from './useModules';
import { useOnboardingSafe } from '../contexts/OnboardingContext';
import { useAuth } from '../contexts/AuthContext';
import { FrameworkType } from '../services/grcClient';
import {
  MenuItemStatus,
  MenuStatusReason,
  StatusReasonCode,
} from '../services/platformApi';

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
  '/audit',
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
    // Golden Flow routes (fully implemented)
    '/evidence',
    '/test-results',
    '/issues',
    '/capa',
    '/coverage',
    '/insights',
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
 * Modules that require at least one active framework
 */
const FRAMEWORK_REQUIRED_MODULES = new Set(['audit', 'policy', 'compliance']);

/**
 * Recommended frameworks for gating messages
 */
export const RECOMMENDED_FRAMEWORKS = ['ISO27001', 'SOC2', 'NIST', 'GDPR'];

export interface MenuDecisionResult {
  status: MenuItemStatus;
  statusReason?: MenuStatusReason;
}

export interface UseMenuDecisionResult {
  /**
   * Get the resolved status for a menu item
   */
  getItemStatus: (
    route: string,
    moduleKey: string,
    baseStatus?: MenuItemStatus,
    gateConditions?: {
      requiresFramework?: boolean;
      requiresMaturity?: string;
      adminOnly?: boolean;
    },
  ) => MenuDecisionResult;

  /**
   * Check if any framework is active
   */
  hasActiveFramework: boolean;

  /**
   * Check if a specific module is enabled
   */
  isModuleEnabled: (moduleKey: string) => boolean;

  /**
   * Loading state
   */
  isLoading: boolean;

  /**
   * Get gating message for a module
   */
  getGatingMessage: (moduleKey: string) => MenuStatusReason | null;
}

export function useMenuDecision(): UseMenuDecisionResult {
  const { isModuleEnabled, isLoading: modulesLoading } = useModules();
  const { isFrameworkActive, loading: onboardingLoading, context } = useOnboardingSafe();
  const { user } = useAuth();

  const userRole = user?.role || 'user';

  // Check if any framework is active
  // Also check context.activeFrameworks directly to handle cases where
  // isFrameworkActive might return false during loading or initialization
  const hasActiveFramework = useMemo(() => {
    // First check via the isFrameworkActive helper
    const hasViaHelper = (
      isFrameworkActive(FrameworkType.ISO27001) ||
      isFrameworkActive(FrameworkType.SOC2) ||
      isFrameworkActive(FrameworkType.NIST) ||
      isFrameworkActive(FrameworkType.GDPR) ||
      isFrameworkActive(FrameworkType.HIPAA) ||
      isFrameworkActive(FrameworkType.PCI_DSS)
    );
    
    // Also check the raw context.activeFrameworks array as a fallback
    // This handles cases where the context has frameworks but isFrameworkActive
    // returns false due to timing or initialization issues
    const hasViaContext = context.activeFrameworks && context.activeFrameworks.length > 0;
    
    return hasViaHelper || hasViaContext;
  }, [isFrameworkActive, context.activeFrameworks]);

  /**
   * Get gating message for a module that requires framework
   */
  const getGatingMessage = useCallback(
    (moduleKey: string): MenuStatusReason | null => {
      if (!FRAMEWORK_REQUIRED_MODULES.has(moduleKey)) {
        return null;
      }

      if (!hasActiveFramework) {
        return {
          code: 'FRAMEWORK_REQUIRED' as StatusReasonCode,
          message: 'Framework Configuration Required',
          actionLabel: 'Go to Admin → Frameworks',
          actionPath: '/admin/settings',
        };
      }

      return null;
    },
    [hasActiveFramework],
  );

  /**
   * Resolve the status for a menu item based on multiple factors
   */
  const getItemStatus = useCallback(
    (
      route: string,
      moduleKey: string,
      baseStatus: MenuItemStatus = 'active',
      gateConditions?: {
        requiresFramework?: boolean;
        requiresMaturity?: string;
        adminOnly?: boolean;
      },
    ): MenuDecisionResult => {
      // Priority 1: Check if route exists
      if (!KNOWN_ROUTES.has(route)) {
        return {
          status: 'hidden',
          statusReason: {
            code: 'ROUTE_NOT_FOUND',
            message: 'This page is not yet available',
          },
        };
      }

      // Priority 2: Check if module is enabled
      if (!isModuleEnabled(moduleKey)) {
        return {
          status: 'hidden',
          statusReason: {
            code: 'MODULE_DISABLED',
            message: `The ${moduleKey} module is not enabled for your organization`,
          },
        };
      }

      // Priority 3: Check gate conditions (framework required)
      const requiresFramework =
        gateConditions?.requiresFramework ||
        FRAMEWORK_REQUIRED_MODULES.has(moduleKey);

      if (requiresFramework && !hasActiveFramework) {
        // For 'coming_soon' items, keep them as coming_soon even if gated
        if (baseStatus === 'coming_soon') {
          return {
            status: 'coming_soon',
            statusReason: {
              code: 'FRAMEWORK_REQUIRED',
              message:
                'Framework Configuration Required - Enable a compliance framework to use this feature',
              actionLabel: 'Go to Admin → Frameworks',
              actionPath: '/admin/settings',
            },
          };
        }

        // For 'active' items, mark them as gated
        return {
          status: 'gated',
          statusReason: {
            code: 'FRAMEWORK_REQUIRED',
            message: 'Framework Configuration Required',
            actionLabel: 'Go to Admin → Frameworks',
            actionPath: '/admin/settings',
          },
        };
      }

      // Priority 4: Check RBAC (admin-only)
      if (gateConditions?.adminOnly && userRole !== 'admin') {
        return {
          status: 'hidden',
          statusReason: {
            code: 'ADMIN_ONLY',
            message: 'This feature requires administrator access',
          },
        };
      }

      // Default: use base status
      return {
        status: baseStatus,
      };
    },
    [isModuleEnabled, hasActiveFramework, userRole],
  );

  return {
    getItemStatus,
    hasActiveFramework,
    isModuleEnabled,
    isLoading: modulesLoading || onboardingLoading,
    getGatingMessage,
  };
}

export default useMenuDecision;
