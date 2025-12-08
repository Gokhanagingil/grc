/**
 * Permission Enum
 *
 * Defines all granular permissions for the GRC platform.
 * These permissions are mapped to roles via the PermissionService.
 *
 * Naming convention: {MODULE}_{RESOURCE}_{ACTION}
 */
export enum Permission {
  // Risk permissions
  GRC_RISK_READ = 'grc:risk:read',
  GRC_RISK_WRITE = 'grc:risk:write',

  // Policy permissions
  GRC_POLICY_READ = 'grc:policy:read',
  GRC_POLICY_WRITE = 'grc:policy:write',

  // Requirement permissions
  GRC_REQUIREMENT_READ = 'grc:requirement:read',
  GRC_REQUIREMENT_WRITE = 'grc:requirement:write',

  // Statistics permissions (restricted read access)
  GRC_STATISTICS_READ = 'grc:statistics:read',

  // Administrative permissions
  GRC_ADMIN = 'grc:admin',

  // ITSM Incident permissions
  ITSM_INCIDENT_READ = 'itsm:incident:read',
  ITSM_INCIDENT_WRITE = 'itsm:incident:write',

  // ITSM Statistics permissions
  ITSM_STATISTICS_READ = 'itsm:statistics:read',

  // Admin Panel permissions
  ADMIN_USERS_READ = 'admin:users:read',
  ADMIN_USERS_WRITE = 'admin:users:write',
  ADMIN_ROLES_READ = 'admin:roles:read',
  ADMIN_ROLES_WRITE = 'admin:roles:write',
  ADMIN_SETTINGS_READ = 'admin:settings:read',
  ADMIN_SETTINGS_WRITE = 'admin:settings:write',
  ADMIN_TENANTS_READ = 'admin:tenants:read',
  ADMIN_TENANTS_WRITE = 'admin:tenants:write',
}

/**
 * Permission descriptions for documentation and UI
 */
export const PermissionDescriptions: Record<Permission, string> = {
  [Permission.GRC_RISK_READ]: 'View risks and risk details',
  [Permission.GRC_RISK_WRITE]: 'Create, update, and delete risks',
  [Permission.GRC_POLICY_READ]: 'View policies and policy details',
  [Permission.GRC_POLICY_WRITE]: 'Create, update, and delete policies',
  [Permission.GRC_REQUIREMENT_READ]:
    'View requirements and requirement details',
  [Permission.GRC_REQUIREMENT_WRITE]: 'Create, update, and delete requirements',
  [Permission.GRC_STATISTICS_READ]: 'View statistics and analytics dashboards',
  [Permission.GRC_ADMIN]: 'Full administrative access to all GRC features',
  [Permission.ITSM_INCIDENT_READ]: 'View incidents and incident details',
  [Permission.ITSM_INCIDENT_WRITE]: 'Create, update, and delete incidents',
  [Permission.ITSM_STATISTICS_READ]:
    'View ITSM statistics and analytics dashboards',
  [Permission.ADMIN_USERS_READ]: 'View users and user details',
  [Permission.ADMIN_USERS_WRITE]: 'Create, update, and delete users',
  [Permission.ADMIN_ROLES_READ]: 'View roles and role permissions',
  [Permission.ADMIN_ROLES_WRITE]: 'Create, update, and delete roles',
  [Permission.ADMIN_SETTINGS_READ]: 'View system settings',
  [Permission.ADMIN_SETTINGS_WRITE]: 'Modify system settings',
  [Permission.ADMIN_TENANTS_READ]: 'View tenants and tenant details',
  [Permission.ADMIN_TENANTS_WRITE]: 'Create, update, and delete tenants',
};
