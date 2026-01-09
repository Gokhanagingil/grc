/**
 * GRC API Client
 * 
 * Centralized API client layer for all GRC/ITSM domain operations.
 * This module provides typed API endpoints and handles the path mapping
 * between frontend and NestJS backend.
 * 
 * All endpoints are defined here to avoid hardcoding paths in multiple components.
 */

import { api } from './api';
import { AxiosRequestConfig } from 'axios';

// ============================================================================
// API Endpoint Paths
// ============================================================================

/**
 * NestJS backend endpoint paths
 * These paths are relative to the API base URL
 */
export const API_PATHS = {
  // Auth endpoints (Express backend at /api/auth)
  AUTH: {
    LOGIN: '/auth/login',
    ME: '/auth/me', // Express backend uses /auth/me
    REFRESH: '/auth/refresh',
    REGISTER: '/auth/register',
  },

  // GRC Risk endpoints (NestJS backend at /grc/risks)
  GRC_RISKS: {
    LIST: '/grc/risks',
    CREATE: '/grc/risks',
    GET: (id: string) => `/grc/risks/${id}`,
    UPDATE: (id: string) => `/grc/risks/${id}`,
    DELETE: (id: string) => `/grc/risks/${id}`,
    SUMMARY: '/grc/risks/summary',
    STATISTICS: '/grc/risks/statistics',
    HIGH_SEVERITY: '/grc/risks/high-severity',
    CONTROLS: (id: string) => `/grc/risks/${id}/controls`,
    POLICIES: (id: string) => `/grc/risks/${id}/policies`,
    REQUIREMENTS: (id: string) => `/grc/risks/${id}/requirements`,
  },

  // GRC Policy endpoints (NestJS backend at /grc/policies)
  GRC_POLICIES: {
    LIST: '/grc/policies',
    CREATE: '/grc/policies',
    GET: (id: string) => `/grc/policies/${id}`,
    UPDATE: (id: string) => `/grc/policies/${id}`,
    DELETE: (id: string) => `/grc/policies/${id}`,
    SUMMARY: '/grc/policies/summary',
    STATISTICS: '/grc/policies/statistics',
    ACTIVE: '/grc/policies/active',
    DUE_FOR_REVIEW: '/grc/policies/due-for-review',
    CONTROLS: (id: string) => `/grc/policies/${id}/controls`,
    RISKS: (id: string) => `/grc/policies/${id}/risks`,
    // Policy Version endpoints
    VERSIONS: {
      LIST: (policyId: string) => `/grc/policies/${policyId}/versions`,
      GET: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}`,
      CREATE: (policyId: string) => `/grc/policies/${policyId}/versions`,
      UPDATE: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}`,
      LATEST: (policyId: string) => `/grc/policies/${policyId}/versions/latest`,
      PUBLISHED: (policyId: string) => `/grc/policies/${policyId}/versions/published`,
      SUBMIT_FOR_REVIEW: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}/submit-for-review`,
      APPROVE: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}/approve`,
      PUBLISH: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}/publish`,
      RETIRE: (policyId: string, versionId: string) => `/grc/policies/${policyId}/versions/${versionId}/retire`,
    },
  },

  // Audit Report Template endpoints
  AUDIT_REPORT_TEMPLATES: {
    LIST: '/audit-report-templates',
    GET: (id: string) => `/audit-report-templates/${id}`,
    CREATE: '/audit-report-templates',
    UPDATE: (id: string) => `/audit-report-templates/${id}`,
    DELETE: (id: string) => `/audit-report-templates/${id}`,
    RENDER: (id: string) => `/audit-report-templates/${id}/render`,
    PREVIEW: '/audit-report-templates/preview',
    VALIDATE: '/audit-report-templates/validate',
    PLACEHOLDERS: (id: string) => `/audit-report-templates/${id}/placeholders`,
  },

  // Search endpoints
  SEARCH: {
    GENERIC: '/grc/search',
    RISKS: '/grc/search/risks',
    POLICIES: '/grc/search/policies',
    REQUIREMENTS: '/grc/search/requirements',
  },

  // Metadata endpoints
  METADATA: {
    FIELDS: {
      LIST: '/metadata/fields',
      GET: (id: string) => `/metadata/fields/${id}`,
      CREATE: '/metadata/fields',
      UPDATE: (id: string) => `/metadata/fields/${id}`,
      DELETE: (id: string) => `/metadata/fields/${id}`,
      TABLES: '/metadata/fields/tables',
      TAGS: (id: string) => `/metadata/fields/${id}/tags`,
      ASSIGN_TAG: (id: string) => `/metadata/fields/${id}/tags`,
      REMOVE_TAG: (id: string, tagId: string) => `/metadata/fields/${id}/tags/${tagId}`,
    },
    TAGS: {
      LIST: '/metadata/tags',
      GET: (id: string) => `/metadata/tags/${id}`,
      CREATE: '/metadata/tags',
      UPDATE: (id: string) => `/metadata/tags/${id}`,
      DELETE: (id: string) => `/metadata/tags/${id}`,
      FIELDS: (id: string) => `/metadata/tags/${id}/fields`,
    },
    SEED: '/metadata/seed',
  },

  // GRC Requirement endpoints (Compliance)
  GRC_REQUIREMENTS: {
    LIST: '/grc/requirements',
    CREATE: '/grc/requirements',
    GET: (id: string) => `/grc/requirements/${id}`,
    UPDATE: (id: string) => `/grc/requirements/${id}`,
    DELETE: (id: string) => `/grc/requirements/${id}`,
    SUMMARY: '/grc/requirements/summary',
    STATISTICS: '/grc/requirements/statistics',
    FRAMEWORKS: '/grc/requirements/frameworks',
    CONTROLS: (id: string) => `/grc/requirements/${id}/controls`,
    RISKS: (id: string) => `/grc/requirements/${id}/risks`,
  },

  // GRC Control endpoints (Unified Control Library)
  GRC_CONTROLS: {
    LIST: '/grc/controls',
    GET: (id: string) => `/grc/controls/${id}`,
    PROCESSES: (id: string) => `/grc/controls/${id}/processes`,
    LINK_PROCESS: (controlId: string, processId: string) => `/grc/controls/${controlId}/processes/${processId}`,
    UNLINK_PROCESS: (controlId: string, processId: string) => `/grc/controls/${controlId}/processes/${processId}`,
  },

  // GRC Coverage endpoints (Unified Control Library)
  GRC_COVERAGE: {
    SUMMARY: '/grc/coverage',
    REQUIREMENTS: '/grc/coverage/requirements',
    PROCESSES: '/grc/coverage/processes',
  },

  // Standards Library endpoints (Phase 7 - Express backend)
  STANDARDS: {
    LIST: '/grc/requirements',
    FILTERS: '/grc/requirements/filters',
    GET: (id: string) => `/grc/requirements/${id}`,
    MAP_POLICY: '/grc/requirements/map/policy',
    MAP_RISK: '/grc/requirements/map/risk',
    MAP_FINDING: '/grc/requirements/map/finding',
    MAP_AUDIT: '/grc/requirements/map/audit',
    POLICIES: (id: string) => `/grc/requirements/${id}/policies`,
    RISKS: (id: string) => `/grc/requirements/${id}/risks`,
    FINDINGS: (id: string) => `/grc/requirements/${id}/findings`,
    AUDITS: (id: string) => `/grc/requirements/${id}/audits`,
  },

  // Platform Metadata Engine endpoints (Phase 7 - Express backend)
  PLATFORM_METADATA: {
    TYPES: '/platform/metadata/types',
    TYPE: (id: string) => `/platform/metadata/types/${id}`,
    VALUES: '/platform/metadata/values',
    TYPE_VALUES: (typeId: string) => `/platform/metadata/types/${typeId}/values`,
    VALUE: (id: string) => `/platform/metadata/values/${id}`,
    ASSIGN: '/platform/metadata/assign',
    ASSIGNED: (objectType: string, objectId: string) => `/platform/metadata/assigned/${objectType}/${objectId}`,
    REMOVE_ASSIGNED: (id: string) => `/platform/metadata/assigned/${id}`,
    STATS: '/platform/metadata/stats',
  },

  // GRC Metrics endpoints (Phase 7 - Express backend)
  GRC_METRICS: {
    REQUIREMENTS_COVERAGE: '/grc/metrics/requirements/coverage',
    FINDINGS_BY_STANDARD: '/grc/metrics/findings/by-standard',
    REQUIREMENTS_TAGS: '/grc/metrics/requirements/tags',
    COMPLIANCE_SUMMARY: '/grc/metrics/compliance/summary',
  },

  // GRC Dashboard endpoints (Phase 8 - Express backend)
  GRC_DASHBOARD: {
    AUDIT_OVERVIEW: '/grc/dashboard/audit-overview',
    COMPLIANCE_OVERVIEW: '/grc/dashboard/compliance-overview',
    GRC_HEALTH: '/grc/dashboard/grc-health',
    FILTERS: '/grc/dashboard/filters',
  },

  // ITSM Incident endpoints
  ITSM_INCIDENTS: {
    LIST: '/itsm/incidents',
    CREATE: '/itsm/incidents',
    GET: (id: string) => `/itsm/incidents/${id}`,
    UPDATE: (id: string) => `/itsm/incidents/${id}`,
    DELETE: (id: string) => `/itsm/incidents/${id}`,
    SUMMARY: '/itsm/incidents/summary',
    STATISTICS: '/itsm/incidents/statistics',
    RESOLVE: (id: string) => `/itsm/incidents/${id}/resolve`,
    CLOSE: (id: string) => `/itsm/incidents/${id}/close`,
  },

  // User endpoints (limited in NestJS)
  USERS: {
    ME: '/users/me',
    COUNT: '/users/count',
    HEALTH: '/users/health',
    // Full CRUD is only in Express backend
    LIST: '/users',
    CREATE: '/users',
    GET: (id: number) => `/users/${id}`,
    UPDATE: (id: number) => `/users/${id}`,
    DELETE: (id: number) => `/users/${id}`,
  },

  // Health endpoints
  HEALTH: {
    OVERALL: '/health',
    LIVE: '/health/live',
    READY: '/health/ready',
    DB: '/health/db',
    AUTH: '/health/auth',
  },

  // Tenant endpoints
  TENANTS: {
    CURRENT: '/tenants/current',
    USERS: '/tenants/users',
    HEALTH: '/tenants/health',
  },

  // Dashboard endpoints (NestJS)
  DASHBOARD: {
    OVERVIEW: '/dashboard/overview',
    RISK_TRENDS: '/dashboard/risk-trends',
    COMPLIANCE_BY_REGULATION: '/dashboard/compliance-by-regulation',
  },

  // Process endpoints (Sprint 5)
  GRC_PROCESSES: {
    LIST: '/grc/processes',
    CREATE: '/grc/processes',
    GET: (id: string) => `/grc/processes/${id}`,
    UPDATE: (id: string) => `/grc/processes/${id}`,
    DELETE: (id: string) => `/grc/processes/${id}`,
    COMPLIANCE_SCORE: (id: string) => `/grc/processes/${id}/compliance-score`,
    COMPLIANCE_OVERVIEW: '/grc/processes/compliance-overview',
  },

  // ProcessControl endpoints (Sprint 5)
  GRC_PROCESS_CONTROLS: {
    LIST: '/grc/process-controls',
    CREATE: '/grc/process-controls',
    GET: (id: string) => `/grc/process-controls/${id}`,
    UPDATE: (id: string) => `/grc/process-controls/${id}`,
    DELETE: (id: string) => `/grc/process-controls/${id}`,
    LINK_RISKS: (id: string) => `/grc/process-controls/${id}/risks`,
  },

  // ControlResult endpoints (Sprint 5)
  GRC_CONTROL_RESULTS: {
    LIST: '/grc/control-results',
    CREATE: '/grc/control-results',
    GET: (id: string) => `/grc/control-results/${id}`,
  },

  // ProcessViolation endpoints (Sprint 5)
  GRC_PROCESS_VIOLATIONS: {
    LIST: '/grc/process-violations',
    GET: (id: string) => `/grc/process-violations/${id}`,
    UPDATE: (id: string) => `/grc/process-violations/${id}`,
    LINK_RISK: (id: string) => `/grc/process-violations/${id}/link-risk`,
    UNLINK_RISK: (id: string) => `/grc/process-violations/${id}/unlink-risk`,
  },

  // Onboarding Core endpoints
  ONBOARDING: {
    CONTEXT: '/onboarding/context',
  },

  // Framework Activation endpoints (Tenant-level compliance frameworks)
  GRC_FRAMEWORKS: {
    LIST: '/grc/frameworks',
  },

  // Tenant Frameworks endpoints
  TENANT_FRAMEWORKS: {
    GET: '/tenants/me/frameworks',
    UPDATE: '/tenants/me/frameworks',
  },

  // Standards Library endpoints (Audit Phase 2 - NestJS backend)
  STANDARDS_LIBRARY: {
    LIST: '/grc/standards',
    CREATE: '/grc/standards',
    GET: (id: string) => `/grc/standards/${id}`,
    GET_WITH_CLAUSES: (id: string) => `/grc/standards/${id}/with-clauses`,
    UPDATE: (id: string) => `/grc/standards/${id}`,
    DELETE: (id: string) => `/grc/standards/${id}`,
    SUMMARY: '/grc/standards/summary',
    CLAUSES: (standardId: string) => `/grc/standards/${standardId}/clauses`,
    CLAUSES_TREE: (standardId: string) => `/grc/standards/${standardId}/clauses/tree`,
    CREATE_CLAUSE: (standardId: string) => `/grc/standards/${standardId}/clauses`,
    GET_CLAUSE: (clauseId: string) => `/grc/standards/clauses/${clauseId}`,
    UPDATE_CLAUSE: (clauseId: string) => `/grc/standards/clauses/${clauseId}`,
  },

  // Audit Scope endpoints (Audit Phase 2 - NestJS backend)
  AUDIT_SCOPE: {
    GET: (auditId: string) => `/grc/audits/${auditId}/scope`,
    SET: (auditId: string) => `/grc/audits/${auditId}/scope`,
    LOCK: (auditId: string) => `/grc/audits/${auditId}/scope/lock`,
    CLAUSE_FINDINGS: (auditId: string, clauseId: string) => `/grc/audits/${auditId}/clauses/${clauseId}/findings`,
    LINK_FINDING: (auditId: string, clauseId: string) => `/grc/audits/${auditId}/clauses/${clauseId}/findings`,
    UNLINK_FINDING: (auditId: string, clauseId: string, issueId: string) => `/grc/audits/${auditId}/clauses/${clauseId}/findings/${issueId}`,
  },

  // GRC Status History endpoints (Control Detail History tab)
  GRC_STATUS_HISTORY: {
    LIST: '/grc/status-history',
    GET: (id: string) => `/grc/status-history/${id}`,
    BY_ENTITY: (entityType: string, entityId: string) => `/grc/status-history/by-entity/${entityType}/${entityId}`,
    TIMELINE: (entityType: string, entityId: string) => `/grc/status-history/timeline/${entityType}/${entityId}`,
  },

  // Admin Studio Data Model Dictionary endpoints (FAZ 2)
  DATA_MODEL: {
    TABLES: '/admin/data-model/tables',
    TABLE: (name: string) => `/admin/data-model/tables/${name}`,
    TABLE_RELATIONSHIPS: (name: string) => `/admin/data-model/tables/${name}/relationships`,
    TABLE_DOT_WALKING: (name: string) => `/admin/data-model/tables/${name}/dot-walking`,
    RELATIONSHIPS: '/admin/data-model/relationships',
    SUMMARY: '/admin/data-model/summary',
    GRAPH: '/admin/data-model/graph',
    REFRESH: '/admin/data-model/refresh',
  },
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Standard paginated response from NestJS backend (LIST-CONTRACT compliant)
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     items: [...],
 *     total: 100,
 *     page: 1,
 *     pageSize: 20,
 *     totalPages: 5
 *   }
 * }
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * Standard single item response from NestJS backend
 */
export interface SingleResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Dashboard overview data aggregated from multiple summary endpoints
 * Enhanced with KPI-ready fields
 */
export interface DashboardOverview {
  risks: {
    total: number;
    open: number;
    high: number;
    overdue: number;
    top5OpenRisks?: Array<{
      id: string;
      title: string;
      severity: string;
      score: number | null;
    }>;
  };
  compliance: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
    coveragePercentage?: number;
  };
  policies: {
    total: number;
    active: number;
    draft: number;
    coveragePercentage?: number;
  };
  incidents: {
    total: number;
    open: number;
    closed: number;
    resolved: number;
    resolvedToday?: number;
    avgResolutionTimeHours?: number | null;
  };
  users: {
    total: number;
    admins: number;
    managers: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create request config with tenant ID header
 */
export function withTenantId(tenantId: string, config?: AxiosRequestConfig): AxiosRequestConfig {
  return {
    ...config,
    headers: {
      ...config?.headers,
      'x-tenant-id': tenantId,
    },
  };
}

/**
 * Unwrap NestJS response envelope
 * Handles both: { success: true, data: T } (NestJS) and flat T (legacy Express)
 */
export function unwrapResponse<T>(response: { data: unknown }): T {
  const data = response.data;
  if (data && typeof data === 'object' && 'success' in data && (data as { success: boolean }).success === true && 'data' in data) {
    return (data as { data: T }).data;
  }
  return data as T;
}

/**
 * Transform policy response from backend format (name) to frontend format (title)
 * Also maps summary to description and snake_case date fields
 */
function transformPolicyResponse<T extends Record<string, unknown>>(policy: T): T {
  const transformed = { ...policy } as Record<string, unknown>;
  
  // Map 'name' to 'title' for frontend display
  if ('name' in transformed && !('title' in transformed)) {
    transformed.title = transformed.name;
  }
  
  // Map 'summary' to 'description' for frontend display
  if ('summary' in transformed && !('description' in transformed)) {
    transformed.description = transformed.summary;
  }
  
  // Map camelCase date fields to snake_case for frontend
  if ('effectiveDate' in transformed && !('effective_date' in transformed)) {
    transformed.effective_date = transformed.effectiveDate;
  }
  if ('reviewDate' in transformed && !('review_date' in transformed)) {
    transformed.review_date = transformed.reviewDate;
  }
  if ('createdAt' in transformed && !('created_at' in transformed)) {
    transformed.created_at = transformed.createdAt;
  }
  
  // Map owner fields if present
  if ('owner' in transformed && transformed.owner && typeof transformed.owner === 'object') {
    const owner = transformed.owner as Record<string, unknown>;
    if ('firstName' in owner) {
      transformed.owner_first_name = owner.firstName;
    }
    if ('lastName' in owner) {
      transformed.owner_last_name = owner.lastName;
    }
  }
  
  return transformed as T;
}

/**
 * Transform requirement response from backend format to frontend format
 * Maps snake_case date fields and owner information
 */
function transformRequirementResponse<T extends Record<string, unknown>>(requirement: T): T {
  const transformed = { ...requirement } as Record<string, unknown>;
  
  // Map 'description' field (already correct name)
  // Map 'framework' to 'regulation' for frontend display
  if ('framework' in transformed && !('regulation' in transformed)) {
    transformed.regulation = transformed.framework;
  }
  
  // Map camelCase date fields to snake_case for frontend
  if ('dueDate' in transformed && !('due_date' in transformed)) {
    transformed.due_date = transformed.dueDate;
  }
  if ('createdAt' in transformed && !('created_at' in transformed)) {
    transformed.created_at = transformed.createdAt;
  }
  
  // Map owner fields if present
  if ('owner' in transformed && transformed.owner && typeof transformed.owner === 'object') {
    const owner = transformed.owner as Record<string, unknown>;
    if ('firstName' in owner) {
      transformed.owner_first_name = owner.firstName;
    }
    if ('lastName' in owner) {
      transformed.owner_last_name = owner.lastName;
    }
  }
  
  return transformed as T;
}

/**
 * Unwrap paginated NestJS response (LIST-CONTRACT compliant)
 *
 * Expected response shape:
 * {
 *   success: true,
 *   data: { items: [...], total, page, pageSize, totalPages }
 * }
 */
export function unwrapPaginatedResponse<T>(response: { data: unknown }): { items: T[]; total: number; page: number; pageSize: number } {
  const data = response.data as PaginatedResponse<T> | { items: T[]; total: number; page?: number; pageSize?: number };
  
  // LIST-CONTRACT compliant format: { success: true, data: { items, total, page, pageSize, totalPages } }
  if ('success' in data && data.success && 'data' in data) {
    const paginatedData = (data as PaginatedResponse<T>).data;
    if (paginatedData && 'items' in paginatedData) {
      return {
        items: paginatedData.items,
        total: paginatedData.total,
        page: paginatedData.page,
        pageSize: paginatedData.pageSize,
      };
    }
  }
  
  // Legacy format with meta (backward compatibility)
  if ('success' in data && data.success && 'data' in data && 'meta' in data) {
    // Cast through unknown since we're doing runtime type checking
    const legacyData = data as unknown as { success: boolean; data: T[]; meta: { total: number; page: number; pageSize: number } };
    return {
      items: legacyData.data,
      total: legacyData.meta.total,
      page: legacyData.meta.page,
      pageSize: legacyData.meta.pageSize,
    };
  }
  
  // Direct paginated object format
  if ('items' in data) {
    return {
      items: data.items,
      total: data.total,
      page: data.page || 1,
      pageSize: data.pageSize || data.items.length,
    };
  }
  
  // Array format
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      pageSize: data.length,
    };
  }
  
  return { items: [], total: 0, page: 1, pageSize: 0 };
}

/**
 * Unwrap paginated policy response with field transformation
 */
export function unwrapPaginatedPolicyResponse<T>(
  response: { data: unknown }
): { items: T[]; total: number; page: number; pageSize: number } {
  const result = unwrapPaginatedResponse<Record<string, unknown>>(response);
  return {
    ...result,
    items: result.items.map(item => transformPolicyResponse(item)) as T[],
  };
}

/**
 * Unwrap paginated requirement response with field transformation
 */
export function unwrapPaginatedRequirementResponse<T>(
  response: { data: unknown }
): { items: T[]; total: number; page: number; pageSize: number } {
  const result = unwrapPaginatedResponse<Record<string, unknown>>(response);
  return {
    ...result,
    items: result.items.map(item => transformRequirementResponse(item)) as T[],
  };
}

// ============================================================================
// GRC Risk API
// ============================================================================

export const riskApi = {
  list: (tenantId: string, params?: URLSearchParams) => 
    api.get(`${API_PATHS.GRC_RISKS.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
  
  get: (tenantId: string, id: string) => 
    api.get(API_PATHS.GRC_RISKS.GET(id), withTenantId(tenantId)),
  
  create: (tenantId: string, data: Record<string, unknown>) => 
    api.post(API_PATHS.GRC_RISKS.CREATE, data, withTenantId(tenantId)),
  
  update: (tenantId: string, id: string, data: Record<string, unknown>) => 
    api.patch(API_PATHS.GRC_RISKS.UPDATE(id), data, withTenantId(tenantId)),
  
  delete: (tenantId: string, id: string) => 
    api.delete(API_PATHS.GRC_RISKS.DELETE(id), withTenantId(tenantId)),
  
  summary: (tenantId: string) => 
    api.get(API_PATHS.GRC_RISKS.SUMMARY, withTenantId(tenantId)),
  
  statistics: (tenantId: string) => 
    api.get(API_PATHS.GRC_RISKS.STATISTICS, withTenantId(tenantId)),
  
  highSeverity: (tenantId: string) => 
    api.get(API_PATHS.GRC_RISKS.HIGH_SEVERITY, withTenantId(tenantId)),

  // Relationship management
  getLinkedPolicies: (tenantId: string, riskId: string) =>
    api.get(API_PATHS.GRC_RISKS.POLICIES(riskId), withTenantId(tenantId)),

  linkPolicies: (tenantId: string, riskId: string, policyIds: string[]) =>
    api.post(API_PATHS.GRC_RISKS.POLICIES(riskId), { policyIds }, withTenantId(tenantId)),

  getLinkedRequirements: (tenantId: string, riskId: string) =>
    api.get(API_PATHS.GRC_RISKS.REQUIREMENTS(riskId), withTenantId(tenantId)),

  linkRequirements: (tenantId: string, riskId: string, requirementIds: string[]) =>
    api.post(API_PATHS.GRC_RISKS.REQUIREMENTS(riskId), { requirementIds }, withTenantId(tenantId)),
};

