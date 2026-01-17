import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { grcMetaApi, SortableField, FilterableField, ListOptionsResponse } from '../services/grcClient';

export interface UseListOptionsResult {
  sortableFields: SortableField[];
  filterableFields: FilterableField[];
  searchableFields: string[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_SORT_OPTIONS: SortableField[] = [
  { name: 'createdAt', label: 'Created At', type: 'date' },
  { name: 'updatedAt', label: 'Updated At', type: 'date' },
];

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  data: ListOptionsResponse;
  timestamp: number;
}

const listOptionsCache = new Map<string, CacheEntry>();

function getCacheKey(tenantId: string, entity: string): string {
  return `${tenantId}:${entity}`;
}

function getCachedData(tenantId: string, entity: string): ListOptionsResponse | null {
  const key = getCacheKey(tenantId, entity);
  const entry = listOptionsCache.get(key);
  
  if (!entry) {
    return null;
  }
  
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    listOptionsCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCachedData(tenantId: string, entity: string, data: ListOptionsResponse): void {
  const key = getCacheKey(tenantId, entity);
  listOptionsCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function useListOptions(entity: string): UseListOptionsResult {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [data, setData] = useState<ListOptionsResponse | null>(() => {
    if (tenantId && entity) {
      return getCachedData(tenantId, entity);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchOptions = useCallback(async (forceRefresh = false) => {
    if (!tenantId || !entity) {
      return;
    }

    if (!forceRefresh) {
      const cached = getCachedData(tenantId, entity);
      if (cached) {
        setData(cached);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await grcMetaApi.getListOptions(tenantId, entity);
      setData(response);
      setCachedData(tenantId, entity, response);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
      const status = axiosError.response?.status;
      
      if (status === 404) {
        setError(`Entity '${entity}' not found`);
      } else if (status === 401) {
        setError('Session expired. Please login again.');
      } else if (status === 403) {
        setError('You do not have permission to access this resource.');
      } else {
        setError('Failed to fetch list options');
      }
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, entity]);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchOptions();
    }
  }, [fetchOptions]);

  useEffect(() => {
    hasFetchedRef.current = false;
  }, [tenantId, entity]);

  const sortableFields = useMemo(() => {
    if (data?.sortableFields && data.sortableFields.length > 0) {
      return data.sortableFields;
    }
    return DEFAULT_SORT_OPTIONS;
  }, [data]);

  const filterableFields = useMemo(() => {
    return data?.filterableFields || [];
  }, [data]);

  const searchableFields = useMemo(() => {
    return data?.searchableFields || [];
  }, [data]);

  return useMemo(() => ({
    sortableFields,
    filterableFields,
    searchableFields,
    isLoading,
    error,
    refetch: fetchOptions,
  }), [sortableFields, filterableFields, searchableFields, isLoading, error, fetchOptions]);
}

export default useListOptions;
