/**
 * Traceability Summary Normalization — Regression Tests
 *
 * Tests for normalizeTraceabilitySummaryResponse covering:
 * - metrics undefined / null / missing entirely / partial / full
 * - nodes/edges missing or non-array
 * - Legacy payload path + enhanced payload path
 * - Boundary normalization guarantees
 *
 * @regression hotfix: metrics.totalNodes crash on Change detail page
 */

import { normalizeTraceabilitySummaryResponse } from '../topology-utils';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const FULL_TRACEABILITY_PAYLOAD: Record<string, unknown> = {
  rootId: 'chg-001',
  rootType: 'CHANGE',
  nodes: [
    { id: 'n1', type: 'CHANGE', label: 'CHG-001', status: 'ASSESS', recordId: 'chg-001', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'n2', type: 'TOPOLOGY_ANALYSIS', label: 'Topology', status: 'COMPUTED', recordId: 'ta-001', createdAt: '2026-01-01T00:01:00Z' },
    { id: 'n3', type: 'GOVERNANCE_DECISION', label: 'Governance', status: 'EVALUATED', recordId: 'gd-001', createdAt: '2026-01-01T00:02:00Z' },
  ],
  edges: [
    { fromId: 'n1', toId: 'n2', relation: 'ANALYZED_BY', label: 'analyzed by' },
    { fromId: 'n2', toId: 'n3', relation: 'DECIDED_BY', label: 'decided by' },
  ],
  summary: 'Full traceability chain established',
  metrics: {
    totalNodes: 3,
    totalEdges: 2,
    hasTopologyAnalysis: true,
    hasGovernanceDecision: true,
    hasOrchestrationActions: false,
    completenessScore: 80,
  },
  generatedAt: '2026-01-01T00:03:00Z',
};

const PARTIAL_METRICS_PAYLOAD: Record<string, unknown> = {
  rootId: 'chg-002',
  rootType: 'CHANGE',
  nodes: [{ id: 'n1', type: 'CHANGE', label: 'CHG-002', status: 'DRAFT', recordId: 'chg-002', createdAt: '2026-01-01T00:00:00Z' }],
  edges: [],
  summary: 'Partial',
  metrics: {
    totalNodes: 1,
    // Missing: totalEdges, hasTopologyAnalysis, etc.
  },
  generatedAt: '2026-01-01T00:00:00Z',
};

/* ------------------------------------------------------------------ */
/* normalizeTraceabilitySummaryResponse                                */
/* ------------------------------------------------------------------ */

