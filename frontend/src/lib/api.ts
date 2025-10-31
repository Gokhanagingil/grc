import axios from 'axios';
import { apiClient } from './api-client';

// API_BASE already includes /api/v2, use as-is
const BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5002/api/v2').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Versioned path helpers - baseURL already includes /api/v2
// Do NOT add extra /v1 or /v2 - just return the path as-is
export const v1 = (p: string) => {
  // Remove any leading /v1 or /v2 to prevent double versioning
  const clean = p.replace(/^\/v\d+\//, '/');
  return clean.startsWith('/') ? clean : `/${clean}`;
};
export const v2 = (p: string) => {
  // Remove any leading /v1 or /v2 to prevent double versioning
  const clean = p.replace(/^\/v\d+\//, '/');
  return clean.startsWith('/') ? clean : `/${clean}`;
};

// Health
export type HealthDto = {
  status: string;
  time: string;
  db: 'up' | 'down';
  version: string;
  build?: string | null;
  uptimeSecs?: number; // <-- eklendi
};

export async function getHealth() {
  const { data } = await api.get('/health');
  return data as HealthDto;
}


