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
  | 'grc:audit:read'
  | 'grc:audit:write'
  | 'grc:control:read'
  | 'grc:control:write'
  | 'grc:evidence:read'
  | 'grc:evidence:write'
  | 'grc:issue:read'
  | 'grc:issue:write'
  | 'grc:capa:read'
  | 'grc:capa:write'
  | 'grc:process:read'
  | 'grc:process:write'
  | 'itsm:incident:read'
  | 'itsm:incident:write'
  | 'itsm:service:read'
  | 'itsm:service:write'
  | 'itsm:change:read'
  | 'itsm:change:write'
  | 'itsm:approval:read'
  | 'itsm:approval:write'
  | 'itsm:sla:read'
  | 'itsm:sla:write'
  | 'itsm:workflow:read'
  | 'itsm:workflow:write'
  | 'itsm:cab:read'
  | 'itsm:cab:write'
  | 'itsm:problem:read'
  | 'itsm:known_error:read'
  | 'itsm:statistics:read'
  | 'cmdb:ci:read'
  | 'cmdb:ci:write'
  | 'cmdb:service:read'
  | 'cmdb:service:write'
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
    'grc:audit:read',
    'grc:audit:write',
    'grc:control:read',
    'grc:control:write',
    'grc:evidence:read',
    'grc:evidence:write',
    'grc:issue:read',
    'grc:issue:write',
    'grc:capa:read',
    'grc:capa:write',
    'grc:process:read',
    'grc:process:write',
    'grc:statistics:read',
    'grc:admin',
    'itsm:incident:read',
    'itsm:incident:write',
    'itsm:service:read',
    'itsm:service:write',
    'itsm:change:read',
    'itsm:change:write',
    'itsm:approval:read',
    'itsm:approval:write',
    'itsm:sla:read',
    'itsm:sla:write',
    'itsm:workflow:read',
    'itsm:workflow:write',
    'itsm:cab:read',
    'itsm:cab:write',
    'itsm:problem:read',
    'itsm:known_error:read',
    'itsm:statistics:read',
    'cmdb:ci:read',
    'cmdb:ci:write',
    'cmdb:service:read',
    'cmdb:service:write',
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
    'grc:audit:read',
    'grc:audit:write',
    'grc:control:read',
    'grc:control:write',
    'grc:evidence:read',
    'grc:evidence:write',
    'grc:issue:read',
    'grc:issue:write',
    'grc:capa:read',
    'grc:capa:write',
    'grc:process:read',
    'grc:process:write',
    'grc:statistics:read',
    'itsm:incident:read',
    'itsm:incident:write',
    'itsm:service:read',
    'itsm:service:write',
    'itsm:change:read',
    'itsm:change:write',
    'itsm:approval:read',
    'itsm:approval:write',
    'itsm:sla:read',
    'itsm:sla:write',
    'itsm:workflow:read',
    'itsm:workflow:write',
    'itsm:cab:read',
    'itsm:cab:write',
    'itsm:problem:read',
    'itsm:known_error:read',
    'itsm:statistics:read',
    'cmdb:ci:read',
    'cmdb:ci:write',
    'cmdb:service:read',
    'cmdb:service:write',
  ],
  user: [
    'grc:risk:read',
    'grc:policy:read',
    'grc:requirement:read',
    'grc:audit:read',
    'grc:control:read',
    'grc:evidence:read',
    'grc:issue:read',
    'grc:capa:read',
    'grc:process:read',
    'itsm:incident:read',
    'itsm:service:read',
    'itsm:change:read',
    'itsm:approval:read',
    'itsm:sla:read',
    'itsm:workflow:read',
    'itsm:cab:read',
    'itsm:problem:read',
    'itsm:known_error:read',
    'cmdb:ci:read',
    'cmdb:service:read',
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
