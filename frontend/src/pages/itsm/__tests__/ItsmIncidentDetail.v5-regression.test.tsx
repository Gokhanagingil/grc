/**
 * Regression tests for ItsmIncidentDetail — v5 Stabilization Pack
 *
 * Issue: Incident edit/save returns "Validation failed"
 * Root cause: Backend returns `status` field, frontend interface uses `state`.
 * When fetchIncident sets incident data, `incident.state` is undefined.
 * handleSave sends `status: incident.state || undefined` which strips the field.
 * Fix: Map `status` → `state` during fetchIncident so handleSave sends correct value.
 *
 * @regression
 * @incident-edit
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockShowNotification = jest.fn();
const mockIncidentsGet = jest.fn();
const mockIncidentsUpdate = jest.fn();
const mockGetLinkedRisks = jest.fn();
const mockGetLinkedControls = jest.fn();
const mockRecordSlas = jest.fn();

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

jest.mock('../../../utils/apiErrorClassifier', () => ({
  classifyApiError: () => ({ kind: 'unknown', message: 'error' }),
}));

jest.mock('../../../utils/payloadNormalizer', () => ({
  normalizeUpdatePayload: (raw: Record<string, unknown>, fields: Set<string>) => {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      if (fields.has(key) && raw[key] !== undefined && raw[key] !== '') {
        result[key] = raw[key];
      }
    }
    return result;
  },
  INCIDENT_UPDATE_FIELDS: new Set([
    'shortDescription', 'description', 'status', 'state', 'impact', 'urgency',
    'category', 'subcategory', 'assignedTo', 'assignmentGroup',
    'serviceId', 'serviceOfferingId', 'contactType', 'notes',
    'closureCode', 'closureNotes', 'resolvedAt', 'resolvedBy',
    'riskReviewRequired', 'workNotes', 'additionalComments',
  ]),
  INCIDENT_EMPTY_STRING_FIELDS: new Set([
    'assignedTo', 'assignmentGroup', 'serviceId', 'serviceOfferingId',
    'resolvedBy', 'closureCode',
  ]),
}));

jest.mock('../../../services/grcClient', () => ({
  itsmApi: {
    incidents: {
      get: (id: string) => mockIncidentsGet(id),
      create: jest.fn().mockResolvedValue({ data: { data: { id: 'new-inc' } } }),
      update: (id: string, payload: unknown) => mockIncidentsUpdate(id, payload),
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

// Lazy import after mocks
let ItsmIncidentDetail: React.ComponentType;
beforeAll(async () => {
  const mod = await import('../ItsmIncidentDetail');
  ItsmIncidentDetail = (mod as Record<string, unknown>).ItsmIncidentDetail as React.ComponentType;
});

describe('ItsmIncidentDetail — v5 Regression: status→state mapping on fetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should map backend "status" field to frontend "state" field on fetch', async () => {
    mockUseParams.mockReturnValue({ id: 'inc-status-map' });
    // Backend returns `status: 'in_progress'`, NOT `state`
    mockIncidentsGet.mockResolvedValue({
      data: {
        data: {
          id: 'inc-status-map',
          number: 'INC-099',
          shortDescription: 'Status mapping test',
          status: 'in_progress',  // backend field name
          priority: 'p3',
          impact: 'medium',
          urgency: 'medium',
          category: 'software',
          riskReviewRequired: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    });
    mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
    mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });
    mockRecordSlas.mockResolvedValue({ data: { data: [] } });

    render(<ItsmIncidentDetail />);

    await waitFor(() => {
      expect(mockIncidentsGet).toHaveBeenCalledWith('inc-status-map');
    });

    // The status select should reflect 'in_progress' from the mapped state field
    await waitFor(() => {
      const statusSelect = screen.getByDisplayValue('in_progress');
      expect(statusSelect).toBeInTheDocument();
    });
  });

  it('should not crash when backend returns status without state', async () => {
    mockUseParams.mockReturnValue({ id: 'inc-no-state' });
    mockIncidentsGet.mockResolvedValue({
      data: {
        data: {
          id: 'inc-no-state',
          number: 'INC-100',
          shortDescription: 'No state field test',
          status: 'open',
          priority: 'p4',
          impact: 'low',
          urgency: 'low',
          category: 'hardware',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    });
    mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
    mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });
    mockRecordSlas.mockResolvedValue({ data: { data: [] } });

    expect(() => render(<ItsmIncidentDetail />)).not.toThrow();
    await waitFor(() => {
      expect(mockIncidentsGet).toHaveBeenCalledWith('inc-no-state');
    });
  });

  it('should fallback to "open" when neither status nor state is present', async () => {
    mockUseParams.mockReturnValue({ id: 'inc-no-both' });
    mockIncidentsGet.mockResolvedValue({
      data: {
        data: {
          id: 'inc-no-both',
          number: 'INC-101',
          shortDescription: 'No status or state',
          priority: 'p4',
          impact: 'low',
          urgency: 'low',
          category: 'hardware',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    });
    mockGetLinkedRisks.mockResolvedValue({ data: { data: [] } });
    mockGetLinkedControls.mockResolvedValue({ data: { data: [] } });
    mockRecordSlas.mockResolvedValue({ data: { data: [] } });

    render(<ItsmIncidentDetail />);

    await waitFor(() => {
      expect(mockIncidentsGet).toHaveBeenCalledWith('inc-no-both');
    });

    // Should default to 'open' per the mapping: state = status || state || 'open'
    await waitFor(() => {
      const statusSelect = screen.getByDisplayValue('open');
      expect(statusSelect).toBeInTheDocument();
    });
  });
});
