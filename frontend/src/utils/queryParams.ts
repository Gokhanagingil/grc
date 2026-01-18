/**
 * Query parameter helpers for list endpoints.
 *
 * Single-encode rule:
 * - Build raw JSON strings for filter/sort
 * - Let URLSearchParams handle encoding exactly once
 */

type Primitive = string | number | boolean;

export interface ListQueryParamsOptions {
  page?: number;
  pageSize?: number;
  filter?: Record<string, unknown>;
  sort?: Record<string, unknown> | Array<Record<string, unknown>>;
  [key: string]: Primitive | Primitive[] | Record<string, unknown> | Array<Record<string, unknown>> | undefined | null;
}

const RESERVED_KEYS = new Set(['page', 'pageSize', 'filter', 'sort']);

export function buildListQueryParams(options: ListQueryParamsOptions = {}): URLSearchParams {
  const params = new URLSearchParams();

  if (options.page !== undefined) {
    params.set('page', String(options.page));
  }

  if (options.pageSize !== undefined) {
    params.set('pageSize', String(options.pageSize));
  }

  if (options.filter) {
    // Do not encode here; URLSearchParams will handle encoding once.
    params.set('filter', JSON.stringify(options.filter));
  }

  if (options.sort) {
    // Do not encode here; URLSearchParams will handle encoding once.
    params.set('sort', JSON.stringify(options.sort));
  }

  Object.entries(options).forEach(([key, value]) => {
    if (RESERVED_KEYS.has(key)) {
      return;
    }

    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && entry !== '') {
          params.append(key, String(entry));
        }
      });
      return;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params.set(key, String(value));
    }
  });

  return params;
}

function safeDecodeURIComponent(value: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(value)) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseFilterFromQuery(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    // Convert legacy format to canonical if needed
    return normalizeFilterFormat(parsed);
  } catch {
    // Decode at most once, then attempt JSON.parse.
    const decoded = safeDecodeURIComponent(value);
    if (decoded === value) {
      return null;
    }

    try {
      const parsed = JSON.parse(decoded) as Record<string, unknown>;
      // Convert legacy format to canonical if needed
      return normalizeFilterFormat(parsed);
    } catch {
      return null;
    }
  }
}

/**
 * Normalize filter format: convert legacy {op: "and", children: [...]} to canonical {and: [...]}
 * Backend supports both, but frontend should produce canonical only.
 */
function normalizeFilterFormat(filter: Record<string, unknown>): Record<string, unknown> {
  if (!filter || typeof filter !== 'object') {
    return filter;
  }

  // Check if it's legacy format: {op: "and", children: [...]}
  if ('op' in filter && 'children' in filter && Array.isArray(filter.children)) {
    const op = filter.op;
    const children = filter.children as Record<string, unknown>[];
    
    // Convert to canonical format: {and: [...]} or {or: [...]}
    return {
      [op as string]: children.map(child => normalizeFilterFormat(child)),
    };
  }

  // Already canonical or simple filter - return as is
  // Recursively normalize nested structures
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      normalized[key] = normalizeFilterFormat(value as Record<string, unknown>);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

/**
 * Build query params excluding default values.
 * Only includes params that differ from defaults.
 */
export interface ListQueryParamsWithDefaults {
  page?: number;
  pageSize?: number;
  filter?: Record<string, unknown> | null;
  sort?: string | null; // Format: "field:DIR" (e.g., "createdAt:DESC")
  search?: string | null;
  [key: string]: string | number | boolean | Record<string, unknown> | null | undefined | string[] | number[];
}

export interface ListQueryDefaults {
  page?: number;
  pageSize?: number;
  sort?: string; // Format: "field:DIR"
  filter?: Record<string, unknown> | null;
}

export function buildListQueryParamsWithDefaults(
  options: ListQueryParamsWithDefaults = {},
  defaults: ListQueryDefaults = {}
): URLSearchParams {
  const params = new URLSearchParams();

  // Page - only include if not default (default is usually 1)
  if (options.page !== undefined && options.page !== (defaults.page ?? 1)) {
    params.set('page', String(options.page));
  }

  // PageSize - only include if not default (default is usually 10)
  if (options.pageSize !== undefined && options.pageSize !== (defaults.pageSize ?? 10)) {
    params.set('pageSize', String(options.pageSize));
  }

  // Filter - only include if not empty and not default
  if (options.filter && Object.keys(options.filter).length > 0) {
    const filterStr = JSON.stringify(options.filter);
    const defaultFilterStr = defaults.filter ? JSON.stringify(defaults.filter) : '';
    if (filterStr !== defaultFilterStr) {
      // URLSearchParams will handle encoding exactly once
      params.set('filter', filterStr);
    }
  }

  // Sort - only include if not default (format: "field:DIR")
  if (options.sort && options.sort !== (defaults.sort ?? 'createdAt:DESC')) {
    params.set('sort', options.sort);
  }

  // Search - only include if not empty
  if (options.search && options.search.trim() !== '') {
    params.set('search', options.search);
  }

  // Other params - exclude empty values
  Object.entries(options).forEach(([key, value]) => {
    if (['page', 'pageSize', 'filter', 'sort', 'search'].includes(key)) {
      return; // Already handled above
    }

    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && entry !== '') {
          params.append(key, String(entry));
        }
      });
      return;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params.set(key, String(value));
    }
  });

  return params;
}

/**
 * Parse sort param from URL (format: "field:DIR")
 * Returns {field: string, direction: 'ASC' | 'DESC'} or null
 */
export function parseSortFromQuery(value: string | null | undefined): { field: string; direction: 'ASC' | 'DESC' } | null {
  if (!value) {
    return null;
  }

  const parts = value.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const field = parts[0];
  const direction = parts[1].toUpperCase() as 'ASC' | 'DESC';
  
  if (direction !== 'ASC' && direction !== 'DESC') {
    return null;
  }

  return { field, direction };
}

/**
 * Format sort to URL param string (format: "field:DIR")
 */
export function formatSortToQuery(field: string, direction: 'ASC' | 'DESC'): string {
  return `${field}:${direction}`;
}