describe('normalizeTraceabilitySummaryResponse', () => {
  describe('null/undefined/empty input', () => {
    it('should return null for null input', () => {
      expect(normalizeTraceabilitySummaryResponse(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(normalizeTraceabilitySummaryResponse(undefined)).toBeNull();
    });

    it('should return null for non-object input', () => {
      expect(normalizeTraceabilitySummaryResponse('string' as unknown as Record<string, unknown>)).toBeNull();
    });
  });

  describe('metrics undefined / null / missing entirely', () => {
    it('should not crash when metrics is undefined', () => {
      const result = normalizeTraceabilitySummaryResponse({
        rootId: 'chg-x',
        rootType: 'CHANGE',
        metrics: undefined,
      });
      expect(result).not.toBeNull();
      expect(result!.metrics.totalNodes).toBe(0);
      expect(result!.metrics.totalEdges).toBe(0);
      expect(result!.metrics.hasTopologyAnalysis).toBe(false);
      expect(result!.metrics.hasGovernanceDecision).toBe(false);
      expect(result!.metrics.hasOrchestrationActions).toBe(false);
      expect(result!.metrics.completenessScore).toBe(0);
    });

    it('should not crash when metrics is null', () => {
      const result = normalizeTraceabilitySummaryResponse({
        rootId: 'chg-x',
        rootType: 'CHANGE',
        metrics: null,
      });
      expect(result).not.toBeNull();
      expect(result!.metrics.totalNodes).toBe(0);
      expect(result!.metrics.completenessScore).toBe(0);
    });

    it('should not crash when metrics is missing entirely', () => {
      const result = normalizeTraceabilitySummaryResponse({
        rootId: 'chg-x',
        rootType: 'CHANGE',
      });
      expect(result).not.toBeNull();
      expect(result!.metrics.totalNodes).toBe(0);
      expect(result!.metrics.totalEdges).toBe(0);
      expect(result!.metrics.hasTopologyAnalysis).toBe(false);
    });
  });

  describe('metrics present but partial', () => {
    it('should fill defaults for missing metric fields', () => {
      const result = normalizeTraceabilitySummaryResponse(PARTIAL_METRICS_PAYLOAD);
      expect(result).not.toBeNull();
      expect(result!.metrics.totalNodes).toBe(1); // present in payload
      expect(result!.metrics.totalEdges).toBe(0); // defaulted
      expect(result!.metrics.hasTopologyAnalysis).toBe(false); // defaulted
      expect(result!.metrics.hasGovernanceDecision).toBe(false); // defaulted
      expect(result!.metrics.hasOrchestrationActions).toBe(false); // defaulted
      expect(result!.metrics.completenessScore).toBe(0); // defaulted
    });

    it('should handle metrics with only completenessScore', () => {
      const result = normalizeTraceabilitySummaryResponse({
        rootId: 'chg-x',
        metrics: { completenessScore: 50 },
      });
      expect(result).not.toBeNull();
      expect(result!.metrics.completenessScore).toBe(50);
      expect(result!.metrics.totalNodes).toBe(0);
    });
  });

  describe('full metrics object', () => {
    it('should preserve all fields from a full payload', () => {
      const result = normalizeTraceabilitySummaryResponse(FULL_TRACEABILITY_PAYLOAD);
      expect(result).not.toBeNull();
      expect(result!.rootId).toBe('chg-001');
      expect(result!.rootType).toBe('CHANGE');
      expect(result!.summary).toBe('Full traceability chain established');
      expect(result!.metrics.totalNodes).toBe(3);
      expect(result!.metrics.totalEdges).toBe(2);
      expect(result!.metrics.hasTopologyAnalysis).toBe(true);
      expect(result!.metrics.hasGovernanceDecision).toBe(true);
      expect(result!.metrics.hasOrchestrationActions).toBe(false);
      expect(result!.metrics.completenessScore).toBe(80);
      expect(result!.nodes).toHaveLength(3);
      expect(result!.edges).toHaveLength(2);
    });
  });

  describe('nodes/edges normalization', () => {
    it('should default nodes to empty array when missing', () => {
      const result = normalizeTraceabilitySummaryResponse({ rootId: 'x' });
      expect(result!.nodes).toEqual([]);
    });

    it('should default nodes to empty array when non-array', () => {
      const result = normalizeTraceabilitySummaryResponse({ rootId: 'x', nodes: 'not-an-array' });
      expect(result!.nodes).toEqual([]);
    });

    it('should default edges to empty array when missing', () => {
      const result = normalizeTraceabilitySummaryResponse({ rootId: 'x' });
      expect(result!.edges).toEqual([]);
    });

    it('should default edges to empty array when non-array', () => {
      const result = normalizeTraceabilitySummaryResponse({ rootId: 'x', edges: 42 });
      expect(result!.edges).toEqual([]);
    });

    it('should normalize node fields with defaults', () => {
      const result = normalizeTraceabilitySummaryResponse({
        rootId: 'x',
        nodes: [{ id: 'n1' }], // minimal node
      });
      expect(result!.nodes).toHaveLength(1);
      expect(result!.nodes[0].id).toBe('n1');
      expect(result!.nodes[0].type).toBe('UNKNOWN');
      expect(result!.nodes[0].label).toBe('');
      expect(result!.nodes[0].status).toBe('UNKNOWN');
    });
  });

  describe('summary/generatedAt defaults', () => {
    it('should default summary to empty string', () => {
      const result = normalizeTraceabilitySummaryResponse({ rootId: 'x' });
      expect(result!.summary).toBe('');
    });

    it('should default generatedAt to ISO date', () => {
      const result = normalizeTraceabilitySummaryResponse({ rootId: 'x' });
      expect(result!.generatedAt).toBeDefined();
      expect(typeof result!.generatedAt).toBe('string');
    });
  });

  describe('legacy vs enhanced payload compatibility', () => {
    it('should handle legacy payload (no metrics object at all)', () => {
      const legacy: Record<string, unknown> = {
        rootId: 'chg-legacy',
        rootType: 'CHANGE',
        nodes: [],
        edges: [],
        summary: 'Legacy payload without metrics',
        generatedAt: '2025-01-01T00:00:00Z',
        // metrics intentionally missing
      };
      const result = normalizeTraceabilitySummaryResponse(legacy);
      expect(result).not.toBeNull();
      expect(result!.metrics.totalNodes).toBe(0);
      expect(result!.metrics.completenessScore).toBe(0);
      expect(result!.summary).toBe('Legacy payload without metrics');
    });

    it('should handle enhanced payload with full metrics', () => {
      const result = normalizeTraceabilitySummaryResponse(FULL_TRACEABILITY_PAYLOAD);
      expect(result).not.toBeNull();
      expect(result!.metrics.totalNodes).toBe(3);
      expect(result!.metrics.hasTopologyAnalysis).toBe(true);
    });
  });

  describe('empty object input', () => {
    it('should return fully defaulted result for empty object', () => {
      const result = normalizeTraceabilitySummaryResponse({});
      expect(result).not.toBeNull();
      expect(result!.rootId).toBe('');
      expect(result!.rootType).toBe('CHANGE');
      expect(result!.nodes).toEqual([]);
      expect(result!.edges).toEqual([]);
      expect(result!.summary).toBe('');
      expect(result!.metrics.totalNodes).toBe(0);
      expect(result!.metrics.totalEdges).toBe(0);
      expect(result!.metrics.completenessScore).toBe(0);
    });
  });
});
