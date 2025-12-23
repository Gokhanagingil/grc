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
 * Translation function placeholder
 * In FAZ 3+, this will be replaced with a proper i18n library integration
 * For now, it returns the English translation or the key if not found
 */
export function t(key: string, params?: Record<string, string>): string {
  let translation = ADMIN_DATA_MODEL_EN[key] || key;
  
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      translation = translation.replace(`{${paramKey}}`, value);
    });
  }
  
  return translation;
}
