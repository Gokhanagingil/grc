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
}

/**
 * Permission descriptions for documentation and UI
 */
export const PermissionDescriptions: Record<Permission, string> = {
  [Permission.GRC_RISK_READ]: 'View risks and risk details',
  [Permission.GRC_RISK_WRITE]: 'Create, update, and delete risks',
  [Permission.GRC_POLICY_READ]: 'View policies and policy details',
  [Permission.GRC_POLICY_WRITE]: 'Create, update, and delete policies',
  [Permission.GRC_REQUIREMENT_READ]: 'View requirements and requirement details',
  [Permission.GRC_REQUIREMENT_WRITE]: 'Create, update, and delete requirements',
  [Permission.GRC_STATISTICS_READ]: 'View statistics and analytics dashboards',
  [Permission.GRC_ADMIN]: 'Full administrative access to all GRC features',
};