// ============================================================================
// GRC Policy API (Governance)
// ============================================================================

export const policyApi = {
  list: (tenantId: string, params?: URLSearchParams) => 
    api.get(`${API_PATHS.GRC_POLICIES.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
  
  get: (tenantId: string, id: string) => 
    api.get(API_PATHS.GRC_POLICIES.GET(id), withTenantId(tenantId)),
  
  create: (tenantId: string, data: Record<string, unknown>) => 
    api.post(API_PATHS.GRC_POLICIES.CREATE, data, withTenantId(tenantId)),
  
  update: (tenantId: string, id: string, data: Record<string, unknown>) => 
    api.patch(API_PATHS.GRC_POLICIES.UPDATE(id), data, withTenantId(tenantId)),
  
  delete: (tenantId: string, id: string) => 
    api.delete(API_PATHS.GRC_POLICIES.DELETE(id), withTenantId(tenantId)),
  
  summary: (tenantId: string) => 
    api.get(API_PATHS.GRC_POLICIES.SUMMARY, withTenantId(tenantId)),
  
  statistics: (tenantId: string) => 
    api.get(API_PATHS.GRC_POLICIES.STATISTICS, withTenantId(tenantId)),
  
  active: (tenantId: string) => 
    api.get(API_PATHS.GRC_POLICIES.ACTIVE, withTenantId(tenantId)),
  
  dueForReview: (tenantId: string) => 
    api.get(API_PATHS.GRC_POLICIES.DUE_FOR_REVIEW, withTenantId(tenantId)),

  // Relationship management
  getLinkedRisks: (tenantId: string, policyId: string) =>
    api.get(API_PATHS.GRC_POLICIES.RISKS(policyId), withTenantId(tenantId)),

  // Policy Version management
  versions: {
    list: (tenantId: string, policyId: string) =>
      api.get(API_PATHS.GRC_POLICIES.VERSIONS.LIST(policyId), withTenantId(tenantId)),
    
    get: (tenantId: string, policyId: string, versionId: string) =>
      api.get(API_PATHS.GRC_POLICIES.VERSIONS.GET(policyId, versionId), withTenantId(tenantId)),
    
    create: (tenantId: string, policyId: string, data: Record<string, unknown>) =>
      api.post(API_PATHS.GRC_POLICIES.VERSIONS.CREATE(policyId), data, withTenantId(tenantId)),
    
    update: (tenantId: string, policyId: string, versionId: string, data: Record<string, unknown>) =>
      api.patch(API_PATHS.GRC_POLICIES.VERSIONS.UPDATE(policyId, versionId), data, withTenantId(tenantId)),
    
    latest: (tenantId: string, policyId: string) =>
      api.get(API_PATHS.GRC_POLICIES.VERSIONS.LATEST(policyId), withTenantId(tenantId)),
    
    published: (tenantId: string, policyId: string) =>
      api.get(API_PATHS.GRC_POLICIES.VERSIONS.PUBLISHED(policyId), withTenantId(tenantId)),
    
    submitForReview: (tenantId: string, policyId: string, versionId: string) =>
      api.post(API_PATHS.GRC_POLICIES.VERSIONS.SUBMIT_FOR_REVIEW(policyId, versionId), {}, withTenantId(tenantId)),
    
    approve: (tenantId: string, policyId: string, versionId: string) =>
      api.post(API_PATHS.GRC_POLICIES.VERSIONS.APPROVE(policyId, versionId), {}, withTenantId(tenantId)),
    
    publish: (tenantId: string, policyId: string, versionId: string) =>
      api.post(API_PATHS.GRC_POLICIES.VERSIONS.PUBLISH(policyId, versionId), {}, withTenantId(tenantId)),
    
    retire: (tenantId: string, policyId: string, versionId: string) =>
      api.post(API_PATHS.GRC_POLICIES.VERSIONS.RETIRE(policyId, versionId), {}, withTenantId(tenantId)),
  },
};

// ============================================================================
// Audit Report Template API
// ============================================================================

export const auditReportTemplateApi = {
  list: (tenantId: string, params?: URLSearchParams) =>
    api.get(`${API_PATHS.AUDIT_REPORT_TEMPLATES.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
  
  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.AUDIT_REPORT_TEMPLATES.GET(id), withTenantId(tenantId)),
  
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(API_PATHS.AUDIT_REPORT_TEMPLATES.CREATE, data, withTenantId(tenantId)),
  
  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(API_PATHS.AUDIT_REPORT_TEMPLATES.UPDATE(id), data, withTenantId(tenantId)),
  
  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.AUDIT_REPORT_TEMPLATES.DELETE(id), withTenantId(tenantId)),
  
  render: (tenantId: string, id: string, context: Record<string, unknown>) =>
    api.post(API_PATHS.AUDIT_REPORT_TEMPLATES.RENDER(id), { context }, withTenantId(tenantId)),
  
  preview: (tenantId: string, templateBody: string, context: Record<string, unknown>) =>
    api.post(API_PATHS.AUDIT_REPORT_TEMPLATES.PREVIEW, { templateBody, context }, withTenantId(tenantId)),
  
  validate: (tenantId: string, templateBody: string) =>
    api.post(API_PATHS.AUDIT_REPORT_TEMPLATES.VALIDATE, { templateBody }, withTenantId(tenantId)),
  
  getPlaceholders: (tenantId: string, id: string) =>
    api.get(API_PATHS.AUDIT_REPORT_TEMPLATES.PLACEHOLDERS(id), withTenantId(tenantId)),
};

