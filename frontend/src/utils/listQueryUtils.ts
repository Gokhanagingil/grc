/**
 * List Query Utilities
 *
 * Shared utilities for parsing, building, and normalizing list query parameters.
 * These utilities ensure consistent handling of pagination, sorting, search,
 * and advanced filtering across all list pages.
 */

import {
  FilterTree,
  FilterCondition,
  FilterAndGroup,
  isFilterCondition,
  isFilterAndGroup,
  isFilterOrGroup,
} from '../components/common/AdvancedFilter/types';

/**
 * Canonical list query state
 */
export interface ListQueryState {
  page: number;
  pageSize: number;
  search: string;
  sort: string;
  filterTree: FilterTree | null;
}

/**
 * Default values for list query state
 */
export const DEFAULT_LIST_QUERY_STATE: ListQueryState = {
  page: 1,
  pageSize: 10,
  search: '',
  sort: 'createdAt:DESC',
  filterTree: null,
};

/**
 * Sort direction type
 */
export type SortDirection = 'ASC' | 'DESC';

/**
 * Parsed sort value
 */
export interface ParsedSort {
  field: string;
  direction: SortDirection;
}

/**
 * Parse sort string into field and direction
 * @param sort - Sort string in format "field:ASC" or "field:DESC"
 * @returns Parsed sort object or null if invalid
 */
export function parseSort(sort: string): ParsedSort | null {
  if (!sort) return null;
  const parts = sort.split(':');
  if (parts.length !== 2) return null;
  const [field, direction] = parts;
  if (!field || (direction !== 'ASC' && direction !== 'DESC')) return null;
  return { field, direction };
}

/**
 * Build sort string from field and direction
 * @param field - Field name to sort by
 * @param direction - Sort direction (ASC or DESC)
 * @returns Sort string in canonical format "field:ASC" or "field:DESC"
 */
export function buildSort(field: string, direction: SortDirection): string {
  return `${field}:${direction}`;
}

/**
 * Safely decode a potentially double-encoded string
 * Handles backward compatibility for URLs with double-encoded filter values
 * @param value - The value to decode
 * @returns Decoded value
 */
function safeDecodeURIComponent(value: string): string {
  if (!value) return value;
  
  let decoded = value;
  let attempts = 0;
  const maxAttempts = 2;
  
  while (attempts < maxAttempts) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) {
        break;
      }
      decoded = nextDecoded;
      attempts++;
    } catch {
      break;
    }
  }
  
  return decoded;
}

/**
 * Parse filter string into FilterTree
 * Handles both single-encoded and double-encoded filter values for backward compatibility
 * @param filterStr - The filter string to parse
 * @returns Parsed FilterTree or null if invalid
 */
