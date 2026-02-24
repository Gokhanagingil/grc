/**
 * ItsmChangeTemplateDetail — routing/render tests
 *
 * Verifies:
 * - Create mode renders correctly
 * - Edit mode fetches and displays template
 * - Save validation works
 * - Error states handled gracefully
 * - Tasks table renders for existing templates
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
const mockUseParams = jest.fn();
const mockShowNotification = jest.fn();
const mockGet = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    __esModule: true,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
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
      get: function() { return mockGet.apply(null, arguments); },
      create: function() { return mockCreate.apply(null, arguments); },
      update: function() { return mockUpdate.apply(null, arguments); },
      delete: jest.fn(),
    },
  },
}));

// Lazy-import the component after mocks are in place
let ItsmChangeTemplateDetail: React.ComponentType;
beforeAll(async () => {
  const mod = await import('../ItsmChangeTemplateDetail');
  ItsmChangeTemplateDetail = mod.ItsmChangeTemplateDetail;
});

const makeTemplate = (overrides?: Partial<Record<string, unknown>>) => ({
  id: 'tmpl-1',
  tenantId: 'test-tenant-id',
  name: 'Standard Change',
  code: 'STD-001',
  description: 'A standard change template',
  isActive: true,
  isGlobal: false,
  version: 2,
  tasks: [
    {
      id: 'task-1',
      taskKey: 'APPROVE',
      title: 'Get Approval',
      taskType: 'APPROVAL',
      defaultStatus: 'OPEN',
      defaultPriority: 'HIGH',
      sequenceOrder: 1,
      sortOrder: 1,
      isBlocking: true,
      stageLabel: 'Pre-Implementation',
    },
    {
      id: 'task-2',
      taskKey: 'IMPLEMENT',
      title: 'Implement Change',
      taskType: 'MANUAL',
      defaultStatus: 'OPEN',
      defaultPriority: 'MEDIUM',
      sequenceOrder: 2,
      sortOrder: 2,
      isBlocking: false,
      stageLabel: 'Implementation',
    },
  ],
  dependencies: [],
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-02-20T14:30:00Z',
  ...overrides,
});

describe('ItsmChangeTemplateDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- Create mode ----------

  describe('create mode', () => {
    beforeEach(() => {
      mockUseParams.mockReturnValue({});
    });

    it('renders create form with empty fields', () => {
      render(<ItsmChangeTemplateDetail />);

      expect(screen.getByText('New Change Template')).toBeInTheDocument();
      expect(screen.getByTestId('save-template-btn')).toBeInTheDocument();
      expect(screen.getByTestId('back-to-templates-btn')).toBeInTheDocument();
    });

    it('validates name is required on save', async () => {
      render(<ItsmChangeTemplateDetail />);

      fireEvent.click(screen.getByTestId('save-template-btn'));

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          'Template name is required',
          'error'
        );
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('validates code is required on save', async () => {
      render(<ItsmChangeTemplateDetail />);

      // Fill in name but not code
      const nameInput = screen.getByRole('textbox', { name: /template name/i });
      fireEvent.change(nameInput, { target: { value: 'Test Template' } });

      fireEvent.click(screen.getByTestId('save-template-btn'));

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          'Template code is required',
          'error'
        );
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('navigates back when "Back to Templates" clicked', () => {
      render(<ItsmChangeTemplateDetail />);

      fireEvent.click(screen.getByTestId('back-to-templates-btn'));

      expect(mockNavigate).toHaveBeenCalledWith('/itsm/change-templates');
    });
  });

  // ---------- Edit mode ----------

  describe('edit mode', () => {
    beforeEach(() => {
      mockUseParams.mockReturnValue({ id: 'tmpl-1' });
    });

    it('fetches and displays template data', async () => {
      mockGet.mockResolvedValue({
        data: { data: makeTemplate() },
      });

      render(<ItsmChangeTemplateDetail />);

      await waitFor(() => {
        expect(screen.getByText('Standard Change')).toBeInTheDocument();
      });

      expect(mockGet).toHaveBeenCalledWith('tmpl-1');
    });

    it('renders template tasks table', async () => {
      mockGet.mockResolvedValue({
        data: { data: makeTemplate() },
      });

      render(<ItsmChangeTemplateDetail />);

      await waitFor(() => {
        expect(screen.getByText('Template Tasks (2)')).toBeInTheDocument();
      });

      expect(screen.getByText('Get Approval')).toBeInTheDocument();
      expect(screen.getByText('Implement Change')).toBeInTheDocument();
    });

    it('shows empty tasks message when no tasks', async () => {
      mockGet.mockResolvedValue({
        data: { data: makeTemplate({ tasks: [] }) },
      });

      render(<ItsmChangeTemplateDetail />);

      await waitFor(() => {
        expect(screen.getByTestId('no-template-tasks')).toBeInTheDocument();
      });
    });

    it('handles fetch error gracefully', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      render(<ItsmChangeTemplateDetail />);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          'Failed to load change template',
          'error'
        );
      });
      expect(mockNavigate).toHaveBeenCalledWith('/itsm/change-templates');
    });

    it('handles 403 error on save', async () => {
      mockGet.mockResolvedValue({
        data: { data: makeTemplate() },
      });
      mockUpdate.mockRejectedValue({ response: { status: 403 } });

      render(<ItsmChangeTemplateDetail />);

      await waitFor(() => {
        expect(screen.getByText('Standard Change')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-template-btn'));

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.stringContaining('permission'),
          'error'
        );
      });
    });

    it('handles 409 conflict on save', async () => {
      mockGet.mockResolvedValue({
        data: { data: makeTemplate() },
      });
      mockUpdate.mockRejectedValue({ response: { status: 409 } });

      render(<ItsmChangeTemplateDetail />);

      await waitFor(() => {
        expect(screen.getByText('Standard Change')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-template-btn'));

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.stringContaining('already exists'),
          'error'
        );
      });
    });

    it('shows version and timestamps for existing template', async () => {
      mockGet.mockResolvedValue({
        data: { data: makeTemplate() },
      });

      render(<ItsmChangeTemplateDetail />);

      await waitFor(() => {
        expect(screen.getByText(/Version: 2/)).toBeInTheDocument();
      });
    });
  });
});
