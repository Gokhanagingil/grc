import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, v2 } from '../lib/api';

interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  loading: boolean;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          const response = await api.get('/auth/me');
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // Backend expects: POST /api/v2/auth/login with x-tenant-id header
      const tenantId = process.env.REACT_APP_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
      const response = await api.post(v2('/auth/login'), 
        { email: username, password }, // username is used as email
        { headers: { 'x-tenant-id': tenantId } }
      );
      const { accessToken, user: userData } = response.data;
      
      localStorage.setItem('token', accessToken);
      setToken(accessToken);
      // Map backend user to frontend User interface
      setUser({
        id: parseInt(userData.id?.substring(0, 8) || '0', 16) || 0,
        username: userData.email,
        email: userData.email,
        firstName: userData.display_name?.split(' ')[0] || '',
        lastName: userData.display_name?.split(' ').slice(1).join(' ') || '',
        department: '',
        role: 'user',
      });
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Login failed');
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { token: newToken, user: newUser } = response.data;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(newUser);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