export function parseFilterString(filterStr: string | null): FilterTree | null {
  if (!filterStr) return null;
  
  try {
    const decoded = safeDecodeURIComponent(filterStr);
    const parsed = JSON.parse(decoded);
    
    if (isFilterCondition(parsed) || isFilterAndGroup(parsed) || isFilterOrGroup(parsed)) {
      return parsed;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse URL search params into list query state
 * @param searchParams - URLSearchParams or string to parse
 * @param defaults - Default values to use for missing params
 * @returns Parsed list query state
 */
export function parseListQuery(
  searchParams: URLSearchParams | string,
  defaults: Partial<ListQueryState> = {}
): ListQueryState {
  const params = typeof searchParams === 'string' 
    ? new URLSearchParams(searchParams) 
    : searchParams;
  
  const mergedDefaults = { ...DEFAULT_LIST_QUERY_STATE, ...defaults };
  
  const pageStr = params.get('page');
  const pageSizeStr = params.get('pageSize');
  const search = params.get('search');
  const sort = params.get('sort');
  const filter = params.get('filter');
  
  return {
    page: pageStr ? parseInt(pageStr, 10) || mergedDefaults.page : mergedDefaults.page,
    pageSize: pageSizeStr ? parseInt(pageSizeStr, 10) || mergedDefaults.pageSize : mergedDefaults.pageSize,
    search: search ?? mergedDefaults.search,
    sort: sort ?? mergedDefaults.sort,
    filterTree: filter ? parseFilterString(filter) : mergedDefaults.filterTree,
  };
}

/**
 * Normalize a filter input to the canonical tree format
 * - Wraps single condition in {and:[cond]}
 * - Handles null/undefined gracefully
 * - Validates filter structure
 * @param input - Filter input (condition, and/or group, or null)
 * @returns Normalized FilterTree or null
 */
export function normalizeFilter(input: FilterTree | FilterCondition | null | undefined): FilterTree | null {
  if (!input) return null;
  
  if (isFilterCondition(input)) {
    return { and: [input] } as FilterAndGroup;
  }
  
  if (isFilterAndGroup(input) || isFilterOrGroup(input)) {
    return input;
  }
  
  return null;
}

/**
 * Serialize filter tree to JSON string
 * @param filter - FilterTree to serialize
 * @returns JSON string representation
 */
export function serializeFilterTree(filter: FilterTree | null): string | null {
  if (!filter) return null;
  return JSON.stringify(filter);
}

/**
 * Build URLSearchParams from list query state
 * Ensures filter is encoded exactly once via URLSearchParams (no double-encode)
 * @param state - List query state to build params from
 * @param includeDefaults - Whether to include default values in params
 * @returns URLSearchParams with canonical query params
 */
export function buildListQueryParams(
  state: Partial<ListQueryState>,
  includeDefaults = false
): URLSearchParams {
  const params = new URLSearchParams();
  const defaults = DEFAULT_LIST_QUERY_STATE;
  
  if (state.page !== undefined && (includeDefaults || state.page !== defaults.page)) {
    params.set('page', String(state.page));
  }
  
  if (state.pageSize !== undefined && (includeDefaults || state.pageSize !== defaults.pageSize)) {
    params.set('pageSize', String(state.pageSize));
  }
  
  if (state.search !== undefined && (includeDefaults || state.search !== defaults.search)) {
    if (state.search) {
      params.set('search', state.search);
    }
  }
  
  if (state.sort !== undefined && (includeDefaults || state.sort !== defaults.sort)) {
    params.set('sort', state.sort);
  }
  
  if (state.filterTree !== undefined && state.filterTree !== null) {
    const serialized = serializeFilterTree(state.filterTree);
    if (serialized) {
      params.set('filter', serialized);
    }
  }
  
  return params;
}

/**
 * Merge current URL params with new state values
 * Preserves existing params not in the state object
 * @param currentParams - Current URLSearchParams
 * @param newState - New state values to merge
 * @returns New URLSearchParams with merged values
 */
export function mergeListQueryParams(
  currentParams: URLSearchParams,
  newState: Partial<ListQueryState>
): URLSearchParams {
  const newParams = new URLSearchParams(currentParams);
  
  if (newState.page !== undefined) {
    newParams.set('page', String(newState.page));
  }
  
  if (newState.pageSize !== undefined) {
    newParams.set('pageSize', String(newState.pageSize));
  }
  
  if (newState.search !== undefined) {
    if (newState.search) {
      newParams.set('search', newState.search);
    } else {
      newParams.delete('search');
    }
  }
  
  if (newState.sort !== undefined) {
    newParams.set('sort', newState.sort);
  }
  
  if (newState.filterTree !== undefined) {
    if (newState.filterTree) {
      const serialized = serializeFilterTree(newState.filterTree);
      if (serialized) {
        newParams.set('filter', serialized);
      }
    } else {
      newParams.delete('filter');
    }
  }
  
  return newParams;
}

/**
 * Check if a filter tree is empty (no conditions)
 * @param filter - FilterTree to check
 * @returns true if filter is empty or null
 */
export function isFilterEmpty(filter: FilterTree | null): boolean {
  if (!filter) return true;
  
  if (isFilterCondition(filter)) {
    return false;
  }
  
  if (isFilterAndGroup(filter)) {
    return filter.and.length === 0;
  }
  
  if (isFilterOrGroup(filter)) {
    return filter.or.length === 0;
  }
  
  return true;
}

/**
 * Count the number of conditions in a filter tree
 * @param filter - FilterTree to count conditions in
 * @returns Number of conditions
 */
export function countFilterConditions(filter: FilterTree | null): number {
  if (!filter) return 0;
  
  if (isFilterCondition(filter)) {
    return 1;
  }
  
  if (isFilterAndGroup(filter)) {
    return filter.and.reduce((sum, child) => sum + countFilterConditions(child), 0);
  }
  
  if (isFilterOrGroup(filter)) {
    return filter.or.reduce((sum, child) => sum + countFilterConditions(child), 0);
  }
  
  return 0;
}

/**
 * Extract flat list of conditions from a filter tree
 * @param filter - FilterTree to extract conditions from
 * @returns Array of FilterCondition objects
 */
export function extractFilterConditions(filter: FilterTree | null): FilterCondition[] {
  if (!filter) return [];
  
  if (isFilterCondition(filter)) {
    return [filter];
  }
  
  if (isFilterAndGroup(filter)) {
    return filter.and.flatMap(child => extractFilterConditions(child));
  }
  
  if (isFilterOrGroup(filter)) {
    return filter.or.flatMap(child => extractFilterConditions(child));
  }
  
  return [];
}

/**
 * Build API params object from list query state
 * Converts state to the format expected by the backend API
 * @param state - List query state
 * @returns Object with API params
 */
export function buildApiParams(state: ListQueryState): Record<string, unknown> {
  const params: Record<string, unknown> = {
    page: state.page,
    pageSize: state.pageSize,
  };
  
  if (state.search) {
    params.search = state.search;
  }
  
  if (state.sort) {
    params.sort = state.sort;
    const parsed = parseSort(state.sort);
    if (parsed) {
      params.sortBy = parsed.field;
      params.sortOrder = parsed.direction;
    }
  }
  
  if (state.filterTree) {
    params.filter = serializeFilterTree(state.filterTree);
  }
  
  return params;
}
