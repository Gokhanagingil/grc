/**
 * Tests for RelationshipSemanticsTab component
 *
 * Covers:
 * - Loading state
 * - Effective rules table renders with origin badges
 * - Empty state (no rules)
 * - API error handling
 * - Filter toggle (all / local / inherited)
 * - Add rule flow (modal opens)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RelationshipSemanticsTab } from '../RelationshipSemanticsTab';

const mockEffectiveForClass = jest.fn();
const mockUpdateRule = jest.fn();
const mockDeleteRule = jest.fn();
const mockCreateRule = jest.fn();
const mockListRelTypes = jest.fn();
const mockListClasses = jest.fn();

jest.mock('../../../utils/apiErrorClassifier', () => ({
  classifyApiError: () => ({ kind: 'server', message: 'Server error', status: 500, isRetryable: false, shouldLogout: false }),
}));

jest.mock('../../../services/grcClient', () => ({
  cmdbApi: {
    classRelationshipRules: {
      effectiveForClass: (classId: string) => mockEffectiveForClass(classId),
      update: (id: string, data: unknown) => mockUpdateRule(id, data),
      delete: (id: string) => mockDeleteRule(id),
      create: (data: unknown) => mockCreateRule(data),
    },
    relationshipTypes: {
      list: (params: unknown) => mockListRelTypes(params),
    },
    classes: {
      list: (params: unknown) => mockListClasses(params),
    },
  },
  unwrapResponse: (resp: unknown) => {
    if (!resp) return null;
    const r = resp as Record<string, unknown>;
    const data = r.data as Record<string, unknown> | undefined;
    if (data && typeof data === 'object' && 'data' in data) return (data as Record<string, unknown>).data;
    if (data && typeof data === 'object' && 'effectiveRules' in data) return data;
    return data ?? null;
  },
  ensureArray: (val: unknown) => (Array.isArray(val) ? val : []),
}));

const sampleEffectiveRules = {
  classId: 'cls-server',
  className: 'cmdb_ci_server',
  classLabel: 'Server',
  effectiveRules: [
    {
      ruleId: 'rule-1',
      sourceClassId: 'cls-ci',
      sourceClassName: 'cmdb_ci',
      sourceClassLabel: 'Configuration Item',
      relationshipTypeId: 'rt-depends',
      relationshipTypeName: 'depends_on',
      relationshipTypeLabel: 'Depends On',
      targetClassId: 'cls-app',
      targetClassName: 'cmdb_ci_app',
      targetClassLabel: 'Application',
      direction: 'OUTBOUND',
      propagationOverride: null,
      propagationWeight: null,
      defaultPropagation: 'forward',
      directionality: 'unidirectional',
      isActive: true,
      isSystem: false,
      originClassId: 'cls-ci',
      originClassName: 'cmdb_ci',
      originClassLabel: 'Configuration Item',
      inherited: true,
      inheritanceDepth: 2,
    },
    {
      ruleId: 'rule-2',
      sourceClassId: 'cls-server',
      sourceClassName: 'cmdb_ci_server',
      sourceClassLabel: 'Server',
      relationshipTypeId: 'rt-runs',
      relationshipTypeName: 'runs_on',
      relationshipTypeLabel: 'Runs On',
      targetClassId: 'cls-hw',
      targetClassName: 'cmdb_ci_hardware',
      targetClassLabel: 'Hardware',
      direction: 'OUTBOUND',
      propagationOverride: 'BOTH',
      propagationWeight: 'HIGH',
      defaultPropagation: 'reverse',
      directionality: 'unidirectional',
      isActive: true,
      isSystem: false,
      originClassId: 'cls-server',
      originClassName: 'cmdb_ci_server',
      originClassLabel: 'Server',
      inherited: false,
      inheritanceDepth: 0,
    },
  ],
  totalRuleCount: 2,
  inheritedRuleCount: 1,
  localRuleCount: 1,
};

describe('RelationshipSemanticsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockEffectiveForClass.mockReturnValue(new Promise(() => {})); // never resolves
    render(<RelationshipSemanticsTab classId="cls-server" />);
    expect(screen.getByTestId('rel-semantics-loading')).toBeInTheDocument();
  });

  it('renders effective rules table after successful API call', async () => {
    mockEffectiveForClass.mockResolvedValue({ data: { data: sampleEffectiveRules } });
    render(<RelationshipSemanticsTab classId="cls-server" />);

    await waitFor(() => {
      expect(screen.getByTestId('rel-semantics-panel')).toBeInTheDocument();
    });

    // Summary chips
    expect(screen.getByTestId('rel-rules-total')).toHaveTextContent('2 total');
    expect(screen.getByTestId('rel-rules-local-count')).toHaveTextContent('1 local');
    expect(screen.getByTestId('rel-rules-inherited-count')).toHaveTextContent('1 inherited');

    // Table rows
    expect(screen.getByTestId('rel-rule-row-rule-1')).toBeInTheDocument();
    expect(screen.getByTestId('rel-rule-row-rule-2')).toBeInTheDocument();

    // Relationship type labels
    expect(screen.getByText('Depends On')).toBeInTheDocument();
    expect(screen.getByText('Runs On')).toBeInTheDocument();

    // Target class labels
    expect(screen.getByText('Application')).toBeInTheDocument();
    expect(screen.getByText('Hardware')).toBeInTheDocument();
  });

  it('renders origin badges correctly (inherited vs local)', async () => {
    mockEffectiveForClass.mockResolvedValue({ data: { data: sampleEffectiveRules } });
    render(<RelationshipSemanticsTab classId="cls-server" />);

    await waitFor(() => {
      expect(screen.getByTestId('rel-semantics-panel')).toBeInTheDocument();
    });

    // Inherited rule shows origin class name
    const inheritedBadge = screen.getByTestId('origin-badge-rule-1');
    expect(inheritedBadge).toHaveTextContent('Configuration Item');

    // Local rule shows "local"
    const localBadge = screen.getByTestId('origin-badge-rule-2');
    expect(localBadge).toHaveTextContent('local');
  });

  it('renders empty state when no rules defined', async () => {
    mockEffectiveForClass.mockResolvedValue({
      data: {
        data: {
          ...sampleEffectiveRules,
          effectiveRules: [],
          totalRuleCount: 0,
          inheritedRuleCount: 0,
          localRuleCount: 0,
        },
      },
    });
    render(<RelationshipSemanticsTab classId="cls-empty" />);

    await waitFor(() => {
      expect(screen.getByTestId('rel-semantics-empty')).toBeInTheDocument();
    });
    expect(screen.getByText(/No relationship rules defined/)).toBeInTheDocument();
  });

  it('shows warning on API error', async () => {
    mockEffectiveForClass.mockRejectedValue(new Error('Network error'));
    render(<RelationshipSemanticsTab classId="cls-broken" />);

    await waitFor(() => {
      expect(screen.getByTestId('rel-semantics-error')).toBeInTheDocument();
    });
  });

  it('filters to local-only rules', async () => {
    mockEffectiveForClass.mockResolvedValue({ data: { data: sampleEffectiveRules } });
    render(<RelationshipSemanticsTab classId="cls-server" />);

    await waitFor(() => {
      expect(screen.getByTestId('rel-semantics-panel')).toBeInTheDocument();
    });

    // Click "Local" toggle
    fireEvent.click(screen.getByText('Local'));

    // Only local rule visible
    expect(screen.getByTestId('rel-rule-row-rule-2')).toBeInTheDocument();
    expect(screen.queryByTestId('rel-rule-row-rule-1')).not.toBeInTheDocument();
  });

  it('filters to inherited-only rules', async () => {
    mockEffectiveForClass.mockResolvedValue({ data: { data: sampleEffectiveRules } });
    render(<RelationshipSemanticsTab classId="cls-server" />);

    await waitFor(() => {
      expect(screen.getByTestId('rel-semantics-panel')).toBeInTheDocument();
    });

    // Click "Inherited" toggle
    fireEvent.click(screen.getByText('Inherited'));

    // Only inherited rule visible
    expect(screen.getByTestId('rel-rule-row-rule-1')).toBeInTheDocument();
    expect(screen.queryByTestId('rel-rule-row-rule-2')).not.toBeInTheDocument();
  });

  it('opens add rule modal when clicking Add Rule button', async () => {
    mockEffectiveForClass.mockResolvedValue({ data: { data: sampleEffectiveRules } });
    render(<RelationshipSemanticsTab classId="cls-server" />);

    await waitFor(() => {
      expect(screen.getByTestId('rel-semantics-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-add-rule'));

    await waitFor(() => {
      expect(screen.getByTestId('add-rule-modal')).toBeInTheDocument();
    });
  });

  it('handles flat response shape (no envelope)', async () => {
    mockEffectiveForClass.mockResolvedValue({ data: sampleEffectiveRules });
    render(<RelationshipSemanticsTab classId="cls-server" />);

    await waitFor(() => {
      expect(screen.getByTestId('rel-semantics-panel')).toBeInTheDocument();
    });
    expect(screen.getByTestId('rel-rule-row-rule-1')).toBeInTheDocument();
  });

  it('shows propagation override badge when present', async () => {
    mockEffectiveForClass.mockResolvedValue({ data: { data: sampleEffectiveRules } });
    render(<RelationshipSemanticsTab classId="cls-server" />);

    await waitFor(() => {
      expect(screen.getByTestId('rel-semantics-panel')).toBeInTheDocument();
    });

    // Rule 2 has propagation override BOTH
    const propagationChip = screen.getByTestId('propagation-rule-2');
    expect(propagationChip).toHaveTextContent('BOTH');

    // Should show (override) text
    expect(screen.getByText('(override)')).toBeInTheDocument();
  });
});
