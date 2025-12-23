/**
 * i18n Translation Keys
 * 
 * This file defines translation keys for the Admin Studio.
 * FAZ 2 establishes the i18n foundation without implementing full localization.
 * 
 * Key naming convention:
 * - admin.data_model.* - Data Model Explorer keys
 * - admin.dictionary.* - Dictionary Explorer keys
 * 
 * Note: Dictionary metadata (table names, field names, relationship identifiers)
 * are language-neutral and NOT localized. Only display labels are translatable.
 */

export const ADMIN_DATA_MODEL_KEYS = {
  // Page titles and headers
  title: 'admin.data_model.title',
  subtitle: 'admin.data_model.subtitle',
  
  // Summary cards
  summary: {
    totalTables: 'admin.data_model.summary.total_tables',
    totalRelationships: 'admin.data_model.summary.total_relationships',
    tenantScopedTables: 'admin.data_model.summary.tenant_scoped_tables',
    softDeleteTables: 'admin.data_model.summary.soft_delete_tables',
  },
  
  // Table list
  tableList: {
    searchPlaceholder: 'admin.data_model.table_list.search_placeholder',
    tenantScopedOnly: 'admin.data_model.table_list.tenant_scoped_only',
    withRelationships: 'admin.data_model.table_list.with_relationships',
    tenantScopedTooltip: 'admin.data_model.table_list.tenant_scoped_tooltip',
    softDeleteTooltip: 'admin.data_model.table_list.soft_delete_tooltip',
  },
  
  // Tabs
  tabs: {
    fields: 'admin.data_model.tabs.fields',
    relationships: 'admin.data_model.tabs.relationships',
    visualGraph: 'admin.data_model.tabs.visual_graph',
    dotWalking: 'admin.data_model.tabs.dot_walking',
  },
  
  // Fields table
  fields: {
    title: 'admin.data_model.fields.title',
    name: 'admin.data_model.fields.name',
    type: 'admin.data_model.fields.type',
    column: 'admin.data_model.fields.column',
    required: 'admin.data_model.fields.required',
    primary: 'admin.data_model.fields.primary',
    details: 'admin.data_model.fields.details',
    nullable: 'admin.data_model.fields.nullable',
    generated: 'admin.data_model.fields.generated',
    maxLength: 'admin.data_model.fields.max_length',
    enumValues: 'admin.data_model.fields.enum_values',
    defaultValue: 'admin.data_model.fields.default_value',
    auditFields: 'admin.data_model.fields.audit_fields',
    primaryKeyTooltip: 'admin.data_model.fields.primary_key_tooltip',
  },
  
  // Relationships table
  relationships: {
    title: 'admin.data_model.relationships.title',
    outgoing: 'admin.data_model.relationships.outgoing',
    name: 'admin.data_model.relationships.name',
    type: 'admin.data_model.relationships.type',
    targetTable: 'admin.data_model.relationships.target_table',
    targetField: 'admin.data_model.relationships.target_field',
    nullable: 'admin.data_model.relationships.nullable',
    cascade: 'admin.data_model.relationships.cascade',
    noRelationships: 'admin.data_model.relationships.no_relationships',
  },
  
  // Visual graph
  visualGraph: {
    title: 'admin.data_model.visual_graph.title',
    description: 'admin.data_model.visual_graph.description',
    selectedTableDescription: 'admin.data_model.visual_graph.selected_table_description',
    relatedTables: 'admin.data_model.visual_graph.related_tables',
    relationshipsCount: 'admin.data_model.visual_graph.relationships_count',
    zoomIn: 'admin.data_model.visual_graph.zoom_in',
    zoomOut: 'admin.data_model.visual_graph.zoom_out',
    fitView: 'admin.data_model.visual_graph.fit_view',
    resetView: 'admin.data_model.visual_graph.reset_view',
  },
  
  // Dot-walking
  dotWalking: {
    title: 'admin.data_model.dot_walking.title',
    description: 'admin.data_model.dot_walking.description',
    selectTablePrompt: 'admin.data_model.dot_walking.select_table_prompt',
    noPathsAvailable: 'admin.data_model.dot_walking.no_paths_available',
    path: 'admin.data_model.dot_walking.path',
    reachableTables: 'admin.data_model.dot_walking.reachable_tables',
    depth: 'admin.data_model.dot_walking.depth',
  },
  
  // Actions
  actions: {
    refresh: 'admin.data_model.actions.refresh',
    selectTable: 'admin.data_model.actions.select_table',
  },
  
  // Status messages
  status: {
    loading: 'admin.data_model.status.loading',
    error: 'admin.data_model.status.error',
    noData: 'admin.data_model.status.no_data',
  },
  
  // Common labels
  common: {
    yes: 'admin.data_model.common.yes',
    no: 'admin.data_model.common.no',
  },
} as const;

