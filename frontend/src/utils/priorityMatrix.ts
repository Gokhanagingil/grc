/**
 * Frontend Priority Matrix
 *
 * Provides live priority recalculation when impact/urgency changes
 * without waiting for a save round-trip.
 *
 * Supports two modes:
 * 1. Hardcoded ITIL default matrix (instant, no API call)
 * 2. Tenant-specific matrix fetched from backend API (configurable via ITSM Studio)
 *
 * | Impact \ Urgency | High | Medium | Low |
 * |------------------|------|--------|-----|
 * | High             | P1   | P2     | P3  |
 * | Medium           | P2   | P3     | P4  |
 * | Low              | P3   | P4     | P4  |
 */

import { api } from '../services/api';
import { API_PATHS } from '../services/grcClient';

/** Shape of a single priority matrix entry from the backend API */
export interface PriorityMatrixEntry {
  impact: string;
  urgency: string;
  priority: string;
  label: string | null;
}

const DEFAULT_MATRIX: Record<string, Record<string, string>> = {
  high: { high: 'p1', medium: 'p2', low: 'p3' },
  medium: { high: 'p2', medium: 'p3', low: 'p4' },
  low: { high: 'p3', medium: 'p4', low: 'p4' },
};

/**
 * Build a lookup map from a flat array of matrix entries.
 * Keys are lowercase impact → urgency → priority.
 */
export function buildMatrixLookup(
  entries: PriorityMatrixEntry[],
): Record<string, Record<string, string>> {
  const lookup: Record<string, Record<string, string>> = {};
  for (const entry of entries) {
    const impact = (entry.impact || '').toLowerCase();
    const urgency = (entry.urgency || '').toLowerCase();
    if (!lookup[impact]) {
      lookup[impact] = {};
    }
    lookup[impact][urgency] = (entry.priority || 'p3').toLowerCase();
  }
  return lookup;
}

/**
 * Fetch the tenant-specific priority matrix from the backend.
 * Returns a lookup map for fast priority resolution.
 * Falls back to the default ITIL matrix on error.
 */
export async function fetchTenantMatrix(): Promise<Record<string, Record<string, string>>> {
  try {
    const response = await api.get(API_PATHS.ITSM.PRIORITY_MATRIX.GET);
    const rows = response?.data?.data || response?.data || [];
    if (Array.isArray(rows) && rows.length > 0) {
      return buildMatrixLookup(rows as PriorityMatrixEntry[]);
    }
  } catch {
    // Fallback to default on any error
  }
  return { ...DEFAULT_MATRIX };
}

/**
 * Calculate incident priority from impact and urgency using a matrix lookup.
 * Uses the provided matrix if available, otherwise falls back to ITIL default.
 *
 * @param impact - Impact level ('high' | 'medium' | 'low')
 * @param urgency - Urgency level ('high' | 'medium' | 'low')
 * @param matrixOverride - Optional tenant-specific matrix lookup
 * @returns Priority string ('p1' | 'p2' | 'p3' | 'p4'), defaults to 'p3' for unknown inputs
 */
export function calculatePriorityFromMatrix(
  impact: string | undefined,
  urgency: string | undefined,
  matrixOverride?: Record<string, Record<string, string>> | null,
): string {
  const normalizedImpact = (impact || 'medium').toLowerCase();
  const normalizedUrgency = (urgency || 'medium').toLowerCase();

  const matrix = matrixOverride || DEFAULT_MATRIX;
  const row = matrix[normalizedImpact];
  if (!row) return 'p3';

  return row[normalizedUrgency] || 'p3';
}

/**
 * Get a human-readable label for a priority value.
 */
export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    p1: 'P1 - Critical',
    p2: 'P2 - High',
    p3: 'P3 - Medium',
    p4: 'P4 - Low',
    p5: 'P5 - Planning',
  };
  return labels[(priority || '').toLowerCase()] || priority?.toUpperCase() || 'P3';
}

/**
 * Get a color for a priority value (for Chip/Badge components).
 */
export function getPriorityColor(priority: string): 'error' | 'warning' | 'info' | 'success' | 'default' {
  const colors: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
    p1: 'error',
    p2: 'warning',
    p3: 'info',
    p4: 'success',
    p5: 'default',
  };
  return colors[(priority || '').toLowerCase()] || 'default';
}
