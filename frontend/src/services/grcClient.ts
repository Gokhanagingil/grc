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
  // Auth endpoints
  AUTH: {
    LOGIN: '/auth/login',
    ME: '/users/me', // NestJS uses /users/me instead of /auth/me
    REFRESH: '/auth/refresh',
    REGISTER: '/auth/register', // Legacy Express endpoint
  },

  // GRC Risk endpoints
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

  // GRC Policy endpoints (Governance)
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
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Standard paginated response from NestJS backend
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
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
 * Unwrap paginated NestJS response
 */
export function unwrapPaginatedResponse<T>(response: { data: unknown }): { items: T[]; total: number; page: number; pageSize: number } {
  const data = response.data as PaginatedResponse<T> | { items: T[]; total: number };
  
  if ('success' in data && data.success && 'data' in data && 'meta' in data) {
    return {
      items: data.data,
      total: data.meta.total,
      page: data.meta.page,
      pageSize: data.meta.pageSize,
    };
  }
  
  // Legacy format
  if ('items' in data) {
    return {
      items: data.items,
      total: data.total,
      page: 1,
      pageSize: data.items.length,
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
export function unwrapPaginatedPolicyResponse<T extends Record<string, unknown>>(
  response: { data: unknown }
): { items: T[]; total: number; page: number; pageSize: number } {
  const result = unwrapPaginatedResponse<T>(response);
  return {
    ...result,
    items: result.items.map(item => transformPolicyResponse(item)),
  };
}

/**
 * Unwrap paginated requirement response with field transformation
 */
export function unwrapPaginatedRequirementResponse<T extends Record<string, unknown>>(
  response: { data: unknown }
): { items: T[]; total: number; page: number; pageSize: number } {
  const result = unwrapPaginatedResponse<T>(response);
  return {
    ...result,
    items: result.items.map(item => transformRequirementResponse(item)),
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
  login: (email: string, password: string) => 
    api.post(API_PATHS.AUTH.LOGIN, { email, password }),
  
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
