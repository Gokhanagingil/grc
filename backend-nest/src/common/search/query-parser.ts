/**
 * KQL-light Query Parser
 * Supports: name contains test AND category = Vendor AND likelihood > 4
 *
 * Operators: =, !=, >, >=, <, <=, contains, startswith, endswith
 * Boolean: AND, OR (left-to-right precedence)
 */

export type Operator =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'contains'
  | 'startswith'
  | 'endswith';
export type BooleanOp = 'AND' | 'OR';

export interface QueryCondition {
  field: string;
  operator: Operator;
  value: string | number;
}

export interface QueryAST {
  conditions: QueryCondition[];
  booleanOps: BooleanOp[];
}

/**
 * Parse a KQL-light query string into AST
 */
export function parseQuery(query: string): QueryAST | null {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return null;
  }

  const trimmed = query.trim();
  const conditions: QueryCondition[] = [];
  const booleanOps: BooleanOp[] = [];

  // Tokenize: split by AND/OR while preserving them
  const tokens: string[] = [];
  let current = '';
  const upper = trimmed.toUpperCase();

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const remaining = upper.substring(i);

    if (remaining.startsWith(' AND ')) {
      if (current.trim()) {
        tokens.push(current.trim());
        tokens.push('AND');
        current = '';
      }
      i += 4; // Skip ' AND'
      continue;
    } else if (remaining.startsWith(' OR ')) {
      if (current.trim()) {
        tokens.push(current.trim());
        tokens.push('OR');
        current = '';
      }
      i += 3; // Skip ' OR'
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  // Parse each token as a condition
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) {
      continue;
    }

    if (token === 'AND' || token === 'OR') {
      booleanOps.push(token as BooleanOp);
      continue;
    }

    const condition = parseCondition(token);
    if (condition) {
      conditions.push(condition);
    }
  }

  return conditions.length > 0 ? { conditions, booleanOps } : null;
}

/**
 * Parse a single condition: field operator value
 */
function parseCondition(expr: string): QueryCondition | null {
  // Match: field operator "value" or field operator value
  const operators: Operator[] = [
    '!=',
    '>=',
    '<=',
    '=',
    '>',
    '<',
    'contains',
    'startswith',
    'endswith',
  ];

  for (const op of operators) {
    const index = expr.indexOf(` ${op} `);
    if (index === -1) continue;

    const field = expr.substring(0, index).trim();
    const valuePart = expr.substring(index + op.length + 2).trim();

    if (!field || !valuePart) continue;

    // Extract value (remove quotes if present)
    let value: string | number = valuePart;
    if (
      (valuePart.startsWith('"') && valuePart.endsWith('"')) ||
      (valuePart.startsWith("'") && valuePart.endsWith("'"))
    ) {
      value = valuePart.slice(1, -1);
    } else {
      // Try to parse as number
      const num = Number(valuePart);
      if (!isNaN(num) && valuePart.trim() === String(num)) {
        value = num;
      }
    }

    return { field, operator: op, value };
  }

  return null;
}

/**
 * Build TypeORM QueryBuilder conditions from AST
 * This is a simplified version - for complex queries, you'd need a more sophisticated builder
 */
export function buildQueryBuilderConditions(
  ast: QueryAST,
  fieldMapping: Record<string, string>, // Maps query field names to DB column names
  queryBuilder: any, // TypeORM SelectQueryBuilder
): void {
  if (!ast || ast.conditions.length === 0) {
    return;
  }

  // For simplicity, combine all conditions with AND/OR as specified
  // For production, you'd want proper precedence handling
  let combinedCondition = '';
  const params: Record<string, any> = {};

  ast.conditions.forEach((cond, idx) => {
    const dbField = fieldMapping[cond.field] || cond.field;
    const paramName = `param_${idx}`;
    params[paramName] = cond.value;

    let condition: string;

    switch (cond.operator) {
      case '=':
        condition = `${dbField} = :${paramName}`;
        break;
      case '!=':
        condition = `${dbField} != :${paramName}`;
        break;
      case '>':
        condition = `${dbField} > :${paramName}`;
        break;
      case '>=':
        condition = `${dbField} >= :${paramName}`;
        break;
      case '<':
        condition = `${dbField} < :${paramName}`;
        break;
      case '<=':
        condition = `${dbField} <= :${paramName}`;
        break;
      case 'contains':
        condition = `${dbField} ILIKE :${paramName}`;
        params[paramName] = `%${cond.value}%`;
        break;
      case 'startswith':
        condition = `${dbField} ILIKE :${paramName}`;
        params[paramName] = `${cond.value}%`;
        break;
      case 'endswith':
        condition = `${dbField} ILIKE :${paramName}`;
        params[paramName] = `%${cond.value}`;
        break;
      default:
        return; // Skip unknown operator
    }

    if (idx === 0) {
      combinedCondition = condition;
    } else {
      const boolOp = ast.booleanOps[idx - 1] || 'AND';
      combinedCondition = `(${combinedCondition}) ${boolOp} (${condition})`;
    }
  });

  if (combinedCondition) {
    queryBuilder.andWhere(combinedCondition, params);
  }
}
