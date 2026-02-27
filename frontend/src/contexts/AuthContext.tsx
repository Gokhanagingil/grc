import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, ApiError, ApiSuccessResponse, STORAGE_TENANT_ID_KEY } from '../services/api';
import { API_PATHS } from '../services/grcClient';
import i18n from '../i18n/config';

/**
 * Helper to unwrap API responses that may be in the new envelope format
 * Handles both: { success: true, data: T } (NestJS) and flat T (legacy Express)
 */
function unwrapApiResponse<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'success' in raw && (raw as { success: boolean }).success === true && 'data' in raw) {
    return (raw as ApiSuccessResponse<T>).data;
  }
  return raw as T;
}

export interface User {
  id: number | string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: 'admin' | 'manager' | 'user';
  tenantId?: string;
  locale?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  hasRole: (roles: string[]) => boolean;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  department: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem('refreshToken'));
  const [loading, setLoading] = useState(true);

  // Role-based access helpers
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  
  const hasRole = useCallback((roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  // Refresh access token using refresh token
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    if (!storedRefreshToken) {
      return false;
    }

    try {
      const response = await api.post('/auth/refresh', { refreshToken: storedRefreshToken });
      // Unwrap the response envelope (handles both NestJS { success, data } and legacy Express flat responses)
      const unwrapped = unwrapApiResponse<{
        accessToken?: string;
        token?: string;
        refreshToken?: string;
      }>(response.data);
      
      const { accessToken, token: legacyToken, refreshToken: newRefreshToken } = unwrapped;
      const newToken = accessToken || legacyToken;
      
      if (!newToken) {
        throw new Error('Refresh response did not contain a valid token');
      }
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('accessToken', newToken);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
        setRefreshToken(newRefreshToken);
      }
      setToken(newToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      return true;
    } catch (error) {
      // Refresh failed, clear tokens
      localStorage.removeItem('token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setToken(null);
      setRefreshToken(null);
      setUser(null);
      delete api.defaults.headers.common['Authorization'];
      return false;
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          // Use /users/me endpoint (NestJS) instead of /auth/me
          const response = await api.get(API_PATHS.AUTH.ME);
          // Unwrap the response envelope (handles both NestJS { success, data } and legacy Express flat responses)
          const userData = unwrapApiResponse<User>(response.data);
          setUser(userData);
          // Store tenant ID if available
          if (userData?.tenantId) {
            localStorage.setItem('tenantId', userData.tenantId);
          }
          // Sync i18n locale from user profile
          if (userData?.locale) {
            i18n.changeLanguage(userData.locale);
            localStorage.setItem('locale', userData.locale);
          }
        } catch (error: unknown) {
          const axiosError = error as { response?: { status?: number } };
          // If token is expired, try to refresh
          if (axiosError.response?.status === 401) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
              try {
                // Use /users/me endpoint (NestJS) instead of /auth/me
                const response = await api.get(API_PATHS.AUTH.ME);
                const userData = unwrapApiResponse<User>(response.data);
                setUser(userData);
                if (userData?.tenantId) {
                  localStorage.setItem(STORAGE_TENANT_ID_KEY, userData.tenantId);
                }
                // Sync i18n locale from user profile
                if (userData?.locale) {
                  i18n.changeLanguage(userData.locale);
                  localStorage.setItem('locale', userData.locale);
                }
              } catch {
                // Refresh succeeded but /me failed, clear everything
                localStorage.removeItem('token');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem(STORAGE_TENANT_ID_KEY);
                setToken(null);
                setRefreshToken(null);
              }
            }
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem(STORAGE_TENANT_ID_KEY);
            setToken(null);
            setRefreshToken(null);
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [refreshAccessToken]);

  // Set up token refresh interval (refresh 5 minutes before expiry)
  useEffect(() => {
    if (!token) return;

    // Refresh token every 20 minutes (assuming 24h token expiry)
    const refreshInterval = setInterval(async () => {
      await refreshAccessToken();
    }, 20 * 60 * 1000); // 20 minutes

    return () => clearInterval(refreshInterval);
  }, [token, refreshAccessToken]);

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email: username, password });
      // Unwrap the response envelope (handles both NestJS { success, data } and legacy Express flat responses)
      const unwrapped = unwrapApiResponse<{
        accessToken?: string;
        token?: string;
        refreshToken?: string;
        user: User;
      }>(response.data);
      
      // NestJS backend returns accessToken, Express backend returns token
      const { accessToken, token: legacyToken, refreshToken: newRefreshToken, user: userData } = unwrapped;
      const newToken = accessToken || legacyToken;
      
      if (!newToken) {
        throw new Error('Login response did not contain a valid token');
      }
      
      // Store tokens in localStorage
      localStorage.setItem('token', newToken);
      localStorage.setItem('accessToken', newToken); // Also store as accessToken for consistency
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
        setRefreshToken(newRefreshToken);
      }
      
      // Store tenant ID for automatic header injection
      if (userData?.tenantId) {
        localStorage.setItem(STORAGE_TENANT_ID_KEY, userData.tenantId);
      } else {
        // If tenantId is missing from login response, fetch it from /users/me
        // This ensures tenantId is always available for subsequent requests
        try {
          const meResponse = await api.get(API_PATHS.AUTH.ME);
          const meUserData = unwrapApiResponse<User>(meResponse.data);
          if (meUserData?.tenantId) {
            localStorage.setItem(STORAGE_TENANT_ID_KEY, meUserData.tenantId);
            // Update user object with tenantId if it was missing
            if (!userData.tenantId) {
              setUser({ ...userData, tenantId: meUserData.tenantId });
            }
          }
        } catch (meError) {
          // Non-fatal: log but don't block login
          if (process.env.NODE_ENV === 'development') {
            console.warn('[AuthContext] Failed to fetch tenantId from /users/me after login:', meError);
          }
        }
      }
      
      setToken(newToken);
      setUser(userData);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: unknown) {
      // Handle standardized ApiError from the API client
      if (error instanceof ApiError) {
        throw new Error(error.message || 'Kullanıcı adı veya şifre hatalı');
      }
      // Handle legacy error format
      const axiosError = error as { response?: { data?: { message?: string } } };
      throw new Error(axiosError.response?.data?.message || 'Kullanıcı adı veya şifre hatalı');
    }
  };

  const register = async (registerUserData: RegisterData) => {
    try {
      const response = await api.post('/auth/register', registerUserData);
      // Unwrap the response envelope (handles both NestJS { success, data } and legacy Express flat responses)
      const unwrapped = unwrapApiResponse<{
        accessToken?: string;
        token?: string;
        refreshToken?: string;
        user: User;
      }>(response.data);
      
      const { accessToken, token: legacyToken, refreshToken: newRefreshToken, user: newUser } = unwrapped;
      const newToken = accessToken || legacyToken;
      
      if (!newToken) {
        throw new Error('Registration response did not contain a valid token');
      }
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('accessToken', newToken);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
        setRefreshToken(newRefreshToken);
      }
      
      // Store tenant ID for automatic header injection
      if (newUser?.tenantId) {
        localStorage.setItem(STORAGE_TENANT_ID_KEY, newUser.tenantId);
      } else {
        // If tenantId is missing from register response, fetch it from /users/me
        try {
          const meResponse = await api.get(API_PATHS.AUTH.ME);
          const meUserData = unwrapApiResponse<User>(meResponse.data);
          if (meUserData?.tenantId) {
            localStorage.setItem(STORAGE_TENANT_ID_KEY, meUserData.tenantId);
            if (!newUser.tenantId) {
              setUser({ ...newUser, tenantId: meUserData.tenantId });
            }
          }
        } catch (meError) {
          // Non-fatal: log but don't block registration
          if (process.env.NODE_ENV === 'development') {
            console.warn('[AuthContext] Failed to fetch tenantId from /users/me after register:', meError);
          }
        }
      }
      
      setToken(newToken);
      setUser(newUser);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: unknown) {
      // Handle standardized ApiError from the API client
      if (error instanceof ApiError) {
        throw new Error(error.message || 'Kayıt işlemi başarısız oldu');
      }
      // Handle legacy error format
      const axiosError = error as { response?: { data?: { message?: string } } };
      throw new Error(axiosError.response?.data?.message || 'Kayıt işlemi başarısız oldu');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(STORAGE_TENANT_ID_KEY);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  const value: AuthContextType = {
    user,
    token,
    refreshToken,
    login,
    register,
    logout,
    refreshAccessToken,
    loading,
    isAdmin,
    isManager,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