/**
 * Default English translations for Admin Data Model
 * These serve as fallback values and documentation for translators
 */
export const ADMIN_DATA_MODEL_EN: Record<string, string> = {
  // Page titles and headers
  [ADMIN_DATA_MODEL_KEYS.title]: 'Data Model Explorer',
  [ADMIN_DATA_MODEL_KEYS.subtitle]: 'Explore the platform\'s data model, relationships, and dictionary metadata.',
  
  // Summary cards
  [ADMIN_DATA_MODEL_KEYS.summary.totalTables]: 'Total Tables',
  [ADMIN_DATA_MODEL_KEYS.summary.totalRelationships]: 'Total Relationships',
  [ADMIN_DATA_MODEL_KEYS.summary.tenantScopedTables]: 'Tenant-Scoped Tables',
  [ADMIN_DATA_MODEL_KEYS.summary.softDeleteTables]: 'Soft Delete Tables',
  
  // Table list
  [ADMIN_DATA_MODEL_KEYS.tableList.searchPlaceholder]: 'Search tables...',
  [ADMIN_DATA_MODEL_KEYS.tableList.tenantScopedOnly]: 'Tenant-scoped only',
  [ADMIN_DATA_MODEL_KEYS.tableList.withRelationships]: 'With relationships',
  [ADMIN_DATA_MODEL_KEYS.tableList.tenantScopedTooltip]: 'Tenant-scoped',
  [ADMIN_DATA_MODEL_KEYS.tableList.softDeleteTooltip]: 'Soft delete',
  
  // Tabs
  [ADMIN_DATA_MODEL_KEYS.tabs.fields]: 'Fields',
  [ADMIN_DATA_MODEL_KEYS.tabs.relationships]: 'Relationships',
  [ADMIN_DATA_MODEL_KEYS.tabs.visualGraph]: 'Visual Graph',
  [ADMIN_DATA_MODEL_KEYS.tabs.dotWalking]: 'Dot-Walking',
  
  // Fields table
  [ADMIN_DATA_MODEL_KEYS.fields.title]: 'Fields',
  [ADMIN_DATA_MODEL_KEYS.fields.name]: 'Name',
  [ADMIN_DATA_MODEL_KEYS.fields.type]: 'Type',
  [ADMIN_DATA_MODEL_KEYS.fields.column]: 'Column',
  [ADMIN_DATA_MODEL_KEYS.fields.required]: 'Required',
  [ADMIN_DATA_MODEL_KEYS.fields.primary]: 'Primary',
  [ADMIN_DATA_MODEL_KEYS.fields.details]: 'Details',
  [ADMIN_DATA_MODEL_KEYS.fields.nullable]: 'Nullable',
  [ADMIN_DATA_MODEL_KEYS.fields.generated]: 'Generated',
  [ADMIN_DATA_MODEL_KEYS.fields.maxLength]: 'Max Length',
  [ADMIN_DATA_MODEL_KEYS.fields.enumValues]: 'Enum Values',
  [ADMIN_DATA_MODEL_KEYS.fields.defaultValue]: 'Default',
  [ADMIN_DATA_MODEL_KEYS.fields.auditFields]: 'Audit Fields',
  [ADMIN_DATA_MODEL_KEYS.fields.primaryKeyTooltip]: 'Primary Key',
  
  // Relationships table
  [ADMIN_DATA_MODEL_KEYS.relationships.title]: 'Relationships',
  [ADMIN_DATA_MODEL_KEYS.relationships.outgoing]: 'Outgoing Relationships',
  [ADMIN_DATA_MODEL_KEYS.relationships.name]: 'Name',
  [ADMIN_DATA_MODEL_KEYS.relationships.type]: 'Type',
  [ADMIN_DATA_MODEL_KEYS.relationships.targetTable]: 'Target Table',
  [ADMIN_DATA_MODEL_KEYS.relationships.targetField]: 'Target Field',
  [ADMIN_DATA_MODEL_KEYS.relationships.nullable]: 'Nullable',
  [ADMIN_DATA_MODEL_KEYS.relationships.cascade]: 'Cascade',
  [ADMIN_DATA_MODEL_KEYS.relationships.noRelationships]: 'This table has no relationships defined.',
  
  // Visual graph
  [ADMIN_DATA_MODEL_KEYS.visualGraph.title]: 'Visual Data Model',
  [ADMIN_DATA_MODEL_KEYS.visualGraph.description]: 'Visual representation of the data model.',
  [ADMIN_DATA_MODEL_KEYS.visualGraph.selectedTableDescription]: 'Showing relationships for "{tableName}".',
  [ADMIN_DATA_MODEL_KEYS.visualGraph.relatedTables]: 'Related Tables',
  [ADMIN_DATA_MODEL_KEYS.visualGraph.relationshipsCount]: 'Relationships',
  [ADMIN_DATA_MODEL_KEYS.visualGraph.zoomIn]: 'Zoom In',
  [ADMIN_DATA_MODEL_KEYS.visualGraph.zoomOut]: 'Zoom Out',
  [ADMIN_DATA_MODEL_KEYS.visualGraph.fitView]: 'Fit View',
  [ADMIN_DATA_MODEL_KEYS.visualGraph.resetView]: 'Reset View',
  
  // Dot-walking
  [ADMIN_DATA_MODEL_KEYS.dotWalking.title]: 'Dot-Walking Preview',
  [ADMIN_DATA_MODEL_KEYS.dotWalking.description]: 'Dot-walking paths from "{tableName}". These paths can be used in reporting and workflow configurations to traverse related data.',
  [ADMIN_DATA_MODEL_KEYS.dotWalking.selectTablePrompt]: 'Select a table to see dot-walking paths.',
  [ADMIN_DATA_MODEL_KEYS.dotWalking.noPathsAvailable]: 'No dot-walking paths available from "{tableName}". This table may not have reference relationships.',
  [ADMIN_DATA_MODEL_KEYS.dotWalking.path]: 'Path',
  [ADMIN_DATA_MODEL_KEYS.dotWalking.reachableTables]: 'Reachable Tables',
  [ADMIN_DATA_MODEL_KEYS.dotWalking.depth]: 'Depth',
  
  // Actions
  [ADMIN_DATA_MODEL_KEYS.actions.refresh]: 'Refresh data model cache',
  [ADMIN_DATA_MODEL_KEYS.actions.selectTable]: 'Select a table to view its details',
  
  // Status messages
  [ADMIN_DATA_MODEL_KEYS.status.loading]: 'Loading...',
  [ADMIN_DATA_MODEL_KEYS.status.error]: 'Failed to load data model. Please try again.',
  [ADMIN_DATA_MODEL_KEYS.status.noData]: 'No data available',
  
  // Common labels
  [ADMIN_DATA_MODEL_KEYS.common.yes]: 'Yes',
  [ADMIN_DATA_MODEL_KEYS.common.no]: 'No',
};

