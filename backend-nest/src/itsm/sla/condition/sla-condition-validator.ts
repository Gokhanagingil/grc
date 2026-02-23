/**
 * SLA Condition Tree Validator
 *
 * Validates a condition tree JSON structure before persistence.
 * Checks:
 *  - structural validity (group has operator + children array)
 *  - leaf has field + operator + value
 *  - field is registered in the field registry
 *  - operator is allowed for the field type
 *  - value type compatibility
 */
import {
  SlaConditionNode,
  SlaConditionGroup,
  SlaConditionLeaf,
  isConditionGroup,
} from '../sla-definition.entity';
import { slaFieldRegistry, ALL_OPERATORS } from './sla-field-registry';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate a full condition tree.
 * Returns { valid: true, errors: [] } on success.
 */
export function validateConditionTree(
  tree: unknown,
  recordType: string = 'INCIDENT',
): ValidationResult {
  const errors: ValidationError[] = [];

  if (tree === null || tree === undefined) {
    return { valid: true, errors: [] };
  }

  if (typeof tree !== 'object') {
    errors.push({ path: '$', message: 'Condition tree must be an object or null' });
    return { valid: false, errors };
  }

  validateNode(tree as SlaConditionNode, '$', recordType, errors);
  return { valid: errors.length === 0, errors };
}

function validateNode(
  node: SlaConditionNode,
  path: string,
  recordType: string,
  errors: ValidationError[],
): void {
  if (node === null || node === undefined) {
    errors.push({ path, message: 'Node cannot be null or undefined' });
    return;
  }

  if (typeof node !== 'object') {
    errors.push({ path, message: 'Node must be an object' });
    return;
  }

  if (isConditionGroup(node)) {
    validateGroup(node, path, recordType, errors);
  } else {
    validateLeaf(node as SlaConditionLeaf, path, recordType, errors);
  }
}

function validateGroup(
  group: SlaConditionGroup,
  path: string,
  recordType: string,
  errors: ValidationError[],
): void {
  const { operator, children } = group;

  if (operator !== 'AND' && operator !== 'OR') {
    errors.push({
      path: `${path}.operator`,
      message: `Group operator must be "AND" or "OR", got "${String(operator)}"`,
    });
  }

  if (!Array.isArray(children)) {
    errors.push({
      path: `${path}.children`,
      message: 'Group children must be an array',
    });
    return;
  }

  if (children.length === 0) {
    // Empty group is allowed (matches everything)
    return;
  }

  for (let i = 0; i < children.length; i++) {
    validateNode(children[i], `${path}.children[${i}]`, recordType, errors);
  }
}

function validateLeaf(
  leaf: SlaConditionLeaf,
  path: string,
  recordType: string,
  errors: ValidationError[],
): void {
  // Must have field
  if (!leaf.field || typeof leaf.field !== 'string') {
    errors.push({
      path: `${path}.field`,
      message: 'Leaf condition must have a string "field" property',
    });
    return;
  }

  // Must have operator
  if (!leaf.operator || typeof leaf.operator !== 'string') {
    errors.push({
      path: `${path}.operator`,
      message: 'Leaf condition must have a string "operator" property',
    });
    return;
  }

  // Check field is registered
  if (!slaFieldRegistry.hasField(leaf.field)) {
    errors.push({
      path: `${path}.field`,
      message: `Unknown condition field: "${leaf.field}"`,
    });
    return;
  }

  // Check field applies to the record type
  const meta = slaFieldRegistry.getField(leaf.field);
  if (meta && !meta.recordTypes.includes(recordType)) {
    errors.push({
      path: `${path}.field`,
      message: `Field "${leaf.field}" is not applicable to record type "${recordType}"`,
    });
  }

  // Check operator is globally known
  if (!(ALL_OPERATORS as readonly string[]).includes(leaf.operator)) {
    errors.push({
      path: `${path}.operator`,
      message: `Unknown operator: "${leaf.operator}"`,
    });
    return;
  }

  // Check operator is allowed for this field
  if (!slaFieldRegistry.isOperatorAllowed(leaf.field, leaf.operator)) {
    errors.push({
      path: `${path}.operator`,
      message: `Operator "${leaf.operator}" is not allowed for field "${leaf.field}"`,
    });
  }

  // Value validation based on operator
  const unaryOperators = ['is_empty', 'is_not_empty'];
  if (unaryOperators.includes(leaf.operator)) {
    // No value needed
    return;
  }

  if (leaf.value === undefined || leaf.value === null) {
    errors.push({
      path: `${path}.value`,
      message: `Value is required for operator "${leaf.operator}"`,
    });
    return;
  }

  // For 'in' / 'not_in', value must be an array
  if (
    (leaf.operator === 'in' || leaf.operator === 'not_in') &&
    !Array.isArray(leaf.value)
  ) {
    errors.push({
      path: `${path}.value`,
      message: `Value must be an array for operator "${leaf.operator}"`,
    });
  }

  // For numeric operators on numeric fields, value must be a number
  if (meta && meta.valueType === 'number') {
    const numericOps = ['gt', 'gte', 'lt', 'lte', 'is', 'is_not'];
    if (numericOps.includes(leaf.operator) && typeof leaf.value !== 'number') {
      errors.push({
        path: `${path}.value`,
        message: `Value must be a number for field "${leaf.field}" with operator "${leaf.operator}"`,
      });
    }
  }
}
