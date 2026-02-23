/**
 * Tests for EffectiveSchemaPanel component
 *
 * Covers:
 * - Loading state
 * - Success render with mixed local/inherited fields
 * - Empty schema
 * - API error fallback (detail page still works)
 * - Filter toggle (all / local / inherited)
 * - Resolution summary display
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EffectiveSchemaPanel } from '../EffectiveSchemaPanel';

const mockEffectiveSchema = jest.fn();

jest.mock('../../../services/grcClient', () => ({
  cmdbApi: {
    classes: {
      effectiveSchema: (classId: string) => mockEffectiveSchema(classId),
    },
  },
}));

const sampleSchema = {
  classId: 'cls-linux',
  className: 'linux_server',
  classLabel: 'Linux Server',
  ancestors: [
    { id: 'cls-ci', name: 'ci', label: 'Configuration Item', depth: 2 },
    { id: 'cls-server', name: 'server', label: 'Server', depth: 1 },
  ],
  effectiveFields: [
    {
      key: 'hostname',
      label: 'Hostname',
      dataType: 'string',
      required: true,
      inherited: true,
      sourceClassId: 'cls-ci',
      sourceClassName: 'ci',
      inheritanceDepth: 2,
    },
    {
      key: 'cpu_count',
      label: 'CPU Count',
      dataType: 'number',
      required: false,
      inherited: true,
      sourceClassId: 'cls-server',
      sourceClassName: 'server',
      inheritanceDepth: 1,
    },
    {
      key: 'kernel_version',
      label: 'Kernel Version',
      dataType: 'string',
      required: false,
      inherited: false,
      sourceClassId: 'cls-linux',
      sourceClassName: 'linux_server',
      inheritanceDepth: 0,
    },
  ],
  totalFieldCount: 3,
  inheritedFieldCount: 2,
  localFieldCount: 1,
};

describe('EffectiveSchemaPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockEffectiveSchema.mockReturnValue(new Promise(() => {})); // never resolves
    render(<EffectiveSchemaPanel classId="cls-linux" />);
    expect(screen.getByTestId('effective-schema-loading')).toBeInTheDocument();
  });

  it('renders effective fields after successful API call', async () => {
    mockEffectiveSchema.mockResolvedValue({ data: { data: sampleSchema } });
    render(<EffectiveSchemaPanel classId="cls-linux" />);

    await waitFor(() => {
      expect(screen.getByTestId('effective-schema-panel')).toBeInTheDocument();
    });

    // Resolution summary
    expect(screen.getByTestId('effective-schema-total')).toHaveTextContent('3 total');
    expect(screen.getByTestId('effective-schema-local-count')).toHaveTextContent('1 local');
    expect(screen.getByTestId('effective-schema-inherited-count')).toHaveTextContent('2 inherited');

    // Fields rendered
    expect(screen.getByTestId('effective-field-hostname')).toBeInTheDocument();
    expect(screen.getByTestId('effective-field-cpu_count')).toBeInTheDocument();
    expect(screen.getByTestId('effective-field-kernel_version')).toBeInTheDocument();

    // Badges
    expect(screen.getByTestId('field-inherited-badge-hostname')).toHaveTextContent('ci');
    expect(screen.getByTestId('field-local-badge-kernel_version')).toHaveTextContent('local');
  });

  it('renders empty state when no effective fields', async () => {
    mockEffectiveSchema.mockResolvedValue({
      data: {
        data: {
          ...sampleSchema,
          effectiveFields: [],
          totalFieldCount: 0,
          inheritedFieldCount: 0,
          localFieldCount: 0,
        },
      },
    });
    render(<EffectiveSchemaPanel classId="cls-empty" />);

    await waitFor(() => {
      expect(screen.getByTestId('effective-schema-empty')).toBeInTheDocument();
    });
  });

  it('shows warning on API error (non-crashing)', async () => {
    mockEffectiveSchema.mockRejectedValue(new Error('Network error'));
    render(<EffectiveSchemaPanel classId="cls-broken" />);

    await waitFor(() => {
      expect(screen.getByTestId('effective-schema-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/Failed to load effective schema/)).toBeInTheDocument();
  });

  it('filters to local-only fields', async () => {
    mockEffectiveSchema.mockResolvedValue({ data: { data: sampleSchema } });
    render(<EffectiveSchemaPanel classId="cls-linux" />);

    await waitFor(() => {
      expect(screen.getByTestId('effective-schema-panel')).toBeInTheDocument();
    });

    // Click "Local" toggle
    fireEvent.click(screen.getByText('Local'));

    // Only local field visible
    expect(screen.getByTestId('effective-field-kernel_version')).toBeInTheDocument();
    expect(screen.queryByTestId('effective-field-hostname')).not.toBeInTheDocument();
    expect(screen.queryByTestId('effective-field-cpu_count')).not.toBeInTheDocument();
  });

  it('filters to inherited-only fields', async () => {
    mockEffectiveSchema.mockResolvedValue({ data: { data: sampleSchema } });
    render(<EffectiveSchemaPanel classId="cls-linux" />);

    await waitFor(() => {
      expect(screen.getByTestId('effective-schema-panel')).toBeInTheDocument();
    });

    // Click "Inherited" toggle
    fireEvent.click(screen.getByText('Inherited'));

    expect(screen.getByTestId('effective-field-hostname')).toBeInTheDocument();
    expect(screen.getByTestId('effective-field-cpu_count')).toBeInTheDocument();
    expect(screen.queryByTestId('effective-field-kernel_version')).not.toBeInTheDocument();
  });

  it('renders ancestor chain', async () => {
    mockEffectiveSchema.mockResolvedValue({ data: { data: sampleSchema } });
    render(<EffectiveSchemaPanel classId="cls-linux" />);

    await waitFor(() => {
      expect(screen.getByTestId('effective-schema-panel')).toBeInTheDocument();
    });

    expect(screen.getByText('Configuration Item')).toBeInTheDocument();
    expect(screen.getByText('Server')).toBeInTheDocument();
    expect(screen.getByText('Linux Server')).toBeInTheDocument();
  });

  it('handles flat response shape (no envelope)', async () => {
    mockEffectiveSchema.mockResolvedValue({ data: sampleSchema });
    render(<EffectiveSchemaPanel classId="cls-linux" />);

    await waitFor(() => {
      expect(screen.getByTestId('effective-schema-panel')).toBeInTheDocument();
    });
    expect(screen.getByTestId('effective-field-hostname')).toBeInTheDocument();
  });
});