// ============================================================================
// Search API
// ============================================================================

export const searchApi = {
  search: (tenantId: string, entity: string, query: Record<string, unknown>) =>
    api.post(API_PATHS.SEARCH.GENERIC, { entity, ...query }, withTenantId(tenantId)),
  
  searchRisks: (tenantId: string, query: Record<string, unknown>) =>
    api.post(API_PATHS.SEARCH.RISKS, query, withTenantId(tenantId)),
  
  searchPolicies: (tenantId: string, query: Record<string, unknown>) =>
    api.post(API_PATHS.SEARCH.POLICIES, query, withTenantId(tenantId)),
  
  searchRequirements: (tenantId: string, query: Record<string, unknown>) =>
    api.post(API_PATHS.SEARCH.REQUIREMENTS, query, withTenantId(tenantId)),
};

// ============================================================================
// Metadata API
// ============================================================================

export const metadataApi = {
  // Field Metadata
  fields: {
    list: (tenantId: string, params?: URLSearchParams) =>
      api.get(`${API_PATHS.METADATA.FIELDS.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
    
    get: (tenantId: string, id: string) =>
      api.get(API_PATHS.METADATA.FIELDS.GET(id), withTenantId(tenantId)),
    
    create: (tenantId: string, data: Record<string, unknown>) =>
      api.post(API_PATHS.METADATA.FIELDS.CREATE, data, withTenantId(tenantId)),
    
    update: (tenantId: string, id: string, data: Record<string, unknown>) =>
      api.patch(API_PATHS.METADATA.FIELDS.UPDATE(id), data, withTenantId(tenantId)),
    
    delete: (tenantId: string, id: string) =>
      api.delete(API_PATHS.METADATA.FIELDS.DELETE(id), withTenantId(tenantId)),
    
    getTables: (tenantId: string) =>
      api.get(API_PATHS.METADATA.FIELDS.TABLES, withTenantId(tenantId)),
    
    getTags: (tenantId: string, fieldId: string) =>
      api.get(API_PATHS.METADATA.FIELDS.TAGS(fieldId), withTenantId(tenantId)),
    
    assignTag: (tenantId: string, fieldId: string, tagId: string) =>
      api.post(API_PATHS.METADATA.FIELDS.ASSIGN_TAG(fieldId), { tagId }, withTenantId(tenantId)),
    
    removeTag: (tenantId: string, fieldId: string, tagId: string) =>
      api.delete(API_PATHS.METADATA.FIELDS.REMOVE_TAG(fieldId, tagId), withTenantId(tenantId)),
  },
  
  // Classification Tags
  tags: {
    list: (tenantId: string, params?: URLSearchParams) =>
      api.get(`${API_PATHS.METADATA.TAGS.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
    
    get: (tenantId: string, id: string) =>
      api.get(API_PATHS.METADATA.TAGS.GET(id), withTenantId(tenantId)),
    
    create: (tenantId: string, data: Record<string, unknown>) =>
      api.post(API_PATHS.METADATA.TAGS.CREATE, data, withTenantId(tenantId)),
    
    update: (tenantId: string, id: string, data: Record<string, unknown>) =>
      api.patch(API_PATHS.METADATA.TAGS.UPDATE(id), data, withTenantId(tenantId)),
    
    delete: (tenantId: string, id: string) =>
      api.delete(API_PATHS.METADATA.TAGS.DELETE(id), withTenantId(tenantId)),
    
    getFields: (tenantId: string, tagId: string) =>
      api.get(API_PATHS.METADATA.TAGS.FIELDS(tagId), withTenantId(tenantId)),
  },
  
  // Seed default tags
  seed: (tenantId: string) =>
    api.post(API_PATHS.METADATA.SEED, {}, withTenantId(tenantId)),
};

// ============================================================================
// GRC Requirement API (Compliance)
// ============================================================================

export const requirementApi = {
  list: (tenantId: string, params?: URLSearchParams) => 
    api.get(`${API_PATHS.GRC_REQUIREMENTS.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
  
  get: (tenantId: string, id: string) => 
    api.get(API_PATHS.GRC_REQUIREMENTS.GET(id), withTenantId(tenantId)),
  
  create: (tenantId: string, data: Record<string, unknown>) => 
    api.post(API_PATHS.GRC_REQUIREMENTS.CREATE, data, withTenantId(tenantId)),
  
  update: (tenantId: string, id: string, data: Record<string, unknown>) => 
    api.patch(API_PATHS.GRC_REQUIREMENTS.UPDATE(id), data, withTenantId(tenantId)),
  
  delete: (tenantId: string, id: string) => 
    api.delete(API_PATHS.GRC_REQUIREMENTS.DELETE(id), withTenantId(tenantId)),
  
  summary: (tenantId: string) => 
    api.get(API_PATHS.GRC_REQUIREMENTS.SUMMARY, withTenantId(tenantId)),
  
  statistics: (tenantId: string) => 
    api.get(API_PATHS.GRC_REQUIREMENTS.STATISTICS, withTenantId(tenantId)),
  
  frameworks: (tenantId: string) => 
    api.get(API_PATHS.GRC_REQUIREMENTS.FRAMEWORKS, withTenantId(tenantId)),

  // Relationship management
  getLinkedRisks: (tenantId: string, requirementId: string) =>
    api.get(API_PATHS.GRC_REQUIREMENTS.RISKS(requirementId), withTenantId(tenantId)),
};

// ============================================================================
// ITSM Incident API
// ============================================================================

export const incidentApi = {
  list: (tenantId: string, params?: URLSearchParams) => 
    api.get(`${API_PATHS.ITSM_INCIDENTS.LIST}${params ? `?${params}` : ''}`, withTenantId(tenantId)),
  
  get: (tenantId: string, id: string) => 
    api.get(API_PATHS.ITSM_INCIDENTS.GET(id), withTenantId(tenantId)),
  
  create: (tenantId: string, data: Record<string, unknown>) => 
    api.post(API_PATHS.ITSM_INCIDENTS.CREATE, data, withTenantId(tenantId)),
  
  update: (tenantId: string, id: string, data: Record<string, unknown>) => 
    api.patch(API_PATHS.ITSM_INCIDENTS.UPDATE(id), data, withTenantId(tenantId)),
  
  delete: (tenantId: string, id: string) => 
    api.delete(API_PATHS.ITSM_INCIDENTS.DELETE(id), withTenantId(tenantId)),
  
  summary: (tenantId: string) => 
    api.get(API_PATHS.ITSM_INCIDENTS.SUMMARY, withTenantId(tenantId)),
  
  statistics: (tenantId: string) => 
    api.get(API_PATHS.ITSM_INCIDENTS.STATISTICS, withTenantId(tenantId)),
  
  resolve: (tenantId: string, id: string, resolutionNotes?: string) => 
    api.post(API_PATHS.ITSM_INCIDENTS.RESOLVE(id), { resolutionNotes }, withTenantId(tenantId)),
  
  close: (tenantId: string, id: string) => 
    api.post(API_PATHS.ITSM_INCIDENTS.CLOSE(id), {}, withTenantId(tenantId)),
};

// ============================================================================
// Dashboard API (Uses dedicated NestJS Dashboard endpoints)
// ============================================================================

/**
 * Risk trend data point for time-series chart
 */
export interface RiskTrendDataPoint {
  date: string;
  total_risks: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Compliance by regulation data point
 */
export interface ComplianceByRegulationItem {
  regulation: string;
  completed: number;
  pending: number;
  overdue: number;
}

export const dashboardApi = {
  /**
   * Get dashboard overview from the dedicated NestJS Dashboard endpoint
   * This endpoint aggregates data from GRC and ITSM services on the backend
   */
  getOverview: async (tenantId: string): Promise<DashboardOverview> => {
    try {
      const response = await api.get(API_PATHS.DASHBOARD.OVERVIEW, withTenantId(tenantId));
      return unwrapResponse<DashboardOverview>(response);
    } catch (error) {
      console.error('Failed to fetch dashboard overview:', error);
      // Return empty data on error for graceful degradation
      return {
        risks: { total: 0, open: 0, high: 0, overdue: 0, top5OpenRisks: [] },
        compliance: { total: 0, pending: 0, completed: 0, overdue: 0 },
        policies: { total: 0, active: 0, draft: 0 },
        incidents: { total: 0, open: 0, closed: 0, resolved: 0 },
        users: { total: 0, admins: 0, managers: 0 },
      };
    }
  },

  /**
   * Get risk trends data from the dedicated NestJS Dashboard endpoint
   * Returns risk counts grouped by severity for visualization
   */
  getRiskTrends: async (tenantId: string): Promise<RiskTrendDataPoint[]> => {
    try {
      const response = await api.get(API_PATHS.DASHBOARD.RISK_TRENDS, withTenantId(tenantId));
      return unwrapResponse<RiskTrendDataPoint[]>(response) || [];
    } catch (error) {
      console.error('Failed to fetch risk trends:', error);
      return [];
    }
  },

  /**
   * Get compliance breakdown by regulation from the dedicated NestJS Dashboard endpoint
   * Returns compliance status grouped by framework for visualization
   */
  getComplianceByRegulation: async (tenantId: string): Promise<ComplianceByRegulationItem[]> => {
    try {
      const response = await api.get(API_PATHS.DASHBOARD.COMPLIANCE_BY_REGULATION, withTenantId(tenantId));
      return unwrapResponse<ComplianceByRegulationItem[]>(response) || [];
    } catch (error) {
      console.error('Failed to fetch compliance by regulation:', error);
      return [];
    }
  },
};

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  login: (username: string, password: string) => 
    api.post(API_PATHS.AUTH.LOGIN, { username, password }),
  
  me: () => 
    api.get(API_PATHS.AUTH.ME),
  
  refresh: (refreshToken: string) => 
    api.post(API_PATHS.AUTH.REFRESH, { refreshToken }),
  
  register: (userData: Record<string, unknown>) => 
    api.post(API_PATHS.AUTH.REGISTER, userData),
};

// ============================================================================
// User API (Legacy - uses Express backend)
// ============================================================================

export const userApi = {
  list: () => api.get(API_PATHS.USERS.LIST),
  get: (id: number) => api.get(API_PATHS.USERS.GET(id)),
  create: (data: Record<string, unknown>) => api.post(API_PATHS.USERS.CREATE, data),
  update: (id: number, data: Record<string, unknown>) => api.put(API_PATHS.USERS.UPDATE(id), data),
  delete: (id: number) => api.delete(API_PATHS.USERS.DELETE(id)),
  me: () => api.get(API_PATHS.USERS.ME),
  count: () => api.get(API_PATHS.USERS.COUNT),
};

// ============================================================================
// Standards Library API (Phase 7)
// ============================================================================

export const standardsApi = {
  list: (params?: URLSearchParams) => 
    api.get(`${API_PATHS.STANDARDS.LIST}${params ? `?${params}` : ''}`),
  
  getFilters: () => 
    api.get(API_PATHS.STANDARDS.FILTERS),
  
  get: (id: string) => 
    api.get(API_PATHS.STANDARDS.GET(id)),
  
  mapPolicy: (requirementId: string, policyId: string, justification?: string) => 
    api.post(API_PATHS.STANDARDS.MAP_POLICY, { requirementId, targetId: policyId, justification }),
  
  mapRisk: (requirementId: string, riskId: string) => 
    api.post(API_PATHS.STANDARDS.MAP_RISK, { requirementId, targetId: riskId }),
  
  mapFinding: (requirementId: string, findingId: string, evidenceStrength?: string) => 
    api.post(API_PATHS.STANDARDS.MAP_FINDING, { requirementId, targetId: findingId, evidenceStrength }),
  
  mapAudit: (requirementId: string, auditId: string) => 
    api.post(API_PATHS.STANDARDS.MAP_AUDIT, { requirementId, targetId: auditId }),
  
  getPolicies: (id: string) => 
    api.get(API_PATHS.STANDARDS.POLICIES(id)),
  
  getRisks: (id: string) => 
    api.get(API_PATHS.STANDARDS.RISKS(id)),
  
  getFindings: (id: string) => 
    api.get(API_PATHS.STANDARDS.FINDINGS(id)),
  
  getAudits: (id: string) => 
    api.get(API_PATHS.STANDARDS.AUDITS(id)),
};

// ============================================================================
// Platform Metadata Engine API (Phase 7)
// ============================================================================

export const platformMetadataApi = {
  getTypes: () => 
    api.get(API_PATHS.PLATFORM_METADATA.TYPES),
  
  getType: (id: string) => 
    api.get(API_PATHS.PLATFORM_METADATA.TYPE(id)),
  
  createType: (data: { name: string; description?: string }) => 
    api.post(API_PATHS.PLATFORM_METADATA.TYPES, data),
  
  updateType: (id: string, data: { name?: string; description?: string }) => 
    api.put(API_PATHS.PLATFORM_METADATA.TYPE(id), data),
  
  deleteType: (id: string) => 
    api.delete(API_PATHS.PLATFORM_METADATA.TYPE(id)),
  
  getValues: () => 
    api.get(API_PATHS.PLATFORM_METADATA.VALUES),
  
  getTypeValues: (typeId: string) => 
    api.get(API_PATHS.PLATFORM_METADATA.TYPE_VALUES(typeId)),
  
  createValue: (typeId: string, data: { value: string; color?: string; description?: string }) => 
    api.post(API_PATHS.PLATFORM_METADATA.TYPE_VALUES(typeId), data),
  
  updateValue: (id: string, data: { value?: string; color?: string; description?: string }) => 
    api.put(API_PATHS.PLATFORM_METADATA.VALUE(id), data),
  
  deleteValue: (id: string) => 
    api.delete(API_PATHS.PLATFORM_METADATA.VALUE(id)),
  
  assignMetadata: (objectType: string, objectId: string, metadataValueId: string) => 
    api.post(API_PATHS.PLATFORM_METADATA.ASSIGN, { objectType, objectId, metadataValueId }),
  
  getAssignedMetadata: (objectType: string, objectId: string) => 
    api.get(API_PATHS.PLATFORM_METADATA.ASSIGNED(objectType, objectId)),
  
  removeAssignment: (id: string) => 
    api.delete(API_PATHS.PLATFORM_METADATA.REMOVE_ASSIGNED(id)),
  
  getStats: () => 
    api.get(API_PATHS.PLATFORM_METADATA.STATS),
};

// ============================================================================
// GRC Metrics API (Phase 7)
// ============================================================================

export const grcMetricsApi = {
  getRequirementsCoverage: () => 
    api.get(API_PATHS.GRC_METRICS.REQUIREMENTS_COVERAGE),
  
  getFindingsByStandard: () => 
    api.get(API_PATHS.GRC_METRICS.FINDINGS_BY_STANDARD),
  
  getRequirementsTags: () => 
    api.get(API_PATHS.GRC_METRICS.REQUIREMENTS_TAGS),
  
  getComplianceSummary: () => 
    api.get(API_PATHS.GRC_METRICS.COMPLIANCE_SUMMARY),
};

// ============================================================================
// GRC Dashboard API (Phase 8)
// ============================================================================

export interface AuditOverviewData {
  auditPipeline: {
    draft: number;
    planned: number;
    fieldwork: number;
    reporting: number;
    final: number;
    closed: number;
  };
  findingsByDepartment: Array<{
    department: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  capaPerformance: {
    total: number;
    open: number;
    overdue: number;
    avgClosureDays: number;
    validatedRate: number;
  };
  topRiskAreas: Array<{
    riskId: string;
    riskTitle: string;
    relatedFindings: number;
    maxSeverity: string;
  }>;
  auditCalendar: Array<{
    month: string;
    planned: number;
    fieldwork: number;
    reporting: number;
    closed: number;
  }>;
}

export interface ComplianceOverviewData {
  standardsCoverage: Array<{
    family: string;
    totalRequirements: number;
    audited: number;
    withFindings: number;
    complianceScore: number;
  }>;
  clauseHeatmap: Array<{
    family: string;
    code: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  requirementStatus: {
    compliant: number;
    partiallyCompliant: number;
    nonCompliant: number;
    notAssessed: number;
  };
  domainBreakdown: Array<{
    domain: string;
    requirements: number;
    findings: number;
    capas: number;
  }>;
}

export interface GrcHealthData {
  departmentScores: Array<{
    department: string;
    score: number;
    auditScore: number;
    riskScore: number;
    policyScore: number;
    capaScore: number;
  }>;
  repeatedFindings: Array<{
    theme: string;
    count: number;
  }>;
  policyCompliance: Array<{
    policyId: string;
    policyTitle: string;
    acknowledgedRate: number;
  }>;
  riskClusters: Array<{
    cluster: string;
    openFindings: number;
    highRisks: number;
  }>;
}

export interface DashboardFilters {
  departments: string[];
  families: string[];
  versions: string[];
}

export const grcDashboardApi = {
  getAuditOverview: async (params?: { from?: string; to?: string; department?: string }): Promise<AuditOverviewData> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.from) queryParams.append('from', params.from);
      if (params?.to) queryParams.append('to', params.to);
      if (params?.department) queryParams.append('department', params.department);
      
      const url = `${API_PATHS.GRC_DASHBOARD.AUDIT_OVERVIEW}${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await api.get(url);
      return unwrapResponse<AuditOverviewData>(response);
    } catch (error) {
      console.error('Failed to fetch audit overview:', error);
      return {
        auditPipeline: { draft: 0, planned: 0, fieldwork: 0, reporting: 0, final: 0, closed: 0 },
        findingsByDepartment: [],
        capaPerformance: { total: 0, open: 0, overdue: 0, avgClosureDays: 0, validatedRate: 0 },
        topRiskAreas: [],
        auditCalendar: [],
      };
    }
  },

  getComplianceOverview: async (params?: { family?: string; version?: string }): Promise<ComplianceOverviewData> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.family) queryParams.append('family', params.family);
      if (params?.version) queryParams.append('version', params.version);
      
      const url = `${API_PATHS.GRC_DASHBOARD.COMPLIANCE_OVERVIEW}${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await api.get(url);
      return unwrapResponse<ComplianceOverviewData>(response);
    } catch (error) {
      console.error('Failed to fetch compliance overview:', error);
      return {
        standardsCoverage: [],
        clauseHeatmap: [],
        requirementStatus: { compliant: 0, partiallyCompliant: 0, nonCompliant: 0, notAssessed: 0 },
        domainBreakdown: [],
      };
    }
  },

  getGrcHealth: async (params?: { from?: string; to?: string }): Promise<GrcHealthData> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.from) queryParams.append('from', params.from);
      if (params?.to) queryParams.append('to', params.to);
      
      const url = `${API_PATHS.GRC_DASHBOARD.GRC_HEALTH}${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await api.get(url);
      return unwrapResponse<GrcHealthData>(response);
    } catch (error) {
      console.error('Failed to fetch GRC health:', error);
      return {
        departmentScores: [],
        repeatedFindings: [],
        policyCompliance: [],
        riskClusters: [],
      };
    }
  },

  getFilters: async (): Promise<DashboardFilters> => {
    try {
      const response = await api.get(API_PATHS.GRC_DASHBOARD.FILTERS);
      return unwrapResponse<DashboardFilters>(response);
    } catch (error) {
      console.error('Failed to fetch dashboard filters:', error);
      return {
        departments: [],
        families: [],
        versions: [],
      };
    }
  },
};

