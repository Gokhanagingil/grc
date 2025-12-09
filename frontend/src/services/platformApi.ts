/**
 * Platform API Service
 * 
 * Provides API calls for Platform Core Phase 2 features:
 * - ACL (Access Control List)
 * - Form Layouts
 * - UI Policies
 * - Modules
 * - Search (DSL-based queries)
 */

import { api } from './api';

// Types for ACL
export interface Permission {
  id: number;
  key: string;
  name: string;
  description: string;
  module: string;
}

export interface AclRule {
  id: number;
  name: string;
  table_name: string;
  effect: 'allow' | 'deny';
  conditions: Record<string, unknown> | null;
  fields: string[] | null;
  actions: string[];
  priority: number;
  is_active: boolean;
}

export interface AclEvaluationResult {
  allowed: boolean;
  deniedFields: string[];
  maskedFields: string[];
}

// Types for Form Layouts
export interface FormLayoutSection {
  title: string;
  fields: string[];
}

export interface FormLayoutConfig {
  sections: FormLayoutSection[];
  hiddenFields: string[];
  readonlyFields: string[];
}

export interface FormLayout {
  id: number;
  table_name: string;
  role: string;
  layout_json: FormLayoutConfig;
  is_active: boolean;
}

// Types for UI Policies
export interface UiPolicyCondition {
  field?: string;
  operator?: string;
  value?: unknown;
  role?: string | string[];
  always?: boolean;
  and?: UiPolicyCondition[];
  or?: UiPolicyCondition[];
  not?: UiPolicyCondition;
}

export interface UiPolicyAction {
  type: 'hide' | 'show' | 'readonly' | 'editable' | 'mandatory' | 'optional' | 'disable';
  fields: string[];
}

export interface UiPolicy {
  id: number;
  name: string;
  table_name: string;
  condition: UiPolicyCondition;
  actions: UiPolicyAction[];
  priority: number;
  is_active: boolean;
}

export interface UiPolicyActions {
  hiddenFields: string[];
  shownFields: string[];
  readonlyFields: string[];
  editableFields: string[];
  mandatoryFields: string[];
  optionalFields: string[];
  disabledFields: string[];
}

// Types for Modules
export interface ModuleDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
}

export interface ModuleStatus extends ModuleDefinition {
  status: 'enabled' | 'disabled' | 'not_configured';
  config: Record<string, unknown> | null;
  tenant_id: string;
}

export interface MenuItem {
  moduleKey: string;
  path: string;
  icon: string;
  label: string;
}

// Types for Search/DSL
export interface SearchFilter {
  field?: string;
  operator?: string;
  value?: unknown;
  and?: SearchFilter[];
  or?: SearchFilter[];
  not?: SearchFilter;
}

