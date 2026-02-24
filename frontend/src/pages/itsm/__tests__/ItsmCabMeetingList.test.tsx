/**
 * CAB Meeting List Page — Rendering & Resilience Tests
 *
 * Covers:
 * - Basic rendering with loading state
 * - Empty state when no meetings
 * - Renders meetings table
 * - Handles null/partial payload resilience
 * - Filter controls render
 *
 * @regression
 * @cab-meetings
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    __esModule: true,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    useLocation: () => ({ pathname: '/itsm/change-management/cab', search: '', hash: '', state: null }),
    MemoryRouter: ({ children }: { children: React.ReactNode }) => R.createElement('div', null, children),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => R.createElement('a', { href: to }, children),
  };
});

jest.mock('../../../contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: jest.fn() }),
}));

const mockCabList = jest.fn();
const mockCabCreate = jest.fn();
const mockCabDelete = jest.fn();

jest.mock('../../../services/grcClient', () => ({
  itsmApi: {
    cabMeetings: {
      list: (...args: unknown[]) => mockCabList(...args),
      create: (...args: unknown[]) => mockCabCreate(...args),
      delete: (...args: unknown[]) => mockCabDelete(...args),
    },
  },
}));

jest.mock('../../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), defaults: { baseURL: '' } },
}));

// Lazy import after mocks
let ItsmCabMeetingList: React.ComponentType;
beforeAll(async () => {
  const mod = await import('../ItsmCabMeetingList');
  ItsmCabMeetingList = (mod as Record<string, unknown>).default as React.ComponentType;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ItsmCabMeetingList — Rendering Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCabList.mockResolvedValue({
      data: { items: [], total: 0 },
    });
  });

  it('renders without crash', async () => {
    expect(() => render(<ItsmCabMeetingList />)).not.toThrow();
  });

  it('shows CAB Meetings title', async () => {
    render(<ItsmCabMeetingList />);
    await waitFor(() => {
      expect(screen.getByText(/CAB Meetings/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no meetings', async () => {
    mockCabList.mockResolvedValue({ data: { items: [], total: 0 } });
    render(<ItsmCabMeetingList />);
    await waitFor(() => {
      expect(screen.getByText(/No CAB meetings found/i)).toBeInTheDocument();
    });
  });

  it('renders meetings when data is returned', async () => {
    mockCabList.mockResolvedValue({
      data: {
        items: [
          {
            id: 'cab-1',
            code: 'CAB-00001',
            title: 'Weekly CAB Review',
            status: 'SCHEDULED',
            meetingAt: '2026-03-01T10:00:00Z',
            endAt: '2026-03-01T11:00:00Z',
            chairperson: null,
          },
        ],
        total: 1,
      },
    });

    render(<ItsmCabMeetingList />);
    await waitFor(() => {
      expect(screen.getByText('CAB-00001')).toBeInTheDocument();
      expect(screen.getByText('Weekly CAB Review')).toBeInTheDocument();
      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
    });
  });

  it('handles null response data without crash', async () => {
    mockCabList.mockResolvedValue({ data: null });
    expect(() => render(<ItsmCabMeetingList />)).not.toThrow();
  });

  it('handles API error without crash', async () => {
    mockCabList.mockRejectedValue(new Error('Network Error'));
    render(<ItsmCabMeetingList />);
    await waitFor(() => {
      expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
    });
  });

  it('renders New Meeting button', async () => {
    render(<ItsmCabMeetingList />);
    await waitFor(() => {
      expect(screen.getByText(/New Meeting/i)).toBeInTheDocument();
    });
  });

  it('handles response with direct array format', async () => {
    mockCabList.mockResolvedValue({
      data: [
        {
          id: 'cab-2',
          code: 'CAB-00002',
          title: 'Emergency CAB',
          status: 'DRAFT',
          meetingAt: '2026-03-05T14:00:00Z',
          endAt: null,
          chairperson: null,
        },
      ],
    });

    render(<ItsmCabMeetingList />);
    await waitFor(() => {
      expect(screen.getByText('CAB-00002')).toBeInTheDocument();
    });
  });
});
