import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getApiBaseUrl } from '../config';
import { recordApiCall } from './telemetryService';

// Use Cursor's config helper for API base URL (environmental correctness)
const API_BASE_URL = getApiBaseUrl();

// Shared constant for tenant ID storage key to ensure consistency
export const STORAGE_TENANT_ID_KEY = 'tenantId';

/**
 * Standard API Error Response
 * Matches the backend's GlobalExceptionFilter error format
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    fieldErrors?: Array<{
      field: string;
      message: string;
    }>;
  };
}

/**
 * Standard API Success Response
 * Matches the backend's ResponseTransformInterceptor format
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    limit?: number;
    offset?: number;
  };
}

/**
 * Custom API Error class for standardized error handling
 */
export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  fieldErrors?: Array<{ field: string; message: string }>;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    fieldErrors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

// Flag to prevent double-registration of interceptors
let interceptorsRegistered = false;

/**
 * Resolves token from localStorage with support for multiple formats.
 * Checks in order: token, accessToken (for backward compatibility).
 * 
 * @returns Token string or null if not found
 */
export function getToken(): string | null {
  return localStorage.getItem('token') || localStorage.getItem('accessToken');
}

/**
 * Resolves tenant ID from localStorage.
 * 
 * @returns Tenant ID string or null if not found
 */
export function getTenantId(): string | null {
  return localStorage.getItem(STORAGE_TENANT_ID_KEY);
}

/**
 * Extracts token from API response with support for multiple envelope formats.
 * Handles:
 * - NestJS envelope: { success: true, data: { accessToken } } or { success: true, data: { token } }
 * - Legacy Express: { token } or { accessToken }
 * - Direct: { accessToken } or { token }
 * 
 * @param responseData - Response data from API
 * @returns Token string or undefined if not found
 */
export function extractTokenFromResponse(responseData: unknown): string | undefined {
  if (!responseData || typeof responseData !== 'object') {
    return undefined;
  }

  const data = responseData as Record<string, unknown>;

  // Handle NestJS envelope format: { success: true, data: { accessToken/token } }
  if (data.success === true && data.data && typeof data.data === 'object') {
    const innerData = data.data as Record<string, unknown>;
    return (innerData.accessToken || innerData.token) as string | undefined;
  }

  // Handle legacy Express format or direct format: { accessToken } or { token }
  return (data.accessToken || data.token) as string | undefined;
}

/**
 * Injects auth token and tenant ID headers into request config.
 * This is the single source of truth for header injection.
 * 
 * @param config - Axios request config
 * @returns Modified config with headers
 */
function injectAuthHeaders(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const tenantId = getTenantId();
  if (tenantId) {
    config.headers['x-tenant-id'] = tenantId;
  } else if (process.env.NODE_ENV === 'development') {
    // Dev-only: log when tenantId is missing for tenant-required endpoints
    const tenantRequiredPaths = ['/onboarding/context', '/grc/audits', '/grc/risks', '/grc/policies'];
    if (tenantRequiredPaths.some(path => config.url?.includes(path))) {
      console.warn(`[API Interceptor] Missing tenantId for tenant-required endpoint: ${config.url}`);
    }
  }

  return config;
}

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Sets up request and response interceptors for the API client.
 * Guards against double-registration to ensure interceptors are only registered once.
 */
