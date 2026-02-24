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
    Permission.ITSM_APPROVAL_READ,
    Permission.ITSM_APPROVAL_WRITE,
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
    Permission.PLATFORM_DICTIONARY_READ,
    Permission.PLATFORM_DICTIONARY_WRITE,
    // CMDB permissions
    Permission.CMDB_CI_READ,
    Permission.CMDB_CI_WRITE,
    Permission.CMDB_CLASS_READ,
    Permission.CMDB_CLASS_WRITE,
    Permission.CMDB_REL_READ,
    Permission.CMDB_REL_WRITE,
    // CMDB Service Portfolio permissions
    Permission.CMDB_SERVICE_READ,
    Permission.CMDB_SERVICE_WRITE,
    Permission.CMDB_SERVICE_OFFERING_READ,
    Permission.CMDB_SERVICE_OFFERING_WRITE,
    // CMDB Import & Reconciliation permissions
    Permission.CMDB_IMPORT_READ,
    Permission.CMDB_IMPORT_WRITE,
    // CMDB Health & Quality permissions
    Permission.CMDB_HEALTH_READ,
    Permission.CMDB_HEALTH_WRITE,
    // Notification Engine permissions
    Permission.NOTIFICATION_RULE_READ,
    Permission.NOTIFICATION_RULE_WRITE,
    Permission.NOTIFICATION_TEMPLATE_READ,
    Permission.NOTIFICATION_TEMPLATE_WRITE,
    Permission.NOTIFICATION_DELIVERY_READ,
    Permission.NOTIFICATION_DELIVERY_RETRY,
    // Webhook Endpoint permissions
    Permission.WEBHOOK_ENDPOINT_READ,
    Permission.WEBHOOK_ENDPOINT_WRITE,
    // API Catalog permissions
    Permission.API_CATALOG_READ,
    Permission.API_CATALOG_WRITE,
    Permission.API_KEY_READ,
    Permission.API_KEY_WRITE,
    // ITSM Calendar & Freeze Window permissions
    Permission.ITSM_CALENDAR_READ,
    Permission.ITSM_CALENDAR_WRITE,
    Permission.ITSM_FREEZE_READ,
    Permission.ITSM_FREEZE_WRITE,
    // ITSM Journal permissions
    Permission.ITSM_JOURNAL_READ,
    Permission.ITSM_JOURNAL_WRITE,
    // Customer Risk Catalog permissions
    Permission.GRC_CUSTOMER_RISK_READ,
    Permission.GRC_CUSTOMER_RISK_WRITE,
    Permission.GRC_CUSTOMER_RISK_BIND_READ,
    Permission.GRC_CUSTOMER_RISK_BIND_WRITE,
    Permission.GRC_CUSTOMER_RISK_OBSERVATION_READ,
    Permission.GRC_CUSTOMER_RISK_OBSERVATION_WRITE,
    // ITSM Problem permissions
    Permission.ITSM_PROBLEM_READ,
    Permission.ITSM_PROBLEM_CREATE,
    Permission.ITSM_PROBLEM_UPDATE,
    Permission.ITSM_PROBLEM_LINK_INCIDENT,
    Permission.ITSM_PROBLEM_LINK_CHANGE,
    Permission.ITSM_PROBLEM_RISK_READ,
    // ITSM Known Error permissions
    Permission.ITSM_KNOWN_ERROR_READ,
    Permission.ITSM_KNOWN_ERROR_CREATE,
    Permission.ITSM_KNOWN_ERROR_UPDATE,
    // ITSM CAB permissions
    Permission.ITSM_CAB_READ,
    Permission.ITSM_CAB_WRITE,
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
    Permission.ITSM_APPROVAL_READ,
    Permission.ITSM_APPROVAL_WRITE,
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
    // CMDB permissions
    Permission.CMDB_CI_READ,
    Permission.CMDB_CI_WRITE,
    Permission.CMDB_CLASS_READ,
    Permission.CMDB_CLASS_WRITE,
    Permission.CMDB_REL_READ,
    Permission.CMDB_REL_WRITE,
    // CMDB Service Portfolio permissions
    Permission.CMDB_SERVICE_READ,
    Permission.CMDB_SERVICE_WRITE,
    Permission.CMDB_SERVICE_OFFERING_READ,
    Permission.CMDB_SERVICE_OFFERING_WRITE,
    // CMDB Import read-only for managers
    Permission.CMDB_IMPORT_READ,
    // CMDB Health read-only for managers
    Permission.CMDB_HEALTH_READ,
    // ITSM Calendar & Freeze Window permissions
    Permission.ITSM_CALENDAR_READ,
    Permission.ITSM_CALENDAR_WRITE,
    Permission.ITSM_FREEZE_READ,
    Permission.ITSM_FREEZE_WRITE,
    // ITSM Journal permissions
    Permission.ITSM_JOURNAL_READ,
    Permission.ITSM_JOURNAL_WRITE,
    // Customer Risk Catalog permissions
    Permission.GRC_CUSTOMER_RISK_READ,
    Permission.GRC_CUSTOMER_RISK_WRITE,
    Permission.GRC_CUSTOMER_RISK_BIND_READ,
    Permission.GRC_CUSTOMER_RISK_BIND_WRITE,
    Permission.GRC_CUSTOMER_RISK_OBSERVATION_READ,
    Permission.GRC_CUSTOMER_RISK_OBSERVATION_WRITE,
    // ITSM Problem permissions
    Permission.ITSM_PROBLEM_READ,
    Permission.ITSM_PROBLEM_CREATE,
    Permission.ITSM_PROBLEM_UPDATE,
    Permission.ITSM_PROBLEM_LINK_INCIDENT,
    Permission.ITSM_PROBLEM_LINK_CHANGE,
    Permission.ITSM_PROBLEM_RISK_READ,
    // ITSM Known Error permissions
    Permission.ITSM_KNOWN_ERROR_READ,
    Permission.ITSM_KNOWN_ERROR_CREATE,
    Permission.ITSM_KNOWN_ERROR_UPDATE,
    // ITSM CAB permissions
    Permission.ITSM_CAB_READ,
    Permission.ITSM_CAB_WRITE,
  ],

  /**
   * USER - Read-only access to GRC and ITSM data (no statistics)
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
    Permission.ITSM_APPROVAL_READ,
    Permission.ITSM_SLA_READ,
    Permission.ITSM_WORKFLOW_READ,
    Permission.ITSM_BUSINESS_RULE_READ,
    Permission.ITSM_UI_POLICY_READ,
    Permission.ITSM_CHOICE_READ,
    // CMDB read permissions
    Permission.CMDB_CI_READ,
    Permission.CMDB_CLASS_READ,
    Permission.CMDB_REL_READ,
    // CMDB Service Portfolio read-only
    Permission.CMDB_SERVICE_READ,
    Permission.CMDB_SERVICE_OFFERING_READ,
    // CMDB Import read-only
    Permission.CMDB_IMPORT_READ,
    // CMDB Health read-only
    Permission.CMDB_HEALTH_READ,
    // ITSM Calendar & Freeze Window read-only
    Permission.ITSM_CALENDAR_READ,
    Permission.ITSM_FREEZE_READ,
    // ITSM Journal read-only
    Permission.ITSM_JOURNAL_READ,
    // Customer Risk Catalog read-only
    Permission.GRC_CUSTOMER_RISK_READ,
    Permission.GRC_CUSTOMER_RISK_BIND_READ,
    Permission.GRC_CUSTOMER_RISK_OBSERVATION_READ,
    // ITSM Problem read-only
    Permission.ITSM_PROBLEM_READ,
    Permission.ITSM_PROBLEM_RISK_READ,
    // ITSM Known Error read-only
    Permission.ITSM_KNOWN_ERROR_READ,
    // ITSM CAB read-only
    Permission.ITSM_CAB_READ,
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