export interface SearchSort {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface SearchQuery {
  filter?: SearchFilter;
  sort?: SearchSort | SearchSort[];
  page?: number;
  limit?: number;
}

export interface SearchResult<T> {
  records: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface FieldMetadata {
  type: string;
  label: string;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  values?: string[];
}

// ACL API
export const aclApi = {
  getPermissions: () => api.get<{ permissions: Permission[] }>('/platform/acl/permissions'),
  
  getRolePermissions: (role: string) => 
    api.get<{ role: string; permissions: string[] }>(`/platform/acl/permissions/role/${role}`),
  
  assignPermission: (role: string, permissionKey: string) =>
    api.post(`/platform/acl/permissions/role/${role}`, { permissionKey }),
  
  removePermission: (role: string, permissionKey: string) =>
    api.delete(`/platform/acl/permissions/role/${role}/${permissionKey}`),
  
  getAclRules: () => api.get<{ rules: AclRule[] }>('/platform/acl/rules'),
  
  getTableAclRules: (tableName: string) =>
    api.get<{ tableName: string; rules: AclRule[] }>(`/platform/acl/rules/table/${tableName}`),
  
  createAclRule: (rule: Omit<AclRule, 'id' | 'is_active'>) =>
    api.post<{ message: string; rule: AclRule }>('/platform/acl/rules', rule),
  
  updateAclRule: (id: number, updates: Partial<AclRule>) =>
    api.put(`/platform/acl/rules/${id}`, updates),
  
  deleteAclRule: (id: number) => api.delete(`/platform/acl/rules/${id}`),
  
  evaluate: (action: string, tableName: string, record?: Record<string, unknown>, fieldName?: string) =>
    api.post<AclEvaluationResult>('/platform/acl/evaluate', { action, tableName, record, fieldName }),
  
  getMyPermissions: () => api.get<{ role: string; permissions: string[] }>('/platform/acl/my-permissions'),
};

// Form Layout API
export const formLayoutApi = {
  getAll: () => api.get<{ layouts: FormLayout[] }>('/platform/form-layouts'),
  
  getTables: () => api.get<{ tables: string[] }>('/platform/form-layouts/tables'),
  
  getForTable: (tableName: string) =>
    api.get<{ tableName: string; layouts: FormLayout[] }>(`/platform/form-layouts/table/${tableName}`),
  
  resolve: (tableName: string) =>
    api.get<{ tableName: string; role: string; layout: FormLayoutConfig; isDefault: boolean }>(
      `/platform/form-layouts/resolve/${tableName}`
    ),
  
  getDefault: (tableName: string) =>
    api.get<{ tableName: string; layout: FormLayoutConfig }>(`/platform/form-layouts/default/${tableName}`),
  
  create: (layout: { table_name: string; role: string; layout_json: FormLayoutConfig }) =>
    api.post<{ message: string; layout: FormLayout }>('/platform/form-layouts', layout),
  
  update: (id: number, updates: Partial<FormLayout>) =>
    api.put(`/platform/form-layouts/${id}`, updates),
  
  delete: (id: number) => api.delete(`/platform/form-layouts/${id}`),
  
  apply: (tableName: string, formData: Record<string, unknown>, mode?: 'view' | 'edit') =>
    api.post<{ sections: FormLayoutSection[]; hiddenFields: string[]; readonlyFields: string[]; data: Record<string, unknown> }>(
      '/platform/form-layouts/apply',
      { tableName, formData, mode }
    ),
};

// UI Policy API
export const uiPolicyApi = {
  getAll: () => api.get<{ policies: UiPolicy[] }>('/platform/ui-policies'),
  
  getTables: () => api.get<{ tables: string[] }>('/platform/ui-policies/tables'),
  
  getForTable: (tableName: string) =>
    api.get<{ tableName: string; policies: UiPolicy[] }>(`/platform/ui-policies/table/${tableName}`),
  
  getById: (id: number) => api.get<{ policy: UiPolicy }>(`/platform/ui-policies/${id}`),
  
  create: (policy: Omit<UiPolicy, 'id' | 'is_active'>) =>
    api.post<{ message: string; policy: UiPolicy }>('/platform/ui-policies', policy),
  
  update: (id: number, updates: Partial<UiPolicy>) =>
    api.put(`/platform/ui-policies/${id}`, updates),
  
  delete: (id: number) => api.delete(`/platform/ui-policies/${id}`),
  
  evaluate: (tableName: string, formData?: Record<string, unknown>) =>
    api.post<{ tableName: string; actions: UiPolicyActions }>('/platform/ui-policies/evaluate', { tableName, formData }),
  
  test: (condition: UiPolicyCondition, formData?: Record<string, unknown>) =>
    api.post<{ condition: UiPolicyCondition; formData: Record<string, unknown>; result: boolean; message: string }>(
      '/platform/ui-policies/test',
      { condition, formData }
    ),
};

// Module API
export const moduleApi = {
  getAvailable: () => api.get<{ modules: ModuleDefinition[] }>('/platform/modules/available'),
  
  getEnabled: () => api.get<{ tenantId: string; enabledModules: string[] }>('/platform/modules/enabled'),
  
  getStatus: () => api.get<{ tenantId: string; modules: ModuleStatus[] }>('/platform/modules/status'),
  
  check: (moduleKey: string) =>
    api.get<{ tenantId: string; moduleKey: string; isEnabled: boolean; module: ModuleDefinition }>(
      `/platform/modules/check/${moduleKey}`
    ),
  
  getMenu: () => api.get<{ tenantId: string; menuItems: MenuItem[] }>('/platform/modules/menu'),
  
  getByCategory: (category: string) =>
    api.get<{ category: string; modules: ModuleDefinition[] }>(`/platform/modules/category/${category}`),
  
  enable: (moduleKey: string, config?: Record<string, unknown>) =>
    api.post(`/platform/modules/${moduleKey}/enable`, { config }),
  
  disable: (moduleKey: string) => api.post(`/platform/modules/${moduleKey}/disable`),
  
  updateConfig: (moduleKey: string, config: Record<string, unknown>) =>
    api.put(`/platform/modules/${moduleKey}/config`, { config }),
  
  getConfig: (moduleKey: string) =>
    api.get<{ tenantId: string; moduleKey: string; config: Record<string, unknown> | null }>(
      `/platform/modules/${moduleKey}/config`
    ),
  
  initialize: (tenantId: string, enabledModules?: string[]) =>
    api.post('/platform/modules/initialize', { tenantId, enabledModules }),
};

// Search API
export const searchApi = {
  search: <T>(tableName: string, query: SearchQuery) =>
    api.post<SearchResult<T>>(`/platform/search/${tableName}`, query),
  
  getMetadata: (tableName: string) =>
    api.get<{ tableName: string; fields: Record<string, FieldMetadata> }>(`/platform/search/${tableName}/metadata`),
  
  getDistinctValues: (tableName: string, fieldName: string) =>
    api.get<{ tableName: string; fieldName: string; values: unknown[] }>(
      `/platform/search/${tableName}/distinct/${fieldName}`
    ),
  
  getTables: () =>
    api.get<{ tables: Array<{ name: string; metadata: Record<string, FieldMetadata> }> }>('/platform/search/tables'),
  
  validate: (query: SearchQuery) =>
    api.post<{ valid: boolean; errors: string[] }>('/platform/search/validate', query),
};

const platformApi = {
  acl: aclApi,
  formLayout: formLayoutApi,
  uiPolicy: uiPolicyApi,
  module: moduleApi,
  search: searchApi,
};

export default platformApi;
