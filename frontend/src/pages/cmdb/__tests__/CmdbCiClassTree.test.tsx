/**
 * Tests for CmdbCiClassTree component (Workbench v1)
 *
 * Covers:
 * - Render nested tree nodes
 * - Node click selects class (workbench inline panel)
 * - Abstract/inactive badges
 * - Empty state
 * - Error state
 * - Loading state
 * - Content pack banner with Apply CTA
 * - Workbench split layout
 * - No-selection guidance text
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CmdbCiClassTree } from '../CmdbCiClassTree';

const mockNavigate = jest.fn();
const mockShowNotification = jest.fn();
const mockTree = jest.fn();
const mockSetSearchParams = jest.fn();

jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    __esModule: true,
    useParams: () => ({}),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    MemoryRouter: ({ children }: { children: React.ReactNode }) => R.createElement('div', null, children),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => R.createElement('a', { href: to }, children),
  };
});

jest.mock('../../../contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

const mockContentPackStatus = jest.fn();
const mockApplyContentPack = jest.fn();
const mockDiagnosticsSummary = jest.fn();

jest.mock('../../../services/grcClient', () => ({
  cmdbApi: {
    classes: {
      tree: () => mockTree(),
      contentPackStatus: () => mockContentPackStatus(),
      applyContentPack: () => mockApplyContentPack(),
      diagnosticsSummary: () => mockDiagnosticsSummary(),
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

// Mock ClassWorkbenchDetailPanel to avoid deep rendering
jest.mock('../ClassWorkbenchDetailPanel', () => ({
  ClassWorkbenchDetailPanel: ({ classId, onClose }: { classId: string; onClose: () => void }) => {
    const R = require('react');
    return R.createElement('div', { 'data-testid': 'mock-detail-panel', 'data-class-id': classId },
      R.createElement('button', { 'data-testid': 'mock-close-btn', onClick: onClose }, 'Close'),
      'Detail Panel for ', classId
    );
  },
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

describe('CmdbCiClassTree (Workbench v1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentPackStatus.mockResolvedValue({ data: { data: { applied: true, version: 'v1.0.0', systemClasses: 10, customClasses: 2, totalClasses: 12, abstractClasses: 3 } } });
    mockDiagnosticsSummary.mockResolvedValue({ data: { data: { totalClasses: 12, classesWithErrors: 0, classesWithWarnings: 0, totalErrors: 0, totalWarnings: 0, totalInfos: 0, topIssues: [] } } });
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

  it('selects class on node click (workbench inline selection)', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('tree-node-cls-server')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tree-node-cls-server'));

    // Should show detail panel instead of navigating away
    await waitFor(() => {
      expect(screen.getByTestId('mock-detail-panel')).toBeInTheDocument();
    });
    expect(screen.getByTestId('mock-detail-panel')).toHaveAttribute('data-class-id', 'cls-server');

    // Should update URL search params
    expect(mockSetSearchParams).toHaveBeenCalledWith({ selected: 'cls-server' }, { replace: true });
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

  it('shows "no class selected" guidance when tree loaded without selection', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('workbench-no-selection')).toBeInTheDocument();
    });
    expect(screen.getByText(/Select a class from the tree/)).toBeInTheDocument();
  });

  it('shows Apply Baseline Content Pack button when not applied', async () => {
    mockContentPackStatus.mockResolvedValue({
      data: { data: { applied: false, version: null, systemClasses: 0, customClasses: 2, totalClasses: 2, abstractClasses: 0 } }
    });
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-apply-content-pack')).toBeInTheDocument();
    });
    expect(screen.getByText('Apply Baseline Content Pack')).toBeInTheDocument();
  });

  it('calls apply content pack API when Apply CTA clicked', async () => {
    mockContentPackStatus.mockResolvedValue({
      data: { data: { applied: false, version: null, systemClasses: 0, customClasses: 2, totalClasses: 2, abstractClasses: 0 } }
    });
    mockApplyContentPack.mockResolvedValue({
      data: { data: { version: 'v1.0.0', totalProcessed: 15, created: 10, updated: 3, reused: 2, skipped: 0, actions: [] } }
    });
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-apply-content-pack')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-apply-content-pack'));

    await waitFor(() => {
      expect(mockApplyContentPack).toHaveBeenCalledTimes(1);
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('Content pack applied'),
      'success'
    );
  });

  it('closes detail panel when close button clicked', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByTestId('tree-node-cls-server')).toBeInTheDocument();
    });

    // Select a class first
    fireEvent.click(screen.getByTestId('tree-node-cls-server'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-detail-panel')).toBeInTheDocument();
    });

    // Close the panel
    fireEvent.click(screen.getByTestId('mock-close-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('mock-detail-panel')).not.toBeInTheDocument();
    });

    // Should clear search params
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true });
  });

  it('renders workbench title', async () => {
    mockTree.mockResolvedValue({ data: { data: sampleTree } });
    render(<CmdbCiClassTree />);

    await waitFor(() => {
      expect(screen.getByText('CMDB Class Hierarchy Workbench')).toBeInTheDocument();
    });
  });
});
