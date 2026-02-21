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

  // ITSM Service permissions
  ITSM_SERVICE_READ = 'itsm:service:read',
  ITSM_SERVICE_WRITE = 'itsm:service:write',

  // ITSM Change permissions
  ITSM_CHANGE_READ = 'itsm:change:read',
  ITSM_CHANGE_WRITE = 'itsm:change:write',

  // ITSM SLA permissions
  ITSM_SLA_READ = 'itsm:sla:read',
  ITSM_SLA_WRITE = 'itsm:sla:write',

  // ITSM Workflow permissions
  ITSM_WORKFLOW_READ = 'itsm:workflow:read',
  ITSM_WORKFLOW_WRITE = 'itsm:workflow:write',

  // ITSM Business Rule permissions
  ITSM_BUSINESS_RULE_READ = 'itsm:business_rule:read',
  ITSM_BUSINESS_RULE_WRITE = 'itsm:business_rule:write',

  // ITSM UI Policy permissions
  ITSM_UI_POLICY_READ = 'itsm:ui_policy:read',
  ITSM_UI_POLICY_WRITE = 'itsm:ui_policy:write',

  // ITSM Choice permissions
  ITSM_CHOICE_READ = 'itsm:choice:read',
  ITSM_CHOICE_WRITE = 'itsm:choice:write',

  // ITSM Journal permissions
  ITSM_JOURNAL_READ = 'itsm:journal:read',
  ITSM_JOURNAL_WRITE = 'itsm:journal:write',

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

  // Platform Dictionary permissions (fields, relationships, indexes)
  PLATFORM_DICTIONARY_READ = 'platform:dictionary:read',
  PLATFORM_DICTIONARY_WRITE = 'platform:dictionary:write',

  // Notification Engine permissions
  NOTIFICATION_RULE_READ = 'notification:rule:read',
  NOTIFICATION_RULE_WRITE = 'notification:rule:write',
  NOTIFICATION_TEMPLATE_READ = 'notification:template:read',
  NOTIFICATION_TEMPLATE_WRITE = 'notification:template:write',
  NOTIFICATION_DELIVERY_READ = 'notification:delivery:read',
  NOTIFICATION_DELIVERY_RETRY = 'notification:delivery:retry',

  // Webhook Endpoint permissions
  WEBHOOK_ENDPOINT_READ = 'webhook:endpoint:read',
  WEBHOOK_ENDPOINT_WRITE = 'webhook:endpoint:write',

  // API Catalog permissions
  API_CATALOG_READ = 'api_catalog:read',
  API_CATALOG_WRITE = 'api_catalog:write',
  API_KEY_READ = 'api_key:read',
  API_KEY_WRITE = 'api_key:write',

  // CMDB permissions
  CMDB_CI_READ = 'cmdb:ci:read',
  CMDB_CI_WRITE = 'cmdb:ci:write',
  CMDB_CLASS_READ = 'cmdb:class:read',
  CMDB_CLASS_WRITE = 'cmdb:class:write',
  CMDB_REL_READ = 'cmdb:rel:read',
  CMDB_REL_WRITE = 'cmdb:rel:write',

  // CMDB Service Portfolio permissions
  CMDB_SERVICE_READ = 'cmdb:service:read',
  CMDB_SERVICE_WRITE = 'cmdb:service:write',
  CMDB_SERVICE_OFFERING_READ = 'cmdb:service_offering:read',
  CMDB_SERVICE_OFFERING_WRITE = 'cmdb:service_offering:write',

  // CMDB Import & Reconciliation permissions
  CMDB_IMPORT_READ = 'cmdb:import:read',
  CMDB_IMPORT_WRITE = 'cmdb:import:write',

  // CMDB Health & Quality permissions
  CMDB_HEALTH_READ = 'cmdb:health:read',
  CMDB_HEALTH_WRITE = 'cmdb:health:write',

  // ITSM Calendar permissions
  ITSM_CALENDAR_READ = 'itsm:calendar:read',
  ITSM_CALENDAR_WRITE = 'itsm:calendar:write',

  // ITSM Freeze Window permissions
  ITSM_FREEZE_READ = 'itsm:freeze:read',
  ITSM_FREEZE_WRITE = 'itsm:freeze:write',

  // ITSM Approval permissions
  ITSM_APPROVAL_READ = 'itsm:approval:read',
  ITSM_APPROVAL_WRITE = 'itsm:approval:write',

  // ITSM Problem permissions
  ITSM_PROBLEM_READ = 'itsm:problem:read',
  ITSM_PROBLEM_CREATE = 'itsm:problem:create',
  ITSM_PROBLEM_UPDATE = 'itsm:problem:update',
  ITSM_PROBLEM_LINK_INCIDENT = 'itsm:problem:link_incident',
  ITSM_PROBLEM_LINK_CHANGE = 'itsm:problem:link_change',
  ITSM_PROBLEM_RISK_READ = 'itsm:problem:risk_read',

  // Customer Risk Catalog permissions
  GRC_CUSTOMER_RISK_READ = 'grc:customer_risk:read',
  GRC_CUSTOMER_RISK_WRITE = 'grc:customer_risk:write',
  GRC_CUSTOMER_RISK_BIND_READ = 'grc:customer_risk_bind:read',
  GRC_CUSTOMER_RISK_BIND_WRITE = 'grc:customer_risk_bind:write',
  GRC_CUSTOMER_RISK_OBSERVATION_READ = 'grc:customer_risk_observation:read',
  GRC_CUSTOMER_RISK_OBSERVATION_WRITE = 'grc:customer_risk_observation:write',
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
  [Permission.ITSM_SERVICE_READ]: 'View ITSM services and service details',
  [Permission.ITSM_SERVICE_WRITE]: 'Create, update, and delete ITSM services',
  [Permission.ITSM_CHANGE_READ]: 'View ITSM changes and change details',
  [Permission.ITSM_CHANGE_WRITE]: 'Create, update, and delete ITSM changes',
  [Permission.ITSM_SLA_READ]: 'View SLA definitions and instances',
  [Permission.ITSM_SLA_WRITE]: 'Create, update, and delete SLA definitions',
  [Permission.ITSM_WORKFLOW_READ]: 'View workflow definitions and transitions',
  [Permission.ITSM_WORKFLOW_WRITE]:
    'Create, update, and delete workflow definitions',
  [Permission.ITSM_BUSINESS_RULE_READ]: 'View business rules',
  [Permission.ITSM_BUSINESS_RULE_WRITE]:
    'Create, update, and delete business rules',
  [Permission.ITSM_UI_POLICY_READ]: 'View UI policies and UI actions',
  [Permission.ITSM_UI_POLICY_WRITE]:
    'Create, update, and delete UI policies and actions',
  [Permission.ITSM_CHOICE_READ]: 'View choice definitions for ITSM tables',
  [Permission.ITSM_CHOICE_WRITE]:
    'Create, update, and deactivate choice definitions',
  [Permission.ITSM_JOURNAL_READ]:
    'View journal entries (work notes and comments)',
  [Permission.ITSM_JOURNAL_WRITE]:
    'Create journal entries (work notes and comments)',
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
  [Permission.PLATFORM_DICTIONARY_READ]:
    'View field, relationship, and index definitions',
  [Permission.PLATFORM_DICTIONARY_WRITE]:
    'Create, update, and delete field, relationship, and index definitions',
  [Permission.NOTIFICATION_RULE_READ]: 'View notification rules',
  [Permission.NOTIFICATION_RULE_WRITE]:
    'Create, update, and delete notification rules',
  [Permission.NOTIFICATION_TEMPLATE_READ]: 'View notification templates',
  [Permission.NOTIFICATION_TEMPLATE_WRITE]:
    'Create, update, and delete notification templates',
  [Permission.NOTIFICATION_DELIVERY_READ]: 'View notification delivery logs',
  [Permission.NOTIFICATION_DELIVERY_RETRY]:
    'Retry failed notification deliveries',
  [Permission.WEBHOOK_ENDPOINT_READ]: 'View webhook endpoints',
  [Permission.WEBHOOK_ENDPOINT_WRITE]:
    'Create, update, and delete webhook endpoints',
  [Permission.API_CATALOG_READ]: 'View published APIs',
  [Permission.API_CATALOG_WRITE]: 'Create, update, and delete published APIs',
  [Permission.API_KEY_READ]: 'View API keys',
  [Permission.API_KEY_WRITE]: 'Create, rotate, and revoke API keys',
  [Permission.CMDB_CI_READ]: 'View CMDB configuration items',
  [Permission.CMDB_CI_WRITE]:
    'Create, update, and delete CMDB configuration items',
  [Permission.CMDB_CLASS_READ]: 'View CMDB CI classes',
  [Permission.CMDB_CLASS_WRITE]: 'Create, update, and delete CMDB CI classes',
  [Permission.CMDB_REL_READ]: 'View CMDB CI relationships',
  [Permission.CMDB_REL_WRITE]:
    'Create, update, and delete CMDB CI relationships',
  [Permission.CMDB_SERVICE_READ]: 'View CMDB services',
  [Permission.CMDB_SERVICE_WRITE]: 'Create, update, and delete CMDB services',
  [Permission.CMDB_SERVICE_OFFERING_READ]: 'View CMDB service offerings',
  [Permission.CMDB_SERVICE_OFFERING_WRITE]:
    'Create, update, and delete CMDB service offerings',
  [Permission.CMDB_IMPORT_READ]:
    'View CMDB import jobs and reconciliation results',
  [Permission.CMDB_IMPORT_WRITE]:
    'Create import jobs, manage import sources, configure reconcile rules, and apply imports',
  [Permission.CMDB_HEALTH_READ]:
    'View CMDB health rules, findings, and quality scores',
  [Permission.CMDB_HEALTH_WRITE]:
    'Create, update, and delete health rules; waive findings; trigger evaluations',
  [Permission.ITSM_CALENDAR_READ]:
    'View change calendar events and conflict details',
  [Permission.ITSM_CALENDAR_WRITE]:
    'Create, update, and delete change calendar events',
  [Permission.ITSM_FREEZE_READ]: 'View freeze windows',
  [Permission.ITSM_FREEZE_WRITE]: 'Create, update, and delete freeze windows',
  [Permission.ITSM_APPROVAL_READ]: 'View change approval requests',
  [Permission.ITSM_APPROVAL_WRITE]:
    'Approve or reject change approval requests',
  [Permission.GRC_CUSTOMER_RISK_READ]: 'View customer risk catalog entries',
  [Permission.GRC_CUSTOMER_RISK_WRITE]:
    'Create, update, and delete customer risk catalog entries',
  [Permission.GRC_CUSTOMER_RISK_BIND_READ]:
    'View customer risk bindings to CIs, services, and offerings',
  [Permission.GRC_CUSTOMER_RISK_BIND_WRITE]:
    'Create and delete customer risk bindings',
  [Permission.GRC_CUSTOMER_RISK_OBSERVATION_READ]:
    'View customer risk observations and signals',
  [Permission.GRC_CUSTOMER_RISK_OBSERVATION_WRITE]:
    'Create and manage customer risk observations',
  [Permission.ITSM_PROBLEM_READ]: 'View problems and problem details',
  [Permission.ITSM_PROBLEM_CREATE]: 'Create new problems',
  [Permission.ITSM_PROBLEM_UPDATE]: 'Update existing problems',
  [Permission.ITSM_PROBLEM_LINK_INCIDENT]:
    'Link and unlink incidents to problems',
  [Permission.ITSM_PROBLEM_LINK_CHANGE]: 'Link and unlink changes to problems',
  [Permission.ITSM_PROBLEM_RISK_READ]:
    'View problem preventive risk intelligence',
};
