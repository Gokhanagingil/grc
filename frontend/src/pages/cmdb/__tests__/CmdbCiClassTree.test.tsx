/**
 * Tests for CmdbCiClassTree component
 *
 * Covers:
 * - Render nested tree nodes
 * - Node click navigation
 * - Abstract/inactive badges
 * - Empty state
 * - Error state
 * - Loading state
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CmdbCiClassTree } from '../CmdbCiClassTree';

const mockNavigate = jest.fn();
const mockShowNotification = jest.fn();
const mockTree = jest.fn();

jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    __esModule: true,
    useParams: () => ({}),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    MemoryRouter: ({ children }: { children: React.ReactNode }) => R.createElement('div', null, children),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => R.createElement('a', { href: to }, children),
  };
});

jest.mock('../../../contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

const mockContentPackStatus = jest.fn();

jest.mock('../../../services/grcClient', () => ({
  cmdbApi: {
    classes: {
      tree: () => mockTree(),
      contentPackStatus: () => mockContentPackStatus(),
    },
  },
  unwrapArrayResponse: (resp: unknown) => {
    if (!resp) return [];
    const r = resp as Record<string, unknown>;
    const data = r.data as Record<string, unknown> | undefined;
    if (data && 'data' in data && Array.isArray(data.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  },
  unwrapResponse: (resp: unknown) => {
    if (!resp) return null;
    const r = resp as Record<string, unknown>;
    const data = r.data as Record<string, unknown> | undefined;
    if (data && 'data' in data) return data.data;
    return data ?? null;
  },
}));

jest.mock('../../../utils/apiErrorClassifier', () => ({
  classifyApiError: (err: unknown) => ({ kind: 'server', message: String(err), status: 500, isRetryable: false, shouldLogout: false }),
}));

const sampleTree = [
  {
    id: 'cls-ci',
    name: 'ci',
    label: 'Configuration Item',
    parentClassId: null,
    isAbstract: true,
    isActive: true,
    isSystem: true,
    sortOrder: 0,
    localFieldCount: 2,
    children: [
      {
        id: 'cls-server',
        name: 'server',
        label: 'Server',
        parentClassId: 'cls-ci',
        isAbstract: false,
        isActive: true,
        isSystem: true,
        sortOrder: 1,
        localFieldCount: 3,
        children: [
          {
            id: 'cls-linux',
            name: 'linux_server',
            label: 'Linux Server',
            parentClassId: 'cls-server',
            isAbstract: false,
            isActive: true,
            isSystem: false,
            sortOrder: 0,
            localFieldCount: 1,
            children: [],
          },
        ],
      },
      {
        id: 'cls-network',
        name: 'network_device',
        label: 'Network Device',
        parentClassId: 'cls-ci',
        isAbstract: false,
        isActive: false,
        isSystem: false,
        sortOrder: 2,
        localFieldCount: 0,
        children: [],
      },
    ],
  },
];

describe('CmdbCiClassTree', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentPackStatus.mockResolvedValue({ data: { data: { applied: true, version: 'v1.0.0', systemClasses: 10, customClasses: 2, totalClasses: 12, abstractClasses: 3 } } });
  });

  it('shows loading state initially', () => {
    mockTree.mockReturnValue(new Promise(() => {}));
    render(<CmdbCiClassTree />);
    expect(screen.getByTestId('tree-loading')).toBeInTheDocument();
  });

  it('renders tree nodes after successful fetch', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('tree-container')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tree-node-cls-ci')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-cls-server')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-cls-linux')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-cls-network')).toBeInTheDocument();
  });

  it('shows abstract badge on abstract nodes', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('tree-abstract-cls-ci')).toBeInTheDocument();
    });
  });

  it('navigates to class detail on node click', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('tree-node-cls-server')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tree-node-cls-server'));
    expect(mockNavigate).toHaveBeenCalledWith('/cmdb/classes/cls-server');
  });

  it('shows empty state when no classes exist', async () => {
    mockTree.mockResolvedValue({ data: { data: [] } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('tree-empty')).toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    mockContentPackStatus.mockResolvedValue({ data: {} });
    mockTree.mockRejectedValue(new Error('Network error'));
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('tree-error')).toBeInTheDocument();
    });
  });

  it('navigates back to class list when back button clicked', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-back-to-classes')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-back-to-classes'));
    expect(mockNavigate).toHaveBeenCalledWith('/cmdb/classes');
  });

  it('shows total node count summary', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByText('4 total classes')).toBeInTheDocument();
    });
    expect(screen.getByText('1 root class')).toBeInTheDocument();
  });

  it('renders content pack status card when applied', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('content-pack-status-card')).toBeInTheDocument();
    });
    expect(screen.getByText(/Applied/)).toBeInTheDocument();
  });

  it('renders quick filters bar', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('tree-filters-bar')).toBeInTheDocument();
    });
    expect(screen.getByTestId('filter-all')).toBeInTheDocument();
    expect(screen.getByTestId('filter-system')).toBeInTheDocument();
    expect(screen.getByTestId('filter-custom')).toBeInTheDocument();
    expect(screen.getByTestId('filter-abstract')).toBeInTheDocument();
  });

  it('renders diagnostics toggle button', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-toggle-diagnostics')).toBeInTheDocument();
    });
  });

  it('shows abstract count in summary chips', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByText('1 abstract')).toBeInTheDocument();
    });
  });
});