// ============================================================================
// Process API (Sprint 5)
// ============================================================================

export const processApi = {
  list: (tenantId: string, params?: URLSearchParams) =>
    api.get(
      `${API_PATHS.GRC_PROCESSES.LIST}${params ? `?${params}` : ''}`,
      withTenantId(tenantId),
    ),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_PROCESSES.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(API_PATHS.GRC_PROCESSES.CREATE, data, withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(API_PATHS.GRC_PROCESSES.UPDATE(id), data, withTenantId(tenantId)),

  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.GRC_PROCESSES.DELETE(id), withTenantId(tenantId)),

  getComplianceScore: (
    tenantId: string,
    id: string,
    params?: { from?: string; to?: string },
  ) => {
    const queryParams = new URLSearchParams();
    if (params?.from) queryParams.append('from', params.from);
    if (params?.to) queryParams.append('to', params.to);
    const url = `${API_PATHS.GRC_PROCESSES.COMPLIANCE_SCORE(id)}${queryParams.toString() ? `?${queryParams}` : ''}`;
    return api.get(url, withTenantId(tenantId));
  },

  getComplianceOverview: (
    tenantId: string,
    params?: { from?: string; to?: string },
  ) => {
    const queryParams = new URLSearchParams();
    if (params?.from) queryParams.append('from', params.from);
    if (params?.to) queryParams.append('to', params.to);
    const url = `${API_PATHS.GRC_PROCESSES.COMPLIANCE_OVERVIEW}${queryParams.toString() ? `?${queryParams}` : ''}`;
    return api.get(url, withTenantId(tenantId));
  },
};

