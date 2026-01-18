/**
 * List Query Apply
 *
 * Applies parsed and validated filters to TypeORM QueryBuilder.
 * Generates safe parameterized SQL conditions.
 */

import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import {
  FilterTree,
  FilterCondition,
  EntityAllowlist,
  FieldDefinition,
  isFilterCondition,
  isFilterGroupAnd,
  isFilterGroupOr,
} from './list-query.types';
import { getFieldDefinition } from './list-query.validator';

/**
 * Parameter counter for unique parameter names
 */
let paramCounter = 0;

/**
 * Reset parameter counter (useful for testing)
 */
export function resetParamCounter(): void {
  paramCounter = 0;
}

/**
 * Generate unique parameter name
 */
function getParamName(prefix: string): string {
  return `${prefix}_${paramCounter++}`;
}

/**
 * Apply filter tree to QueryBuilder
 *
 * @param qb - TypeORM QueryBuilder
 * @param tree - Validated filter tree
 * @param allowlist - Entity allowlist for column resolution
 * @param alias - Entity alias in the query
 */
export function applyFilterTree<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  tree: FilterTree,
  allowlist: EntityAllowlist,
  alias: string,
): void {
  const { sql, params } = buildFilterSql(tree, allowlist, alias);
  if (sql) {
    qb.andWhere(sql, params);
  }
}

/**
 * Build SQL condition from filter tree
 */
function buildFilterSql(
  node: FilterTree,
  allowlist: EntityAllowlist,
  alias: string,
): { sql: string; params: Record<string, unknown> } {
  if (isFilterCondition(node)) {
    return buildConditionSql(node, allowlist, alias);
  }

  if (isFilterGroupAnd(node)) {
    const children = node.and.map((child) =>
      buildFilterSql(child, allowlist, alias),
    );
    const sql = children
      .filter((c) => c.sql)
      .map((c) => `(${c.sql})`)
      .join(' AND ');
    const params = children.reduce(
      (acc, c) => ({ ...acc, ...c.params }),
      {} as Record<string, unknown>,
    );
    return { sql, params };
  }

  if (isFilterGroupOr(node)) {
    const children = node.or.map((child) =>
      buildFilterSql(child, allowlist, alias),
    );
    const sql = children
      .filter((c) => c.sql)
      .map((c) => `(${c.sql})`)
      .join(' OR ');
    const params = children.reduce(
      (acc, c) => ({ ...acc, ...c.params }),
      {} as Record<string, unknown>,
    );
    return { sql, params };
  }

  return { sql: '', params: {} };
}

/**
 * Build SQL condition for a single filter condition
 */
function buildConditionSql(
  condition: FilterCondition,
  allowlist: EntityAllowlist,
  alias: string,
): { sql: string; params: Record<string, unknown> } {
  const { field, op, value } = condition;

  // Get field definition for column name resolution
  const fieldDef = getFieldDefinition(field, allowlist);
  const columnName = fieldDef?.column || field;
  const columnAlias = fieldDef?.alias || alias;
  const columnRef = `${columnAlias}.${columnName}`;

  // Handle operators
  switch (op) {
    case 'is':
      return buildEqualsSql(columnRef, value, fieldDef);

    case 'is_not':
      return buildNotEqualsSql(columnRef, value, fieldDef);

    case 'is_empty':
      return buildIsEmptySql(columnRef, fieldDef);

    case 'is_not_empty':
      return buildIsNotEmptySql(columnRef, fieldDef);

    case 'contains':
      return buildContainsSql(columnRef, value);

    case 'not_contains':
      return buildNotContainsSql(columnRef, value);

    case 'after':
    case 'gt':
      return buildGreaterThanSql(columnRef, value);

    case 'before':
    case 'lt':
      return buildLessThanSql(columnRef, value);

    case 'gte':
      return buildGreaterThanOrEqualSql(columnRef, value);

    case 'lte':
      return buildLessThanOrEqualSql(columnRef, value);

    default:
      return { sql: '', params: {} };
  }
}

/**
 * Build equals condition
 */
function buildEqualsSql(
  columnRef: string,
  value: unknown,
  fieldDef?: FieldDefinition,
): { sql: string; params: Record<string, unknown> } {
  const paramName = getParamName('eq');
  let normalizedValue = value;

  // Handle case-insensitive enum comparison
  if (
    fieldDef?.type === 'enum' &&
    fieldDef.caseInsensitive &&
    fieldDef.enumValues
  ) {
    const stringValue = String(value).toLowerCase();
    const matchedValue = fieldDef.enumValues.find(
      (ev) => ev.toLowerCase() === stringValue,
    );
    normalizedValue = matchedValue || value;
  }

  // Handle boolean conversion
  if (fieldDef?.type === 'boolean') {
    normalizedValue = value === 'true' || value === true;
  }

  return {
    sql: `${columnRef} = :${paramName}`,
    params: { [paramName]: normalizedValue },
  };
}

/**
 * Build not equals condition
 */
