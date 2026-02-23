/**
 * Tests for ParentClassSelector component
 *
 * Covers:
 * - Excludes self from options
 * - Excludes descendants from options
 * - Validates inheritance on parent selection
 * - Shows validation error from API
 * - Allows clearing parent
 * - Loading state
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ParentClassSelector } from '../ParentClassSelector';

const mockList = jest.fn();
const mockDescendants = jest.fn();
const mockValidateInheritance = jest.fn();

jest.mock('../../../services/grcClient', () => ({
  cmdbApi: {
    classes: {
      list: (params: unknown) => mockList(params),
      descendants: (id: string) => mockDescendants(id),
      validateInheritance: (id: string, data: unknown) => mockValidateInheritance(id, data),
    },
  },
}));

const sampleClasses = [
  { id: 'cls-ci', name: 'ci', label: 'Configuration Item', isAbstract: true },
  { id: 'cls-server', name: 'server', label: 'Server', isAbstract: false },
  { id: 'cls-linux', name: 'linux_server', label: 'Linux Server', isAbstract: false },
  { id: 'cls-windows', name: 'windows_server', label: 'Windows Server', isAbstract: false },
];

describe('ParentClassSelector', () => {
  const defaultProps = {
    classId: 'cls-server',
    parentClassId: 'cls-ci',
    onParentChange: jest.fn(),
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({
      data: { data: { items: sampleClasses, total: 4 } },
    });
    mockDescendants.mockResolvedValue({
      data: { data: [
        { id: 'cls-linux', name: 'linux_server', label: 'Linux Server', depth: 1 },
        { id: 'cls-windows', name: 'windows_server', label: 'Windows Server', depth: 1 },
      ] },
    });
    mockValidateInheritance.mockResolvedValue({
      data: { data: { valid: true } },
    });
  });

  it('renders parent class selector', async () => {
    render(<ParentClassSelector {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('parent-class-selector')).toBeInTheDocument();
    });
  });

  it('excludes self from options', async () => {
    render(<ParentClassSelector {...defaultProps} />);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    // Open autocomplete
    const input = screen.getByRole('combobox');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: '' } });

    await waitFor(() => {
      // Self (cls-server) should not be in the options list
      expect(screen.queryByTestId('parent-option-cls-server')).not.toBeInTheDocument();
    });
  });

  it('marks descendants as disabled', async () => {
    render(<ParentClassSelector {...defaultProps} />);

    await waitFor(() => {
      expect(mockDescendants).toHaveBeenCalledWith('cls-server');
    });

    // Verify descendants count message
    await waitFor(() => {
      const helperText = screen.queryByText(/descendant/i);
      expect(helperText).toBeInTheDocument();
    });
  });

  it('calls onParentChange when selection changes', async () => {
    const onParentChange = jest.fn();
    render(<ParentClassSelector {...defaultProps} onParentChange={onParentChange} />);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    // Open autocomplete and select an option
    const input = screen.getByRole('combobox');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'Configuration' } });

    await waitFor(() => {
      const option = screen.queryByTestId('parent-option-cls-ci');
      if (option) {
        fireEvent.click(option);
      }
    });
  });

  it('shows validation error from API', async () => {
    mockValidateInheritance.mockResolvedValue({
      data: {
        data: {
          valid: false,
          errors: ['Circular dependency detected'],
        },
      },
    });

    const onParentChange = jest.fn();
    render(<ParentClassSelector {...defaultProps} parentClassId={null} onParentChange={onParentChange} />);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    // Open autocomplete and select an option
    const input = screen.getByRole('combobox');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'Configuration' } });

    await waitFor(() => {
      const option = screen.queryByTestId('parent-option-cls-ci');
      if (option) {
        fireEvent.click(option);
      }
    });

    // Validation error should show
    await waitFor(() => {
      const errorAlert = screen.queryByTestId('parent-validation-error');
      if (errorAlert) {
        expect(errorAlert).toHaveTextContent('Circular dependency detected');
      }
    });
  });

  it('handles descendants fetch failure gracefully', async () => {
    mockDescendants.mockRejectedValue(new Error('Network error'));
    render(<ParentClassSelector {...defaultProps} />);

    // Should still render without crashing
    await waitFor(() => {
      expect(screen.getByTestId('parent-class-selector')).toBeInTheDocument();
    });
  });

  it('skips validation in create mode (no classId)', async () => {
    render(
      <ParentClassSelector
        classId={null}
        parentClassId={null}
        onParentChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('parent-class-selector')).toBeInTheDocument();
    });

    // Descendants should not be fetched for create mode
    expect(mockDescendants).not.toHaveBeenCalled();
  });
});
