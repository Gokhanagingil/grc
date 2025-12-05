import { Injectable } from '@nestjs/common';
import { Permission } from './permission.enum';
import { UserRole } from '../../users/user.entity';

/**
 * Role to Permission Mapping
 *
 * Defines which permissions each role has.
 * This is the central configuration for RBAC.
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  /**
   * ADMIN - Full access to all GRC features
   */
  [UserRole.ADMIN]: [
    Permission.GRC_RISK_READ,
    Permission.GRC_RISK_WRITE,
    Permission.GRC_POLICY_READ,
    Permission.GRC_POLICY_WRITE,
    Permission.GRC_REQUIREMENT_READ,
    Permission.GRC_REQUIREMENT_WRITE,
    Permission.GRC_STATISTICS_READ,
    Permission.GRC_ADMIN,
  ],

  /**
   * MANAGER - Full GRC read/write access, including statistics
   */
  [UserRole.MANAGER]: [
    Permission.GRC_RISK_READ,
    Permission.GRC_RISK_WRITE,
    Permission.GRC_POLICY_READ,
    Permission.GRC_POLICY_WRITE,
    Permission.GRC_REQUIREMENT_READ,
    Permission.GRC_REQUIREMENT_WRITE,
    Permission.GRC_STATISTICS_READ,
  ],

  /**
   * USER - Read-only access to GRC data (no statistics)
   */
  [UserRole.USER]: [
    Permission.GRC_RISK_READ,
    Permission.GRC_POLICY_READ,
    Permission.GRC_REQUIREMENT_READ,
  ],
};

/**
 * Permission Service
 *
 * Provides role-to-permission mapping and permission checking utilities.
 * This service is the single source of truth for RBAC configuration.
 */
@Injectable()
export class PermissionService {
  /**
   * Get all permissions for a given role
   */
  getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if a role has a specific permission
   */
  roleHasPermission(role: UserRole, permission: Permission): boolean {
    const permissions = this.getPermissionsForRole(role);
    return permissions.includes(permission);
  }

  /**
   * Check if a role has all specified permissions
   */
  roleHasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
    const rolePermissions = this.getPermissionsForRole(role);
    return permissions.every((p) => rolePermissions.includes(p));
  }

  /**
   * Check if a role has any of the specified permissions
   */
  roleHasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
    const rolePermissions = this.getPermissionsForRole(role);
    return permissions.some((p) => rolePermissions.includes(p));
  }

  /**
   * Get the role-to-permission mapping (for documentation/debugging)
   */
  getRolePermissionMatrix(): Record<UserRole, Permission[]> {
    return { ...ROLE_PERMISSIONS };
  }

  /**
   * Get all available permissions
   */
  getAllPermissions(): Permission[] {
    return Object.values(Permission);
  }

  /**
   * Get all roles
   */
  getAllRoles(): UserRole[] {
    return Object.values(UserRole);
  }
}
