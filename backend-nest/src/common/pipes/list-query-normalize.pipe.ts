/**
 * List Query Normalize Pipe
 *
 * Transforms and normalizes list query parameters before DTO validation.
 * Implements the platform-wide list query contract with backward compatibility.
 *
 * Target Contract (canonical):
 * - page, pageSize: pagination
 * - q: text search
 * - sort=field:ASC|DESC (canonical format)
 * - filter=<tree-json> (existing standard)
 *
 * Legacy inputs supported:
 * - sortBy=<field>
 * - sortOrder=ASC|DESC
 *
 * Behavior:
 * - If canonical 'sort' is provided, parse it and set sortBy/sortOrder, ignore legacy params
 * - If only legacy sortBy/sortOrder are provided, use them
 * - Validate sort field against allowlist for the specific resource
 * - On invalid sort: throw BadRequest (400) with clear message
 */

import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';

/**
 * Sort field allowlists per resource
 * Each resource defines which fields can be sorted
 */
export const SORT_ALLOWLISTS: Record<string, readonly string[]> = {
  issues: [
    'createdAt',
    'updatedAt',
    'title',
    'type',
    'status',
    'severity',
    'discoveredDate',
    'dueDate',
    'resolvedDate',
  ] as const,
  capas: [
    'createdAt',
    'updatedAt',
    'status',
    'type',
    'priority',
    'dueDate',
    'completedDate',
    'verifiedAt',
    'closedAt',
    'title',
  ] as const,
  risks: [
    'createdAt',
    'updatedAt',
    'title',
    'status',
    'severity',
    'likelihood',
    'impact',
    'dueDate',
    'score',
  ] as const,
  'control-tests': [
    'createdAt',
    'updatedAt',
    'name',
    'status',
    'testType',
    'scheduledDate',
  ] as const,
};

/**
 * Default sort configuration per resource
 */
export const DEFAULT_SORTS: Record<
  string,
  { field: string; direction: 'ASC' | 'DESC' }
> = {
  issues: { field: 'createdAt', direction: 'DESC' },
  capas: { field: 'createdAt', direction: 'DESC' },
  risks: { field: 'createdAt', direction: 'DESC' },
  'control-tests': { field: 'createdAt', direction: 'DESC' },
};

/**
 * Parsed sort result
 */
export interface NormalizedSort {
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

/**
 * Parse and normalize sort parameters
 *
 * @param query - Raw query parameters
 * @param resourceName - Resource name for allowlist lookup
 * @returns Normalized sort parameters
 * @throws BadRequestException if sort is invalid
 */
export function normalizeListQuerySort(
  query: Record<string, unknown>,
  resourceName: string,
): NormalizedSort {
  const allowlist = SORT_ALLOWLISTS[resourceName];
  const defaultSort = DEFAULT_SORTS[resourceName] || {
    field: 'createdAt',
    direction: 'DESC',
  };

  if (!allowlist) {
    // If no allowlist defined, use default sort
    return { sortBy: defaultSort.field, sortOrder: defaultSort.direction };
  }

  // Priority 1: Canonical 'sort' param (field:ASC|DESC format)
  if (query.sort && typeof query.sort === 'string') {
    const sortStr = query.sort.trim();
    const colonIndex = sortStr.lastIndexOf(':');

    if (colonIndex === -1) {
      throw new BadRequestException(
        `Invalid sort format: "${sortStr}". Expected format: "field:ASC" or "field:DESC"`,
      );
    }

    const field = sortStr.substring(0, colonIndex);
    const directionRaw = sortStr.substring(colonIndex + 1).toUpperCase();

    if (directionRaw !== 'ASC' && directionRaw !== 'DESC') {
      throw new BadRequestException(
        `Invalid sort direction: "${directionRaw}". Must be ASC or DESC`,
      );
    }

    if (!allowlist.includes(field)) {
      throw new BadRequestException(
        `Invalid sort field: "${field}". Allowed fields for ${resourceName}: ${allowlist.join(', ')}`,
      );
    }

    return { sortBy: field, sortOrder: directionRaw };
  }

  // Priority 2: Legacy sortBy/sortOrder params
  if (query.sortBy && typeof query.sortBy === 'string') {
    const field = query.sortBy.trim();

    if (!allowlist.includes(field)) {
      throw new BadRequestException(
        `Invalid sort field: "${field}". Allowed fields for ${resourceName}: ${allowlist.join(', ')}`,
      );
    }

    let direction: 'ASC' | 'DESC' = 'DESC';
    if (query.sortOrder && typeof query.sortOrder === 'string') {
      const directionRaw = query.sortOrder.toUpperCase();
      if (directionRaw !== 'ASC' && directionRaw !== 'DESC') {
        throw new BadRequestException(
          `Invalid sort direction: "${query.sortOrder}". Must be ASC or DESC`,
        );
      }
      direction = directionRaw;
    }

    return { sortBy: field, sortOrder: direction };
  }

  // No sort params provided - use default
  return { sortBy: defaultSort.field, sortOrder: defaultSort.direction };
}

/**
 * Normalize list query parameters
 *
 * Transforms raw query params into canonical form:
 * - Parses 'sort' into sortBy/sortOrder
 * - Validates sort field against allowlist
 * - Removes 'sort' param after parsing (to avoid DTO validation issues)
 *
 * @param query - Raw query parameters
 * @param resourceName - Resource name for allowlist lookup
 * @returns Normalized query parameters
 */
export function normalizeListQuery(
  query: Record<string, unknown>,
  resourceName: string,
): Record<string, unknown> {
  const normalized = { ...query };

  // Normalize sort parameters
  const { sortBy, sortOrder } = normalizeListQuerySort(query, resourceName);
  normalized.sortBy = sortBy;
  normalized.sortOrder = sortOrder;

  // Remove canonical 'sort' param to avoid DTO validation issues
  // (some DTOs have regex validation on 'sort' that would fail after normalization)
  delete normalized.sort;

  return normalized;
}

/**
 * Factory function to create a ListQueryNormalizePipe for a specific resource
 *
 * @param resourceName - Resource name for allowlist lookup (e.g., 'issues', 'capas', 'risks', 'control-tests')
 * @returns PipeTransform instance
 */
export function createListQueryNormalizePipe(
  resourceName: string,
): PipeTransform {
  @Injectable()
  class ListQueryNormalizePipe implements PipeTransform {
    transform(value: unknown, metadata: ArgumentMetadata): unknown {
      // Only transform query parameters
      if (metadata.type !== 'query') {
        return value;
      }

      // Only transform objects
      if (!value || typeof value !== 'object') {
        return value;
      }

      return normalizeListQuery(value as Record<string, unknown>, resourceName);
    }
  }

  return new ListQueryNormalizePipe();
}

/**
 * Pre-configured pipes for each resource
 */
export const IssuesListQueryPipe = createListQueryNormalizePipe('issues');
export const CapasListQueryPipe = createListQueryNormalizePipe('capas');
export const RisksListQueryPipe = createListQueryNormalizePipe('risks');
export const ControlTestsListQueryPipe =
  createListQueryNormalizePipe('control-tests');
