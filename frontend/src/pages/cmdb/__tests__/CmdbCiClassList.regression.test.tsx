/**
 * Regression tests for CmdbCiClassList component
 *
 * Issue #4: CI Classes row click routes to CI list instead of CI Class detail
 * Root cause: onRowClick navigated to `/cmdb/cis?classId=${row.id}` instead of `/cmdb/classes/${row.id}`.
 * Fix: Changed navigation target to `/cmdb/classes/${row.id}`.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = jest.fn();
const mockShowNotification = jest.fn();
const mockClassesList = jest.fn();

jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    __esModule: true,
    useParams: () => ({}),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    MemoryRouter: ({ children }: { children: React.ReactNode }) => R.createElement('div', null, children),
    Routes: ({ children }: { children: React.ReactNode }) => R.createElement('div', null, children),
    Route: ({ element }: { element: React.ReactNode }) => element,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => R.createElement('a', { href: to }, children),
    NavLink: ({ children, to }: { children: React.ReactNode; to: string }) => R.createElement('a', { href: to }, children),
  };
});

jest.mock('../../../contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

jest.mock('../../../services/grcClient', () => ({
  cmdbApi: {
    classes: {
      list: (params: unknown) => mockClassesList(params),
      create: jest.fn(),
    },
  },
}));

// Mock GenericListPage to expose onRowClick for testing
jest.mock('../../../components/common/GenericListPage', () => ({
  GenericListPage: (props: {
    onRowClick?: (row: { id: string }) => void;
    items: Array<{ id: string; name: string }>;
    [key: string]: unknown;
  }) => {
    return (
      <div data-testid="generic-list-page">
        {(props.items || []).map((item: { id: string; name: string }) => (
          <div
            key={item.id}
            data-testid={`row-${item.id}`}
            onClick={() => props.onRowClick && props.onRowClick(item)}
          >
            {item.name}
          </div>
        ))}
      </div>
    );
  },
}));

import { CmdbCiClassList } from '../CmdbCiClassList';

describe('CmdbCiClassList — Regression #4: Row click routes to wrong page', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('Row click navigation target', () => {
    it('should navigate to /cmdb/classes/:id when a class row is clicked', async () => {
      const items = [
        { id: 'cls-1', name: 'server', label: 'Server', description: '', isActive: true, isAbstract: false, parentClassId: null, fieldsSchema: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'cls-2', name: 'vm', label: 'VM', description: '', isActive: true, isAbstract: false, parentClassId: 'cls-1', fieldsSchema: [{ name: 'cpu', type: 'number' }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
      mockClassesList.mockResolvedValue({ data: { data: { items, total: 2 } } });

      render(<CmdbCiClassList />);

      await waitFor(() => { expect(screen.getByTestId('row-cls-1')).toBeInTheDocument(); });

      screen.getByTestId('row-cls-1').click();

      // CRITICAL: Must navigate to class detail, NOT CI list
      expect(mockNavigate).toHaveBeenCalledWith('/cmdb/classes/cls-1');
      expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/cmdb/cis'));
    });

    it('should NOT navigate to /cmdb/cis?classId= pattern (the old bug)', async () => {
      const items = [
        { id: 'cls-x', name: 'net', label: 'Network', description: '', isActive: true, isAbstract: false, parentClassId: null, fieldsSchema: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
      mockClassesList.mockResolvedValue({ data: { data: { items, total: 1 } } });

      render(<CmdbCiClassList />);

      await waitFor(() => { expect(screen.getByTestId('row-cls-x')).toBeInTheDocument(); });
      screen.getByTestId('row-cls-x').click();

      const allPaths = mockNavigate.mock.calls.map((c: unknown[]) => c[0]);
      allPaths.forEach((path: string) => {
        expect(path).not.toMatch(/\/cmdb\/cis\?classId=/);
        expect(path).toMatch(/\/cmdb\/classes\//);
      });
    });
  });

  describe('Component renders correctly', () => {
    it('should render the page title', async () => {
      mockClassesList.mockResolvedValue({ data: { data: { items: [], total: 0 } } });
      render(<CmdbCiClassList />);
      expect(screen.getByText('CI Classes')).toBeInTheDocument();
    });

    it('should handle API error gracefully', async () => {
      mockClassesList.mockRejectedValue(new Error('Network error'));
      expect(() => { render(<CmdbCiClassList />); }).not.toThrow();
      await waitFor(() => { expect(mockShowNotification).toHaveBeenCalledWith('Failed to load CI classes.', 'error'); });
    });
  });
});
