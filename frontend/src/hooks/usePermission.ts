import { useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export type Permission =
  | 'grc:risk:read'
  | 'grc:risk:write'
  | 'grc:policy:read'
  | 'grc:policy:write'
  | 'grc:requirement:read'
  | 'grc:requirement:write'
  | 'grc:statistics:read'
  | 'grc:admin'
  | 'itsm:incident:read'
  | 'itsm:incident:write'
  | 'itsm:statistics:read'
  | 'admin:users:read'
  | 'admin:users:write'
  | 'admin:roles:read'
  | 'admin:roles:write'
  | 'admin:settings:read'
  | 'admin:settings:write'
  | 'admin:tenants:read'
  | 'admin:tenants:write';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'grc:risk:read',
    'grc:risk:write',
    'grc:policy:read',
    'grc:policy:write',
    'grc:requirement:read',
    'grc:requirement:write',
    'grc:statistics:read',
    'grc:admin',
    'itsm:incident:read',
    'itsm:incident:write',
    'itsm:statistics:read',
    'admin:users:read',
    'admin:users:write',
    'admin:roles:read',
    'admin:roles:write',
    'admin:settings:read',
    'admin:settings:write',
    'admin:tenants:read',
    'admin:tenants:write',
  ],
  manager: [
    'grc:risk:read',
    'grc:risk:write',
    'grc:policy:read',
    'grc:policy:write',
    'grc:requirement:read',
    'grc:requirement:write',
    'grc:statistics:read',
    'itsm:incident:read',
    'itsm:incident:write',
    'itsm:statistics:read',
  ],
  user: [
    'grc:risk:read',
    'grc:policy:read',
    'grc:requirement:read',
    'itsm:incident:read',
  ],
};

export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

export function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  const rolePermissions = getPermissionsForRole(role);
  return permissions.every((p) => rolePermissions.includes(p));
}

export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  const rolePermissions = getPermissionsForRole(role);
  return permissions.some((p) => rolePermissions.includes(p));
}

export interface UsePermissionResult {
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  canRead: (module: string) => boolean;
  canWrite: (module: string) => boolean;
  isAdmin: boolean;
  isManager: boolean;
}

export function usePermission(): UsePermissionResult {
  const { user } = useAuth();
  const role = user?.role || 'user';

  const permissions = useMemo(() => getPermissionsForRole(role), [role]);

  const checkPermission = useCallback(
    (permission: Permission): boolean => {
      return permissions.includes(permission);
    },
    [permissions]
  );

  const checkAllPermissions = useCallback(
    (perms: Permission[]): boolean => {
      return perms.every((p) => permissions.includes(p));
    },
    [permissions]
  );

  const checkAnyPermission = useCallback(
    (perms: Permission[]): boolean => {
      return perms.some((p) => permissions.includes(p));
    },
    [permissions]
  );

  const canRead = useCallback(
    (module: string): boolean => {
      const readPermission = `${module}:read` as Permission;
      return permissions.includes(readPermission);
    },
    [permissions]
  );

  const canWrite = useCallback(
    (module: string): boolean => {
      const writePermission = `${module}:write` as Permission;
      return permissions.includes(writePermission);
    },
    [permissions]
  );

  return {
    permissions,
    hasPermission: checkPermission,
    hasAllPermissions: checkAllPermissions,
    hasAnyPermission: checkAnyPermission,
    canRead,
    canWrite,
    isAdmin: role === 'admin',
    isManager: role === 'manager' || role === 'admin',
  };
}

export default usePermission;