// ============================================================================
// ProcessControl API (Sprint 5)
// ============================================================================

export const processControlApi = {
  list: (tenantId: string, params?: URLSearchParams) =>
    api.get(
      `${API_PATHS.GRC_PROCESS_CONTROLS.LIST}${params ? `?${params}` : ''}`,
      withTenantId(tenantId),
    ),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_PROCESS_CONTROLS.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(
      API_PATHS.GRC_PROCESS_CONTROLS.CREATE,
      data,
      withTenantId(tenantId),
    ),

  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(
      API_PATHS.GRC_PROCESS_CONTROLS.UPDATE(id),
      data,
      withTenantId(tenantId),
    ),

  delete: (tenantId: string, id: string) =>
    api.delete(API_PATHS.GRC_PROCESS_CONTROLS.DELETE(id), withTenantId(tenantId)),

  linkRisks: (tenantId: string, id: string, riskIds: string[]) =>
    api.put(
      API_PATHS.GRC_PROCESS_CONTROLS.LINK_RISKS(id),
      { riskIds },
      withTenantId(tenantId),
    ),
};

// ============================================================================
// ControlResult API (Sprint 5)
// ============================================================================

export const controlResultApi = {
  list: (tenantId: string, params?: URLSearchParams) =>
    api.get(
      `${API_PATHS.GRC_CONTROL_RESULTS.LIST}${params ? `?${params}` : ''}`,
      withTenantId(tenantId),
    ),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_CONTROL_RESULTS.GET(id), withTenantId(tenantId)),

  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(API_PATHS.GRC_CONTROL_RESULTS.CREATE, data, withTenantId(tenantId)),
};

