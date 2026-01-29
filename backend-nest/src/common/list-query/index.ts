/**
 * List Query Module
 *
 * Platform-level utilities for universal list search and advanced filtering.
 * Provides reusable components for implementing filtered list endpoints.
 *
 * Usage:
 * ```typescript
 * import {
 *   parseFilterJson,
 *   validateFilterAgainstAllowlist,
 *   applyFilterTree,
 *   applyQuickSearch,
 *   CONTROL_ALLOWLIST,
 *   CONTROL_SEARCHABLE_COLUMNS,
 * } from '../common/list-query';
 *
 * // In controller:
 * const filter = parseFilterJson(filterJson);
 * validateFilterAgainstAllowlist(filter.tree, CONTROL_ALLOWLIST);
 * applyFilterTree(queryBuilder, filter.tree, CONTROL_ALLOWLIST, 'control');
 * ```
 */

// Types
export {
  FilterOperator,
  FieldType,
  FilterCondition,
  FilterGroupAnd,
  FilterGroupOr,
  FilterTree,
  FieldDefinition,
  EntityAllowlist,
  FilterSecurityLimits,
  ParsedFilter,
  FilterValidationError,
  DEFAULT_SECURITY_LIMITS,
  OPERATORS_BY_TYPE,
  ALL_OPERATORS,
  isFilterCondition,
  isFilterGroupAnd,
  isFilterGroupOr,
} from './list-query.types';

// Parser
export {
  parseFilterJson,
  validateQuickSearch,
  countConditions,
  calculateDepth,
} from './list-query.parser';

// Validator
export {
  validateFilterAgainstAllowlist,
  getFieldDefinition,
  isFieldAllowed,
} from './list-query.validator';

// Apply
export {
  applyFilterTree,
  applyQuickSearch,
  resetParamCounter,
} from './list-query.apply';

// Allowlists
export {
  CONTROL_ALLOWLIST,
  CONTROL_SEARCHABLE_COLUMNS,
  ISSUE_ALLOWLIST,
  ISSUE_SEARCHABLE_COLUMNS,
  CAPA_ALLOWLIST,
  CAPA_SEARCHABLE_COLUMNS,
  EVIDENCE_ALLOWLIST,
  EVIDENCE_SEARCHABLE_COLUMNS,
  getEntityAllowlist,
  hasEntityAllowlist,
  getRegisteredEntities,
  createAllowlist,
} from './list-query.allowlist';