/**
 * Admin Security Keys (FAZ 3)
 * Translation keys for security-related Admin Core screens
 */
export const ADMIN_SECURITY_KEYS = {
  // Security Posture
  securityPosture: {
    title: 'admin.security.posture.title',
    subtitle: 'admin.security.posture.subtitle',
  },
  
  // Authentication
  authentication: {
    title: 'admin.security.authentication.title',
    localAuth: 'admin.security.authentication.local_auth',
    mfaAvailable: 'admin.security.authentication.mfa_available',
    ldapEnabled: 'admin.security.authentication.ldap_enabled',
    ldapHost: 'admin.security.authentication.ldap_host',
  },
  
  // MFA Status
  mfa: {
    title: 'admin.security.mfa.title',
    usersWithMfa: 'admin.security.mfa.users_with_mfa',
    enforcedForAdmins: 'admin.security.mfa.enforced_for_admins',
    enforcedForAll: 'admin.security.mfa.enforced_for_all',
    setup: 'admin.security.mfa.setup',
    verify: 'admin.security.mfa.verify',
    disable: 'admin.security.mfa.disable',
    recoveryCodesTitle: 'admin.security.mfa.recovery_codes_title',
    recoveryCodesWarning: 'admin.security.mfa.recovery_codes_warning',
  },
  
  // LDAP Status
  ldap: {
    title: 'admin.security.ldap.title',
    configured: 'admin.security.ldap.configured',
    enabled: 'admin.security.ldap.enabled',
    lastConnectionTest: 'admin.security.ldap.last_connection_test',
    connectionStatus: 'admin.security.ldap.connection_status',
    testConnection: 'admin.security.ldap.test_connection',
  },
  
  // Security Settings
  settings: {
    title: 'admin.security.settings.title',
    passwordPolicy: 'admin.security.settings.password_policy',
    minLength: 'admin.security.settings.min_length',
    requireUppercase: 'admin.security.settings.require_uppercase',
    requireLowercase: 'admin.security.settings.require_lowercase',
    requireNumber: 'admin.security.settings.require_number',
    requireSpecial: 'admin.security.settings.require_special',
    sessionTimeout: 'admin.security.settings.session_timeout',
  },
  
  // Common
  common: {
    enabled: 'admin.security.common.enabled',
    disabled: 'admin.security.common.disabled',
    configured: 'admin.security.common.configured',
    notConfigured: 'admin.security.common.not_configured',
    active: 'admin.security.common.active',
    inactive: 'admin.security.common.inactive',
  },
} as const;