function setupInterceptors() {
  if (interceptorsRegistered) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[API] Interceptors already registered, skipping duplicate registration');
    }
    return;
  }

  // Request interceptor to add auth token and tenant ID (single source of truth)
  api.interceptors.request.use(
    (config) => {
      return injectAuthHeaders(config);
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  interceptorsRegistered = true;
}

// Register interceptors immediately
setupInterceptors();

// Response interceptor to handle standard error envelope and auth errors with token refresh
api.interceptors.response.use(
  (response) => {
    // Record successful API calls for telemetry context
    const endpoint = response.config.url || 'unknown';
    const correlationId = response.headers['x-correlation-id'];
    recordApiCall(endpoint, correlationId);
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { 
      _retry?: boolean;
      _retryForMissingAuth?: boolean;
    };

    // Check if response follows the standard error envelope format
    const errorResponse = error.response?.data;
    if (errorResponse && errorResponse.success === false && errorResponse.error) {
      // Transform to ApiError for consistent error handling
      const apiError = new ApiError(
        errorResponse.error.code,
        errorResponse.error.message,
        errorResponse.error.details,
        errorResponse.error.fieldErrors
      );
      
      // For 401 errors, continue with token refresh logic below
      // For other errors, reject with the standardized ApiError
      if (error.response?.status !== 401) {
        return Promise.reject(apiError);
      }
    }

    // Handle 401 errors
    if (error.response?.status === 401) {
      // Don't try to refresh if this was already a refresh request
      if (originalRequest.url?.includes('/auth/refresh')) {
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // One-time retry for missing token/tenant at request time
      // This handles transient cases where token/tenant becomes available shortly after request
      if (!originalRequest._retryForMissingAuth) {
        const hadTokenAtRequest = !!originalRequest.headers.Authorization;
        const hadTenantAtRequest = !!originalRequest.headers['x-tenant-id'];
        
        // Check if token/tenant are now available (they weren't at request time)
        const tokenNow = getToken();
        const tenantNow = getTenantId();
        
        // Only retry if:
        // 1. Token or tenant was missing at request time
        // 2. Token or tenant is now available
        // 3. We haven't already retried for this reason
        if ((!hadTokenAtRequest && tokenNow) || (!hadTenantAtRequest && tenantNow)) {
          originalRequest._retryForMissingAuth = true;
          // Re-inject headers with newly available token/tenant
          injectAuthHeaders(originalRequest);
          // Retry the request once
          return api(originalRequest);
        }
      }

      // Standard token refresh flow (if we have a refresh token)
      if (!originalRequest._retry) {
        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = localStorage.getItem('refreshToken');

        if (!refreshToken) {
          localStorage.removeItem('token');
          localStorage.removeItem('accessToken');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          // Use centralized token extraction helper
          const newToken = extractTokenFromResponse(response.data);
          const responseData = response.data as Record<string, unknown>;
          let newRefreshToken: string | undefined;
          
          // Extract refresh token (similar pattern)
          if (responseData.success === true && responseData.data && typeof responseData.data === 'object') {
            const innerData = responseData.data as Record<string, unknown>;
            newRefreshToken = innerData.refreshToken as string | undefined;
          } else {
            newRefreshToken = responseData.refreshToken as string | undefined;
          }

          if (!newToken) {
            throw new Error('Refresh response did not contain a valid token');
          }

          localStorage.setItem('token', newToken);
          localStorage.setItem('accessToken', newToken);
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }

          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          
          // Also inject tenant header if available
          const tenantId = getTenantId();
          if (tenantId) {
            originalRequest.headers['x-tenant-id'] = tenantId;
          }

          processQueue(null, newToken);

          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError as Error, null);
          localStorage.removeItem('token');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem(STORAGE_TENANT_ID_KEY);
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    }

    return Promise.reject(error);
  }
);
import { getApiBaseUrl } from '../config';

// Request cancellation map for AbortController support
const cancelTokenSources = new Map<string, CancelTokenSource>();

// Create cancel token for a request
function getCancelToken(key: string): { cancelToken: any; cancelKey: string } {
  // Cancel previous request with same key
  const existing = cancelTokenSources.get(key);
  if (existing) {
    existing.cancel('Request superseded by newer request');
  }

  // Create new cancel token
  const source = axios.CancelToken.source();
  cancelTokenSources.set(key, source);

  return { cancelToken: source.token, cancelKey: key };
}

// Use Cursor's config helper for API base URL (environmental correctness)
const API_BASE_URL = getApiBaseUrl();

// Shared constant for tenant ID storage key to ensure consistency
export const STORAGE_TENANT_ID_KEY = 'tenantId';

export function getAuthToken(): string | null {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  if (!token || token.trim().length === 0) {
    return null;
  }
  return token;
}

export function getTenantId(): string | null {
  const tenantId = localStorage.getItem(STORAGE_TENANT_ID_KEY);
  if (!tenantId || tenantId.trim().length === 0) {
    return null;
  }
  return tenantId;
}

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  const tenantId = getTenantId();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  return headers;
}

/**
 * Standard API Error Response
 * Matches the backend's GlobalExceptionFilter error format
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    fieldErrors?: Array<{
      field: string;
      message: string;
    }>;
  };
}

/**
 * Standard API Success Response
 * Matches the backend's ResponseTransformInterceptor format
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    limit?: number;
    offset?: number;
  };
}

/**
 * Custom API Error class for standardized error handling
 */
export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  fieldErrors?: Array<{ field: string; message: string }>;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    fieldErrors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export function applyAuthInterceptors(instance: AxiosInstance): void {
  instance.interceptors.request.use(
    (config) => {
      config.headers = config.headers ?? {};
      const token = getAuthToken();
      const tenantId = getTenantId();

      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (tenantId && !config.headers['x-tenant-id']) {
        config.headers['x-tenant-id'] = tenantId;
      } else if (!tenantId && process.env.NODE_ENV === 'development') {
        // Dev-only: log when tenantId is missing for tenant-required endpoints
        const tenantRequiredPaths = ['/onboarding/context', '/grc/audits', '/grc/risks', '/grc/policies'];
        if (tenantRequiredPaths.some(path => config.url?.includes(path))) {
          console.warn(`[API Interceptor] Missing tenantId for tenant-required endpoint: ${config.url}`);
        }
      }

      // Add cancel token for GET requests (especially list endpoints)
      // This allows cancelling previous requests when new ones are made
      if (config.method?.toLowerCase() === 'get') {
        const cancelKey = `${config.method}:${config.url}`;
        const { cancelToken } = getCancelToken(cancelKey);
        config.cancelToken = cancelToken;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
}

// Request interceptor to add auth token and tenant ID
applyAuthInterceptors(api);

// Response interceptor to handle standard error envelope and auth errors with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _retryAuth?: boolean;
    };

    // Handle 429 Rate Limit errors - don't break UI, show user-friendly message
    if (error.response?.status === 429) {
      const errorResponse = error.response?.data;
      const retryAfter = error.response?.headers['retry-after'];
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
      
      // Create user-friendly rate limit error
      const rateLimitError = new ApiError(
        errorResponse?.error?.code || 'RATE_LIMITED',
        errorResponse?.error?.message || `Çok fazla istek yapıldı. ${retryAfterSeconds} saniye sonra tekrar deneyin.`,
        {
          retryAfter: retryAfterSeconds,
          scope: errorResponse?.error?.details?.scope || 'read',
        }
      );
      
      // Reject with rate limit error - let UI handle gracefully (show message, keep previous data)
      return Promise.reject(rateLimitError);
    }

    // Check if response follows the standard error envelope format
    const errorResponse = error.response?.data;
    if (errorResponse && errorResponse.success === false && errorResponse.error) {
      // Transform to ApiError for consistent error handling
      const apiError = new ApiError(
        errorResponse.error.code,
        errorResponse.error.message,
        errorResponse.error.details,
        errorResponse.error.fieldErrors
      );
      
      // For 401 errors, continue with token refresh logic below
      // For other errors, reject with the standardized ApiError
      if (error.response?.status !== 401) {
        return Promise.reject(apiError);
      }
    }

    // If error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      const token = getAuthToken();
      const tenantId = getTenantId();
      const hasAuthHeader = Boolean(originalRequest.headers?.Authorization);
      const hasTenantHeader = Boolean(originalRequest.headers?.['x-tenant-id']);

      // Handle auth/tenant timing: retry once if headers were missing but became available.
      if (!originalRequest._retryAuth && (token || tenantId) && (!hasAuthHeader || !hasTenantHeader)) {
        originalRequest._retryAuth = true;
        originalRequest.headers = originalRequest.headers ?? {};
        if (token && !hasAuthHeader) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        if (tenantId && !hasTenantHeader) {
          originalRequest.headers['x-tenant-id'] = tenantId;
        }
        return api(originalRequest);
      }

      // Don't try to refresh if this was already a refresh request
      if (originalRequest.url?.includes('/auth/refresh')) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { headers: buildAuthHeaders() }
        );

        // Handle both envelope format { success, data: { accessToken } } and legacy { token }
        let newToken: string | undefined;
        let newRefreshToken: string | undefined;
        
        if (response.data && response.data.success === true && response.data.data) {
          // NestJS envelope format
          newToken = response.data.data.accessToken || response.data.data.token;
          newRefreshToken = response.data.data.refreshToken;
        } else {
          // Legacy Express format
          newToken = response.data.token;
          newRefreshToken = response.data.refreshToken;
        }

        if (!newToken) {
          throw new Error('Refresh response did not contain a valid token');
        }

        localStorage.setItem('token', newToken);
        localStorage.setItem('accessToken', newToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        processQueue(null, newToken);

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem(STORAGE_TENANT_ID_KEY);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
