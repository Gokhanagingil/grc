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

  // Audit permissions
  GRC_AUDIT_READ = 'grc:audit:read',
  GRC_AUDIT_WRITE = 'grc:audit:write',

  // Control permissions (for GrcControl and ProcessControl)
  GRC_CONTROL_READ = 'grc:control:read',
  GRC_CONTROL_WRITE = 'grc:control:write',
  GRC_CONTROL_DELETE = 'grc:control:delete',

  // Evidence permissions
  GRC_EVIDENCE_READ = 'grc:evidence:read',
  GRC_EVIDENCE_WRITE = 'grc:evidence:write',

  // Issue permissions
  GRC_ISSUE_READ = 'grc:issue:read',
  GRC_ISSUE_WRITE = 'grc:issue:write',
  GRC_ISSUE_CLOSE = 'grc:issue:close',

  // CAPA permissions
  GRC_CAPA_READ = 'grc:capa:read',
  GRC_CAPA_WRITE = 'grc:capa:write',
  GRC_CAPA_VERIFY = 'grc:capa:verify',
  GRC_CAPA_CLOSE = 'grc:capa:close',

  // Process permissions (Sprint 5)
  GRC_PROCESS_READ = 'grc:process:read',
  GRC_PROCESS_WRITE = 'grc:process:write',
  GRC_PROCESS_DELETE = 'grc:process:delete',

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

  // Platform Builder permissions
  ADMIN_TABLES_READ = 'admin:tables:read',
  ADMIN_TABLES_WRITE = 'admin:tables:write',
  DATA_RECORDS_READ = 'data:records:read',
  DATA_RECORDS_WRITE = 'data:records:write',
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
  [Permission.GRC_AUDIT_READ]: 'View audits and audit details',
  [Permission.GRC_AUDIT_WRITE]: 'Create, update, and delete audits',
  [Permission.GRC_CONTROL_READ]: 'View controls and control details',
  [Permission.GRC_CONTROL_WRITE]: 'Create and update controls',
  [Permission.GRC_CONTROL_DELETE]: 'Delete controls',
  [Permission.GRC_EVIDENCE_READ]: 'View evidence and evidence details',
  [Permission.GRC_EVIDENCE_WRITE]: 'Create, update, and delete evidence',
  [Permission.GRC_ISSUE_READ]: 'View issues and issue details',
  [Permission.GRC_ISSUE_WRITE]: 'Create and update issues',
  [Permission.GRC_ISSUE_CLOSE]: 'Close issues',
  [Permission.GRC_CAPA_READ]: 'View CAPAs and CAPA details',
  [Permission.GRC_CAPA_WRITE]: 'Create and update CAPAs',
  [Permission.GRC_CAPA_VERIFY]: 'Verify CAPAs',
  [Permission.GRC_CAPA_CLOSE]: 'Close CAPAs',
  [Permission.GRC_PROCESS_READ]:
    'View processes, controls, results, and violations',
  [Permission.GRC_PROCESS_WRITE]:
    'Create and update processes, controls, and results',
  [Permission.GRC_PROCESS_DELETE]: 'Delete processes',
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
  [Permission.ADMIN_TABLES_READ]: 'View dynamic table definitions',
  [Permission.ADMIN_TABLES_WRITE]:
    'Create, update, and delete dynamic table definitions',
  [Permission.DATA_RECORDS_READ]: 'View dynamic table records',
  [Permission.DATA_RECORDS_WRITE]:
    'Create, update, and delete dynamic table records',
};
