import { useState, useEffect, useCallback, useMemo } from 'react';
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

export function useListOptions(entity: string): UseListOptionsResult {
  const { tenantId } = useAuth();
  const [data, setData] = useState<ListOptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    if (!tenantId || !entity) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await grcMetaApi.getListOptions(tenantId, entity);
      setData(response);
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
    fetchOptions();
  }, [fetchOptions]);

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
