import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

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

// Request interceptor to add auth token and tenant ID
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Auto-add tenant ID header if available
    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle standard error envelope and auth errors with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

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
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { token: newToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem('token', newToken);
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
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
