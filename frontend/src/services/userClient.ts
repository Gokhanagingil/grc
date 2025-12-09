/**
 * User Client
 * 
 * Dedicated API client for User Management operations that supports both
 * Express (legacy) and NestJS backends with automatic response adaptation.
 * 
 * This client:
 * - Selects the appropriate backend based on REACT_APP_USER_API_MODE
 * - Normalizes response formats between Express and NestJS
 * - Handles ID format differences (integer vs UUID)
 * - Provides a consistent interface for the UI layer
 */

import axios, { AxiosInstance } from 'axios';
import { getUserApiMode, getUserApiBaseUrl, UserApiMode } from './userApiConfig';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Normalized User interface for the UI layer.
 * Uses snake_case to match the existing UserManagement.tsx expectations.
 * The `id` field is string | number to support both Express (integer) and NestJS (UUID).
 */
export interface User {
  id: string | number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * User data for create/update operations
 */
export interface UserFormData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  password?: string;
  isActive?: boolean;
}

/**
 * Paginated response for user listing
 */
export interface UserListResponse {
  users: User[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Express backend raw user format
 */
interface ExpressUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string | null;
  is_active: boolean | number;
  created_at: string;
}

/**
 * NestJS backend user format (camelCase)
 */
interface NestUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string | null;
  isActive: boolean;
  createdAt: string;
}

/**
 * Express response format (raw data)
 */
interface ExpressListResponse {
  users: ExpressUser[];
  total?: number;
  page?: number;
  limit?: number;
}

/**
 * NestJS response format (envelope)
 */
interface NestListResponse {
  success: boolean;
  data: {
    users: NestUser[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

/**
 * NestJS single item response format
 */
interface NestSingleResponse<T> {
  success: boolean;
  data: T;
}

// ============================================================================
// Response Adapters
// ============================================================================

/**
 * Normalize an Express user to the common User interface
 */
function normalizeExpressUser(user: ExpressUser): User {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    department: user.department,
    is_active: Boolean(user.is_active),
    created_at: user.created_at,
  };
}

/**
 * Normalize a NestJS user to the common User interface
 */
function normalizeNestUser(user: NestUser): User {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    role: user.role,
    department: user.department,
    is_active: user.isActive,
    created_at: user.createdAt,
  };
}

/**
 * Adapt Express list response to normalized format
 */
function adaptExpressListResponse(response: ExpressListResponse): UserListResponse {
  return {
    users: (response.users || []).map(normalizeExpressUser),
    pagination: response.total ? {
      page: response.page || 1,
      limit: response.limit || response.users?.length || 10,
      total: response.total,
      pages: Math.ceil(response.total / (response.limit || response.users?.length || 10)),
    } : undefined,
  };
}

/**
 * Adapt NestJS list response to normalized format
 */
function adaptNestListResponse(response: NestListResponse): UserListResponse {
  const data = response.data;
  return {
    users: (data.users || []).map(normalizeNestUser),
    pagination: data.pagination,
  };
}

/**
 * Adapt any list response based on its format
 */
function adaptListResponse(data: unknown, mode: UserApiMode): UserListResponse {
  if (mode === 'nest' && isNestEnvelope(data)) {
    return adaptNestListResponse(data as NestListResponse);
  }
  
  // Express format or fallback
  return adaptExpressListResponse(data as ExpressListResponse);
}

/**
 * Adapt single user response based on format
 */
function adaptSingleUserResponse(data: unknown, mode: UserApiMode): User {
  if (mode === 'nest' && isNestEnvelope(data)) {
    const nestResponse = data as NestSingleResponse<NestUser>;
    return normalizeNestUser(nestResponse.data);
  }
  
  // Express format - could be raw user or wrapped
  if (isExpressUser(data)) {
    return normalizeExpressUser(data);
  }
  
  // Handle case where Express wraps in { user: ... }
  const wrapped = data as { user?: ExpressUser };
  if (wrapped.user) {
    return normalizeExpressUser(wrapped.user);
  }
  
  throw new Error('Unable to parse user response');
}

/**
 * Type guard for NestJS envelope format
 */
function isNestEnvelope(data: unknown): data is { success: boolean; data: unknown } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    'data' in data
  );
}

/**
 * Type guard for Express user format
 */
function isExpressUser(data: unknown): data is ExpressUser {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof (data as ExpressUser).id === 'number' &&
    'username' in data
  );
}

// ============================================================================
// Request Adapters
// ============================================================================

/**
 * Convert form data to Express format (snake_case)
 */
function toExpressUserData(formData: UserFormData): Record<string, unknown> {
  const data: Record<string, unknown> = {
    username: formData.username,
    email: formData.email,
    first_name: formData.firstName,
    last_name: formData.lastName,
    role: formData.role,
  };
  
  if (formData.department !== undefined) {
    data.department = formData.department;
  }
  if (formData.password) {
    data.password = formData.password;
  }
  if (formData.isActive !== undefined) {
    data.is_active = formData.isActive;
  }
  
  return data;
}

/**
 * Convert form data to NestJS format (camelCase)
 */
function toNestUserData(formData: UserFormData): Record<string, unknown> {
  const data: Record<string, unknown> = {
    username: formData.username,
    email: formData.email,
    firstName: formData.firstName,
    lastName: formData.lastName,
    role: formData.role,
  };
  
  if (formData.department !== undefined) {
    data.department = formData.department;
  }
  if (formData.password) {
    data.password = formData.password;
  }
  if (formData.isActive !== undefined) {
    data.isActive = formData.isActive;
  }
  
  return data;
}

/**
 * Convert form data to the appropriate backend format
 */
function toBackendUserData(formData: UserFormData, mode: UserApiMode): Record<string, unknown> {
  return mode === 'nest' ? toNestUserData(formData) : toExpressUserData(formData);
}

