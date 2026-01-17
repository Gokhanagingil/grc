/**
 * useListData Hook
 *
 * A hook that provides standardized data fetching for list pages with
 * integrated notification handling for errors. This hook wraps useListQueryState
 * and adds toast notifications for invalid filters and other errors.
 *
 * Features:
 * - Standardized data fetching with axios
 * - Automatic error handling with toast notifications
 * - Invalid filter detection and clearing
 * - Loading and error state management
 * - URL synchronization for query state
 */

import { useCallback, useEffect, useRef } from 'react';
import { AxiosResponse } from 'axios';
import { useNotification } from '../contexts/NotificationContext';
import {
  useListQueryState,
  UseListQueryStateOptions,
  UseListQueryStateResult,
  ListContractResponse,
} from './useListQueryState';
import { FilterTree } from '../components/common/AdvancedFilter/types';
import { isFilterEmpty } from '../utils/listQueryUtils';

/**
 * Field definition for list configuration
 */
export interface ListFieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'enum' | 'boolean' | 'date' | 'number' | 'uuid';
  enumValues?: string[];
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
}

/**
 * Options for useListData hook
 */
export interface UseListDataOptions<T> extends Omit<UseListQueryStateOptions<T>, 'fetchFn'> {
  /** API fetch function */
  fetchFn: (params: Record<string, unknown>) => Promise<AxiosResponse<{ success: boolean; data: ListContractResponse<T> }>>;
  /** Entity name for error messages */
  entityName?: string;
  /** Field definitions for the list */
  fields?: ListFieldDefinition[];
  /** Callback when filter is invalid and cleared */
  onFilterCleared?: () => void;
  /** Whether to show notifications for errors */
  showNotifications?: boolean;
}

/**
 * Result from useListData hook
 */
export interface UseListDataResult<T> extends UseListQueryStateResult<T> {
  /** Field definitions for the list */
  fields: ListFieldDefinition[];
  /** Whether the filter is currently active */
  hasActiveFilter: boolean;
  /** Number of active filter conditions */
  filterConditionCount: number;
  /** Clear filter and show notification */
  clearFilterWithNotification: () => void;
  /** Apply filter with validation */
  applyFilter: (filter: FilterTree | null) => void;
}

/**
 * Count conditions in a filter tree
 */
function countConditions(filter: FilterTree | null): number {
  if (!filter) return 0;
  
  if ('field' in filter) {
    return 1;
  }
  
  if ('and' in filter) {
    return filter.and.reduce((sum, child) => sum + countConditions(child as FilterTree), 0);
  }
  
  if ('or' in filter) {
    return filter.or.reduce((sum, child) => sum + countConditions(child as FilterTree), 0);
  }
  
  return 0;
}

/**
 * useListData Hook
 *
 * Provides standardized data fetching for list pages with integrated
 * notification handling for errors.
 *
 * @param options - Hook options
 * @returns List data state and methods
 */
export function useListData<T>(options: UseListDataOptions<T>): UseListDataResult<T> {
  const {
    entityName = 'items',
    fields = [],
    onFilterCleared,
    showNotifications = true,
    ...listQueryOptions
  } = options;

  const { showError, showWarning, showInfo } = useNotification();
  const prevErrorRef = useRef<string | null>(null);

  const listQueryResult = useListQueryState<T>(listQueryOptions);

  const {
    error,
    state,
    setFilterTree,
    clearFilters,
  } = listQueryResult;

  // Show notification when error changes
  useEffect(() => {
    if (showNotifications && error && error !== prevErrorRef.current) {
      // Check if it's a filter-related error
      if (error.toLowerCase().includes('filter') || error.toLowerCase().includes('invalid')) {
        showWarning(`Invalid filter applied. ${error}`);
      } else {
        showError(error);
      }
      prevErrorRef.current = error;
    } else if (!error) {
      prevErrorRef.current = null;
    }
  }, [error, showNotifications, showError, showWarning]);

  // Calculate filter state
  const hasActiveFilter = !isFilterEmpty(state.filterTree);
  const filterConditionCount = countConditions(state.filterTree);

  // Clear filter with notification
  const clearFilterWithNotification = useCallback(() => {
    clearFilters();
    if (showNotifications) {
      showInfo('Filters cleared');
    }
    onFilterCleared?.();
  }, [clearFilters, showNotifications, showInfo, onFilterCleared]);

  // Apply filter with validation
  const applyFilter = useCallback((filter: FilterTree | null) => {
    try {
      setFilterTree(filter);
    } catch (err) {
      if (showNotifications) {
        showWarning('Invalid filter format. Filter has been cleared.');
      }
      setFilterTree(null);
      onFilterCleared?.();
    }
  }, [setFilterTree, showNotifications, showWarning, onFilterCleared]);

  return {
    ...listQueryResult,
    fields,
    hasActiveFilter,
    filterConditionCount,
    clearFilterWithNotification,
    applyFilter,
  };
}

export default useListData;
