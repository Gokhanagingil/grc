/**
 * Standards Library Response Normalizers
 * 
 * Defensive normalization functions to prevent UI crashes from unexpected API response shapes.
 * Handles both envelope responses { success, data } and raw array responses.
 */

export interface FiltersData {
  families: string[];
  versions: string[];
  domains: string[];
  categories: string[];
  hierarchyLevels: string[];
}

export interface StandardRequirement {
  id: string;
  code: string;
  title: string;
  description: string;
  family: string;
  version: string;
  hierarchy_level: string;
  domain: string;
  category: string;
  regulation: string;
  status: string;
  metadata_tags?: Array<{ id: string; value: string; color: string }>;
}

export const DEFAULT_FILTERS_DATA: FiltersData = {
  families: [],
  versions: [],
  domains: [],
  categories: [],
  hierarchyLevels: [],
};

/**
 * Normalize filters data from API response
 * Ensures all array fields are always arrays, never undefined/null
 */
export function normalizeFiltersData(data: unknown): FiltersData {
  if (!data || typeof data !== 'object') {
    return DEFAULT_FILTERS_DATA;
  }
  const obj = data as Record<string, unknown>;
  return {
    families: Array.isArray(obj.families) ? obj.families : [],
    versions: Array.isArray(obj.versions) ? obj.versions : [],
    domains: Array.isArray(obj.domains) ? obj.domains : [],
    categories: Array.isArray(obj.categories) ? obj.categories : [],
    hierarchyLevels: Array.isArray(obj.hierarchyLevels) ? obj.hierarchyLevels : [],
  };
}

/**
 * Normalize requirements list response from API
 * Handles multiple response shapes:
 * - Raw array: [...]
 * - Envelope with success: { success: true, data: [...], pagination: { total } }
 * - Envelope with items: { items: [...], total }
 * - Envelope with data array: { data: [...], total }
 */
export function normalizeRequirementsResponse(data: unknown): { items: StandardRequirement[]; total: number } {
  if (!data) {
    return { items: [], total: 0 };
  }
  if (Array.isArray(data)) {
    return { items: data, total: data.length };
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (obj.success === true && 'data' in obj) {
      const innerData = obj.data;
      const items = Array.isArray(innerData) ? innerData : [];
      // Only use pagination total if items is valid array, otherwise use items.length (0)
      const pagination = obj.pagination as { total?: number } | undefined;
      const total = items.length > 0 ? (pagination?.total ?? items.length) : items.length;
      return { items, total };
    }
    if ('items' in obj && Array.isArray(obj.items)) {
      return { items: obj.items as StandardRequirement[], total: (obj.total as number) ?? obj.items.length };
    }
    if ('data' in obj && Array.isArray(obj.data)) {
      return { items: obj.data as StandardRequirement[], total: (obj.total as number) ?? obj.data.length };
    }
  }
  return { items: [], total: 0 };
}
