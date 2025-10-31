/**
 * Centralized API client with route builders
 * Ensures no double /v2 in paths
 */
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api/v2';

export const apiClient = {
  auth: {
    login: () => `${API_BASE}/auth/login`,
    me: () => `${API_BASE}/auth/me`,
  },
  health: () => `${API_BASE}/health`,
  policies: () => `${API_BASE}/policies`,
  risks: () => `${API_BASE}/risks`,
  audits: () => `${API_BASE}/audits`,
  issues: () => `${API_BASE}/issues`,
};

export default apiClient;

