/**
 * ItsmChangeTemplateList — routing/render tests
 *
 * Verifies:
 * - List page renders with templates
 * - Empty state renders correctly
 * - Error states handled gracefully
 * - Navigation to create/detail works
 *
 * @pr476
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks — must be before component import
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockShowNotification = jest.fn();
const mockList = jest.fn();
const mockDeleteFn = jest.fn();

jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    __esModule: true,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    useLocation: () => ({ pathname: '/itsm/change-templates', search: '', hash: '', state: null }),
    MemoryRouter: ({ children }: { children: React.ReactNode }) => R.createElement('div', null, children),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => R.createElement('a', { href: to }, children),
    NavLink: ({ children, to }: { children: React.ReactNode; to: string }) => R.createElement('a', { href: to }, children),
  };
});

jest.mock('../../../contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

jest.mock('../../../services/grcClient', () => ({
  itsmApi: {
    changeTemplates: {
      list: function() { return mockList.apply(null, arguments); },
      delete: function() { return mockDeleteFn.apply(null, arguments); },
    },
  },
}));

// Lazy-import the component after mocks are in place
let ItsmChangeTemplateList: React.ComponentType;
beforeAll(async () => {
  const mod = await import('../ItsmChangeTemplateList');
  ItsmChangeTemplateList = mod.ItsmChangeTemplateList;
});

const makeTemplate = (id: string, overrides?: Partial<Record<string, unknown>>) => ({
  id,
  tenantId: '00000000-0000-0000-0000-000000000001',
  name: `Template ${id}`,
  code: `TMPL-${id.toUpperCase()}`,
  description: `Description for template ${id}`,
  isActive: true,
  isGlobal: false,
  version: 1,
  tasks: [],
  dependencies: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('ItsmChangeTemplateList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({
      data: { data: { items: [], total: 0 } },
    });
  });

  it('renders empty state when no templates exist', async () => {
    render(<ItsmChangeTemplateList />);

    await waitFor(() => {
      expect(screen.getByText(/no change templates found/i)).toBeInTheDocument();
    });
  });

  it('renders the page title', async () => {
    render(<ItsmChangeTemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Change Templates')).toBeInTheDocument();
    });
  });

  it('renders "New Template" button', async () => {
    render(<ItsmChangeTemplateList />);

    expect(screen.getByTestId('create-template-btn')).toBeInTheDocument();
  });

  it('navigates to create page when "New Template" clicked', async () => {
    render(<ItsmChangeTemplateList />);

    fireEvent.click(screen.getByTestId('create-template-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('/itsm/change-templates/new');
  });

  it('renders templates when data exists', async () => {
    mockList.mockResolvedValue({
      data: {
        data: {
          items: [makeTemplate('t1'), makeTemplate('t2', { name: 'Standard Change' })],
          total: 2,
        },
      },
    });

    render(<ItsmChangeTemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Template t1')).toBeInTheDocument();
    });
    expect(screen.getByText('Standard Change')).toBeInTheDocument();
  });

  it('shows active/inactive status chips', async () => {
    mockList.mockResolvedValue({
      data: {
        data: {
          items: [
            makeTemplate('t1', { isActive: true }),
            makeTemplate('t2', { isActive: false }),
          ],
          total: 2,
        },
      },
    });

    render(<ItsmChangeTemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    mockList.mockRejectedValue({ response: { status: 500 } });

    render(<ItsmChangeTemplateList />);

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load'),
        'error'
      );
    });
  });

  it('handles 403 error with permission message', async () => {
    mockList.mockRejectedValue({ response: { status: 403 } });

    render(<ItsmChangeTemplateList />);

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining('permission'),
        'error'
      );
    });
  });

  it('handles flat array envelope', async () => {
    mockList.mockResolvedValue({
      data: [makeTemplate('flat-1')],
    });

    render(<ItsmChangeTemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Template flat-1')).toBeInTheDocument();
    });
  });

  it('handles { data: [...] } envelope', async () => {
    mockList.mockResolvedValue({
      data: { data: [makeTemplate('wrapped-1')] },
    });

    render(<ItsmChangeTemplateList />);

    await waitFor(() => {
      expect(screen.getByText('Template wrapped-1')).toBeInTheDocument();
    });
  });
});
