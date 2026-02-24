/**
 * Regression tests for ItsmChangeDetail component
 *
 * Issue #2: Change create/detail crashes with "Cannot read properties of undefined (reading 'length')"
 * Root cause: riskAssessment.breakdown could be undefined; response envelope parsing was fragile.
 * Fix: Added defensive null-checking for breakdown array and hardened response envelope parsing.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ItsmChangeDetail } from '../ItsmChangeDetail';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockShowNotification = jest.fn();
const mockApiGet = jest.fn();
const mockApiPost = jest.fn();

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
      getLinkedRisks: () => Promise.resolve({ data: { data: [] } }),
      getLinkedControls: () => Promise.resolve({ data: { data: [] } }),
      linkRisk: jest.fn().mockResolvedValue({ data: {} }),
      linkControl: jest.fn().mockResolvedValue({ data: {} }),
      unlinkRisk: jest.fn().mockResolvedValue({ data: {} }),
      unlinkControl: jest.fn().mockResolvedValue({ data: {} }),
      conflicts: () => Promise.resolve({ data: { data: [] } }),
      getRiskAssessment: (id: string) => mockApiGet(`/changes/${id}/risk-assessment`),
      listApprovals: () => Promise.resolve({ data: { data: [] } }),
      getTopologyImpact: () => Promise.resolve({ data: { data: null } }),
      recalculateTopologyImpact: () => Promise.resolve({ data: { data: null } }),
      evaluateTopologyGovernance: () => Promise.resolve({ data: { data: null } }),
      getTopologyGuardrails: () => Promise.resolve({ data: { data: null } }),
      recalculateTopologyGuardrails: () => Promise.resolve({ data: { data: null } }),
      getSuggestedTaskPack: () => Promise.resolve({ data: { data: null } }),
      getTraceabilitySummary: () => Promise.resolve({ data: { data: null } }),
      recalculateRisk: jest.fn().mockResolvedValue({ data: { data: null } }),
      refreshConflicts: jest.fn().mockResolvedValue({ data: {} }),
      getCabSummary: () => Promise.resolve({ data: { data: null } }),
    },
    choices: { list: () => Promise.resolve({ data: { data: { items: [] } } }) },
  },
  cmdbApi: {
    services: { list: () => Promise.resolve({ data: { data: { items: [] } } }) },
    serviceOfferings: { list: () => Promise.resolve({ data: { data: { items: [] } } }) },
  },
  riskApi: {
    list: () => Promise.resolve({ data: { data: { items: [] } } }),
  },
  controlApi: {
    list: () => Promise.resolve({ data: { data: { items: [] } } }),
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

// Mock ALL sub-components used by ItsmChangeDetail
jest.mock('../../../components/topology-intelligence', () => ({
  TopologyImpactSummaryCard: () => null,
  TopologyExplainabilityPanel: () => null,
  TopologyInsightBanner: () => null,
  TopologyGovernanceDecisionPanel: () => null,
  TopologyGuardrailsPanel: () => null,
  SuggestedTaskPackCard: () => null,
  TraceabilityChainWidget: () => null,
  classifyTopologyApiError: () => ({ kind: 'unknown', message: '' }),
  unwrapTopologyResponse: (r: unknown) => r,
  normalizeTopologyImpactResponse: (r: unknown) => r,
  getTopologyRiskLevel: () => 'low',
}));

jest.mock('../../../components/itsm/ActivityStream', () => ({
  ActivityStream: () => null,
}));

jest.mock('../../../components/itsm/CustomerRiskIntelligence', () => ({
  CustomerRiskIntelligence: () => null,
}));

jest.mock('../../../components/itsm/GovernanceBanner', () => ({
  GovernanceBanner: () => null,
}));

jest.mock('../../../components/copilot/CopilotPanel', () => ({
  CopilotPanel: () => null,
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { tenantId: 'test-tenant' }, token: 'test-token' }),
}));

jest.mock('../../../components/itsm/LinkRecordDialog', () => ({
  LinkRecordDialog: () => null,
}));

describe('ItsmChangeDetail — Regression #2: undefined.length crash', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('Create mode', () => {
    it('should render without crash in create mode', () => {
      mockUseParams.mockReturnValue({});
      expect(() => { render(<ItsmChangeDetail />); }).not.toThrow();
    });
  });

  describe('Detail mode — response envelope handling', () => {
    it('should not crash with nested envelope { data: { data: obj } }', async () => {
      const rec = { id: 'c1', number: 'CHG-1', title: 'T', type: 'STANDARD', state: 'DRAFT', risk: 'LOW', approvalStatus: 'NOT_REQUESTED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      mockUseParams.mockReturnValue({ id: 'c1' });
      mockApiGet.mockImplementation((url: string) => url.includes('/risk-assessment') ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: rec } }));
      expect(() => { render(<ItsmChangeDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockApiGet).toHaveBeenCalled(); });
    });

    it('should not crash with flat response { id, ... }', async () => {
      const rec = { id: 'c2', number: 'CHG-2', title: 'Flat', type: 'NORMAL', state: 'ASSESS', risk: 'MEDIUM', approvalStatus: 'REQUESTED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      mockUseParams.mockReturnValue({ id: 'c2' });
      mockApiGet.mockImplementation((url: string) => url.includes('/risk-assessment') ? Promise.resolve({ data: null }) : Promise.resolve({ data: rec }));
      expect(() => { render(<ItsmChangeDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockApiGet).toHaveBeenCalled(); });
    });

    it('should not crash when data.data is null', async () => {
      mockUseParams.mockReturnValue({ id: 'c3' });
      mockApiGet.mockResolvedValue({ data: { data: null } });
      expect(() => { render(<ItsmChangeDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockApiGet).toHaveBeenCalled(); });
    });
  });

  describe('Risk assessment breakdown — defensive null-checking', () => {
    const makeRec = (id: string) => ({ id, number: `CHG-${id}`, title: 'T', type: 'STANDARD', state: 'ASSESS', risk: 'HIGH', approvalStatus: 'NOT_REQUESTED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

    it('should not crash when breakdown is undefined (original crash trigger)', async () => {
      const ra = { id: 'ra1', riskScore: 75, riskLevel: 'HIGH', computedAt: new Date().toISOString(), impactedCiCount: 5, impactedServiceCount: 2 };
      mockUseParams.mockReturnValue({ id: 'c4' });
      mockApiGet.mockImplementation((url: string) => url.includes('/risk-assessment') ? Promise.resolve({ data: { data: ra } }) : Promise.resolve({ data: { data: makeRec('c4') } }));
      expect(() => { render(<ItsmChangeDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockApiGet).toHaveBeenCalled(); });
    });

    it('should not crash when breakdown is null', async () => {
      const ra = { id: 'ra2', riskScore: 50, riskLevel: 'MEDIUM', computedAt: new Date().toISOString(), impactedCiCount: 2, impactedServiceCount: 1, breakdown: null };
      mockUseParams.mockReturnValue({ id: 'c5' });
      mockApiGet.mockImplementation((url: string) => url.includes('/risk-assessment') ? Promise.resolve({ data: { data: ra } }) : Promise.resolve({ data: { data: makeRec('c5') } }));
      expect(() => { render(<ItsmChangeDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockApiGet).toHaveBeenCalled(); });
    });

    it('should not crash when breakdown is a valid array', async () => {
      const ra = { id: 'ra3', riskScore: 85, riskLevel: 'HIGH', computedAt: new Date().toISOString(), impactedCiCount: 10, impactedServiceCount: 3, breakdown: [{ name: 'CI Impact', score: 90, weight: 40, weightedScore: 36 }] };
      mockUseParams.mockReturnValue({ id: 'c6' });
      mockApiGet.mockImplementation((url: string) => url.includes('/risk-assessment') ? Promise.resolve({ data: { data: ra } }) : Promise.resolve({ data: { data: makeRec('c6') } }));
      expect(() => { render(<ItsmChangeDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockApiGet).toHaveBeenCalled(); });
    });
  });

  describe('API error resilience', () => {
    it('should not crash when change GET endpoint fails', async () => {
      mockUseParams.mockReturnValue({ id: 'err' });
      mockApiGet.mockRejectedValue(new Error('Network error'));
      expect(() => { render(<ItsmChangeDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockApiGet).toHaveBeenCalled(); });
    });
  });
});
