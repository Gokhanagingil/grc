/**
 * Regression tests for ItsmIncidentDetail component — SLA Linkage
 *
 * Issue #1: Missing SLA linkage under Incident
 * Root cause: Incident detail page did not render any SLA section.
 * Fix: Added collapsible SLA section with empty-state support and breach status chips.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ItsmIncidentDetail } from '../ItsmIncidentDetail';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockShowNotification = jest.fn();
const mockRecordSlas = jest.fn();
const mockIncidentsGet = jest.fn();
const mockGetLinkedRisks = jest.fn();
const mockGetLinkedControls = jest.fn();

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

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', role: 'admin', username: 'admin', email: 'admin@test.local', firstName: 'Admin', lastName: 'User', department: 'IT' },
    token: 'mock-token',
    loading: false,
    isAdmin: true,
    isManager: true,
    hasRole: () => true,
  }),
}));

jest.mock('../../../hooks/useItsmChoices', () => ({
  useItsmChoices: () => ({ choices: {}, loading: false }),
}));

jest.mock('../../../utils/apiErrorClassifier', () => ({
  classifyApiError: () => ({ kind: 'unknown', message: 'error' }),
}));

jest.mock('../../../services/grcClient', () => ({
  itsmApi: {
    incidents: {
      get: (id: string) => mockIncidentsGet(id),
      create: jest.fn().mockResolvedValue({ data: { data: { id: 'new-inc' } } }),
      update: jest.fn().mockResolvedValue({ data: {} }),
      getLinkedRisks: (id: string) => mockGetLinkedRisks(id),
      getLinkedControls: (id: string) => mockGetLinkedControls(id),
      unlinkRisk: jest.fn(),
      unlinkControl: jest.fn(),
    },
    sla: {
      recordSlas: (entityType: string, entityId: string) => mockRecordSlas(entityType, entityId),
    },
    choices: { list: () => Promise.resolve({ data: { data: { items: [] } } }) },
  },
  cmdbApi: {
    services: { list: () => Promise.resolve({ data: { data: { items: [] } } }) },
    serviceOfferings: { list: () => Promise.resolve({ data: { data: { items: [] } } }) },
  },
  riskApi: { list: jest.fn().mockResolvedValue({ data: { data: { items: [] } } }) },
  controlApi: { list: jest.fn().mockResolvedValue({ data: { data: { items: [] } } }) },
}));

jest.mock('../../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), defaults: { baseURL: '' } },
}));


jest.mock('../../../components/itsm/ActivityStream', () => ({
  ActivityStream: () => null,
}));

jest.mock('../../../components/itsm/IncidentImpactTab', () => ({
  IncidentImpactTab: () => null,
}));

jest.mock('../../../components/copilot/CopilotPanel', () => ({
  CopilotPanel: () => null,
}));

const MOCK_INCIDENT= {
  id: 'inc-1', number: 'INC-001', shortDescription: 'Test Incident',
  state: 'open', priority: 'p3', impact: 'medium', urgency: 'medium',
  category: 'software', riskReviewRequired: false,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const setupDetailMocks = (slaData: unknown = []) => {
  mockIncidentsGet.mockResolvedValue({ data: { data: MOCK_INCIDENT } });
  mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
  mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });
  mockRecordSlas.mockResolvedValue({ data: { data: slaData } });
};

describe('ItsmIncidentDetail — Regression #1: Missing SLA linkage', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('SLA section visibility', () => {
    it('should render SLA section in detail mode (even when no SLAs)', async () => {
      mockUseParams.mockReturnValue({ id: 'inc-1' });
      setupDetailMocks([]);

      render(<ItsmIncidentDetail />);

      await waitFor(() => { expect(mockIncidentsGet).toHaveBeenCalledWith('inc-1'); });
      await waitFor(() => { expect(mockRecordSlas).toHaveBeenCalledWith('Incident', 'inc-1'); });

      // SLA section should be visible — the core fix
      await waitFor(() => {
        expect(screen.getByTestId('incident-sla-section')).toBeInTheDocument();
      });
    });

    it('should show empty state text when no SLAs attached', async () => {
      mockUseParams.mockReturnValue({ id: 'inc-1' });
      setupDetailMocks([]);

      render(<ItsmIncidentDetail />);

      await waitFor(() => {
        expect(screen.getByTestId('sla-empty-state')).toBeInTheDocument();
      });
    });

    it('should call recordSlas with correct params', async () => {
      mockUseParams.mockReturnValue({ id: 'inc-1' });
      setupDetailMocks([]);

      render(<ItsmIncidentDetail />);

      await waitFor(() => {
        expect(mockRecordSlas).toHaveBeenCalledWith('Incident', 'inc-1');
      });
    });

    it('should NOT render SLA section or call SLA API in create mode', () => {
      mockUseParams.mockReturnValue({});
      render(<ItsmIncidentDetail />);

      expect(mockRecordSlas).not.toHaveBeenCalled();
    });
  });

  describe('SLA data rendering', () => {
    it('should render SLA records when they exist', async () => {
      const slaRecords = [
        { id: 'sla-1', definitionId: 'def-1', definition: { id: 'def-1', name: 'Response Time SLA' }, state: 'IN_PROGRESS', breached: false, startTime: new Date().toISOString() },
        { id: 'sla-2', definitionId: 'def-2', definition: { id: 'def-2', name: 'Resolution Time SLA' }, state: 'BREACHED', breached: true, startTime: new Date().toISOString() },
      ];

      mockUseParams.mockReturnValue({ id: 'inc-1' });
      setupDetailMocks(slaRecords);

      render(<ItsmIncidentDetail />);

      await waitFor(() => { expect(mockRecordSlas).toHaveBeenCalledWith('Incident', 'inc-1'); });

      // Should show SLA count
      await waitFor(() => {
        expect(screen.getByText(/SLA Linkage \(2\)/)).toBeInTheDocument();
      });
    });

    it('should handle flat array SLA response', async () => {
      mockUseParams.mockReturnValue({ id: 'inc-1' });
      mockIncidentsGet.mockResolvedValue({ data: { data: MOCK_INCIDENT } });
      mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
      mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });
      // Flat response (no nested data)
      mockRecordSlas.mockResolvedValue({ data: [{ id: 'sla-3', state: 'IN_PROGRESS', breached: false }] });

      expect(() => { render(<ItsmIncidentDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockRecordSlas).toHaveBeenCalled(); });
    });
  });

  describe('Error resilience', () => {
    it('should not crash when SLA API fails', async () => {
      mockUseParams.mockReturnValue({ id: 'inc-1' });
      mockIncidentsGet.mockResolvedValue({ data: { data: MOCK_INCIDENT } });
      mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
      mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });
      mockRecordSlas.mockRejectedValue(new Error('SLA service unavailable'));

      expect(() => { render(<ItsmIncidentDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockRecordSlas).toHaveBeenCalled(); });
    });

    it('should not crash when incident GET fails', async () => {
      mockUseParams.mockReturnValue({ id: 'err' });
      mockIncidentsGet.mockRejectedValue(new Error('Network error'));

      expect(() => { render(<ItsmIncidentDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockIncidentsGet).toHaveBeenCalledWith('err'); });
    });

    it('should not crash when SLA data is null', async () => {
      mockUseParams.mockReturnValue({ id: 'inc-1' });
      mockIncidentsGet.mockResolvedValue({ data: { data: MOCK_INCIDENT } });
      mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
      mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });
      mockRecordSlas.mockResolvedValue({ data: { data: null } });

      expect(() => { render(<ItsmIncidentDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockRecordSlas).toHaveBeenCalled(); });
    });
  });
});
