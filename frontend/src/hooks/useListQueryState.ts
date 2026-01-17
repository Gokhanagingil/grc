/**
 * useListQueryState Hook
 *
 * A hook that provides unified list query state management with URL synchronization.
 * This hook wraps the existing useUniversalList hook and provides a cleaner API
 * for managing pagination, sorting, search, and filtering with URL state sync.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AxiosResponse } from 'axios';
import {
  ListQueryState,
  DEFAULT_LIST_QUERY_STATE,
  parseListQuery,
  mergeListQueryParams,
  normalizeFilter,
  parseSort,
  buildSort,
  SortDirection,
  buildApiParams,
} from '../utils/listQueryUtils';
import { FilterTree } from '../components/common/AdvancedFilter/types';

/**
 * List contract response from backend
 */
export interface ListContractResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Options for useListQueryState hook
 */
export interface UseListQueryStateOptions<T> {
  fetchFn: (params: Record<string, unknown>) => Promise<AxiosResponse<{ success: boolean; data: ListContractResponse<T> }>>;
  defaultPageSize?: number;
  defaultSort?: string;
  syncToUrl?: boolean;
  enabled?: boolean;
  additionalFilters?: Record<string, unknown>;
  tableKey?: string;
}

/**
 * Result from useListQueryState hook
 */
export interface UseListQueryStateResult<T> {
  items: T[];
  total: number;
  totalPages: number;
  state: ListQueryState;
  isLoading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setSort: (sort: string) => void;
  setSortField: (field: string, direction?: SortDirection) => void;
  setFilterTree: (filter: FilterTree | null) => void;
  refetch: () => Promise<void>;
  reset: () => void;
  clearFilters: () => void;
}

/**
 * Unwrap list response from backend
 */
function unwrapListResponse<T>(response: AxiosResponse<unknown>): ListContractResponse<T> | null {
  const body = response.data as { success?: boolean; data?: unknown };
  
  if (body && body.success && body.data) {
    const data = body.data as ListContractResponse<T>;
    if ('items' in data && Array.isArray(data.items)) {
      return data;
    }
  }
  
  if (body && 'items' in body && Array.isArray((body as ListContractResponse<T>).items)) {
    return body as ListContractResponse<T>;
  }
  
  return null;
}

/**
 * useListQueryState Hook
 *
 * Provides unified list query state management with URL synchronization.
 * Handles pagination, sorting, search, and filtering with a clean API.
 *
 * @param options - Hook options
 * @returns List query state and setters
 */
export function useListQueryState<T>(options: UseListQueryStateOptions<T>): UseListQueryStateResult<T> {
  const {
    fetchFn,
    defaultPageSize = 10,
    defaultSort = 'createdAt:DESC',
    syncToUrl = true,
    enabled = true,
    additionalFilters = {},
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  const defaults = useMemo(() => ({
    ...DEFAULT_LIST_QUERY_STATE,
    pageSize: defaultPageSize,
    sort: defaultSort,
  }), [defaultPageSize, defaultSort]);

  const getInitialState = useCallback((): ListQueryState => {
    if (syncToUrl) {
      return parseListQuery(searchParams, defaults);
    }
    return defaults;
  }, [syncToUrl, searchParams, defaults]);

  const [state, setState] = useState<ListQueryState>(getInitialState);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const updateUrlParams = useCallback((newState: Partial<ListQueryState>) => {
    if (!syncToUrl) return;
    
    const newParams = mergeListQueryParams(searchParams, newState);
    setSearchParams(newParams, { replace: true });
  }, [syncToUrl, searchParams, setSearchParams]);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const apiParams = {
        ...buildApiParams(state),
        ...additionalFilters,
      };

      const response = await fetchFn(apiParams);

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      const result = unwrapListResponse<T>(response);

      if (result) {
        setItems(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else {
        setItems([]);
        setTotal(0);
        setTotalPages(0);
      }
    } catch (err: unknown) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      const axiosError = err as { 
        response?: { status?: number; data?: { message?: string; error?: { message?: string } } };
        code?: string;
        name?: string;
      };

      if (axiosError.name === 'CanceledError' || axiosError.code === 'ERR_CANCELED') {
        return;
      }

      const status = axiosError.response?.status;
      const message = axiosError.response?.data?.error?.message || axiosError.response?.data?.message;

      if (status === 401) {
        setError('Session expired. Please login again.');
      } else if (status === 403) {
        setError('You do not have permission to view this data.');
      } else if (status === 404 || status === 502) {
        setItems([]);
        setTotal(0);
        setTotalPages(0);
      } else if (status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError(message || 'Failed to fetch data. Please try again.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, state, additionalFilters, fetchFn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setPage = useCallback((page: number) => {
    setState(prev => ({ ...prev, page }));
    updateUrlParams({ page });
  }, [updateUrlParams]);

  const setPageSize = useCallback((pageSize: number) => {
    setState(prev => ({ ...prev, pageSize, page: 1 }));
    updateUrlParams({ pageSize, page: 1 });
  }, [updateUrlParams]);

  const setSearch = useCallback((search: string) => {
    setState(prev => ({ ...prev, search, page: 1 }));
    updateUrlParams({ search, page: 1 });
  }, [updateUrlParams]);

  const setSort = useCallback((sort: string) => {
    setState(prev => ({ ...prev, sort, page: 1 }));
    updateUrlParams({ sort, page: 1 });
  }, [updateUrlParams]);

  const setSortField = useCallback((field: string, direction?: SortDirection) => {
    const currentSort = parseSort(state.sort);
    const newDirection = direction || (currentSort?.field === field && currentSort?.direction === 'ASC' ? 'DESC' : 'ASC');
    const newSort = buildSort(field, newDirection);
    setState(prev => ({ ...prev, sort: newSort, page: 1 }));
    updateUrlParams({ sort: newSort, page: 1 });
  }, [state.sort, updateUrlParams]);

  const setFilterTree = useCallback((filter: FilterTree | null) => {
    const normalized = normalizeFilter(filter);
    setState(prev => ({ ...prev, filterTree: normalized, page: 1 }));
    updateUrlParams({ filterTree: normalized, page: 1 });
  }, [updateUrlParams]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const reset = useCallback(() => {
    setState(defaults);
    updateUrlParams(defaults);
  }, [defaults, updateUrlParams]);

  const clearFilters = useCallback(() => {
    setState(prev => ({ ...prev, filterTree: null, search: '', page: 1 }));
    updateUrlParams({ filterTree: null, search: '', page: 1 });
  }, [updateUrlParams]);

  return useMemo(() => ({
    items,
    total,
    totalPages,
    state,
    isLoading,
    error,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setSortField,
    setFilterTree,
    refetch,
    reset,
    clearFilters,
  }), [
    items,
    total,
    totalPages,
    state,
    isLoading,
    error,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setSortField,
    setFilterTree,
    refetch,
    reset,
    clearFilters,
  ]);
}

export default useListQueryState;
