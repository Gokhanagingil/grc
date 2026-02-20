/**
 * useSearch Hook
 * 
 * Provides DSL-based search functionality for list pages.
 * Supports filtering, sorting, pagination, and saved filters.
 */

import { useState, useEffect, useCallback } from 'react';
import { searchApi, SearchQuery, SearchFilter, SearchSort, FieldMetadata } from '../services/platformApi';

export interface SavedFilter {
  id: string;
  name: string;
  filter: SearchFilter;
  createdAt: string;
}

export interface UseSearchResult<T> {
  records: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  isLoading: boolean;
  error: string | null;
  filter: SearchFilter | undefined;
  sort: SearchSort | SearchSort[] | undefined;
  metadata: Record<string, FieldMetadata>;
  savedFilters: SavedFilter[];
  setFilter: (filter: SearchFilter | undefined) => void;
  setSort: (sort: SearchSort | SearchSort[] | undefined) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  search: () => Promise<void>;
  addFilter: (field: string, operator: string, value: unknown) => void;
  removeFilter: (field: string) => void;
  clearFilters: () => void;
  saveFilter: (name: string) => void;
  loadFilter: (filterId: string) => void;
  deleteFilter: (filterId: string) => void;
  showMatching: (field: string, value: unknown) => void;
  filterOut: (field: string, value: unknown) => void;
}

const SAVED_FILTERS_KEY = 'grc_saved_filters';

export function useSearch<T>(tableName: string, initialQuery?: Partial<SearchQuery>): UseSearchResult<T> {
  const [records, setRecords] = useState<T[]>([]);
  const [pagination, setPagination] = useState({
    page: initialQuery?.page || 1,
    limit: initialQuery?.limit || 10,
    total: 0,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SearchFilter | undefined>(initialQuery?.filter);
  const [sort, setSort] = useState<SearchSort | SearchSort[] | undefined>(initialQuery?.sort);
  const [metadata, setMetadata] = useState<Record<string, FieldMetadata>>({});
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Load saved filters from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${SAVED_FILTERS_KEY}_${tableName}`);
      if (stored) {
        setSavedFilters(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Error loading saved filters:', err);
    }
  }, [tableName]);

  // Fetch metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await searchApi.getMetadata(tableName);
        setMetadata(response.data.fields);
      } catch (err) {
        console.error('Error fetching metadata:', err);
      }
    };
    fetchMetadata();
  }, [tableName]);

  const search = useCallback(async () => {
    if (!tableName) return;

    try {
      setIsLoading(true);
      setError(null);

      const query: SearchQuery = {
        filter,
        sort,
        page: pagination.page,
        limit: pagination.limit,
      };

      const response = await searchApi.search<T>(tableName, query);
      setRecords(response.data.records);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Error searching records:', err);
      setError('Failed to search records');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [tableName, filter, sort, pagination.page, pagination.limit]);

  // Auto-search when filter, sort, or pagination changes
  useEffect(() => {
    search();
  }, [search]);

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setPagination((prev) => ({ ...prev, page: 1, limit }));
  }, []);

  const addFilter = useCallback((field: string, operator: string, value: unknown) => {
    setFilter((prev) => {
      const newCondition: SearchFilter = { field, operator, value };
      
      if (!prev) {
        return newCondition;
      }

      // If existing filter is an AND, add to it
      if (prev.and) {
        return {
          and: [...prev.and.filter((f) => f.field !== field), newCondition],
        };
      }

      // If existing filter is a single condition, create AND
      if (prev.field) {
        if (prev.field === field) {
          return newCondition;
        }
        return {
          and: [prev, newCondition],
        };
      }

      return newCondition;
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const removeFilter = useCallback((field: string) => {
    setFilter((prev) => {
      if (!prev) return undefined;

      // If single condition
      if (prev.field === field) {
        return undefined;
      }

      // If AND condition
      if (prev.and) {
        const remaining = prev.and.filter((f) => f.field !== field);
        if (remaining.length === 0) return undefined;
        if (remaining.length === 1) return remaining[0];
        return { and: remaining };
      }

      return prev;
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilter(undefined);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const saveFilter = useCallback(
    (name: string) => {
      if (!filter) return;

      const newFilter: SavedFilter = {
        id: `filter_${Date.now()}`,
        name,
        filter,
        createdAt: new Date().toISOString(),
      };

      const updated = [...savedFilters, newFilter];
      setSavedFilters(updated);

      try {
        localStorage.setItem(`${SAVED_FILTERS_KEY}_${tableName}`, JSON.stringify(updated));
      } catch (err) {
        console.error('Error saving filter:', err);
      }
    },
    [filter, savedFilters, tableName]
  );

  const loadFilter = useCallback(
    (filterId: string) => {
      const saved = savedFilters.find((f) => f.id === filterId);
      if (saved) {
        setFilter(saved.filter);
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    },
    [savedFilters]
  );

  const deleteFilter = useCallback(
    (filterId: string) => {
      const updated = savedFilters.filter((f) => f.id !== filterId);
      setSavedFilters(updated);

      try {
        localStorage.setItem(`${SAVED_FILTERS_KEY}_${tableName}`, JSON.stringify(updated));
      } catch (err) {
        console.error('Error deleting filter:', err);
      }
    },
    [savedFilters, tableName]
  );

  const showMatching = useCallback(
    (field: string, value: unknown) => {
      addFilter(field, 'equals', value);
    },
    [addFilter]
  );

  const filterOut = useCallback(
    (field: string, value: unknown) => {
      addFilter(field, 'not_equals', value);
    },
    [addFilter]
  );

  return {
    records,
    pagination,
    isLoading,
    error,
    filter,
    sort,
    metadata,
    savedFilters,
    setFilter,
    setSort,
    setPage,
    setLimit,
    search,
    addFilter,
    removeFilter,
    clearFilters,
    saveFilter,
    loadFilter,
    deleteFilter,
    showMatching,
    filterOut,
  };
}

export default useSearch;
