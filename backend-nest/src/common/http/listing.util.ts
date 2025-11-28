/**
 * Common utilities for list endpoints
 * Normalizes pagination parameters and provides empty list responses
 */

import { PagedListDto } from './paged.dto';

export interface ListParams {
  page: number;
  pageSize: number;
}

export interface EmptyListResponse {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Normalizes pagination parameters from query string
 * Supports both `pageSize` and `limit` parameters
 * @param query - Query object from request
 * @returns Normalized pagination parameters
 */
export function normalizeListParams(query: any): ListParams {
  // Extract page (default: 1, min: 1)
  let page = 1;
  if (query?.page !== undefined) {
    const parsed = parseInt(String(query.page), 10);
    if (!isNaN(parsed) && parsed >= 1) {
      page = parsed;
    }
  }

  // Extract pageSize (supports both pageSize and limit, default: 20, min: 1, max: 200)
  let pageSize = 20;
  if (query?.pageSize !== undefined) {
    const parsed = parseInt(String(query.pageSize), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 200) {
      pageSize = parsed;
    } else if (!isNaN(parsed) && parsed > 200) {
      pageSize = 200; // Cap at 200
    }
  } else if (query?.limit !== undefined) {
    const parsed = parseInt(String(query.limit), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 200) {
      pageSize = parsed;
    } else if (!isNaN(parsed) && parsed > 200) {
      pageSize = 200; // Cap at 200
    }
  }

  return { page, pageSize };
}

/**
 * Returns standardized empty list response
 * @param page - Current page number
 * @param pageSize - Page size
 * @returns Empty list response matching the contract
 */
export function emptyList(
  page: number = 1,
  pageSize: number = 20,
): EmptyListResponse {
  return {
    items: [],
    total: 0,
    page,
    pageSize,
  };
}

/**
 * Creates a PagedListDto from items and pagination info
 * @param items - Array of items
 * @param total - Total count across all pages
 * @param page - Current page number
 * @param pageSize - Page size
 * @returns PagedListDto instance
 */
export function asPaged<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PagedListDto<T> {
  return {
    items,
    total,
    page,
    pageSize,
  };
}

/**
 * Parse sort parameter from query string
 * Format: "column:direction" or "column" (defaults to desc)
 * @param sortStr - Sort string from query (e.g., "created_at:desc", "name:asc")
 * @param whitelist - Allowed column names
 * @param defaultColumn - Default column if invalid
 * @param defaultDirection - Default direction if invalid
 * @returns Object with column and direction
 */
export function parseSort(
  sortStr?: string,
  whitelist: string[] = ['created_at', 'name', 'title', 'updated_at'],
  defaultColumn: string = 'created_at',
  defaultDirection: 'ASC' | 'DESC' = 'DESC',
): { column: string; direction: 'ASC' | 'DESC' } {
  if (!sortStr) {
    return { column: defaultColumn, direction: defaultDirection };
  }

  const parts = sortStr.split(':');
  const column = parts[0]?.trim() || defaultColumn;
  const directionStr = (parts[1]?.trim() || defaultDirection).toUpperCase();

  // Validate column is in whitelist
  if (!whitelist.includes(column)) {
    return { column: defaultColumn, direction: defaultDirection };
  }

  // Validate direction
  const direction: 'ASC' | 'DESC' =
    directionStr === 'ASC' || directionStr === 'DESC'
      ? directionStr
      : defaultDirection;

  return { column, direction };
}

/**
 * Build where clause with tenant filtering and optional search/filters
 * @param tenantId - Tenant ID (required)
 * @param query - Query object with optional q (search), status, etc.
 * @param searchFields - Fields to search in (for q parameter)
 * @returns TypeORM FindOptionsWhere object
 */
export function buildWhere<T>(
  tenantId: string,
  query: any,
  searchFields: string[] = ['name', 'title', 'description'],
): any {
  const where: any = {
    tenant_id: tenantId,
  };

  // Status filter (if provided)
  if (query.status) {
    where.status = query.status;
  }

  // Text search (q parameter) - ILIKE on search fields
  if (query.q && query.q.trim()) {
    const searchTerm = `%${query.q.trim()}%`;
    // For multiple fields, we'll use OR conditions in the service layer
    // Here we just mark that search is needed
    where._search = {
      term: searchTerm,
      fields: searchFields,
    };
  }

  return where;
}

