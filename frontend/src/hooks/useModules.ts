/**
 * useModules Hook
 * 
 * Provides module visibility and licensing functionality.
 * Checks if modules are enabled for the current tenant.
 */

import { useState, useEffect, useCallback } from 'react';
import { moduleApi, ModuleStatus, MenuItem } from '../services/platformApi';
import { safeArray, safeIncludes } from '../utils/safeHelpers';

/**
 * Unwrap API response envelope
 * Handles both formats:
 * - Envelope: { success: true, data: T }
 * - Direct: T
 */
function unwrapModuleResponse<T>(response: { data: unknown }): T {
  const data = response.data;
  if (
    data &&
    typeof data === 'object' &&
    'success' in data &&
    (data as { success: boolean }).success === true &&
    'data' in data
  ) {
    return (data as { data: T }).data;
  }
  return data as T;
}

export interface UseModulesResult {
  enabledModules: string[];
  moduleStatuses: ModuleStatus[];
  menuItems: MenuItem[];
  isLoading: boolean;
  error: string | null;
  isModuleEnabled: (moduleKey: string) => boolean;
  refreshModules: () => Promise<void>;
}

export function useModules(): UseModulesResult {
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [moduleStatuses, setModuleStatuses] = useState<ModuleStatus[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [enabledResponse, statusResponse, menuResponse] = await Promise.all([
        moduleApi.getEnabled(),
        moduleApi.getStatus(),
        moduleApi.getMenu(),
      ]);

      // Unwrap envelope responses and extract data
      // Handles both: { success: true, data: { enabledModules: [...] } } and { enabledModules: [...] }
      const enabledData = unwrapModuleResponse<{ tenantId?: string; enabledModules?: string[] }>(enabledResponse);
      const statusData = unwrapModuleResponse<{ tenantId?: string; modules?: ModuleStatus[] }>(statusResponse);
      const menuData = unwrapModuleResponse<{ tenantId?: string; menuItems?: MenuItem[] }>(menuResponse);

      // Use safeArray to handle undefined/null responses
      setEnabledModules(safeArray(enabledData?.enabledModules));
      setModuleStatuses(safeArray(statusData?.modules));
      setMenuItems(safeArray(menuData?.menuItems));
    } catch (err) {
      console.error('Error fetching modules:', err);
      setError('Failed to load module configuration');
      // Set default modules on error
      setEnabledModules(['risk', 'policy', 'compliance', 'audit']);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const isModuleEnabled = useCallback(
    (moduleKey: string): boolean => {
      // Use safeIncludes to handle potential undefined/null enabledModules
      return safeIncludes(enabledModules, moduleKey);
    },
    [enabledModules]
  );

  return {
    enabledModules,
    moduleStatuses,
    menuItems,
    isLoading,
    error,
    isModuleEnabled,
    refreshModules: fetchModules,
  };
}

export default useModules;
