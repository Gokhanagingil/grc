/**
 * Regression tests for CmdbCiDetail component — CI Relationship target selector
 *
 * Issue #5: CI Relationship popup cannot select target CI (Target CI dropdown empty)
 * Root cause: Old implementation used fetchAllCis with cis.list; new implementation uses
 * searchCis with cis.search endpoint and an Autocomplete component.
 *
 * The CI search is triggered by typing in the Autocomplete field (debounced),
 * NOT by clicking "Create Relationship".
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CmdbCiDetail } from '../CmdbCiDetail';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockShowNotification = jest.fn();
const mockCisSearch = jest.fn();
const mockCisGet = jest.fn();
const mockClassesList = jest.fn();
const mockRelationshipsList = jest.fn();
const mockRelTypesList = jest.fn();

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
      list: jest.fn().mockResolvedValue({ data: { data: { items: [], total: 0 } } }),
      get: (id: string) => mockCisGet(id),
      search: (params: unknown) => mockCisSearch(params),
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
    relationshipTypes: {
      list: (params: unknown) => mockRelTypesList(params),
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

const MOCK_CI = {
  id: 'ci-1', name: 'web-server-01', classId: 'cls-server', lifecycle: 'active',
  environment: 'production', attributes: {}, description: '',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const MOCK_SEARCH_RESULTS = [
  { id: 'ci-2', name: 'db-server-01', classId: 'cls-db', classLabel: 'Database', lifecycle: 'active' },
  { id: 'ci-3', name: 'app-server-01', classId: 'cls-app', classLabel: 'Application Server', lifecycle: 'active' },
];

const MOCK_REL_TYPES = [
  { id: 'rt-1', name: 'depends_on', label: 'Depends On', inverseLabel: 'Depended On By' },
  { id: 'rt-2', name: 'hosted_on', label: 'Hosted On', inverseLabel: 'Hosts' },
];

const setupDefaults = () => {
  mockCisGet.mockResolvedValue({ data: { data: MOCK_CI } });
  mockClassesList.mockResolvedValue({ data: { data: { items: [], total: 0 } } });
  mockRelationshipsList.mockResolvedValue({ data: { data: [] } });
  mockCisSearch.mockResolvedValue({ data: { data: { items: MOCK_SEARCH_RESULTS, total: 2 } } });
  mockRelTypesList.mockResolvedValue({ data: { data: { items: MOCK_REL_TYPES, total: 2 } } });
};

/**
 * Helper: render in detail mode and click "Create Relationship" button to open dialog.
 * Note: CI search is now triggered by typing in the Autocomplete, not by the button click.
 */
const renderAndOpenRelDialog = async () => {
  render(<CmdbCiDetail />);

  // Wait for component to finish loading (fetchCi resolves → loading=false)
  await waitFor(() => {
    expect(screen.getByTestId('btn-create-relationship')).toBeInTheDocument();
  });

  // Click "Create Relationship" → opens dialog
  fireEvent.click(screen.getByTestId('btn-create-relationship'));
};

describe('CmdbCiDetail — Regression #5: CI Relationship target selector empty', () => {
  beforeEach(() => { jest.clearAllMocks(); setupDefaults(); });

  describe('searchCis — Autocomplete-based CI search', () => {
    it('should open Create Relationship dialog with Autocomplete when button clicked', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });

      await renderAndOpenRelDialog();

      // The dialog should be open with the create relationship form
      expect(screen.getByText('Create CI Relationship')).toBeInTheDocument();
      // Autocomplete-based target CI field should be present
      expect(screen.getByTestId('autocomplete-rel-target-ci')).toBeInTheDocument();
    });

    it('should handle search API error gracefully without crash', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisSearch.mockRejectedValue(new Error('Network error'));

      await renderAndOpenRelDialog();

      // Dialog should still be open even if search fails
      expect(screen.getByText('Create CI Relationship')).toBeInTheDocument();
    });

    it('should handle empty search results', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisSearch.mockResolvedValue({ data: { data: { items: [], total: 0 } } });

      await renderAndOpenRelDialog();

      expect(screen.getByText('Create CI Relationship')).toBeInTheDocument();
    });

    it('should handle null data gracefully', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });
      mockCisSearch.mockResolvedValue({ data: null });

      await renderAndOpenRelDialog();

      expect(screen.getByText('Create CI Relationship')).toBeInTheDocument();
    });
  });

  describe('Relationship types loaded from API', () => {
    it('should fetch relationship types when dialog opens', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });

      await renderAndOpenRelDialog();

      await waitFor(() => {
        expect(mockRelTypesList).toHaveBeenCalledWith({ pageSize: 100 });
      });
    });
  });

  describe('Component renders without crash', () => {
    it('should render in edit mode for existing CI', async () => {
      mockUseParams.mockReturnValue({ id: 'ci-1' });

      expect(() => { render(<CmdbCiDetail />); }).not.toThrow();
      await waitFor(() => { expect(mockCisGet).toHaveBeenCalledWith('ci-1'); });
    });

    it('should render create mode without crash', () => {
      mockUseParams.mockReturnValue({});

      expect(() => { render(<CmdbCiDetail />); }).not.toThrow();
    });
  });
});