// ============================================================================
// ProcessViolation API (Sprint 5)
// ============================================================================

export const processViolationApi = {
  list: (tenantId: string, params?: URLSearchParams) =>
    api.get(
      `${API_PATHS.GRC_PROCESS_VIOLATIONS.LIST}${params ? `?${params}` : ''}`,
      withTenantId(tenantId),
    ),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_PROCESS_VIOLATIONS.GET(id), withTenantId(tenantId)),

  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(
      API_PATHS.GRC_PROCESS_VIOLATIONS.UPDATE(id),
      data,
      withTenantId(tenantId),
    ),

  linkRisk: (tenantId: string, id: string, riskId: string) =>
    api.patch(
      API_PATHS.GRC_PROCESS_VIOLATIONS.LINK_RISK(id),
      { riskId },
      withTenantId(tenantId),
    ),

  unlinkRisk: (tenantId: string, id: string) =>
    api.patch(
      API_PATHS.GRC_PROCESS_VIOLATIONS.UNLINK_RISK(id),
      {},
      withTenantId(tenantId),
    ),
};

// ============================================================================
// GRC Control API (Unified Control Library)
// ============================================================================

export const controlApi = {
  list: (tenantId: string, params?: Record<string, unknown>) =>
    api.get(API_PATHS.GRC_CONTROLS.LIST, {
      ...withTenantId(tenantId),
      params,
    }),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_CONTROLS.GET(id), withTenantId(tenantId)),

  getProcesses: (tenantId: string, controlId: string) =>
    api.get(API_PATHS.GRC_CONTROLS.PROCESSES(controlId), withTenantId(tenantId)),

  linkProcess: (tenantId: string, controlId: string, processId: string) =>
    api.post(
      API_PATHS.GRC_CONTROLS.LINK_PROCESS(controlId, processId),
      {},
      withTenantId(tenantId),
    ),

  unlinkProcess: (tenantId: string, controlId: string, processId: string) =>
    api.delete(
      API_PATHS.GRC_CONTROLS.UNLINK_PROCESS(controlId, processId),
      withTenantId(tenantId),
    ),
};

