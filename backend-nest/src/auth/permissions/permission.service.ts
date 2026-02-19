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
   * ADMIN - Full access to all GRC, ITSM, and Admin features
   */
  [UserRole.ADMIN]: [
    Permission.GRC_RISK_READ,
    Permission.GRC_RISK_WRITE,
    Permission.GRC_POLICY_READ,
    Permission.GRC_POLICY_WRITE,
    Permission.GRC_REQUIREMENT_READ,
    Permission.GRC_REQUIREMENT_WRITE,
    Permission.GRC_AUDIT_READ,
    Permission.GRC_AUDIT_WRITE,
    Permission.GRC_CONTROL_READ,
    Permission.GRC_CONTROL_WRITE,
    Permission.GRC_CONTROL_DELETE,
    Permission.GRC_EVIDENCE_READ,
    Permission.GRC_EVIDENCE_WRITE,
    Permission.GRC_ISSUE_READ,
    Permission.GRC_ISSUE_WRITE,
    Permission.GRC_ISSUE_CLOSE,
    Permission.GRC_CAPA_READ,
    Permission.GRC_CAPA_WRITE,
    Permission.GRC_CAPA_VERIFY,
    Permission.GRC_CAPA_CLOSE,
    Permission.GRC_PROCESS_READ,
    Permission.GRC_PROCESS_WRITE,
    Permission.GRC_PROCESS_DELETE,
    Permission.GRC_STATISTICS_READ,
    Permission.GRC_ADMIN,
    Permission.ITSM_INCIDENT_READ,
    Permission.ITSM_INCIDENT_WRITE,
    Permission.ITSM_SERVICE_READ,
    Permission.ITSM_SERVICE_WRITE,
    Permission.ITSM_CHANGE_READ,
    Permission.ITSM_CHANGE_WRITE,
    Permission.ITSM_SLA_READ,
    Permission.ITSM_SLA_WRITE,
    Permission.ITSM_WORKFLOW_READ,
    Permission.ITSM_WORKFLOW_WRITE,
    Permission.ITSM_BUSINESS_RULE_READ,
    Permission.ITSM_BUSINESS_RULE_WRITE,
    Permission.ITSM_UI_POLICY_READ,
    Permission.ITSM_UI_POLICY_WRITE,
    Permission.ITSM_CHOICE_READ,
    Permission.ITSM_CHOICE_WRITE,
    Permission.ITSM_STATISTICS_READ,
    Permission.ADMIN_USERS_READ,
    Permission.ADMIN_USERS_WRITE,
    Permission.ADMIN_ROLES_READ,
    Permission.ADMIN_ROLES_WRITE,
    Permission.ADMIN_SETTINGS_READ,
    Permission.ADMIN_SETTINGS_WRITE,
    Permission.ADMIN_TENANTS_READ,
    Permission.ADMIN_TENANTS_WRITE,
    // Platform Builder permissions
    Permission.ADMIN_TABLES_READ,
    Permission.ADMIN_TABLES_WRITE,
    Permission.DATA_RECORDS_READ,
    Permission.DATA_RECORDS_WRITE,
  ],

  /**
   * MANAGER - Full GRC and ITSM read/write access, including statistics
   */
  [UserRole.MANAGER]: [
    Permission.GRC_RISK_READ,
    Permission.GRC_RISK_WRITE,
    Permission.GRC_POLICY_READ,
    Permission.GRC_POLICY_WRITE,
    Permission.GRC_REQUIREMENT_READ,
    Permission.GRC_REQUIREMENT_WRITE,
    Permission.GRC_AUDIT_READ,
    Permission.GRC_AUDIT_WRITE,
    Permission.GRC_CONTROL_READ,
    Permission.GRC_CONTROL_WRITE,
    Permission.GRC_EVIDENCE_READ,
    Permission.GRC_EVIDENCE_WRITE,
    Permission.GRC_ISSUE_READ,
    Permission.GRC_ISSUE_WRITE,
    Permission.GRC_CAPA_READ,
    Permission.GRC_CAPA_WRITE,
    Permission.GRC_PROCESS_READ,
    Permission.GRC_PROCESS_WRITE,
    Permission.GRC_STATISTICS_READ,
    Permission.ITSM_INCIDENT_READ,
    Permission.ITSM_INCIDENT_WRITE,
    Permission.ITSM_SERVICE_READ,
    Permission.ITSM_SERVICE_WRITE,
    Permission.ITSM_CHANGE_READ,
    Permission.ITSM_CHANGE_WRITE,
    Permission.ITSM_SLA_READ,
    Permission.ITSM_SLA_WRITE,
    Permission.ITSM_WORKFLOW_READ,
    Permission.ITSM_WORKFLOW_WRITE,
    Permission.ITSM_BUSINESS_RULE_READ,
    Permission.ITSM_BUSINESS_RULE_WRITE,
    Permission.ITSM_UI_POLICY_READ,
    Permission.ITSM_UI_POLICY_WRITE,
    Permission.ITSM_CHOICE_READ,
    Permission.ITSM_CHOICE_WRITE,
    Permission.ITSM_STATISTICS_READ,
  ],

  /**
   * USER - Read-only accessto GRC and ITSM data (no statistics)
   */
  [UserRole.USER]: [
    Permission.GRC_RISK_READ,
    Permission.GRC_POLICY_READ,
    Permission.GRC_REQUIREMENT_READ,
    Permission.GRC_AUDIT_READ,
    Permission.GRC_CONTROL_READ,
    Permission.GRC_EVIDENCE_READ,
    Permission.GRC_ISSUE_READ,
    Permission.GRC_CAPA_READ,
    Permission.GRC_PROCESS_READ,
    Permission.ITSM_INCIDENT_READ,
    Permission.ITSM_SERVICE_READ,
    Permission.ITSM_CHANGE_READ,
    Permission.ITSM_SLA_READ,
    Permission.ITSM_WORKFLOW_READ,
    Permission.ITSM_BUSINESS_RULE_READ,
    Permission.ITSM_UI_POLICY_READ,
    Permission.ITSM_CHOICE_READ,
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
