/**
 * List Query Parser
 *
 * Parses and validates filter JSON strings with security constraints.
 * Enforces depth limits, condition counts, and structural validation.
 */

import { BadRequestException } from '@nestjs/common';
import {
  FilterTree,
  FilterCondition,
  FilterGroupAnd,
  FilterGroupOr,
  ParsedFilter,
  FilterSecurityLimits,
  DEFAULT_SECURITY_LIMITS,
  ALL_OPERATORS,
  isFilterCondition,
  isFilterGroupAnd,
  isFilterGroupOr,
  FilterOperator,
} from './list-query.types';

/**
 * Parse and validate a filter JSON string
 *
 * @param filterJson - URI-encoded JSON string representing the filter tree
 * @param limits - Security limits for validation
 * @returns Parsed and validated filter
 * @throws BadRequestException if validation fails
 */
export function parseFilterJson(
  filterJson: string,
  limits: FilterSecurityLimits = DEFAULT_SECURITY_LIMITS,
): ParsedFilter {
  // Check raw string length before parsing
  if (filterJson.length > limits.maxFilterLength) {
    throw new BadRequestException(
      `Filter exceeds maximum length of ${limits.maxFilterLength} characters`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(filterJson);
  } catch {
    throw new BadRequestException('Invalid filter JSON: malformed JSON syntax');
  }

  // Validate structure and count conditions
  const validationResult = validateFilterTree(parsed, limits, 1);

  return {
    tree: validationResult.tree,
    conditionCount: validationResult.conditionCount,
    maxDepth: validationResult.maxDepth,
  };
}

interface ValidationResult {
  tree: FilterTree;
  conditionCount: number;
  maxDepth: number;
}

/**
 * Normalize legacy filter format to canonical format
 *
 * Legacy format: {op: "and"|"or", children: [...]}
 * Canonical format: {and: [...]} or {or: [...]}
 *
 * This function recursively normalizes the entire tree.
 *
 * @param node - Filter node (possibly in legacy format)
 * @returns Normalized node in canonical format
 */
function normalizeLegacyNode(node: unknown): unknown {
  if (!node || typeof node !== 'object') {
    return node;
  }

  const nodeObj = node as Record<string, unknown>;

  // Check for legacy format: {op: "and"|"or", children: [...]}
  if (
    'op' in nodeObj &&
    'children' in nodeObj &&
    (nodeObj.op === 'and' || nodeObj.op === 'or') &&
    Array.isArray(nodeObj.children)
  ) {
    const groupType = nodeObj.op;
    const normalizedChildren = nodeObj.children.map((child) =>
      normalizeLegacyNode(child),
    );
    return { [groupType]: normalizedChildren };
  }

  // Check for canonical AND group - normalize children recursively
  if ('and' in nodeObj && Array.isArray(nodeObj.and)) {
    return {
      and: nodeObj.and.map((child) => normalizeLegacyNode(child)),
    };
  }

  // Check for canonical OR group - normalize children recursively
  if ('or' in nodeObj && Array.isArray(nodeObj.or)) {
    return {
      or: nodeObj.or.map((child) => normalizeLegacyNode(child)),
    };
  }

  // Condition nodes or other structures pass through unchanged
  return node;
}

/**
 * Recursively validate filter tree structure
 */
function validateFilterTree(
  node: unknown,
  limits: FilterSecurityLimits,
  currentDepth: number,
  path = 'root',
): ValidationResult {
  if (currentDepth > limits.maxFilterDepth) {
    throw new BadRequestException(
      `Filter exceeds maximum depth of ${limits.maxFilterDepth} at path: ${path}`,
    );
  }

  if (!node || typeof node !== 'object') {
    throw new BadRequestException(`Invalid filter node at path: ${path}`);
  }

  // Normalize legacy format to canonical format before validation
  const normalizedNode = normalizeLegacyNode(node);
  const nodeObj = normalizedNode as Record<string, unknown>;

  // Check if it's an AND group
  if ('and' in nodeObj) {
    return validateGroupNode(nodeObj, 'and', limits, currentDepth, path);
  }

  // Check if it's an OR group
  if ('or' in nodeObj) {
    return validateGroupNode(nodeObj, 'or', limits, currentDepth, path);
  }

  // Check if it's a condition
  if ('field' in nodeObj && 'op' in nodeObj) {
    return validateConditionNode(nodeObj, path);
  }

  throw new BadRequestException(
    `Invalid filter node at path: ${path}. Expected 'and', 'or', or condition with 'field' and 'op'`,
  );
}

/**
 * Validate a group node (AND or OR)
 */
function validateGroupNode(
  node: Record<string, unknown>,
  groupType: 'and' | 'or',
  limits: FilterSecurityLimits,
  currentDepth: number,
  path: string,
): ValidationResult {
  const children = node[groupType];

  if (!Array.isArray(children)) {
    throw new BadRequestException(
      `Invalid '${groupType}' group at path: ${path}. Expected an array`,
    );
  }

  if (children.length === 0) {
    throw new BadRequestException(
      `Empty '${groupType}' group at path: ${path}. Groups must have at least one condition`,
    );
  }

  let totalConditions = 0;
  let maxChildDepth = currentDepth;
  const validatedChildren: FilterTree[] = [];

  for (let i = 0; i < children.length; i++) {
    const childPath = `${path}.${groupType}[${i}]`;
    const childResult = validateFilterTree(
      children[i],
      limits,
      currentDepth + 1,
      childPath,
    );

    totalConditions += childResult.conditionCount;
    maxChildDepth = Math.max(maxChildDepth, childResult.maxDepth);
    validatedChildren.push(childResult.tree);

    // Check total conditions limit
    if (totalConditions > limits.maxConditions) {
      throw new BadRequestException(
        `Filter exceeds maximum of ${limits.maxConditions} conditions`,
      );
    }
  }

  const tree: FilterGroupAnd | FilterGroupOr =
    groupType === 'and'
      ? { and: validatedChildren }
      : { or: validatedChildren };

  return {
    tree,
    conditionCount: totalConditions,
    maxDepth: maxChildDepth,
  };
}

/**
 * Validate a condition node
 */
function validateConditionNode(
  node: Record<string, unknown>,
  path: string,
): ValidationResult {
  const { field, op, value } = node;

  // Validate field
  if (typeof field !== 'string' || field.trim() === '') {
    throw new BadRequestException(
      `Invalid 'field' at path: ${path}. Expected non-empty string`,
    );
  }

  // Validate field name format (alphanumeric, underscore, dot for relations)
  if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(field)) {
    throw new BadRequestException(
      `Invalid field name '${field}' at path: ${path}. Field names must start with a letter and contain only letters, numbers, underscores, or dots`,
    );
  }

  // Validate operator
  if (typeof op !== 'string') {
    throw new BadRequestException(
      `Invalid 'op' at path: ${path}. Expected string`,
    );
  }

  if (!ALL_OPERATORS.includes(op as FilterOperator)) {
    throw new BadRequestException(
      `Unknown operator '${op}' at path: ${path}. Allowed operators: ${ALL_OPERATORS.join(', ')}`,
    );
  }

  // Validate value based on operator
  const typedOp = op as FilterOperator;
  if (typedOp !== 'is_empty' && typedOp !== 'is_not_empty') {
    if (value === undefined) {
      throw new BadRequestException(
        `Missing 'value' for operator '${op}' at path: ${path}`,
      );
    }
  }

  const condition: FilterCondition = {
    field: field.trim(),
    op: typedOp,
    value,
  };

  return {
    tree: condition,
    conditionCount: 1,
    maxDepth: 1,
  };
}

