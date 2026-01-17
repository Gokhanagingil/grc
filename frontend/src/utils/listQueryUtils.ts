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
 * 
 * This interface represents the unified query state for all list pages.
 * It supports:
 * - pagination: page/pageSize
 * - sorting: sortField/sortOrder (via sort string "field:ASC|DESC")
 * - filtering: filterTree (JSON tree with and/or groups + conditions)
 * - search: q (global quick search across reasonable fields)
 */
export interface ListQueryState {
  page: number;
  pageSize: number;
  /** Quick search query (q parameter) - searches across configured fields */
  q: string;
  /** Sort in format "field:ASC" or "field:DESC" */
  sort: string;
  /** Parsed sort field (derived from sort) */
  sortField: string;
  /** Parsed sort order (derived from sort) */
  sortOrder: 'ASC' | 'DESC';
  /** Advanced filter tree with AND/OR groups */
  filterTree: FilterTree | null;
  /** @deprecated Use q instead - kept for backward compatibility */
  search: string;
}

/**
 * Default values for list query state
 */
export const DEFAULT_LIST_QUERY_STATE: ListQueryState = {
  page: 1,
  pageSize: 10,
  q: '',
  sort: 'createdAt:DESC',
  sortField: 'createdAt',
  sortOrder: 'DESC',
  filterTree: null,
  search: '', // deprecated, use q
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
 * Try to parse a string as JSON, with progressive decoding for legacy double-encoded URLs.
 * 
 * Decoding strategy (per spec):
 * 1. Try JSON.parse directly (value already decoded by URLSearchParams)
 * 2. If fails, try decodeURIComponent once then JSON.parse
 * 3. If still fails, try decodeURIComponent twice then JSON.parse (legacy tolerance)
 * 4. If still fails, return null and log a non-fatal warning
 * 
 * @param value - The raw string value from URLSearchParams
 * @returns Parsed object or null if invalid
 */
function tryParseFilterJSON(value: string): unknown | null {
  if (!value) return null;
  
  // Strategy 1: Try direct JSON.parse (canonical single-encoded case)
  // URLSearchParams.get() already decodes once, so the value should be raw JSON
  try {
    return JSON.parse(value);
  } catch {
    // Continue to next strategy
  }
  
  // Strategy 2: Try decodeURIComponent once then JSON.parse
  // This handles cases where the filter was double-encoded
  try {
    const decoded = decodeURIComponent(value);
    return JSON.parse(decoded);
  } catch {
    // Continue to next strategy
  }
  
  // Strategy 3: Try decodeURIComponent twice then JSON.parse
  // This handles legacy triple-encoded cases (very rare)
  try {
    const decodedOnce = decodeURIComponent(value);
    const decodedTwice = decodeURIComponent(decodedOnce);
    return JSON.parse(decodedTwice);
  } catch {
    // All strategies failed
  }
  
  // Log warning for debugging (non-fatal)
  console.warn('[listQueryUtils] Failed to parse filter value after all decode attempts:', value.substring(0, 100));
  return null;
}

/**
 * Parse filter string into FilterTree
 * 
 * Handles both single-encoded and double-encoded filter values for backward compatibility.
 * Uses progressive decoding strategy to tolerate legacy URLs while preferring canonical format.
 * 
 * @param filterStr - The filter string to parse (from URLSearchParams.get())
 * @returns Parsed FilterTree or null if invalid
 */
export function parseFilterString(filterStr: string | null): FilterTree | null {
  if (!filterStr) return null;
  
  const parsed = tryParseFilterJSON(filterStr);
  
  if (parsed && (isFilterCondition(parsed) || isFilterAndGroup(parsed) || isFilterOrGroup(parsed))) {
    return parsed as FilterTree;
  }
  
  return null;
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
  // Support both 'q' (canonical) and 'search' (legacy) - q takes precedence
  const q = params.get('q') ?? params.get('search');
  const sort = params.get('sort');
  const filter = params.get('filter');
  
  // Parse sort into field and order
  const sortValue = sort ?? mergedDefaults.sort;
  const parsedSort = parseSort(sortValue);
  
  // Resolve search value - q takes precedence
  const searchValue = q ?? mergedDefaults.q;
  
  return {
    page: pageStr ? parseInt(pageStr, 10) || mergedDefaults.page : mergedDefaults.page,
    pageSize: pageSizeStr ? parseInt(pageSizeStr, 10) || mergedDefaults.pageSize : mergedDefaults.pageSize,
    q: searchValue,
    sort: sortValue,
    sortField: parsedSort?.field ?? mergedDefaults.sortField,
    sortOrder: (parsedSort?.direction ?? mergedDefaults.sortOrder) as 'ASC' | 'DESC',
    filterTree: filter ? parseFilterString(filter) : mergedDefaults.filterTree,
    search: searchValue, // deprecated, kept for backward compatibility
  };
}

/**
 * Validate a filter condition has required fields
 * @param condition - Condition to validate
 * @returns true if valid
 */
function isValidCondition(condition: FilterCondition): boolean {
  return typeof condition.field === 'string' && 
         condition.field.length > 0 && 
         typeof condition.op === 'string';
}

/**
 * Normalize a filter input to the canonical tree format
 * 
 * Normalization rules:
 * - Wraps single condition in {and:[condition]}
 * - Keeps existing {and:[...]}/{or:[...]} as-is
 * - Validates minimal shape and drops invalid nodes
 * - Returns null for invalid/empty input (safe fallback)
 * 
 * @param input - Filter input (condition, and/or group, or null)
 * @returns Normalized FilterTree or null
 */
export function normalizeFilter(input: FilterTree | FilterCondition | null | undefined): FilterTree | null {
  if (!input) return null;
  
  // Handle single condition - wrap in AND group
  if (isFilterCondition(input)) {
    if (!isValidCondition(input)) {
      console.warn('[listQueryUtils] Invalid filter condition dropped:', input);
      return null;
    }
    return { and: [input] } as FilterAndGroup;
  }
  
  // Handle AND group - validate and filter children
  if (isFilterAndGroup(input)) {
    const validChildren = input.and.filter(child => {
      if (isFilterCondition(child)) {
        return isValidCondition(child);
      }
      // Recursively validate nested groups
      return isFilterAndGroup(child) || isFilterOrGroup(child);
    });
    return { and: validChildren } as FilterAndGroup;
  }
  
  // Handle OR group - validate and filter children
  if (isFilterOrGroup(input)) {
    const validChildren = input.or.filter(child => {
      if (isFilterCondition(child)) {
        return isValidCondition(child);
      }
      // Recursively validate nested groups
      return isFilterAndGroup(child) || isFilterOrGroup(child);
    });
    return { or: validChildren } as FilterTree;
  }
  
  // Unknown structure - return null (safe fallback)
  console.warn('[listQueryUtils] Unknown filter structure dropped:', input);
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
  
  // Use 'q' as canonical param, but also check 'search' for backward compatibility
  const searchValue = state.q ?? state.search;
  const defaultSearchValue = defaults.q ?? defaults.search;
  if (searchValue !== undefined && (includeDefaults || searchValue !== defaultSearchValue)) {
    if (searchValue) {
      params.set('q', searchValue);
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
  
  // Use 'q' as canonical param, but also check 'search' for backward compatibility
  const searchValue = newState.q ?? newState.search;
  if (searchValue !== undefined) {
    if (searchValue) {
      newParams.set('q', searchValue);
      newParams.delete('search'); // Remove legacy param if present
    } else {
      newParams.delete('q');
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
  
  // Use 'q' as canonical param, but also check 'search' for backward compatibility
  const searchValue = state.q ?? state.search;
  if (searchValue) {
    params.q = searchValue;
  }
  
  if (state.sort) {
    // Send ONLY canonical sort param (field:ASC|DESC format)
    // Do NOT send legacy sortBy/sortOrder to avoid contract conflicts
    params.sort = state.sort;
  }
  
  if (state.filterTree) {
    params.filter = serializeFilterTree(state.filterTree);
  }
  
  return params;
}
