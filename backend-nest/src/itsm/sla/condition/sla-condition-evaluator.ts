/**
 * SLA Condition Tree Evaluator
 *
 * Evaluates a condition tree against a record context (key-value map).
 * Returns true if the record matches the condition tree.
 *
 * Supports:
 *  - AND / OR groups (nested)
 *  - Leaf operators: is, is_not, in, not_in, contains,
 *    is_empty, is_not_empty, gt, gte, lt, lte
 */
import {
  SlaConditionNode,
  SlaConditionGroup,
  SlaConditionLeaf,
  isConditionGroup,
} from '../sla-definition.entity';

export type RecordContext = Record<string, unknown>;

/**
 * Evaluate the full condition tree against a record context.
 * A null / undefined tree matches everything (no conditions).
 */
export function evaluateConditionTree(
  tree: SlaConditionNode | null | undefined,
  context: RecordContext,
): boolean {
  if (!tree) return true; // no conditions = matches everything

  return evaluateNode(tree, context);
}

function evaluateNode(
  node: SlaConditionNode,
  context: RecordContext,
): boolean {
  if (isConditionGroup(node)) {
    return evaluateGroup(node, context);
  }
  return evaluateLeaf(node as SlaConditionLeaf, context);
}

function evaluateGroup(
  group: SlaConditionGroup,
  context: RecordContext,
): boolean {
  const { operator, children } = group;

  if (!children || children.length === 0) {
    return true; // empty group matches everything
  }

  if (operator === 'AND') {
    return children.every((child) => evaluateNode(child, context));
  }

  // OR
  return children.some((child) => evaluateNode(child, context));
}

function evaluateLeaf(
  leaf: SlaConditionLeaf,
  context: RecordContext,
): boolean {
  const recordValue = context[leaf.field];
  const conditionValue = leaf.value;

  switch (leaf.operator) {
    case 'is':
      return isEqual(recordValue, conditionValue);

    case 'is_not':
      return !isEqual(recordValue, conditionValue);

    case 'in':
      if (!Array.isArray(conditionValue)) return false;
      return conditionValue.some((v) => isEqual(recordValue, v));

    case 'not_in':
      if (!Array.isArray(conditionValue)) return true;
      return !conditionValue.some((v) => isEqual(recordValue, v));

    case 'contains':
      if (typeof recordValue !== 'string') return false;
      return recordValue
        .toLowerCase()
        .includes(String(conditionValue).toLowerCase());

    case 'is_empty':
      return isEmpty(recordValue);

    case 'is_not_empty':
      return !isEmpty(recordValue);

    case 'gt':
      return compareNumeric(recordValue, conditionValue) > 0;

    case 'gte':
      return compareNumeric(recordValue, conditionValue) >= 0;

    case 'lt':
      return compareNumeric(recordValue, conditionValue) < 0;

    case 'lte':
      return compareNumeric(recordValue, conditionValue) <= 0;

    default:
      // Unknown operator - fail closed (don't match)
      return false;
  }
}

/** Case-insensitive equality for strings; strict for others. */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase() === b.toLowerCase();
  }
  // Coerce string <-> number comparison
  if (a !== null && a !== undefined && b !== null && b !== undefined) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  return false;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function compareNumeric(a: unknown, b: unknown): number {
  const numA = typeof a === 'number' ? a : Number(a);
  const numB = typeof b === 'number' ? b : Number(b);
  if (isNaN(numA) || isNaN(numB)) return NaN;
  return numA - numB;
}
