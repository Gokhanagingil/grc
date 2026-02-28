import { useState, useEffect, useCallback, useRef } from 'react';
import { api, STORAGE_TENANT_ID_KEY } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { AxiosError } from 'axios';

export interface CompanyOption {
  id: string;
  name: string;
  type: string;
}

interface UseCompanyLookupResult {
  companies: CompanyOption[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const companyCacheMap = new Map<string, { data: CompanyOption[]; ts: number }>();
const CACHE_TTL = 120_000; // 2 minutes

function currentTenantKey(): string {
  try {
    return localStorage.getItem(STORAGE_TENANT_ID_KEY) ?? '_default';
  } catch {
    return '_default';
  }
}

function parseLookupResponse(raw: unknown): CompanyOption[] {
  const mapItem = (c: { id: string; name: string; type: string }) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  });
  if (Array.isArray(raw)) return raw.map(mapItem);
  if (!raw || typeof raw !== 'object') return [];
  const envelope = raw as Record<string, unknown>;
  const data = envelope.data;
  if (Array.isArray(data)) return data.map(mapItem);
  if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).items)) {
    const items = (data as { items: Array<{ id: string; name: string; type: string }> }).items;
    return items.map(mapItem);
  }
  return [];
}

/**
 * Hook to fetch core_companies for ITSM selectors and filters.
 * Calls tenant-scoped GET /grc/companies/lookup (type=CUSTOMER) so ITSM users
 * without admin company permission get the dropdown. On 401/403/5xx shows
 * a snackbar error; does not show error for legitimate empty results.
 */
export function useCompanyLookup(): UseCompanyLookupResult {
  const { showNotification } = useNotification();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const lastErrorShownRef = useRef<string | null>(null);

  const fetchCompanies = useCallback(async (bypassCache = false) => {
    const tenantId = currentTenantKey();
    const cacheKey = `${tenantId}:CUSTOMER`;
    if (!bypassCache) {
      const cached = companyCacheMap.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setCompanies(cached.data);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('type', 'CUSTOMER');
      params.set('limit', '50');

      const res = await api.get(`/grc/companies/lookup?${params.toString()}`);
      const raw = res.data;
      const items = parseLookupResponse(raw);

      companyCacheMap.set(cacheKey, { data: items, ts: Date.now() });
      if (mountedRef.current) {
        setCompanies(items);
      }
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { message?: string }; message?: string }>;
      const status = axiosErr.response?.status;
      const message =
        axiosErr.response?.data?.error?.message ??
        axiosErr.response?.data?.message ??
        (status === 401
          ? 'Unauthorized: sign in again'
          : status === 403
            ? 'You do not have permission to load companies'
            : status && status >= 500
              ? 'Server error loading companies. Try again later.'
              : 'Failed to load companies');
      if (process.env.NODE_ENV === 'development' && status !== undefined) {
        console.warn('[useCompanyLookup] lookup failed:', status, message);
      }
      if (mountedRef.current) {
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    const cacheKey = `${currentTenantKey()}:CUSTOMER`;
    companyCacheMap.delete(cacheKey);
    fetchCompanies(true);
  }, [fetchCompanies]);

  useEffect(() => {
    mountedRef.current = true;
    fetchCompanies();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchCompanies]);

  useEffect(() => {
    if (error && error !== lastErrorShownRef.current) {
      lastErrorShownRef.current = error;
      showNotification(error, 'error');
    }
    if (!error) lastErrorShownRef.current = null;
  }, [error, showNotification]);

  return { companies, loading, error, refresh };
}

export function invalidateCompanyCache(): void {
  companyCacheMap.clear();
}
