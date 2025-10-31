import axios from 'axios';

import { API_BASE } from '../config';

const BASE_URL = API_BASE.replace(/\/+$/, '');

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

// Versioned path helpers
export const v1 = (p: string) => `/v1${p.startsWith('/') ? p : `/${p}`}`;
export const v2 = (p: string) => `/v2${p.startsWith('/') ? p : `/${p}`}`;

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