// ============================================================================
// User Client Class
// ============================================================================

/**
 * User API Client with mode-based routing and response adaptation
 */
class UserClient {
  private axiosInstance: AxiosInstance;
  private mode: UserApiMode;

  constructor() {
    this.mode = getUserApiMode();
    this.axiosInstance = this.createAxiosInstance();
  }

  private createAxiosInstance(): AxiosInstance {
    const baseURL = getUserApiBaseUrl(this.mode);
    
    const instance = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token and tenant ID
    instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add tenant ID header for NestJS
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId) {
          config.headers['x-tenant-id'] = tenantId;
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    return instance;
  }

  /**
   * Get the current API mode
   */
  getMode(): UserApiMode {
    return this.mode;
  }

  /**
   * Get the users endpoint path
   */
  private getUsersPath(): string {
    return '/users';
  }

  /**
   * List all users with optional pagination
   */
  async list(params?: { page?: number; limit?: number; search?: string }): Promise<UserListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.search) queryParams.set('search', params.search);
    
    const queryString = queryParams.toString();
    const url = `${this.getUsersPath()}${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.axiosInstance.get(url);
    return adaptListResponse(response.data, this.mode);
  }

  /**
   * Get a single user by ID
   */
  async get(id: string | number): Promise<User> {
    const response = await this.axiosInstance.get(`${this.getUsersPath()}/${id}`);
    return adaptSingleUserResponse(response.data, this.mode);
  }

  /**
   * Create a new user
   */
  async create(formData: UserFormData): Promise<User> {
    const data = toBackendUserData(formData, this.mode);
    const response = await this.axiosInstance.post(this.getUsersPath(), data);
    return adaptSingleUserResponse(response.data, this.mode);
  }

  /**
   * Update an existing user
   */
  async update(id: string | number, formData: Partial<UserFormData>): Promise<User> {
    const data = toBackendUserData(formData as UserFormData, this.mode);
    
    // Remove undefined values
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    
    const response = await this.axiosInstance.put(`${this.getUsersPath()}/${id}`, data);
    return adaptSingleUserResponse(response.data, this.mode);
  }

  /**
   * Delete a user
   */
  async delete(id: string | number): Promise<void> {
    await this.axiosInstance.delete(`${this.getUsersPath()}/${id}`);
  }

  /**
   * Activate a user account
   */
  async activate(id: string | number): Promise<User> {
    const response = await this.axiosInstance.put(`${this.getUsersPath()}/${id}/activate`);
    return adaptSingleUserResponse(response.data, this.mode);
  }

  /**
   * Deactivate a user account
   */
  async deactivate(id: string | number): Promise<User> {
    const response = await this.axiosInstance.put(`${this.getUsersPath()}/${id}/deactivate`);
    return adaptSingleUserResponse(response.data, this.mode);
  }

  /**
   * Update user role
   */
  async updateRole(id: string | number, role: string): Promise<User> {
    const response = await this.axiosInstance.put(`${this.getUsersPath()}/${id}/role`, { role });
    return adaptSingleUserResponse(response.data, this.mode);
  }

  /**
   * Change user password
   */
  async changePassword(id: string | number, currentPassword: string, newPassword: string): Promise<void> {
    await this.axiosInstance.put(`${this.getUsersPath()}/${id}/password`, {
      currentPassword,
      newPassword,
    });
  }

  /**
   * Get user statistics
   */
  async getStatistics(): Promise<Record<string, unknown>> {
    const response = await this.axiosInstance.get(`${this.getUsersPath()}/statistics/overview`);
    
    if (this.mode === 'nest' && isNestEnvelope(response.data)) {
      return (response.data as NestSingleResponse<Record<string, unknown>>).data;
    }
    
    return response.data;
  }

  /**
   * Get departments list
   */
  async getDepartments(): Promise<string[]> {
    const response = await this.axiosInstance.get(`${this.getUsersPath()}/departments/list`);
    
    if (this.mode === 'nest' && isNestEnvelope(response.data)) {
      return (response.data as NestSingleResponse<string[]>).data;
    }
    
    return response.data.departments || response.data || [];
  }
}

// ============================================================================
// Singleton Instance & Exports
// ============================================================================

/**
 * Singleton instance of the UserClient
 */
let userClientInstance: UserClient | null = null;

/**
 * Get the UserClient singleton instance
 */
export function getUserClient(): UserClient {
  if (!userClientInstance) {
    userClientInstance = new UserClient();
  }
  return userClientInstance;
}

/**
 * Reset the UserClient instance (useful for testing or mode changes)
 */
export function resetUserClient(): void {
  userClientInstance = null;
}

/**
 * Default export for convenience
 */
export const userClient = {
  list: (params?: { page?: number; limit?: number; search?: string }) => 
    getUserClient().list(params),
  get: (id: string | number) => 
    getUserClient().get(id),
  create: (formData: UserFormData) => 
    getUserClient().create(formData),
  update: (id: string | number, formData: Partial<UserFormData>) => 
    getUserClient().update(id, formData),
  delete: (id: string | number) => 
    getUserClient().delete(id),
  activate: (id: string | number) => 
    getUserClient().activate(id),
  deactivate: (id: string | number) => 
    getUserClient().deactivate(id),
  updateRole: (id: string | number, role: string) => 
    getUserClient().updateRole(id, role),
  changePassword: (id: string | number, currentPassword: string, newPassword: string) => 
    getUserClient().changePassword(id, currentPassword, newPassword),
  getStatistics: () => 
    getUserClient().getStatistics(),
  getDepartments: () => 
    getUserClient().getDepartments(),
  getMode: () => 
    getUserClient().getMode(),
};

export default userClient;
