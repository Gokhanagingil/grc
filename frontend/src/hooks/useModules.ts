/**
 * useModules Hook
 * 
 * Provides module visibility and licensing functionality.
 * Checks if modules are enabled for the current tenant.
 */

import { useState, useEffect, useCallback } from 'react';
import { moduleApi, ModuleStatus, MenuItem } from '../services/platformApi';

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

      setEnabledModules(enabledResponse.data.enabledModules);
      setModuleStatuses(statusResponse.data.modules);
      setMenuItems(menuResponse.data.menuItems);
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
      return enabledModules.includes(moduleKey);
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