// ============================================================================
// GRC Coverage API (Unified Control Library)
// ============================================================================

export interface CoverageSummary {
  requirementCoverage: number;
  processCoverage: number;
  unlinkedControlsCount: number;
  totalRequirements: number;
  coveredRequirements: number;
  totalProcesses: number;
  coveredProcesses: number;
  totalControls: number;
}

export interface RequirementCoverageItem {
  id: string;
  title: string;
  referenceCode: string;
  status: string;
  controlCount: number;
  isCovered: boolean;
}

export interface RequirementCoverageResponse {
  total: number;
  covered: number;
  uncovered: number;
  coveragePercent: number;
  requirements: RequirementCoverageItem[];
}

export interface ProcessCoverageItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  controlCount: number;
  isCovered: boolean;
}

export interface ProcessCoverageResponse {
  total: number;
  covered: number;
  uncovered: number;
  coveragePercent: number;
  processes: ProcessCoverageItem[];
}

export const coverageApi = {
  getSummary: (tenantId: string) =>
    api.get<CoverageSummary>(API_PATHS.GRC_COVERAGE.SUMMARY, withTenantId(tenantId)),

  getRequirementCoverage: (tenantId: string) =>
    api.get<RequirementCoverageResponse>(API_PATHS.GRC_COVERAGE.REQUIREMENTS, withTenantId(tenantId)),

  getProcessCoverage: (tenantId: string) =>
    api.get<ProcessCoverageResponse>(API_PATHS.GRC_COVERAGE.PROCESSES, withTenantId(tenantId)),
};

// ============================================================================
// GRC Status History Types and API (Control Detail History tab)
// ============================================================================

