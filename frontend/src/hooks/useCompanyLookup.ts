import { useState, useEffect, useCallback, useRef } from 'react';
import { api, getTenantId } from '../services/api';

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

/**
 * Hook to fetch core_companies for use in ITSM selectors and filters.
 * Uses the existing admin companies list endpoint with a large page size
 * to populate dropdowns. Results are cached per-tenant for 2 minutes.
 */
export function useCompanyLookup(): UseCompanyLookupResult {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchCompanies = useCallback(async () => {
    const tenantId = getTenantId() ?? '_default';
    const cached = companyCacheMap.get(tenantId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setCompanies(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', '200');
      params.set('status', 'ACTIVE');

      const res = await api.get(`/grc/admin/companies?${params.toString()}`);
      const raw = res.data;

      let items: CompanyOption[] = [];
      if (raw && typeof raw === 'object') {
        const envelope = raw as Record<string, unknown>;
        const inner = envelope.data;
        if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
          const paginated = inner as { items?: Array<{ id: string; name: string; type: string }> };
          if (Array.isArray(paginated.items)) {
            items = paginated.items.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
            }));
          }
        }
      }

      companyCacheMap.set(tenantId, { data: items, ts: Date.now() });
      if (mountedRef.current) {
        setCompanies(items);
      }
    } catch (err) {
      console.error('Failed to load companies for lookup:', err);
      if (mountedRef.current) {
        setError('Failed to load companies');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchCompanies();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchCompanies]);

  return { companies, loading, error, refresh: fetchCompanies };
}

export function invalidateCompanyCache(): void {
  companyCacheMap.clear();
}
