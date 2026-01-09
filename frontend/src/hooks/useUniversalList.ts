import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AxiosResponse } from 'axios';

export interface ListContractResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UniversalListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  [key: string]: unknown;
}

export interface UseUniversalListOptions<T> {
  fetchFn: (params: UniversalListParams) => Promise<AxiosResponse<{ success: boolean; data: ListContractResponse<T> }>>;
  defaultPageSize?: number;
  defaultSort?: string;
  syncToUrl?: boolean;
  enabled?: boolean;
  tenantId?: string;
  additionalFilters?: Record<string, unknown>;
}

export interface UseUniversalListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
  sort: string;
  isLoading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setSort: (sort: string) => void;
  refetch: () => Promise<void>;
  reset: () => void;
}

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

export function useUniversalList<T>(options: UseUniversalListOptions<T>): UseUniversalListResult<T> {
  const {
    fetchFn,
    defaultPageSize = 10,
    defaultSort = 'createdAt:DESC',
    syncToUrl = true,
    enabled = true,
    additionalFilters = {},
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialPage = () => {
    if (syncToUrl) {
      const urlPage = searchParams.get('page');
      return urlPage ? parseInt(urlPage, 10) : 1;
    }
    return 1;
  };

  const getInitialPageSize = () => {
    if (syncToUrl) {
      const urlPageSize = searchParams.get('pageSize');
      return urlPageSize ? parseInt(urlPageSize, 10) : defaultPageSize;
    }
    return defaultPageSize;
  };

  const getInitialSearch = () => {
    if (syncToUrl) {
      return searchParams.get('search') || '';
    }
    return '';
  };

  const getInitialSort = () => {
    if (syncToUrl) {
      return searchParams.get('sort') || defaultSort;
    }
    return defaultSort;
  };

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(getInitialPage);
  const [pageSize, setPageSizeState] = useState(getInitialPageSize);
  const [search, setSearchState] = useState(getInitialSearch);
  const [sort, setSortState] = useState(getInitialSort);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUrlParams = useCallback((params: Record<string, string | number>) => {
    if (!syncToUrl) return;
    
    const newParams = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        newParams.set(key, String(value));
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams, { replace: true });
  }, [syncToUrl, searchParams, setSearchParams]);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params: UniversalListParams = {
        page,
        pageSize,
        ...additionalFilters,
      };

      if (search) {
        params.search = search;
      }

      if (sort) {
        params.sort = sort;
        const [sortBy, sortOrder] = sort.split(':');
        if (sortBy && sortOrder) {
          params.sortBy = sortBy;
          params.sortOrder = sortOrder as 'ASC' | 'DESC';
        }
      }

      const response = await fetchFn(params);
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
      const axiosError = err as { response?: { status?: number; data?: { message?: string; error?: { message?: string } } } };
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
      } else {
        setError(message || 'Failed to fetch data. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [enabled, page, pageSize, search, sort, additionalFilters, fetchFn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage);
    updateUrlParams({ page: newPage });
  }, [updateUrlParams]);

  const setPageSize = useCallback((newPageSize: number) => {
    setPageSizeState(newPageSize);
    setPageState(1);
    updateUrlParams({ pageSize: newPageSize, page: 1 });
  }, [updateUrlParams]);

  const setSearch = useCallback((newSearch: string) => {
    setSearchState(newSearch);
    setPageState(1);
    updateUrlParams({ search: newSearch, page: 1 });
  }, [updateUrlParams]);

  const setSort = useCallback((newSort: string) => {
    setSortState(newSort);
    setPageState(1);
    updateUrlParams({ sort: newSort, page: 1 });
  }, [updateUrlParams]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const reset = useCallback(() => {
    setPageState(1);
    setPageSizeState(defaultPageSize);
    setSearchState('');
    setSortState(defaultSort);
    updateUrlParams({ page: 1, pageSize: defaultPageSize, search: '', sort: defaultSort });
  }, [defaultPageSize, defaultSort, updateUrlParams]);

  return useMemo(() => ({
    items,
    total,
    page,
    pageSize,
    totalPages,
    search,
    sort,
    isLoading,
    error,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    refetch,
    reset,
  }), [items, total, page, pageSize, totalPages, search, sort, isLoading, error, setPage, setPageSize, setSearch, setSort, refetch, reset]);
}

export default useUniversalList;
