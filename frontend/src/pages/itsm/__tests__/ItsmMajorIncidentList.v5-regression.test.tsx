/**
 * Regression tests for ItsmMajorIncidentList — v5 Stabilization Pack
 *
 * Issue: "Failed to load major incidents" on list page
 * Root cause: Frontend checked `'items' in envelope` at top level, but response
 * is wrapped by ResponseTransformInterceptor as `{ success: true, data: { items, total } }`.
 * The `items` key is inside `data`, not at the top level of the Axios response data.
 * Fix: Use unwrapPaginatedResponse helper which handles the LIST-CONTRACT envelope.
 *
 * @regression
 * @major-incident
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = jest.fn();
const mockShowNotification = jest.fn();
const mockMajorIncidentList = jest.fn();
const mockMajorIncidentCreate = jest.fn();

jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    __esModule: true,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    useLocation: () => ({ pathname: '/itsm/major-incidents', search: '', hash: '', state: null }),
    MemoryRouter: ({ children }: { children: React.ReactNode }) => R.createElement('div', null, children),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => R.createElement('a', { href: to }, children),
  };
});

jest.mock('../../../contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

jest.mock('../../../services/grcClient', () => ({
  itsmApi: {
    majorIncidents: {
      list: (...args: unknown[]) => mockMajorIncidentList(...args),
      create: (...args: unknown[]) => mockMajorIncidentCreate(...args),
    },
  },
  unwrapPaginatedResponse: (res: { data: unknown }) => {
    const data = res.data as Record<string, unknown>;
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      const inner = data.data as { items?: unknown[]; total?: number };
      return { items: inner?.items || [], total: inner?.total || 0, page: 1, pageSize: 20 };
    }
    if (data && typeof data === 'object' && 'items' in data) {
      const d = data as { items: unknown[]; total?: number };
      return { items: d.items, total: d.total || 0, page: 1, pageSize: 20 };
    }
    if (Array.isArray(data)) {
      return { items: data, total: data.length, page: 1, pageSize: data.length };
    }
    return { items: [], total: 0, page: 1, pageSize: 0 };
  },
}));

jest.mock('../../../utils/apiErrorClassifier', () => ({
  classifyApiError: (err: unknown) => ({
    kind: 'unknown',
    message: err instanceof Error ? err.message : 'Unknown error',
  }),
}));

jest.mock('../../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), defaults: { baseURL: '' } },
}));

// Lazy import after mocks
let ItsmMajorIncidentList: React.ComponentType;
beforeAll(async () => {
  const mod = await import('../ItsmMajorIncidentList');
  ItsmMajorIncidentList = (mod as Record<string, unknown>).default as React.ComponentType;
});

describe('ItsmMajorIncidentList — v5 Regression: envelope parsing fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crash with LIST-CONTRACT envelope', async () => {
    mockMajorIncidentList.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'mi-1',
              number: 'MI-001',
              title: 'Major outage',
              severity: 'SEV1',
              status: 'ACTIVE',
              createdAt: '2026-01-15T10:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      },
    });

    render(<ItsmMajorIncidentList />);

    await waitFor(() => {
      expect(screen.getByText('MI-001')).toBeInTheDocument();
    });
  });

  it('shows empty state when no major incidents', async () => {
    mockMajorIncidentList.mockResolvedValue({
      data: {
        success: true,
        data: { items: [], total: 0, page: 1, pageSize: 20 },
      },
    });

    render(<ItsmMajorIncidentList />);

    await waitFor(() => {
      expect(screen.getByText(/No major incidents found/i)).toBeInTheDocument();
    });
  });

  it('handles API error with classified message', async () => {
    mockMajorIncidentList.mockRejectedValue(new Error('Network timeout'));

    render(<ItsmMajorIncidentList />);

    await waitFor(() => {
      expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();
    });
  });

  it('handles null response data without crash', async () => {
    mockMajorIncidentList.mockResolvedValue({ data: null });

    expect(() => render(<ItsmMajorIncidentList />)).not.toThrow();
  });

  it('handles direct items format (legacy)', async () => {
    mockMajorIncidentList.mockResolvedValue({
      data: {
        items: [
          {
            id: 'mi-2',
            number: 'MI-002',
            title: 'Legacy format incident',
            severity: 'SEV2',
            status: 'RESOLVED',
            createdAt: '2026-01-20T08:00:00Z',
          },
        ],
        total: 1,
      },
    });

    render(<ItsmMajorIncidentList />);

    await waitFor(() => {
      expect(screen.getByText('MI-002')).toBeInTheDocument();
    });
  });
});
