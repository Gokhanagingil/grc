/**
 * Advanced Filter Types
 *
 * Type definitions for the universal list filter system.
 * These types mirror the backend list-query types for consistency.
 */

export type FilterOperator =
  | 'is'
  | 'is_not'
  | 'is_empty'
  | 'is_not_empty'
  | 'contains'
  | 'not_contains'
  | 'after'
  | 'before'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte';

export type FieldType = 'string' | 'number' | 'date' | 'enum' | 'boolean' | 'uuid';

export interface FilterCondition {
  field: string;
  op: FilterOperator;
  value?: string | number | boolean;
}

export interface FilterAndGroup {
  and: FilterTree[];
}

export interface FilterOrGroup {
  or: FilterTree[];
}

export type FilterTree = FilterCondition | FilterAndGroup | FilterOrGroup;

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  enumValues?: string[];
  enumLabels?: Record<string, string>;
}

export interface FilterConfig {
  fields: FieldDefinition[];
  maxConditions?: number;
  maxDepth?: number;
}

export const OPERATORS_BY_TYPE: Record<FieldType, FilterOperator[]> = {
  string: ['is', 'is_not', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  number: ['is', 'is_not', 'gt', 'lt', 'gte', 'lte', 'is_empty', 'is_not_empty'],
  date: ['is', 'is_not', 'after', 'before', 'is_empty', 'is_not_empty'],
  enum: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  boolean: ['is', 'is_not'],
  uuid: ['is', 'is_not', 'is_empty', 'is_not_empty'],
};

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  is: 'is',
  is_not: 'is not',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  contains: 'contains',
  not_contains: 'does not contain',
  after: 'is after',
  before: 'is before',
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater than or equal',
  lte: 'less than or equal',
};

export const EMPTY_OPERATORS: FilterOperator[] = ['is_empty', 'is_not_empty'];

export function isEmptyOperator(op: FilterOperator): boolean {
  return EMPTY_OPERATORS.includes(op);
}

export function isFilterCondition(tree: unknown): tree is FilterCondition {
  return tree !== null && typeof tree === 'object' && 'field' in tree && 'op' in tree;
}

export function isFilterAndGroup(tree: unknown): tree is FilterAndGroup {
  return tree !== null && typeof tree === 'object' && 'and' in tree;
}

export function isFilterOrGroup(tree: unknown): tree is FilterOrGroup {
  return tree !== null && typeof tree === 'object' && 'or' in tree;
}

export function createEmptyCondition(fields: FieldDefinition[]): FilterCondition {
  const firstField = fields[0];
  const operators = OPERATORS_BY_TYPE[firstField?.type || 'string'];
  return {
    field: firstField?.name || '',
    op: operators[0] || 'is',
    value: '',
  };
}

export function serializeFilter(tree: FilterTree): string {
  return JSON.stringify(tree);
}

export function encodeFilter(tree: FilterTree): string {
  return encodeURIComponent(serializeFilter(tree));
}

export function countConditions(tree: FilterTree): number {
  if (isFilterCondition(tree)) {
    return 1;
  }
  if (isFilterAndGroup(tree)) {
    return tree.and.reduce((sum, child) => sum + countConditions(child), 0);
  }
  if (isFilterOrGroup(tree)) {
    return tree.or.reduce((sum, child) => sum + countConditions(child), 0);
  }
  return 0;
}
