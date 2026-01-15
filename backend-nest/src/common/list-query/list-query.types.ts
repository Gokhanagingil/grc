/**
 * List Query Types
 *
 * Type definitions for the universal list query system with advanced filtering.
 * Supports quick search (q) and structured filter trees with AND/OR logic.
 */

/**
 * Supported filter operators
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

/**
 * Field types for operator compatibility validation
 */
export type FieldType =
  | 'string'
  | 'enum'
  | 'boolean'
  | 'date'
  | 'number'
  | 'uuid';

/**
 * Single filter condition
 */
export interface FilterCondition {
  field: string;
  op: FilterOperator;
  value?: unknown;
}

/**
 * Filter group with AND logic
 */
export interface FilterGroupAnd {
  and: Array<FilterCondition | FilterGroupAnd | FilterGroupOr>;
}

/**
 * Filter group with OR logic
 */
export interface FilterGroupOr {
  or: Array<FilterCondition | FilterGroupAnd | FilterGroupOr>;
}

/**
 * Root filter tree - can be a single condition or a group
 */
export type FilterTree = FilterCondition | FilterGroupAnd | FilterGroupOr;

/**
 * Field definition for allowlist configuration
 */
export interface FieldDefinition {
  /** Field name as used in filter conditions */
  name: string;
  /** Database column name (defaults to field name) */
  column?: string;
  /** Field type for operator validation */
  type: FieldType;
  /** Allowed enum values (required for enum type) */
  enumValues?: string[];
  /** Whether enum comparison is case-insensitive */
  caseInsensitive?: boolean;
  /** Table alias for joined fields */
  alias?: string;
}

/**
 * Allowlist configuration for an entity
 */
export interface EntityAllowlist {
  /** Entity name for error messages */
  entityName: string;
  /** Allowed fields for filtering */
  fields: FieldDefinition[];
  /** Allowed dot-walk paths (e.g., 'owner.email') */
  dotWalkPaths?: string[];
}

/**
 * Security limits for filter validation
 */
export interface FilterSecurityLimits {
  /** Maximum length of quick search string (default: 120) */
  maxSearchLength: number;
  /** Maximum length of filter JSON string (default: 4000) */
  maxFilterLength: number;
  /** Maximum nesting depth of filter tree (default: 5) */
  maxFilterDepth: number;
  /** Maximum total conditions in filter tree (default: 30) */
  maxConditions: number;
}

/**
 * Default security limits
 */
export const DEFAULT_SECURITY_LIMITS: FilterSecurityLimits = {
  maxSearchLength: 120,
  maxFilterLength: 4000,
  maxFilterDepth: 5,
  maxConditions: 30,
};

/**
 * Operators allowed for each field type
 */
export const OPERATORS_BY_TYPE: Record<FieldType, FilterOperator[]> = {
  string: [
    'is',
    'is_not',
    'is_empty',
    'is_not_empty',
    'contains',
    'not_contains',
  ],
  enum: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  boolean: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  date: [
    'is',
    'is_not',
    'is_empty',
    'is_not_empty',
    'after',
    'before',
    'gt',
    'lt',
    'gte',
    'lte',
  ],
  number: [
    'is',
    'is_not',
    'is_empty',
    'is_not_empty',
    'gt',
    'lt',
    'gte',
    'lte',
  ],
  uuid: ['is', 'is_not', 'is_empty', 'is_not_empty'],
};

/**
 * All valid operators
 */
export const ALL_OPERATORS: FilterOperator[] = [
  'is',
  'is_not',
  'is_empty',
  'is_not_empty',
  'contains',
  'not_contains',
  'after',
  'before',
  'gt',
  'lt',
  'gte',
  'lte',
];

/**
 * Type guards for filter tree nodes
 */
export function isFilterCondition(node: FilterTree): node is FilterCondition {
  return 'field' in node && 'op' in node;
}

export function isFilterGroupAnd(node: FilterTree): node is FilterGroupAnd {
  return 'and' in node && Array.isArray(node.and);
}

export function isFilterGroupOr(node: FilterTree): node is FilterGroupOr {
  return 'or' in node && Array.isArray(node.or);
}

/**
 * Parsed and validated filter result
 */
export interface ParsedFilter {
  tree: FilterTree;
  conditionCount: number;
  maxDepth: number;
}

/**
 * Validation error details
 */
export interface FilterValidationError {
  code: string;
  message: string;
  field?: string;
  operator?: string;
  path?: string;
}