/**
 * Default English translations for Admin Security (FAZ 3)
 */
export const ADMIN_SECURITY_EN: Record<string, string> = {
  // Security Posture
  [ADMIN_SECURITY_KEYS.securityPosture.title]: 'Security Posture',
  [ADMIN_SECURITY_KEYS.securityPosture.subtitle]: 'Overview of authentication modes and security configuration',
  
  // Authentication
  [ADMIN_SECURITY_KEYS.authentication.title]: 'Authentication Modes',
  [ADMIN_SECURITY_KEYS.authentication.localAuth]: 'Local Authentication',
  [ADMIN_SECURITY_KEYS.authentication.mfaAvailable]: 'MFA Available',
  [ADMIN_SECURITY_KEYS.authentication.ldapEnabled]: 'LDAP Enabled',
  [ADMIN_SECURITY_KEYS.authentication.ldapHost]: 'LDAP Host',
  
  // MFA Status
  [ADMIN_SECURITY_KEYS.mfa.title]: 'Multi-Factor Authentication',
  [ADMIN_SECURITY_KEYS.mfa.usersWithMfa]: 'Users with MFA Enabled',
  [ADMIN_SECURITY_KEYS.mfa.enforcedForAdmins]: 'Enforced for Admins',
  [ADMIN_SECURITY_KEYS.mfa.enforcedForAll]: 'Enforced for All Users',
  [ADMIN_SECURITY_KEYS.mfa.setup]: 'Set Up MFA',
  [ADMIN_SECURITY_KEYS.mfa.verify]: 'Verify Code',
  [ADMIN_SECURITY_KEYS.mfa.disable]: 'Disable MFA',
  [ADMIN_SECURITY_KEYS.mfa.recoveryCodesTitle]: 'Recovery Codes',
  [ADMIN_SECURITY_KEYS.mfa.recoveryCodesWarning]: 'Save these codes in a secure location. Each code can only be used once.',
  
  // LDAP Status
  [ADMIN_SECURITY_KEYS.ldap.title]: 'LDAP / Active Directory',
  [ADMIN_SECURITY_KEYS.ldap.configured]: 'LDAP Configured',
  [ADMIN_SECURITY_KEYS.ldap.enabled]: 'LDAP Enabled',
  [ADMIN_SECURITY_KEYS.ldap.lastConnectionTest]: 'Last Connection Test',
  [ADMIN_SECURITY_KEYS.ldap.connectionStatus]: 'Connection Status',
  [ADMIN_SECURITY_KEYS.ldap.testConnection]: 'Test Connection',
  
  // Security Settings
  [ADMIN_SECURITY_KEYS.settings.title]: 'Security Settings',
  [ADMIN_SECURITY_KEYS.settings.passwordPolicy]: 'Password Policy',
  [ADMIN_SECURITY_KEYS.settings.minLength]: 'Minimum Length',
  [ADMIN_SECURITY_KEYS.settings.requireUppercase]: 'Require Uppercase',
  [ADMIN_SECURITY_KEYS.settings.requireLowercase]: 'Require Lowercase',
  [ADMIN_SECURITY_KEYS.settings.requireNumber]: 'Require Number',
  [ADMIN_SECURITY_KEYS.settings.requireSpecial]: 'Require Special Character',
  [ADMIN_SECURITY_KEYS.settings.sessionTimeout]: 'Session Timeout (minutes)',
  
  // Common
  [ADMIN_SECURITY_KEYS.common.enabled]: 'Enabled',
  [ADMIN_SECURITY_KEYS.common.disabled]: 'Disabled',
  [ADMIN_SECURITY_KEYS.common.configured]: 'Configured',
  [ADMIN_SECURITY_KEYS.common.notConfigured]: 'Not Configured',
  [ADMIN_SECURITY_KEYS.common.active]: 'Active',
  [ADMIN_SECURITY_KEYS.common.inactive]: 'Inactive',
};

/**
 * Combined translations for all Admin screens
 */
const ALL_TRANSLATIONS: Record<string, string> = {
  ...ADMIN_DATA_MODEL_EN,
  ...ADMIN_SECURITY_EN,
};

/**
 * Translation function placeholder
 * In FAZ 3+, this will be replaced with a proper i18n library integration
 * For now, it returns the English translation or the key if not found
 */
export function t(key: string, params?: Record<string, string>): string {
  let translation = ALL_TRANSLATIONS[key] || key;
  
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      translation = translation.replace(`{${paramKey}}`, value);
    });
  }
  
  return translation;
}
