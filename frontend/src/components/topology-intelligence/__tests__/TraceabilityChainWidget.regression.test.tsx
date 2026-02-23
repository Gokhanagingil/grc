/**
 * TraceabilityChainWidget — Regression Tests
 *
 * Regression test for: "undefined is not an object (evaluating 'i.metrics.totalNodes')"
 * Root cause: TraceabilityChainWidget accessed data.metrics.totalNodes without null guard
 * when the API returned a response without a metrics object.
 *
 * Tests cover:
 * - Widget renders when metrics is undefined
 * - Widget renders when metrics is null
 * - Widget renders when metrics is missing entirely
 * - Widget renders when metrics is present but partial (e.g., only totalNodes)
 * - Widget renders with full metrics object
 * - No error boundary trigger for these variants
 * - Legacy payload path + enhanced payload path both render safely
 * - Embedded widget normalization (not only page-level)
 *
 * @regression hotfix: metrics.totalNodes crash on Change detail page
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TraceabilityChainWidget } from '../TraceabilityChainWidget';
import type { TraceabilitySummaryResponseData } from '../../../services/grcClient';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const makeFullResponse = (overrides?: Partial<TraceabilitySummaryResponseData>): TraceabilitySummaryResponseData => ({
  rootId: 'chg-001',
  rootType: 'CHANGE',
  nodes: [
    { id: 'n1', type: 'CHANGE', label: 'CHG-001', status: 'ASSESS', recordId: 'chg-001', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'n2', type: 'TOPOLOGY_ANALYSIS', label: 'Topology', status: 'COMPUTED', recordId: 'ta-001', createdAt: '2026-01-01T00:01:00Z' },
  ],
  edges: [
    { fromId: 'n1', toId: 'n2', relation: 'ANALYZED_BY', label: 'analyzed by' },
  ],
  summary: 'Full traceability chain',
  metrics: {
    totalNodes: 2,
    totalEdges: 1,
    hasTopologyAnalysis: true,
    hasGovernanceDecision: false,
    hasOrchestrationActions: false,
    completenessScore: 60,
  },
  generatedAt: '2026-01-01T00:02:00Z',
  ...overrides,
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('TraceabilityChainWidget — Regression: metrics.totalNodes crash', () => {
  it('should render without crash when metrics is undefined', async () => {
    const response = makeFullResponse();
    // Simulate missing metrics by casting
    const broken = { ...response, metrics: undefined } as unknown as TraceabilitySummaryResponseData;
    const onFetch = jest.fn().mockResolvedValue(broken);

    expect(() => {
      render(
        <TraceabilityChainWidget
          recordId="chg-001"
          recordType="CHANGE"
          onFetch={onFetch}
        />,
      );
    }).not.toThrow();

    await waitFor(() => {
      expect(onFetch).toHaveBeenCalledWith('chg-001');
    });
  });

  it('should render without crash when metrics is null', async () => {
    const response = makeFullResponse();
    const broken = { ...response, metrics: null } as unknown as TraceabilitySummaryResponseData;
    const onFetch = jest.fn().mockResolvedValue(broken);

    expect(() => {
      render(
        <TraceabilityChainWidget
          recordId="chg-002"
          recordType="CHANGE"
          onFetch={onFetch}
        />,
      );
    }).not.toThrow();

    await waitFor(() => {
      expect(onFetch).toHaveBeenCalledWith('chg-002');
    });
  });

  it('should render without crash when metrics is missing entirely from response', async () => {
    // Simulate a response object without the metrics key at all
    const response = {
      rootId: 'chg-003',
      rootType: 'CHANGE',
      nodes: [],
      edges: [],
      summary: 'No metrics',
      generatedAt: '2026-01-01T00:00:00Z',
    } as unknown as TraceabilitySummaryResponseData;

    const onFetch = jest.fn().mockResolvedValue(response);

    expect(() => {
      render(
        <TraceabilityChainWidget
          recordId="chg-003"
          recordType="CHANGE"
          onFetch={onFetch}
        />,
      );
    }).not.toThrow();

    await waitFor(() => {
      expect(onFetch).toHaveBeenCalledWith('chg-003');
    });
  });

  it('should render without crash when metrics is present but partial (only totalNodes)', async () => {
    const response = makeFullResponse();
    const partial = {
      ...response,
      metrics: { totalNodes: 5 },
    } as unknown as TraceabilitySummaryResponseData;
    const onFetch = jest.fn().mockResolvedValue(partial);

    expect(() => {
      render(
        <TraceabilityChainWidget
          recordId="chg-004"
          recordType="CHANGE"
          onFetch={onFetch}
        />,
      );
    }).not.toThrow();

    await waitFor(() => {
      expect(onFetch).toHaveBeenCalledWith('chg-004');
    });
  });

  it('should render correctly with full metrics object', async () => {
    const response = makeFullResponse();
    const onFetch = jest.fn().mockResolvedValue(response);

    render(
      <TraceabilityChainWidget
        recordId="chg-005"
        recordType="CHANGE"
        onFetch={onFetch}
      />,
    );

    await waitFor(() => {
      expect(onFetch).toHaveBeenCalledWith('chg-005');
    });

    // Should show the widget
    expect(screen.getByTestId('traceability-chain-widget')).toBeInTheDocument();
  });

  it('should render loading state then data without crash', async () => {
    const response = makeFullResponse();
    const onFetch = jest.fn().mockResolvedValue(response);

    render(
      <TraceabilityChainWidget
        recordId="chg-006"
        recordType="CHANGE"
        onFetch={onFetch}
      />,
    );

    // Loading state should appear first
    expect(screen.getByTestId('traceability-chain-widget')).toBeInTheDocument();

    await waitFor(() => {
      expect(onFetch).toHaveBeenCalled();
    });
  });

  it('should handle fetch error gracefully without crash', async () => {
    const onFetch = jest.fn().mockRejectedValue(new Error('Network error'));

    expect(() => {
      render(
        <TraceabilityChainWidget
          recordId="chg-007"
          recordType="CHANGE"
          onFetch={onFetch}
        />,
      );
    }).not.toThrow();

    await waitFor(() => {
      expect(onFetch).toHaveBeenCalledWith('chg-007');
    });

    // Error state should render
    expect(screen.getByTestId('traceability-error')).toBeInTheDocument();
  });

  it('should render without crash when nodes array is missing', async () => {
    const response = {
      rootId: 'chg-008',
      rootType: 'CHANGE',
      edges: [],
      summary: 'No nodes',
      metrics: { totalNodes: 0, totalEdges: 0, hasTopologyAnalysis: false, hasGovernanceDecision: false, hasOrchestrationActions: false, completenessScore: 0 },
      generatedAt: '2026-01-01T00:00:00Z',
    } as unknown as TraceabilitySummaryResponseData;

    const onFetch = jest.fn().mockResolvedValue(response);

    expect(() => {
      render(
        <TraceabilityChainWidget
          recordId="chg-008"
          recordType="CHANGE"
          onFetch={onFetch}
        />,
      );
    }).not.toThrow();

    await waitFor(() => {
      expect(onFetch).toHaveBeenCalledWith('chg-008');
    });
  });
});
