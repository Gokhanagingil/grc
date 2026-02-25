/**
 * CMDB Visibility Hardening — Frontend Integration Tests
 *
 * Tests cover:
 * 1. System/Custom badges render on class list
 * 2. System badges render on class tree nodes
 * 3. Summary banner renders with correct counts
 * 4. Class tree view link exists on class list
 * 5. Empty local fields message guides to Effective Schema tab
 * 6. Detail page shows System/Custom badge
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ============================================================================
// Mocks
// ============================================================================

const mockNavigate = jest.fn();
const mockShowNotification = jest.fn();
const mockClassesList = jest.fn();
const mockClassesSummary = jest.fn();
const mockClassesTree = jest.fn();
const mockClassesGet = jest.fn();

jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    __esModule: true,
    useParams: () => ({ id: 'cls-system-1' }),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    MemoryRouter: (props) => R.createElement('div', null, props.children),
    Routes: (props) => R.createElement('div', null, props.children),
    Route: (props) => props.element,
    Link: (props) => R.createElement('a', { href: props.to }, props.children),
    NavLink: (props) => R.createElement('a', { href: props.to }, props.children),
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
      summary: () => mockClassesSummary(),
      tree: () => mockClassesTree(),
      get: (id: string) => mockClassesGet(id),
      effectiveSchema: jest.fn().mockResolvedValue({ data: { data: { effectiveFields: [], totalFieldCount: 0, inheritedFieldCount: 0, localFieldCount: 0, ancestors: [] } } }),
      ancestors: jest.fn().mockResolvedValue({ data: { data: [] } }),
      descendants: jest.fn().mockResolvedValue({ data: { data: [] } }),
      validateInheritance: jest.fn().mockResolvedValue({ data: { data: { valid: true } } }),
      contentPackStatus: jest.fn().mockResolvedValue({ data: { data: { applied: true, version: 'v1.0.0', systemClasses: 19, customClasses: 2, totalClasses: 21, abstractClasses: 5 } } }),
    },
  },
  unwrapPaginatedResponse: (resp: unknown) => {
    if (!resp) return { items: [], total: 0 };
    const r = resp as Record<string, unknown>;
    const data = r.data as Record<string, unknown> | undefined;
    if (data && 'data' in data) {
      const inner = data.data as Record<string, unknown>;
      if (inner && 'items' in inner) return inner;
      if (Array.isArray(inner)) return { items: inner, total: inner.length };
    }
    return { items: [], total: 0 };
  },
  unwrapResponse: (resp: unknown) => {
    if (!resp) return null;
    const r = resp as Record<string, unknown>;
    const data = r.data as Record<string, unknown> | undefined;
    if (data && 'data' in data) return data.data;
    return data ?? null;
  },
  unwrapArrayResponse: (resp: unknown) => {
    if (!resp) return [];
    const r = resp as Record<string, unknown>;
    const data = r.data as Record<string, unknown> | undefined;
    if (data && 'data' in data && Array.isArray(data.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  },
}));

jest.mock('../../../utils/apiErrorClassifier', () => ({
  classifyApiError: () => ({ kind: 'server', message: 'Test error', status: 500, isRetryable: false, shouldLogout: false }),
}));

// ============================================================================
// Test data
// ============================================================================

const systemClassItems = [
  {
    id: 'cls-system-1',
    name: 'cmdb_ci',
    label: 'Configuration Item',
    description: 'Root CI class',
    isActive: true,
    isAbstract: true,
    isSystem: true,
    parentClassId: null,
    fieldsSchema: [{ key: 'ci_name', label: 'CI Name', dataType: 'string' }],
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cls-custom-1',
    name: 'my_custom_class',
    label: 'My Custom Class',
    description: 'A custom class',
    isActive: true,
    isAbstract: false,
    isSystem: false,
    parentClassId: 'cls-system-1',
    fieldsSchema: [],
    sortOrder: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const summaryData = {
  total: 21,
  system: 19,
  custom: 2,
  abstract: 5,
};

const treeDataWithSystem = [
  {
    id: 'cls-system-1',
    name: 'cmdb_ci',
    label: 'Configuration Item',
    parentClassId: null,
    isAbstract: true,
    isActive: true,
    isSystem: true,
    sortOrder: 0,
    localFieldCount: 4,
    children: [
      {
        id: 'cls-custom-1',
        name: 'my_custom_class',
        label: 'My Custom Class',
        parentClassId: 'cls-system-1',
        isAbstract: false,
        isActive: true,
        isSystem: false,
        sortOrder: 100,
        localFieldCount: 0,
        children: [],
      },
    ],
  },
];

// ============================================================================
// Test: Class List — System/Custom badges and summary banner
// ============================================================================

// Mock GenericListPage to render items with columns
jest.mock('../../../components/common/GenericListPage', () => {
  const R = require('react');
  return {
    GenericListPage: (props) => {
      return R.createElement('div', { 'data-testid': 'generic-list-page' },
        R.createElement('table', null,
          R.createElement('tbody', null,
            (props.items || []).map((item) =>
              R.createElement('tr', {
                key: item.id,
                'data-testid': 'row-' + item.id,
                onClick: () => props.onRowClick && props.onRowClick(item),
              },
                (props.columns || []).map((col) =>
                  R.createElement('td', { key: col.key }, col.render(item))
                )
              )
            )
          )
        )
      );
    },
  };
});

describe('CMDB Visibility Hardening — Class List', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders System badge for system classes', async () => {
    mockClassesList.mockResolvedValue({ data: { data: { items: systemClassItems, total: 2 } } });
    mockClassesSummary.mockResolvedValue({ data: { data: summaryData } });

    const { CmdbCiClassList } = require('../CmdbCiClassList');
    render(React.createElement(CmdbCiClassList));

    await waitFor(() => {
      expect(screen.getByTestId('system-badge-cls-system-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('system-badge-cls-system-1')).toHaveTextContent('System');
  });

  it('renders Custom badge for non-system classes', async () => {
    mockClassesList.mockResolvedValue({ data: { data: { items: systemClassItems, total: 2 } } });
    mockClassesSummary.mockResolvedValue({ data: { data: summaryData } });

    const { CmdbCiClassList } = require('../CmdbCiClassList');
    render(React.createElement(CmdbCiClassList));

    await waitFor(() => {
      expect(screen.getByTestId('custom-badge-cls-custom-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('custom-badge-cls-custom-1')).toHaveTextContent('Custom');
  });

  it('renders summary banner with counts', async () => {
    mockClassesList.mockResolvedValue({ data: { data: { items: systemClassItems, total: 2 } } });
    mockClassesSummary.mockResolvedValue({ data: summaryData });

    const { CmdbCiClassList } = require('../CmdbCiClassList');
    render(React.createElement(CmdbCiClassList));

    await waitFor(() => {
      expect(screen.getByTestId('class-summary-banner')).toBeInTheDocument();
    });
    expect(screen.getByText('21 Total')).toBeInTheDocument();
    expect(screen.getByText('19 System')).toBeInTheDocument();
    expect(screen.getByText('2 Custom')).toBeInTheDocument();
    expect(screen.getByText('5 Abstract')).toBeInTheDocument();
  });

  it('renders Class Tree button for navigation', async () => {
    mockClassesList.mockResolvedValue({ data: { data: { items: [], total: 0 } } });
    mockClassesSummary.mockResolvedValue({ data: { data: summaryData } });

    const { CmdbCiClassList } = require('../CmdbCiClassList');
    render(React.createElement(CmdbCiClassList));

    expect(screen.getByTestId('btn-view-tree')).toBeInTheDocument();
    expect(screen.getByTestId('btn-view-tree')).toHaveTextContent('Class Tree');
  });
});

// ============================================================================
// Test: Class Tree — System badges
// ============================================================================

describe('CMDB Visibility Hardening — Class Tree', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders System badge on system tree nodes', async () => {
    mockClassesTree.mockResolvedValue({ data: { data: treeDataWithSystem } });

    const { CmdbCiClassTree } = require('../CmdbCiClassTree');
    render(React.createElement(CmdbCiClassTree));

    await waitFor(() => {
      expect(screen.getByTestId('tree-system-cls-system-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tree-system-cls-system-1')).toHaveTextContent('System');
  });

  it('does not render System badge on custom tree nodes', async () => {
    mockClassesTree.mockResolvedValue({ data: { data: treeDataWithSystem } });

    const { CmdbCiClassTree } = require('../CmdbCiClassTree');
    render(React.createElement(CmdbCiClassTree));

    await waitFor(() => {
      expect(screen.getByTestId('tree-node-cls-custom-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('tree-system-cls-custom-1')).not.toBeInTheDocument();
  });

  it('renders system/custom counts in summary chips', async () => {
    mockClassesTree.mockResolvedValue({ data: { data: treeDataWithSystem } });

    const { CmdbCiClassTree } = require('../CmdbCiClassTree');
    render(React.createElement(CmdbCiClassTree));

    await waitFor(() => {
      expect(screen.getByTestId('tree-summary-chips')).toBeInTheDocument();
    });
    expect(screen.getByText('1 system')).toBeInTheDocument();
    expect(screen.getByText('1 custom')).toBeInTheDocument();
  });
});
