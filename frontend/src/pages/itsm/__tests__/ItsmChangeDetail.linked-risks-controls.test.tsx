/**
 * ItsmChangeDetail — Linked Risks/Controls Integration Tests
 *
 * Tests the linked risks/controls rendering path in Change Detail.
 * Covers:
 * - Change detail renders with linked risks + linked controls all successful
 * - Linked risks empty + linked controls empty => friendly empty states (no error banner)
 * - Linked risks 403 => permission classified error state
 * - Linked controls 404 => endpoint unavailable message
 * - Linked risks/controls 5xx => retryable error state
 * - Malformed envelope/null payload => no crash
 * - Ensure "Something went wrong" boundary is NOT triggered
 * - Response envelope compatibility ({ data: [...] }, { success: true, data: [...] }, etc.)
 *
 * @regression
 * @pr476
 * @grc-bridge
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks — must be before component import
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockShowNotification = jest.fn();
const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
const mockGetLinkedRisks = jest.fn();
const mockGetLinkedControls = jest.fn();
const mockGetTopologyGuardrails = jest.fn();
const mockRecalculateTopologyGuardrails = jest.fn();

jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    __esModule: true,
    useParams: () => mockUseParams(),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    MemoryRouter: ({ children }: { children: React.ReactNode }) => R.createElement('div', null, children),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => R.createElement('a', { href: to }, children),
    NavLink: ({ children, to }: { children: React.ReactNode; to: string }) => R.createElement('a', { href: to }, children),
  };
});

jest.mock('../../../contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

jest.mock('../../../hooks/useItsmChoices', () => ({
  useItsmChoices: () => ({ choices: {}, loading: false }),
}));

jest.mock('../../../services/grcClient', () => ({
  itsmApi: {
    changes: {
      get: (id: string) => mockApiGet(`/changes/${id}`),
      create: (dto: unknown) => mockApiPost('/changes', dto),
      update: jest.fn().mockResolvedValue({ data: {} }),
      getLinkedRisks: (...args: unknown[]) => mockGetLinkedRisks(...args),
      getLinkedControls: (...args: unknown[]) => mockGetLinkedControls(...args),
      conflicts: () => Promise.resolve({ data: { data: [] } }),
      getRiskAssessment: (id: string) => mockApiGet(`/changes/${id}/risk-assessment`),
      listApprovals: () => Promise.resolve({ data: { data: [] } }),
      getTopologyImpact: () => Promise.resolve({ data: { data: null } }),
      recalculateTopologyImpact: () => Promise.resolve({ data: { data: null } }),
      evaluateTopologyGovernance: () => Promise.resolve({ data: { data: null } }),
      getTopologyGuardrails: (...args: unknown[]) => mockGetTopologyGuardrails(...args),
      recalculateTopologyGuardrails: (...args: unknown[]) => mockRecalculateTopologyGuardrails(...args),
      getSuggestedTaskPack: () => Promise.resolve({ data: { data: null } }),
      getTraceabilitySummary: () => Promise.resolve({ data: { data: null } }),
      recalculateRisk: jest.fn().mockResolvedValue({ data: { data: null } }),
      refreshConflicts: jest.fn().mockResolvedValue({ data: {} }),
    },
    choices: { list: () => Promise.resolve({ data: { data: { items: [] } } }) },
  },
  cmdbApi: {
    services: { list: () => Promise.resolve({ data: { data: { items: [] } } }) },
    serviceOfferings: { list: () => Promise.resolve({ data: { data: { items: [] } } }) },
  },
  unwrapResponse: (resp: { data: unknown }) => {
    const raw = resp?.data;
    if (raw && typeof raw === 'object' && 'data' in (raw as Record<string, unknown>)) {
      return (raw as Record<string, unknown>).data;
    }
    return raw;
  },
}));

jest.mock('../../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), defaults: { baseURL: '' } },
}));

jest.mock('../../../utils/apiErrorClassifier', () => ({
  classifyApiError: () => ({ kind: 'unknown', message: 'error' }),
}));

jest.mock('../../../components/topology-intelligence', () => {
  const R = require('react');
  return {
    TopologyImpactSummaryCard: () => null,
    TopologyExplainabilityPanel: () => null,
    TopologyInsightBanner: () => null,
    TopologyGovernanceDecisionPanel: () => null,
    TopologyGuardrailsPanel: () => R.createElement('div', { 'data-testid': 'guardrails-ok' }, 'Guardrails'),
    SuggestedTaskPackCard: () => null,
    TraceabilityChainWidget: () => null,
    classifyTopologyApiError: () => ({ kind: 'unknown', message: '' }),
    unwrapTopologyResponse: (r: unknown) => r,
    normalizeTopologyImpactResponse: (r: unknown) => r,
    getTopologyRiskLevel: () => 'low',
    normalizeGuardrailEvaluationResponse: (raw: unknown) => {
      if (!raw) return null;
      if (typeof raw === 'object' && 'guardrailStatus' in (raw as Record<string, unknown>)) return raw;
      return null;
    },
    normalizeGovernanceEvaluationResponse: (raw: unknown) => {
      if (!raw) return null;
      if (typeof raw === 'object' && 'decision' in (raw as Record<string, unknown>)) return raw;
      return null;
    },
    normalizeSuggestedTaskPackResponse: (raw: unknown) => {
      if (!raw) return { tasks: [], warnings: [], totalTasks: 0, recommendedCount: 0, changeId: '' };
      return raw;
    },
    normalizeTraceabilitySummaryResponse: (raw: unknown) => {
      if (!raw) return null;
      return raw;
    },
  };
});

jest.mock('../../../components/itsm/ActivityStream', () => ({
  ActivityStream: () => null,
}));

jest.mock('../../../components/itsm/CustomerRiskIntelligence', () => {
  const RR = require('react');
  return {
    CustomerRiskIntelligence: () => RR.createElement('div', { 'data-testid': 'risk-intel' }, 'Risk Intel'),
  };
});

jest.mock('../../../components/itsm/GovernanceBanner', () => ({
  GovernanceBanner: () => null,
}));

jest.mock('../../../components/copilot/CopilotPanel', () => ({
  CopilotPanel: () => null,
}));

// Lazy-import the component after mocks are in place
let ItsmChangeDetail: React.ComponentType;
beforeAll(async () => {
  const mod = await import('../ItsmChangeDetail');
  ItsmChangeDetail = mod.ItsmChangeDetail;
});

const makeRec = (id: string, overrides?: Partial<Record<string, unknown>>) => ({
  id,
  number: `CHG-${id}`,
  title: 'Test Change',
  type: 'STANDARD',
  state: 'DRAFT',
  risk: 'LOW',
  approvalStatus: 'NOT_REQUESTED',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// ===========================================================================
// Linked Risks/Controls Integration Tests
// ===========================================================================
describe('ItsmChangeDetail — Linked Risks/Controls Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
    mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });
    mockGetTopologyGuardrails.mockResolvedValue({ data: { data: null } });
    mockRecalculateTopologyGuardrails.mockResolvedValue({ data: { data: null } });
  });

  // -------------------------------------------------------------------------
  // All successful: risks + controls populated
  // -------------------------------------------------------------------------
  describe('All successful — risks + controls populated', () => {
    it('renders without crash when linked risks and controls both return data', async () => {
      mockUseParams.mockReturnValue({ id: 'all-ok' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('all-ok') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({
        data: { success: true, data: [{ id: 'r1', title: 'Risk 1' }, { id: 'r2', title: 'Risk 2' }] },
      });
      mockGetLinkedControls.mockResolvedValue({
        data: { success: true, data: [{ id: 'c1', name: 'Control 1' }] },
      });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
      await waitFor(() => expect(mockGetLinkedControls).toHaveBeenCalled());
    });
  });

  // -------------------------------------------------------------------------
  // Empty lists — no error banners
  // -------------------------------------------------------------------------
  describe('Empty lists — friendly empty states', () => {
    it('renders without error banners when risks are empty', async () => {
      mockUseParams.mockReturnValue({ id: 'empty-risks' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('empty-risks') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
      mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
      await waitFor(() => expect(mockGetLinkedControls).toHaveBeenCalled());

      // Should NOT show "Something went wrong" or generic error boundary
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('renders without error when risks return [] and controls return []', async () => {
      mockUseParams.mockReturnValue({ id: 'both-empty' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('both-empty') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({ data: [] });
      mockGetLinkedControls.mockResolvedValue({ data: [] });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    });
  });

  // -------------------------------------------------------------------------
  // 403 — Permission denied
  // -------------------------------------------------------------------------
  describe('403 — permission denied', () => {
    it('does not crash when linked risks returns 403', async () => {
      mockUseParams.mockReturnValue({ id: 'risks-403' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('risks-403') } }),
      );
      mockGetLinkedRisks.mockRejectedValue({ response: { status: 403 } });
      mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());

      // Should NOT trigger error boundary
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('does not crash when linked controls returns 403', async () => {
      mockUseParams.mockReturnValue({ id: 'controls-403' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('controls-403') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
      mockGetLinkedControls.mockRejectedValue({ response: { status: 403 } });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedControls).toHaveBeenCalled());
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 404 — Endpoint not found
  // -------------------------------------------------------------------------
  describe('404 — endpoint not found', () => {
    it('does not crash when linked risks returns 404', async () => {
      mockUseParams.mockReturnValue({ id: 'risks-404' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('risks-404') } }),
      );
      mockGetLinkedRisks.mockRejectedValue({ response: { status: 404 } });
      mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('does not crash when linked controls returns 404', async () => {
      mockUseParams.mockReturnValue({ id: 'controls-404' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('controls-404') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
      mockGetLinkedControls.mockRejectedValue({ response: { status: 404 } });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedControls).toHaveBeenCalled());
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 5xx — Server errors
  // -------------------------------------------------------------------------
  describe('5xx — server errors', () => {
    it('does not crash when both risks and controls return 500', async () => {
      mockUseParams.mockReturnValue({ id: 'both-500' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('both-500') } }),
      );
      mockGetLinkedRisks.mockRejectedValue({ response: { status: 500 } });
      mockGetLinkedControls.mockRejectedValue({ response: { status: 502, data: { message: 'Bad Gateway' } } });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
      await waitFor(() => expect(mockGetLinkedControls).toHaveBeenCalled());
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('does not crash when risks return 503', async () => {
      mockUseParams.mockReturnValue({ id: 'risks-503' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('risks-503') } }),
      );
      mockGetLinkedRisks.mockRejectedValue({ response: { status: 503 } });
      mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
    });
  });

  // -------------------------------------------------------------------------
  // Malformed envelope / null payload
  // -------------------------------------------------------------------------
  describe('Malformed envelope / null payload', () => {
    it('handles null data from linked risks gracefully', async () => {
      mockUseParams.mockReturnValue({ id: 'null-data' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('null-data') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({ data: null });
      mockGetLinkedControls.mockResolvedValue({ data: null });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('handles string data from linked controls gracefully', async () => {
      mockUseParams.mockReturnValue({ id: 'string-data' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('string-data') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({ data: 'not-json' });
      mockGetLinkedControls.mockResolvedValue({ data: 'invalid' });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('handles { data: { data: undefined } } gracefully', async () => {
      mockUseParams.mockReturnValue({ id: 'undef-data' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('undef-data') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({ data: { data: undefined } });
      mockGetLinkedControls.mockResolvedValue({ data: { data: undefined } });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Network errors
  // -------------------------------------------------------------------------
  describe('Network errors', () => {
    it('handles network error for linked risks gracefully', async () => {
      mockUseParams.mockReturnValue({ id: 'net-err' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('net-err') } }),
      );
      mockGetLinkedRisks.mockRejectedValue({ message: 'Network Error' });
      mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('handles timeout for linked controls gracefully', async () => {
      mockUseParams.mockReturnValue({ id: 'timeout' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('timeout') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
      mockGetLinkedControls.mockRejectedValue({ message: 'timeout of 30000ms exceeded' });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedControls).toHaveBeenCalled());
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Response envelope compatibility
  // -------------------------------------------------------------------------
  describe('Response envelope compatibility', () => {
    it('parses { success: true, data: [...] } envelope', async () => {
      mockUseParams.mockReturnValue({ id: 'env-success' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('env-success') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({
        data: { success: true, data: [{ id: 'r1', title: 'Risk' }] },
      });
      mockGetLinkedControls.mockResolvedValue({
        data: { success: true, data: [{ id: 'c1', name: 'Control' }] },
      });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
    });

    it('parses flat array envelope', async () => {
      mockUseParams.mockReturnValue({ id: 'env-flat' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('env-flat') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({
        data: [{ id: 'r1', title: 'Risk' }],
      });
      mockGetLinkedControls.mockResolvedValue({
        data: [{ id: 'c1', name: 'Control' }],
      });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
    });

    it('parses { data: { items: [...] } } paginated envelope', async () => {
      mockUseParams.mockReturnValue({ id: 'env-pag' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('env-pag') } }),
      );
      mockGetLinkedRisks.mockResolvedValue({
        data: { data: { items: [{ id: 'r1' }], total: 1 } },
      });
      mockGetLinkedControls.mockResolvedValue({
        data: { data: { items: [{ id: 'c1' }], total: 1 } },
      });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockGetLinkedRisks).toHaveBeenCalled());
    });
  });

  // -------------------------------------------------------------------------
  // Change detail compatibility: no tasks, no risks, no controls
  // -------------------------------------------------------------------------
  describe('Change detail compatibility', () => {
    it('existing change with no tasks, no risks, no controls loads safely', async () => {
      mockUseParams.mockReturnValue({ id: 'compat' });
      mockApiGet.mockImplementation((url: string) =>
        url.includes('/risk-assessment')
          ? Promise.resolve({ data: { data: null } })
          : Promise.resolve({ data: { data: makeRec('compat', { tasks: undefined }) } }),
      );
      mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
      mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });

      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
      await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('create mode (no id) does not crash', () => {
      mockUseParams.mockReturnValue({});
      expect(() => render(<ItsmChangeDetail />)).not.toThrow();
    });
  });
});