function buildNotEqualsSql(
  columnRef: string,
  value: unknown,
  fieldDef?: FieldDefinition,
): { sql: string; params: Record<string, unknown> } {
  const paramName = getParamName('neq');
  let normalizedValue = value;

  // Handle case-insensitive enum comparison
  if (
    fieldDef?.type === 'enum' &&
    fieldDef.caseInsensitive &&
    fieldDef.enumValues
  ) {
    const stringValue = String(value).toLowerCase();
    const matchedValue = fieldDef.enumValues.find(
      (ev) => ev.toLowerCase() === stringValue,
    );
    normalizedValue = matchedValue || value;
  }

  // Handle boolean conversion
  if (fieldDef?.type === 'boolean') {
    normalizedValue = value === 'true' || value === true;
  }

  return {
    sql: `${columnRef} != :${paramName}`,
    params: { [paramName]: normalizedValue },
  };
}

/**
 * Build is empty condition
 * For strings: IS NULL OR = ''
 * For other types: IS NULL
 */
function buildIsEmptySql(
  columnRef: string,
  fieldDef?: FieldDefinition,
): { sql: string; params: Record<string, unknown> } {
  if (fieldDef?.type === 'string') {
    return {
      sql: `(${columnRef} IS NULL OR ${columnRef} = '')`,
      params: {},
    };
  }

  return {
    sql: `${columnRef} IS NULL`,
    params: {},
  };
}

/**
 * Build is not empty condition
 * For strings: IS NOT NULL AND != ''
 * For other types: IS NOT NULL
 */
function buildIsNotEmptySql(
  columnRef: string,
  fieldDef?: FieldDefinition,
): { sql: string; params: Record<string, unknown> } {
  if (fieldDef?.type === 'string') {
    return {
      sql: `(${columnRef} IS NOT NULL AND ${columnRef} != '')`,
      params: {},
    };
  }

  return {
    sql: `${columnRef} IS NOT NULL`,
    params: {},
  };
}

/**
 * Build contains condition (ILIKE for case-insensitive)
 */
function buildContainsSql(
  columnRef: string,
  value: unknown,
): { sql: string; params: Record<string, unknown> } {
  const paramName = getParamName('contains');
  return {
    sql: `${columnRef} ILIKE :${paramName}`,
    params: { [paramName]: `%${String(value)}%` },
  };
}

/**
 * Build not contains condition
 */
function buildNotContainsSql(
  columnRef: string,
  value: unknown,
): { sql: string; params: Record<string, unknown> } {
  const paramName = getParamName('ncontains');
  return {
    sql: `(${columnRef} IS NULL OR ${columnRef} NOT ILIKE :${paramName})`,
    params: { [paramName]: `%${String(value)}%` },
  };
}

/**
 * Build greater than condition
 */
function buildGreaterThanSql(
  columnRef: string,
  value: unknown,
): { sql: string; params: Record<string, unknown> } {
  const paramName = getParamName('gt');
  return {
    sql: `${columnRef} > :${paramName}`,
    params: { [paramName]: value },
  };
}

/**
 * Build less than condition
 */
function buildLessThanSql(
  columnRef: string,
  value: unknown,
): { sql: string; params: Record<string, unknown> } {
  const paramName = getParamName('lt');
  return {
    sql: `${columnRef} < :${paramName}`,
    params: { [paramName]: value },
  };
}

/**
 * Build greater than or equal condition
 */
function buildGreaterThanOrEqualSql(
  columnRef: string,
  value: unknown,
): { sql: string; params: Record<string, unknown> } {
  const paramName = getParamName('gte');
  return {
    sql: `${columnRef} >= :${paramName}`,
    params: { [paramName]: value },
  };
}

/**
 * Build less than or equal condition
 */
function buildLessThanOrEqualSql(
  columnRef: string,
  value: unknown,
): { sql: string; params: Record<string, unknown> } {
  const paramName = getParamName('lte');
  return {
    sql: `${columnRef} <= :${paramName}`,
    params: { [paramName]: value },
  };
}

/**
 * Apply quick search to QueryBuilder
 *
 * @param qb - TypeORM QueryBuilder
 * @param search - Sanitized search string
 * @param searchableColumns - Columns to search in
 * @param alias - Entity alias
 */
export function applyQuickSearch<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  search: string,
  searchableColumns: Array<{ column: string; alias?: string }>,
  alias: string,
): void {
  if (!search || searchableColumns.length === 0) {
    return;
  }

  const conditions = searchableColumns.map((col, index) => {
    const columnRef = col.alias
      ? `${col.alias}.${col.column}`
      : `${alias}.${col.column}`;
    return `${columnRef} ILIKE :quickSearch${index}`;
  });

  const params: Record<string, string> = {};
  searchableColumns.forEach((_, index) => {
    params[`quickSearch${index}`] = `%${search}%`;
  });

  qb.andWhere(`(${conditions.join(' OR ')})`, params);
}
