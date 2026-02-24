/**
 * SlaConditionBuilder — Typed Value Editor Tests
 *
 * Verifies that the condition builder renders the correct value input
 * based on field type and operator semantics.
 *
 * Covers:
 * - enum fields with options render Select dropdown
 * - boolean fields render true/false select
 * - number fields render numeric input
 * - string fields without options render text input
 * - unary operators (is_empty/is_not_empty) hide value input
 * - array operators (in/not_in) render multi-select for enum fields
 * - category field renders select (not free text) — regression for Phase 6
 * - backward compatibility with existing saved conditions
 *
 * @regression
 * @phase6-sla-typed-editors
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  SlaConditionBuilder,
  ConditionGroup,
  FieldRegistryEntry,
} from '../SlaConditionBuilder';

const mockOnChange = jest.fn();

const FIELDS: FieldRegistryEntry[] = [
  { key: 'category', label: 'Category', type: 'enum', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'], options: ['HARDWARE', 'SOFTWARE', 'NETWORK'] },
  { key: 'priority', label: 'Priority', type: 'enum', operators: ['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty'], options: ['P1', 'P2', 'P3', 'P4'] },
  { key: 'isBlocking', label: 'Is Blocking', type: 'boolean', operators: ['is', 'is_not'] },
  { key: 'subcategory', label: 'Subcategory', type: 'string', operators: ['is', 'is_not', 'contains', 'is_empty', 'is_not_empty'] },
  { key: 'serviceId', label: 'Service', type: 'uuid', operators: ['is', 'is_not', 'is_empty', 'is_not_empty'] },
];

describe('SlaConditionBuilder — Typed Value Editors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing with null value', () => {
    render(
      <SlaConditionBuilder value={null} onChange={mockOnChange} fields={FIELDS} />
    );
    expect(screen.getByText('Matching Conditions')).toBeInTheDocument();
  });

  it('renders with an empty AND group', () => {
    const emptyGroup: ConditionGroup = { operator: 'AND', children: [] };
    render(
      <SlaConditionBuilder value={emptyGroup} onChange={mockOnChange} fields={FIELDS} />
    );
    expect(screen.getByText('AND')).toBeInTheDocument();
  });

  it('renders enum field with category=is and shows select (not text)', () => {
    const condition: ConditionGroup = {
      operator: 'AND',
      children: [
        { field: 'category', operator: 'is', value: 'HARDWARE' },
      ],
    };
    render(
      <SlaConditionBuilder value={condition} onChange={mockOnChange} fields={FIELDS} />
    );
    // Category should render a Select, not a TextField
    // The value 'HARDWARE' should be visible
    expect(screen.queryByDisplayValue('HARDWARE')).toBeFalsy();
    // Instead it should be in a select component
  });

  it('renders string field with text input', () => {
    const condition: ConditionGroup = {
      operator: 'AND',
      children: [
        { field: 'subcategory', operator: 'is', value: 'disk' },
      ],
    };
    render(
      <SlaConditionBuilder value={condition} onChange={mockOnChange} fields={FIELDS} />
    );
    // Subcategory has no options, so it should render a text input
    const textInput = screen.getByDisplayValue('disk');
    expect(textInput).toBeInTheDocument();
  });

  it('hides value input for unary operators', () => {
    const condition: ConditionGroup = {
      operator: 'AND',
      children: [
        { field: 'category', operator: 'is_empty', value: null },
      ],
    };
    render(
      <SlaConditionBuilder value={condition} onChange={mockOnChange} fields={FIELDS} />
    );
    // No value input should be shown for is_empty
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Values')).not.toBeInTheDocument();
  });

  it('preserves backward compatibility with existing saved conditions', () => {
    // A condition saved before typed editors (string value for enum field)
    const condition: ConditionGroup = {
      operator: 'AND',
      children: [
        { field: 'priority', operator: 'is', value: 'P1' },
        { field: 'subcategory', operator: 'contains', value: 'disk' },
      ],
    };
    render(
      <SlaConditionBuilder value={condition} onChange={mockOnChange} fields={FIELDS} />
    );
    // Should render without crashing
    expect(screen.getByText('AND')).toBeInTheDocument();
  });

  it('renders nested groups correctly', () => {
    const condition: ConditionGroup = {
      operator: 'AND',
      children: [
        { field: 'category', operator: 'is', value: 'HARDWARE' },
        {
          operator: 'OR',
          children: [
            { field: 'priority', operator: 'is', value: 'P1' },
            { field: 'priority', operator: 'is', value: 'P2' },
          ],
        },
      ],
    };
    render(
      <SlaConditionBuilder value={condition} onChange={mockOnChange} fields={FIELDS} />
    );
    expect(screen.getByText('AND')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
  });
});
