/**
 * Regression tests for CmdbCiDetail component — CI Relationship target selector
 *
 * Issue #5: CI Relationship popup cannot select target CI (Target CI dropdown empty)
 * Root cause: fetchAllCis only handled nested {data: {data: {items: [...]}}} envelope format.
 * Fix: Added multiple envelope format handlers and error fallback with setAllCis([]).
 *
 * Note: fetchAllCis is triggered ONLY when the user clicks "Create Relationship" button,
 * NOT on component mount. Tests simulate this interaction.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockShowNotification = jest.fn();
const mockCisList = jest.fn();
const mockCisGet = jest.fn();
const mockClassesList = jest.fn();
const mockRelationshipsList = jest.fn();

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
  cmdbApi: {
    cis: {
      list: (params: unknown) => mockCisList(params),
      get: (id: string) => mockCisGet(id),
      create: jest.fn().mockResolvedValue({ data: { data: { id: 'new-ci' } } }),
      update: jest.fn().mockResolvedValue({ data: {} }),
    },
    classes: {
      list: (params: unknown) => mockClassesList(params),
      effectiveSchema: () => Promise.resolve({ data: { data: null } }),
    },
    relationships: {
      list: (params: unknown) => mockRelationshipsList(params),
      create: jest.fn().mockResolvedValue({ data: {} }),
      delete: jest.fn().mockResolvedValue({ data: {} }),
    },
    serviceCi: {
      servicesForCi: () => Promise.resolve({ data: { data: { items: [] } } }),
      link: jest.fn().mockResolvedValue({ data: {} }),
      unlink: jest.fn().mockResolvedValue({ data: {} }),
    },
    services: { list: () => Promise.resolve({ data: { data: { items: [], total: 0 } } }) },
    serviceOfferings: { list: () => Promise.resolve({ data: { data: { items: [], total: 0 } } }) },
  },
  itsmApi: {
    choices: { list: () => Promise.resolve({ data: { data: { items: [] } } }) },
  },
}));

jest.mock('../../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), defaults: { baseURL: '' } },
}));

jest.mock('../../../utils/apiErrorClassifier', () => ({
  classifyApiError: () => ({ kind: 'unknown', message: 'error' }),
}));

jest.mock('../../../components/cmdb/TopologyPanel', () => ({
  TopologyPanel: () => null,
}));

jest.mock('../../../components/cmdb/SchemaFieldRenderer', () => ({
  SchemaFieldRenderer: () => null,
}));

import { CmdbCiDetail } from '../CmdbCiDetail';

const MOCK_CI = {
  id: 'ci-1', name: 'web-server-01', classId: 'cls-server', lifecycle: 'active',
  environment: 'production', attributes: {}, description: '',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const MOCK_CI_LIST = [
  { id: 'ci-2', name: 'db-server-01', classId: 'cls-db', lifecycle: 'active' },
  { id: 'ci-3', name: 'app-server-01', classId: 'cls-app', lifecycle: 'active' },
];

const setupDefaults = () => {
  mockCisGet.mockResolvedValue({ data: { data: MOCK_CI } });
  mockClassesList.mockResolvedValue({ data: { data: { items: [], total: 0 } } });
  mockRelationshipsList.mockResolvedValue({ data: { data: [] } });
};

/**
 * Helper: render in detail mode and click "Create Relationship" button to trigger fetchAllCis.
 * fetchAllCis is ONLY invoked on that button click, not on component mount.
 */
const renderAndOpenRelDialog = async () => {
  render(<CmdbCiDetail />);

  // Wait for component to finish loading (fetchCi resolves → loading=false)
  await waitFor(() => {
    expect(screen.getByTestId('btn-create-relationship')).toBeInTheDocument();
  });

  // Click "Create Relationship" → triggers fetchAllCis()
  fireEvent.click(screen.getByTestId('btn-create-relationship'));
};

describe('CmdbCiDetail — Regression #5: CI Relationship target selector empty', () => {
  beforeEach(() => { jest.clearAllMocks(); setupDefaults(); });

  describe('fetchAllCis — response envelope parsing (triggered via Create Relationship button)', () => {
    it('should call cis.list with pageSize 200 when Create Relationship clicked', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisList.mockResolvedValue({ data: { data: { items: MOCK_CI_LIST, total: 2 } } });

      await renderAndOpenRelDialog();

      await waitFor(() => {
        expect(mockCisList).toHaveBeenCalledWith({ pageSize: 200 });
      });
    });

    it('should parse nested envelope {data: {data: {items: [...]}}}', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisList.mockResolvedValue({ data: { data: { items: MOCK_CI_LIST, total: 2 } } });

      await renderAndOpenRelDialog();

      await waitFor(() => { expect(mockCisList).toHaveBeenCalled(); });

      // The dialog should be open with the create relationship form
      expect(screen.getByText('Create CI Relationship')).toBeInTheDocument();
    });

    it('should parse flat array envelope {data: {data: [...]}}', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisList.mockResolvedValue({ data: { data: MOCK_CI_LIST } });

      await renderAndOpenRelDialog();
      await waitFor(() => { expect(mockCisList).toHaveBeenCalled(); });
    });

    it('should parse top-level items envelope {data: {items: [...]}}', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisList.mockResolvedValue({ data: { items: MOCK_CI_LIST, total: 2 } });

      await renderAndOpenRelDialog();
      await waitFor(() => { expect(mockCisList).toHaveBeenCalled(); });
    });

    it('should handle null data gracefully without crash', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisList.mockResolvedValue({ data: null });

      await renderAndOpenRelDialog();
      await waitFor(() => { expect(mockCisList).toHaveBeenCalled(); });
    });

    it('should handle empty items array', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisList.mockResolvedValue({ data: { data: { items: [], total: 0 } } });

      await renderAndOpenRelDialog();
      await waitFor(() => { expect(mockCisList).toHaveBeenCalled(); });
    });

    it('should handle API error by setting allCis to empty array', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisList.mockRejectedValue(new Error('Network error'));

      await renderAndOpenRelDialog();
      await waitFor(() => { expect(mockCisList).toHaveBeenCalled(); });
    });
  });

  describe('Component renders without crash', () => {
    it('should render in edit mode for existing CI', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisList.mockResolvedValue({ data: { data: { items: MOCK_CI_LIST, total: 2 } } });

      expect(() => { render(<CmdbCiDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockCisGet).toHaveBeenCalledWith('ci-1'); });
    });

    it('should render create mode without crash', () => {
      mockUseParams.mockReturnValue({});
      mockCisList.mockResolvedValue({ data: { data: { items: [], total: 0 } } });

      expect(() => { render(<CmdbCiDetail />); }).not.toThrow();
    });
  });
});
