/**
 * Frontend Priority Matrix
 *
 * Mirrors the backend ITIL priority matrix (calculatePriority in enums/index.ts)
 * so the frontend can show live priority recalculation when impact/urgency changes
 * without waiting for a save round-trip.
 *
 * | Impact \ Urgency | High | Medium | Low |
 * |------------------|------|--------|-----|
 * | High             | P1   | P2     | P3  |
 * | Medium           | P2   | P3     | P4  |
 * | Low              | P3   | P4     | P4  |
 */

const PRIORITY_MATRIX: Record<string, Record<string, string>> = {
  high: { high: 'p1', medium: 'p2', low: 'p3' },
  medium: { high: 'p2', medium: 'p3', low: 'p4' },
  low: { high: 'p3', medium: 'p4', low: 'p4' },
};

/**
 * Calculate incident priority from impact and urgency using ITIL matrix.
 * Uses lowercase enum values to match frontend convention (p1-p4, high/medium/low).
 *
 * @param impact - Impact level ('high' | 'medium' | 'low')
 * @param urgency - Urgency level ('high' | 'medium' | 'low')
 * @returns Priority string ('p1' | 'p2' | 'p3' | 'p4'), defaults to 'p3' for unknown inputs
 */
export function calculatePriorityFromMatrix(
  impact: string | undefined,
  urgency: string | undefined,
): string {
  const normalizedImpact = (impact || 'medium').toLowerCase();
  const normalizedUrgency = (urgency || 'medium').toLowerCase();

  const row = PRIORITY_MATRIX[normalizedImpact];
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
  };
  return colors[(priority || '').toLowerCase()] || 'default';
}
