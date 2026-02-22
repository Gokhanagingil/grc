/**
 * Unit tests for normalizeRcaDecisionsSummary()
 *
 * Phase 0 regression test — PR #448 response shape mismatch.
 *
 * Verifies that the normalizer:
 *   1. Converts legacy array `decisions` to Record<string, HypothesisDecisionData>
 *   2. Passes through correct Record shape unchanged
 *   3. Returns null for null/undefined input
 *   4. Always outputs Record (never array) for `decisions`
 *
 * @regression
 */

import { normalizeRcaDecisionsSummary } from '../grcClient';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const HYPO_1 = {
  hypothesisId: 'hypo-aaa',
  status: 'ACCEPTED',
  reason: 'Confirmed root cause',
  decidedBy: 'user-1',
  decidedAt: '2025-12-01T00:00:00Z',
  notes: [
    {
      id: 'note-1',
      hypothesisId: 'hypo-aaa',
      content: 'Evidence collected',
      noteType: 'evidence',
      createdBy: 'user-1',
      createdAt: '2025-12-01T00:00:00Z',
    },
  ],
};

const HYPO_2 = {
  hypothesisId: 'hypo-bbb',
  status: 'REJECTED',
  reason: null,
  decidedBy: 'user-2',
  decidedAt: '2025-12-02T00:00:00Z',
  notes: [],
};

const BASE_SUMMARY = {
  majorIncidentId: 'mi-001',
  selectedHypothesisId: 'hypo-aaa',
  selectedReason: 'Most likely cause',
  selectedBy: 'user-1',
  selectedAt: '2025-12-01T12:00:00Z',
  totalDecisions: 2,
  acceptedCount: 1,
  rejectedCount: 1,
  investigatingCount: 0,
  pendingCount: 0,
};

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('normalizeRcaDecisionsSummary', () => {
  describe('null / undefined input', () => {
    it('should return null for null input', () => {
      expect(normalizeRcaDecisionsSummary(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(normalizeRcaDecisionsSummary(undefined)).toBeNull();
    });
  });

  describe('Record shape (current contract)', () => {
    it('should pass through Record<string, HypothesisDecisionData> unchanged', () => {
      const raw = {
        ...BASE_SUMMARY,
        decisions: {
          'hypo-aaa': HYPO_1,
          'hypo-bbb': HYPO_2,
        },
      } as Record<string, unknown>;

      const result = normalizeRcaDecisionsSummary(raw);

      expect(result).not.toBeNull();
      expect(Array.isArray(result!.decisions)).toBe(false);
      expect(typeof result!.decisions).toBe('object');

      // Keyed lookup works
      expect(result!.decisions['hypo-aaa'].hypothesisId).toBe('hypo-aaa');
      expect(result!.decisions['hypo-aaa'].status).toBe('ACCEPTED');
      expect(result!.decisions['hypo-bbb'].hypothesisId).toBe('hypo-bbb');
      expect(result!.decisions['hypo-bbb'].status).toBe('REJECTED');
    });

    it('should preserve all summary fields', () => {
      const raw = {
        ...BASE_SUMMARY,
        decisions: { 'hypo-aaa': HYPO_1 },
      } as Record<string, unknown>;

      const result = normalizeRcaDecisionsSummary(raw)!;

      expect(result.majorIncidentId).toBe('mi-001');
      expect(result.selectedHypothesisId).toBe('hypo-aaa');
      expect(result.selectedReason).toBe('Most likely cause');
      expect(result.selectedBy).toBe('user-1');
      expect(result.selectedAt).toBe('2025-12-01T12:00:00Z');
      expect(result.totalDecisions).toBe(2);
      expect(result.acceptedCount).toBe(1);
      expect(result.rejectedCount).toBe(1);
      expect(result.investigatingCount).toBe(0);
      expect(result.pendingCount).toBe(0);
    });
  });

  describe('Array shape (legacy contract — PR #448 mismatch)', () => {
    it('should convert array decisions to Record keyed by hypothesisId', () => {
      const raw = {
        ...BASE_SUMMARY,
        decisions: [HYPO_1, HYPO_2],
      } as Record<string, unknown>;

      const result = normalizeRcaDecisionsSummary(raw);

      expect(result).not.toBeNull();
      // CRITICAL: output decisions must ALWAYS be Record, never array
      expect(Array.isArray(result!.decisions)).toBe(false);
      expect(typeof result!.decisions).toBe('object');

      // Keyed lookup works after conversion
      expect(result!.decisions['hypo-aaa']).toBeDefined();
      expect(result!.decisions['hypo-aaa'].hypothesisId).toBe('hypo-aaa');
      expect(result!.decisions['hypo-aaa'].status).toBe('ACCEPTED');

      expect(result!.decisions['hypo-bbb']).toBeDefined();
      expect(result!.decisions['hypo-bbb'].status).toBe('REJECTED');
    });

    it('should skip array entries without hypothesisId', () => {
      const raw = {
        ...BASE_SUMMARY,
        decisions: [
          HYPO_1,
          { status: 'PENDING', notes: [] }, // Missing hypothesisId
          null,
        ],
      } as Record<string, unknown>;

      const result = normalizeRcaDecisionsSummary(raw)!;

      expect(Object.keys(result.decisions)).toHaveLength(1);
      expect(result.decisions['hypo-aaa']).toBeDefined();
    });

    it('should handle empty array', () => {
      const raw = {
        ...BASE_SUMMARY,
        decisions: [],
      } as Record<string, unknown>;

      const result = normalizeRcaDecisionsSummary(raw)!;

      expect(Array.isArray(result.decisions)).toBe(false);
      expect(Object.keys(result.decisions)).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle missing decisions field', () => {
      const raw = {
        majorIncidentId: 'mi-001',
        totalDecisions: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        investigatingCount: 0,
        pendingCount: 0,
      } as Record<string, unknown>;

      const result = normalizeRcaDecisionsSummary(raw)!;

      expect(Array.isArray(result.decisions)).toBe(false);
      expect(Object.keys(result.decisions)).toHaveLength(0);
    });

    it('should default missing scalar fields', () => {
      const raw = {} as Record<string, unknown>;
      const result = normalizeRcaDecisionsSummary(raw)!;

      expect(result.majorIncidentId).toBe('');
      expect(result.selectedHypothesisId).toBeNull();
      expect(result.totalDecisions).toBe(0);
      expect(result.acceptedCount).toBe(0);
    });

    it('should handle decisions as non-object primitive gracefully', () => {
      const raw = {
        ...BASE_SUMMARY,
        decisions: 'invalid',
      } as Record<string, unknown>;

      const result = normalizeRcaDecisionsSummary(raw)!;

      // String is neither array nor object, so decisions should be empty Record
      expect(Array.isArray(result.decisions)).toBe(false);
      expect(Object.keys(result.decisions)).toHaveLength(0);
    });
  });
});
