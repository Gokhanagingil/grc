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
// Dashboard API (Aggregated from summary endpoints)
// ============================================================================

export const dashboardApi = {
  /**
   * Get dashboard overview by aggregating data from multiple summary endpoints
   * Enhanced with KPI-ready fields for Dashboard
   */
  getOverview: async (tenantId: string): Promise<DashboardOverview> => {
    try {
      const [riskSummary, policySummary, requirementSummary, incidentSummary] = await Promise.all([
        riskApi.summary(tenantId).catch(() => ({ data: null })),
        policyApi.summary(tenantId).catch(() => ({ data: null })),
        requirementApi.summary(tenantId).catch(() => ({ data: null })),
        incidentApi.summary(tenantId).catch(() => ({ data: null })),
      ]);

      // Extract data from responses, handling both envelope and flat formats
      const riskData = unwrapResponse<{
        totalCount?: number;
        total?: number;
        byStatus?: Record<string, number>;
        bySeverity?: Record<string, number>;
        highPriorityCount?: number;
        overdueCount?: number;
        top5OpenRisks?: Array<{
          id: string;
          title: string;
          severity: string;
          score: number | null;
        }>;
      }>(riskSummary) || {};
      
      const policyData = unwrapResponse<{
        totalCount?: number;
        total?: number;
        byStatus?: Record<string, number>;
        activeCount?: number;
        draftCount?: number;
        policyCoveragePercentage?: number;
      }>(policySummary) || {};
      
      const requirementData = unwrapResponse<{
        totalCount?: number;
        total?: number;
        byStatus?: Record<string, number>;
        compliantCount?: number;
        nonCompliantCount?: number;
        inProgressCount?: number;
        requirementCoveragePercentage?: number;
      }>(requirementSummary) || {};
      
      const incidentData = unwrapResponse<{
        totalCount?: number;
        total?: number;
        byStatus?: Record<string, number>;
        openCount?: number;
        closedCount?: number;
        resolvedCount?: number;
        resolvedToday?: number;
        avgResolutionTimeHours?: number | null;
      }>(incidentSummary) || {};

      return {
        risks: {
          total: riskData.totalCount || riskData.total || 0,
          open: riskData.byStatus?.['identified'] || riskData.byStatus?.['open'] || 0,
          high: (riskData.bySeverity?.['high'] || 0) + (riskData.bySeverity?.['critical'] || 0),
          overdue: riskData.overdueCount || 0,
          top5OpenRisks: riskData.top5OpenRisks || [],
        },
        compliance: {
          total: requirementData.totalCount || requirementData.total || 0,
          pending: requirementData.byStatus?.['pending'] || requirementData.inProgressCount || 0,
          completed: requirementData.byStatus?.['compliant'] || requirementData.compliantCount || 0,
          overdue: requirementData.byStatus?.['non_compliant'] || requirementData.nonCompliantCount || 0,
          coveragePercentage: requirementData.requirementCoveragePercentage,
        },
        policies: {
          total: policyData.totalCount || policyData.total || 0,
          active: policyData.byStatus?.['active'] || policyData.activeCount || 0,
          draft: policyData.byStatus?.['draft'] || policyData.draftCount || 0,
          coveragePercentage: policyData.policyCoveragePercentage,
        },
        incidents: {
          total: incidentData.totalCount || incidentData.total || 0,
          open: incidentData.openCount || 0,
          closed: incidentData.closedCount || 0,
          resolved: incidentData.resolvedCount || 0,
          resolvedToday: incidentData.resolvedToday,
          avgResolutionTimeHours: incidentData.avgResolutionTimeHours,
        },
        users: {
          total: 0, // User count not available from NestJS summary endpoints
          admins: 0,
          managers: 0,
        },
      };
    } catch (error) {
      console.error('Failed to fetch dashboard overview:', error);
      return {
        risks: { total: 0, open: 0, high: 0, overdue: 0, top5OpenRisks: [] },
        compliance: { total: 0, pending: 0, completed: 0, overdue: 0 },
        policies: { total: 0, active: 0, draft: 0 },
        incidents: { total: 0, open: 0, closed: 0, resolved: 0 },
        users: { total: 0, admins: 0, managers: 0 },
      };
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