/**
 * Validate quick search string
 *
 * @param search - Quick search string
 * @param maxLength - Maximum allowed length
 * @returns Sanitized search string or undefined
 * @throws BadRequestException if validation fails
 */
export function validateQuickSearch(
  search: string | undefined,
  maxLength: number = DEFAULT_SECURITY_LIMITS.maxSearchLength,
): string | undefined {
  if (!search) {
    return undefined;
  }

  const trimmed = search.trim();
  if (trimmed === '') {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw new BadRequestException(
      `Quick search exceeds maximum length of ${maxLength} characters`,
    );
  }

  // Sanitize: collapse multiple spaces
  return trimmed.replace(/\s+/g, ' ');
}

/**
 * Count total conditions in a filter tree
 */
export function countConditions(tree: FilterTree): number {
  if (isFilterCondition(tree)) {
    return 1;
  }

  if (isFilterGroupAnd(tree)) {
    return tree.and.reduce((sum, child) => sum + countConditions(child), 0);
  }

  if (isFilterGroupOr(tree)) {
    return tree.or.reduce((sum, child) => sum + countConditions(child), 0);
  }

  return 0;
}

/**
 * Calculate maximum depth of a filter tree
 */
export function calculateDepth(tree: FilterTree, currentDepth = 1): number {
  if (isFilterCondition(tree)) {
    return currentDepth;
  }

  if (isFilterGroupAnd(tree)) {
    return Math.max(
      currentDepth,
      ...tree.and.map((child) => calculateDepth(child, currentDepth + 1)),
    );
  }

  if (isFilterGroupOr(tree)) {
    return Math.max(
      currentDepth,
      ...tree.or.map((child) => calculateDepth(child, currentDepth + 1)),
    );
  }

  return currentDepth;
}
