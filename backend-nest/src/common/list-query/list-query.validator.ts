/**
 * List Query Validator
 *
 * Validates filter conditions against entity allowlists.
 * Enforces field allowlists and operator-type compatibility.
 */

import { BadRequestException } from '@nestjs/common';
import {
  FilterTree,
  FilterCondition,
  EntityAllowlist,
  FieldDefinition,
  OPERATORS_BY_TYPE,
  isFilterCondition,
  isFilterGroupAnd,
  isFilterGroupOr,
  FilterOperator,
} from './list-query.types';

/**
 * Validate a filter tree against an entity allowlist
 *
 * @param tree - Parsed filter tree
 * @param allowlist - Entity allowlist configuration
 * @throws BadRequestException if validation fails
 */
export function validateFilterAgainstAllowlist(
  tree: FilterTree,
  allowlist: EntityAllowlist,
): void {
  validateNode(tree, allowlist, 'root');
}

/**
 * Recursively validate filter tree nodes
 */
function validateNode(
  node: FilterTree,
  allowlist: EntityAllowlist,
  path: string,
): void {
  if (isFilterCondition(node)) {
    validateCondition(node, allowlist, path);
    return;
  }

  if (isFilterGroupAnd(node)) {
    node.and.forEach((child, index) => {
      validateNode(child, allowlist, `${path}.and[${index}]`);
    });
    return;
  }

  if (isFilterGroupOr(node)) {
    node.or.forEach((child, index) => {
      validateNode(child, allowlist, `${path}.or[${index}]`);
    });
    return;
  }
}

/**
 * Validate a single condition against the allowlist
 */
function validateCondition(
  condition: FilterCondition,
  allowlist: EntityAllowlist,
  path: string,
): void {
  const { field, op, value } = condition;

  // Check if field contains a dot (potential dot-walk)
  if (field.includes('.')) {
    validateDotWalkField(field, allowlist, path);
    return;
  }

  // Find field definition in allowlist
  const fieldDef = allowlist.fields.find((f) => f.name === field);
  if (!fieldDef) {
    const allowedFields = allowlist.fields.map((f) => f.name).join(', ');
    throw new BadRequestException(
      `Unknown field '${field}' for ${allowlist.entityName}. Allowed fields: ${allowedFields}`,
    );
  }

  // Validate operator is compatible with field type
  validateOperatorCompatibility(fieldDef, op, path);

  // Validate value for enum fields
  if (fieldDef.type === 'enum' && op !== 'is_empty' && op !== 'is_not_empty') {
    validateEnumValue(fieldDef, value, path);
  }

  // Validate value type for other field types
  validateValueType(fieldDef, op, value, path);
}

/**
 * Validate dot-walk field paths
 */
function validateDotWalkField(
  field: string,
  allowlist: EntityAllowlist,
  path: string,
): void {
  if (!allowlist.dotWalkPaths || allowlist.dotWalkPaths.length === 0) {
    throw new BadRequestException(
      `Dot-walk paths are not allowed for ${allowlist.entityName}. Field '${field}' at path: ${path}`,
    );
  }

  if (!allowlist.dotWalkPaths.includes(field)) {
    const allowedPaths = allowlist.dotWalkPaths.join(', ');
    throw new BadRequestException(
      `Unknown dot-walk path '${field}' for ${allowlist.entityName}. Allowed paths: ${allowedPaths}`,
    );
  }
}

/**
 * Validate operator is compatible with field type
 */
function validateOperatorCompatibility(
  fieldDef: FieldDefinition,
  op: FilterOperator,
  path: string,
): void {
  const allowedOperators = OPERATORS_BY_TYPE[fieldDef.type];

  if (!allowedOperators.includes(op)) {
    throw new BadRequestException(
      `Operator '${op}' is not compatible with field type '${fieldDef.type}' for field '${fieldDef.name}' at path: ${path}. Allowed operators: ${allowedOperators.join(', ')}`,
    );
  }
}

/**
 * Validate enum value against allowed values
 */
function validateEnumValue(
  fieldDef: FieldDefinition,
  value: unknown,
  path: string,
): void {
  if (!fieldDef.enumValues || fieldDef.enumValues.length === 0) {
    return; // No enum validation if no values defined
  }

  const stringValue = String(value);
  const normalizedValue = fieldDef.caseInsensitive
    ? stringValue.toLowerCase()
    : stringValue;

  const isValid = fieldDef.enumValues.some((ev) => {
    const normalizedEnum = fieldDef.caseInsensitive ? ev.toLowerCase() : ev;
    return normalizedEnum === normalizedValue;
  });

  if (!isValid) {
    const allowedValues = fieldDef.enumValues.join(', ');
    throw new BadRequestException(
      `Invalid value '${stringValue}' for enum field '${fieldDef.name}' at path: ${path}. Allowed values: ${allowedValues}`,
    );
  }
}

/**
 * Validate value type matches field type
 */
function validateValueType(
  fieldDef: FieldDefinition,
  op: FilterOperator,
  value: unknown,
  path: string,
): void {
  // Skip validation for empty operators
  if (op === 'is_empty' || op === 'is_not_empty') {
    return;
  }

  switch (fieldDef.type) {
    case 'number':
      if (typeof value !== 'number' && isNaN(Number(value))) {
        throw new BadRequestException(
          `Invalid value for number field '${fieldDef.name}' at path: ${path}. Expected a number`,
        );
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        throw new BadRequestException(
          `Invalid value for boolean field '${fieldDef.name}' at path: ${path}. Expected true or false`,
        );
      }
      break;

    case 'date':
      if (!isValidDateValue(value)) {
        throw new BadRequestException(
          `Invalid value for date field '${fieldDef.name}' at path: ${path}. Expected ISO date string (YYYY-MM-DD)`,
        );
      }
      break;

    case 'uuid':
      if (!isValidUuid(value)) {
        throw new BadRequestException(
          `Invalid value for UUID field '${fieldDef.name}' at path: ${path}. Expected valid UUID`,
        );
      }
      break;

    case 'string':
      if (typeof value !== 'string') {
        throw new BadRequestException(
          `Invalid value for string field '${fieldDef.name}' at path: ${path}. Expected a string`,
        );
      }
      // Limit string value length for security
      if (value.length > 500) {
        throw new BadRequestException(
          `Value too long for string field '${fieldDef.name}' at path: ${path}. Maximum 500 characters`,
        );
      }
      break;
  }
}

/**
 * Check if value is a valid date string
 */
function isValidDateValue(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  // Accept ISO date format (YYYY-MM-DD) or full ISO datetime
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!dateRegex.test(value)) {
    return false;
  }

  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Check if value is a valid UUID
 */
function isValidUuid(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Get field definition from allowlist
 */
export function getFieldDefinition(
  fieldName: string,
  allowlist: EntityAllowlist,
): FieldDefinition | undefined {
  return allowlist.fields.find((f) => f.name === fieldName);
}

/**
 * Check if a field is in the allowlist
 */
export function isFieldAllowed(
  fieldName: string,
  allowlist: EntityAllowlist,
): boolean {
  if (fieldName.includes('.')) {
    return allowlist.dotWalkPaths?.includes(fieldName) ?? false;
  }
  return allowlist.fields.some((f) => f.name === fieldName);
}
