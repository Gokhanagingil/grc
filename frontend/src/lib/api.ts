import axios from 'axios';

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002/api').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

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