export interface StatusHistoryItem {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  previousStatus: string | null;
  newStatus: string;
  changedByUserId: string | null;
  changedBy: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  changeReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface StatusHistoryFilterParams {
  entityType?: string;
  entityId?: string;
  changedByUserId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface StatusTimelineResponse {
  timeline: StatusHistoryItem[];
  currentStatus: string | null;
  totalTransitions: number;
  firstTransitionAt: string | null;
  lastTransitionAt: string | null;
}

export const statusHistoryApi = {
  list: (tenantId: string, params?: StatusHistoryFilterParams) =>
    api.get(API_PATHS.GRC_STATUS_HISTORY.LIST, {
      ...withTenantId(tenantId),
      params,
    }),

  get: (tenantId: string, id: string) =>
    api.get(API_PATHS.GRC_STATUS_HISTORY.GET(id), withTenantId(tenantId)),

  getByEntity: (tenantId: string, entityType: string, entityId: string) =>
    api.get(API_PATHS.GRC_STATUS_HISTORY.BY_ENTITY(entityType, entityId), withTenantId(tenantId)),

  getTimeline: (tenantId: string, entityType: string, entityId: string) =>
    api.get<StatusTimelineResponse>(API_PATHS.GRC_STATUS_HISTORY.TIMELINE(entityType, entityId), withTenantId(tenantId)),
};

// ============================================================================
// Onboarding Core Types
// ============================================================================

export enum SuiteType {
  GRC_SUITE = 'GRC_SUITE',
  ITSM_SUITE = 'ITSM_SUITE',
}

export enum ModuleType {
  RISK = 'risk',
  POLICY = 'policy',
  CONTROL = 'control',
  AUDIT = 'audit',
  INCIDENT = 'incident',
  REQUEST = 'request',
  CHANGE = 'change',
  PROBLEM = 'problem',
  CMDB = 'cmdb',
}

export enum FrameworkType {
  ISO27001 = 'ISO27001',
  SOC2 = 'SOC2',
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  NIST = 'NIST',
  PCI_DSS = 'PCI_DSS',
}

export enum MaturityLevel {
  FOUNDATIONAL = 'foundational',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum PolicyCode {
  FRAMEWORK_REQUIRED = 'FRAMEWORK_REQUIRED',
  ADVANCED_RISK_SCORING_DISABLED = 'ADVANCED_RISK_SCORING_DISABLED',
  ISO27001_EVIDENCE_RECOMMENDED = 'ISO27001_EVIDENCE_RECOMMENDED',
  AUDIT_SCOPE_FILTERED = 'AUDIT_SCOPE_FILTERED',
  CLAUSE_LEVEL_ASSESSMENT_WARNING = 'CLAUSE_LEVEL_ASSESSMENT_WARNING',
  ITSM_RELATED_RISK_DISABLED = 'ITSM_RELATED_RISK_DISABLED',
  MAJOR_INCIDENT_AUTOMATION_DISABLED = 'MAJOR_INCIDENT_AUTOMATION_DISABLED',
}

export enum WarningSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface PolicyWarning {
  code: PolicyCode;
  severity: WarningSeverity;
  message: string;
  targets: string[];
}

export interface PolicyResult {
  disabledFeatures: string[];
  warnings: PolicyWarning[];
  metadata: Record<string, unknown>;
}

export interface OnboardingContext {
  status: 'active' | 'pending' | 'suspended';
  schemaVersion: number;
  policySetVersion: string | null;
  activeSuites: SuiteType[];
  enabledModules: Record<SuiteType, ModuleType[]>;
  activeFrameworks: FrameworkType[];
  maturity: MaturityLevel;
  metadata: {
    initializedAt: Date | null;
    lastUpdatedAt: Date | null;
  };
}

export interface OnboardingContextWithPolicy {
  context: OnboardingContext;
  policy: PolicyResult;
}

export const DEFAULT_ONBOARDING_CONTEXT: OnboardingContext = {
  status: 'active',
  schemaVersion: 1,
  policySetVersion: null,
  activeSuites: [],
  enabledModules: {
    [SuiteType.GRC_SUITE]: [],
    [SuiteType.ITSM_SUITE]: [],
  },
  activeFrameworks: [],
  maturity: MaturityLevel.FOUNDATIONAL,
  metadata: {
    initializedAt: null,
    lastUpdatedAt: null,
  },
};

export const DEFAULT_POLICY_RESULT: PolicyResult = {
  disabledFeatures: [],
  warnings: [],
  metadata: {},
};

// ============================================================================
// Onboarding Core API
// ============================================================================

export const onboardingApi = {
  getContext: (tenantId: string) =>
    api.get(API_PATHS.ONBOARDING.CONTEXT, withTenantId(tenantId)),
};

// ============================================================================
// Framework Activation API (Tenant-level compliance frameworks)
// ============================================================================

export interface GrcFrameworkData {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantFrameworksResponse {
  activeKeys: string[];
}

export const grcFrameworksApi = {
  list: () => api.get<{ frameworks: GrcFrameworkData[] }>(API_PATHS.GRC_FRAMEWORKS.LIST),
};

export const tenantFrameworksApi = {
  get: (tenantId: string) =>
    api.get<TenantFrameworksResponse>(API_PATHS.TENANT_FRAMEWORKS.GET, withTenantId(tenantId)),

  update: (tenantId: string, activeKeys: string[]) =>
    api.put<TenantFrameworksResponse>(
      API_PATHS.TENANT_FRAMEWORKS.UPDATE,
      { activeKeys },
      withTenantId(tenantId)
    ),
};

// ============================================================================
// Standards Library API (Audit Phase 2)
// ============================================================================

export interface StandardData {
  id: string;
  code: string;
  name: string;
  shortName?: string | null;
  version: string;
  description?: string | null;
  publisher?: string | null;
  effectiveDate?: string | null;
  domain?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClauseData {
  id: string;
  standardId: string;
  parentClauseId?: string | null;
  code: string;
  title: string;
  description?: string | null;
  descriptionLong?: string | null;
  level: number;
  sortOrder: number;
  path?: string | null;
  isAuditable: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClauseTreeNode {
  id: string;
  code: string;
  title: string;
  description: string | null;
  level: number;
  sortOrder: number;
  path: string | null;
  isAuditable: boolean;
  children: ClauseTreeNode[];
}

export interface StandardWithClauses extends StandardData {
  clauseTree: ClauseTreeNode[];
}

export interface AuditScopeStandard {
  id: string;
  auditId: string;
  standardId: string;
  scopeType: 'full' | 'partial';
  isLocked: boolean;
  lockedAt?: string | null;
  lockedBy?: string | null;
  notes?: string | null;
  standard?: StandardData;
}

export interface AuditScopeClause {
  id: string;
  auditId: string;
  clauseId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'not_applicable';
  isLocked: boolean;
  notes?: string | null;
  clause?: ClauseData;
}

export interface AuditScope {
  standards: AuditScopeStandard[];
  clauses: AuditScopeClause[];
  isLocked: boolean;
}

export const standardsLibraryApi = {
  list: () => api.get(API_PATHS.STANDARDS_LIBRARY.LIST),

  get: (id: string) => api.get(API_PATHS.STANDARDS_LIBRARY.GET(id)),

  getWithClauses: (id: string) =>
    api.get(API_PATHS.STANDARDS_LIBRARY.GET_WITH_CLAUSES(id)),

  create: (data: {
    code: string;
    name: string;
    shortName?: string;
    version: string;
    description?: string;
    publisher?: string;
    effectiveDate?: string;
    domain?: string;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }) => api.post(API_PATHS.STANDARDS_LIBRARY.CREATE, data),

  update: (
    id: string,
    data: {
      code?: string;
      name?: string;
      shortName?: string;
      version?: string;
      description?: string;
      publisher?: string;
      effectiveDate?: string;
      domain?: string;
      isActive?: boolean;
      metadata?: Record<string, unknown>;
    }
  ) => api.patch(API_PATHS.STANDARDS_LIBRARY.UPDATE(id), data),

  delete: (id: string) => api.delete(API_PATHS.STANDARDS_LIBRARY.DELETE(id)),

  getSummary: () => api.get(API_PATHS.STANDARDS_LIBRARY.SUMMARY),

  getClauses: (standardId: string) =>
    api.get(API_PATHS.STANDARDS_LIBRARY.CLAUSES(standardId)),

  getClausesTree: (standardId: string) =>
    api.get(API_PATHS.STANDARDS_LIBRARY.CLAUSES_TREE(standardId)),

  createClause: (
    standardId: string,
    data: {
      code: string;
      title: string;
      description?: string;
      descriptionLong?: string;
      parentClauseId?: string;
      level?: number;
      sortOrder?: number;
      path?: string;
      isAuditable?: boolean;
      metadata?: Record<string, unknown>;
    }
  ) => api.post(API_PATHS.STANDARDS_LIBRARY.CREATE_CLAUSE(standardId), data),

  getClause: (clauseId: string) =>
    api.get(API_PATHS.STANDARDS_LIBRARY.GET_CLAUSE(clauseId)),

  updateClause: (
    clauseId: string,
    data: {
      code?: string;
      title?: string;
      description?: string;
      descriptionLong?: string;
      parentClauseId?: string;
      level?: number;
      sortOrder?: number;
      path?: string;
      isAuditable?: boolean;
      metadata?: Record<string, unknown>;
    }
  ) => api.patch(API_PATHS.STANDARDS_LIBRARY.UPDATE_CLAUSE(clauseId), data),
};

// ============================================================================
// Audit Scope API (Audit Phase 2)
// ============================================================================

export const auditScopeApi = {
  getScope: (auditId: string) => api.get(API_PATHS.AUDIT_SCOPE.GET(auditId)),

  setScope: (
    auditId: string,
    data: {
      standardIds: string[];
      clauseIds?: string[];
    }
  ) => api.post(API_PATHS.AUDIT_SCOPE.SET(auditId), data),

  lockScope: (auditId: string) =>
    api.post(API_PATHS.AUDIT_SCOPE.LOCK(auditId)),

  getClauseFindings: (auditId: string, clauseId: string) =>
    api.get(API_PATHS.AUDIT_SCOPE.CLAUSE_FINDINGS(auditId, clauseId)),

  linkFindingToClause: (
    auditId: string,
    clauseId: string,
    data: {
      issueId: string;
      notes?: string;
    }
  ) => api.post(API_PATHS.AUDIT_SCOPE.LINK_FINDING(auditId, clauseId), data),

  unlinkFindingFromClause: (auditId: string, clauseId: string, issueId: string) =>
    api.delete(API_PATHS.AUDIT_SCOPE.UNLINK_FINDING(auditId, clauseId, issueId)),
};

// ============================================================================
// Data Model Dictionary Types (Admin Studio FAZ 2)
// ============================================================================

export type DictionaryFieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'uuid'
  | 'enum'
  | 'json'
  | 'reference'
  | 'unknown';

export type DictionaryRelationshipType =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many';

export interface DictionaryField {
  name: string;
  columnName: string;
  type: DictionaryFieldType;
  label: string;
  description: string | null;
  isRequired: boolean;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isGenerated: boolean;
  isAuditField: boolean;
  isTenantScoped: boolean;
  defaultValue: unknown | null;
  enumValues: string[] | null;
  referenceTarget: string | null;
  maxLength: number | null;
}

export interface DictionaryRelationship {
  name: string;
  type: DictionaryRelationshipType;
  sourceTable: string;
  sourceField: string;
  targetTable: string;
  targetField: string;
  isNullable: boolean;
  isCascade: boolean;
  inverseRelationship: string | null;
}

export interface DictionaryTable {
  name: string;
  tableName: string;
  label: string;
  description: string | null;
  isTenantScoped: boolean;
  hasSoftDelete: boolean;
  hasAuditFields: boolean;
  fields: DictionaryField[];
  relationships: DictionaryRelationship[];
  primaryKeyField: string;
}

export interface DotWalkSegment {
  field: string;
  targetTable: string;
  relationshipType: DictionaryRelationshipType;
}

export interface DotWalkPath {
  path: string;
  segments: DotWalkSegment[];
  reachableTables: string[];
}

export interface DataModelSummary {
  totalTables: number;
  totalRelationships: number;
  tenantScopedTables: number;
  tablesWithSoftDelete: number;
  relationshipsByType: Record<DictionaryRelationshipType, number>;
}

export interface DataModelGraphNode {
  id: string;
  label: string;
  tableName: string;
  fieldCount: number;
  isTenantScoped: boolean;
  hasSoftDelete: boolean;
}

export interface DataModelGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: DictionaryRelationshipType;
  sourceField: string;
}

export interface DataModelGraph {
  nodes: DataModelGraphNode[];
  edges: DataModelGraphEdge[];
}

// ============================================================================
// Data Model Dictionary API (Admin Studio FAZ 2)
// ============================================================================

export const dataModelApi = {
  listTables: (options?: {
    tenantScopedOnly?: boolean;
    withRelationships?: boolean;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.tenantScopedOnly) params.append('tenantScopedOnly', 'true');
    if (options?.withRelationships) params.append('withRelationships', 'true');
    if (options?.search) params.append('search', options.search);
    const queryString = params.toString();
    return api.get(`${API_PATHS.DATA_MODEL.TABLES}${queryString ? `?${queryString}` : ''}`);
  },

  getTable: (name: string) => api.get(API_PATHS.DATA_MODEL.TABLE(name)),

  getTableRelationships: (name: string) =>
    api.get(API_PATHS.DATA_MODEL.TABLE_RELATIONSHIPS(name)),

  getDotWalkingPaths: (name: string, maxDepth?: number) => {
    const params = maxDepth ? `?maxDepth=${maxDepth}` : '';
    return api.get(`${API_PATHS.DATA_MODEL.TABLE_DOT_WALKING(name)}${params}`);
  },

  listRelationships: () => api.get(API_PATHS.DATA_MODEL.RELATIONSHIPS),

  getSummary: () => api.get(API_PATHS.DATA_MODEL.SUMMARY),

  getGraph: () => api.get(API_PATHS.DATA_MODEL.GRAPH),

  refreshCache: () => api.get(API_PATHS.DATA_MODEL.REFRESH),
};
