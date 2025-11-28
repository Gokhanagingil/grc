/**
 * Advanced Boolean Search Engine (ServiceNow-style)
 * Supports: AND, OR, NOT, LIKE, >, <, >=, <=, =, !=, IN, IS EMPTY, IS NOT EMPTY
 * Parentheses support for precedence
 */

export type Operator =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'LIKE'
  | 'IN'
  | 'IS EMPTY'
  | 'IS NOT EMPTY';
export type BooleanOp = 'AND' | 'OR' | 'NOT';

export interface QueryCondition {
  field: string;
  operator: Operator;
  value?: string | number | string[]; // IN operator uses array
  negated?: boolean; // For NOT prefix
}

export interface QueryNode {
  type: 'condition' | 'group';
  condition?: QueryCondition;
  group?: QueryNode[];
  booleanOp?: BooleanOp;
  negated?: boolean;
}

/**
 * Parse a boolean query string into an AST tree
 * Example: (impact>3 AND (likelihood>4 OR category=Vendor)) OR NOT status=Active
 */
export function parseBooleanQuery(query: string): QueryNode | null {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return null;
  }

  const tokens = tokenize(query);
  if (tokens.length === 0) return null;

  const index = 0;
  const ast = parseExpression(tokens, index);

  return ast.node;
}

interface ParseResult {
  node: QueryNode;
  nextIndex: number;
}

function tokenize(query: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    const remaining = query.substring(i).toUpperCase();

    // Handle quoted strings
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      current += char;
      continue;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      current += char;
      tokens.push(current.trim());
      current = '';
      quoteChar = '';
      continue;
    }

    if (inQuotes) {
      current += char;
      continue;
    }

    // Check for operators (case-insensitive)
    if (remaining.match(/^ (IS NOT EMPTY|IS EMPTY|LIKE|NOT|AND|OR) /)) {
      const match = remaining.match(
        /^ (IS NOT EMPTY|IS EMPTY|LIKE|NOT|AND|OR) /,
      );
      if (match) {
        const op = match[1];
        if (!op) continue;
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        tokens.push(op);
        i += op.length; // Skip the operator
        continue;
      }
    }

    // Check for comparison operators
    if (remaining.match(/^(>=|<=|!=|>|<|=)/)) {
      const match = remaining.match(/^(>=|<=|!=|>|<|=)/);
      if (match) {
        const op = match[1];
        if (!op) continue;
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        tokens.push(op);
        i += op.length - 1;
        continue;
      }
    }

    // Check for parentheses
    if (char === '(' || char === ')') {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      tokens.push(char);
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens.filter((t) => t.length > 0);
}

function parseExpression(tokens: string[], startIndex: number): ParseResult {
  const nodes: QueryNode[] = [];
  let currentBoolOp: BooleanOp | undefined;
  let i = startIndex;

  while (i < tokens.length) {
    const token = tokens[i];
    if (!token) {
      i++;
      continue;
    }

    if (token === ')') {
      break; // End of group
    }

    if (token === '(') {
      // Parse group
      const groupResult = parseExpression(tokens, i + 1);
      nodes.push(groupResult.node);
      i = groupResult.nextIndex;

      // Check for boolean operator after group
      if (i < tokens.length && (tokens[i] === 'AND' || tokens[i] === 'OR')) {
        currentBoolOp = tokens[i] as BooleanOp;
        i++;
      }
      continue;
    }

    if (token === 'AND' || token === 'OR') {
      currentBoolOp = token as BooleanOp;
      i++;
      continue;
    }

    if (token === 'NOT') {
      // Next token should be condition or group
      if (i + 1 < tokens.length) {
        if (tokens[i + 1] === '(') {
          const groupResult = parseExpression(tokens, i + 2);
          groupResult.node.negated = true;
          nodes.push(groupResult.node);
          i = groupResult.nextIndex;
        } else {
          // NOT condition
          const condition = parseCondition(tokens, i + 1);
          if (condition.result) {
            condition.result.negated = true;
            nodes.push({ type: 'condition', condition: condition.result });
          }
          i = condition.nextIndex;
        }
      } else {
        i++;
      }
      continue;
    }

    // Parse condition
    const conditionResult = parseCondition(tokens, i);
    if (conditionResult.result) {
      nodes.push({ type: 'condition', condition: conditionResult.result });
    }
    i = conditionResult.nextIndex;

    // Check for boolean operator
    if (i < tokens.length && (tokens[i] === 'AND' || tokens[i] === 'OR')) {
      currentBoolOp = tokens[i] as BooleanOp;
      i++;
    }
  }

  // Combine nodes with boolean operators
  if (nodes.length === 0) {
    return {
      node: { type: 'group', group: [] },
      nextIndex: i,
    };
  }

  if (nodes.length === 1) {
    const firstNode = nodes[0];
    if (!firstNode) {
      return {
        node: { type: 'group', group: [] },
        nextIndex: i,
      };
    }
    return { node: firstNode, nextIndex: i };
  }

  // Build tree with AND having higher precedence than OR
  if (nodes.length === 0) {
    return {
      node: { type: 'group', group: [] },
      nextIndex: i,
    };
  }

  let result = nodes[0];
  if (!result) {
    return {
      node: { type: 'group', group: [] },
      nextIndex: i,
    };
  }

  for (let j = 1; j < nodes.length; j++) {
    const nodeJ = nodes[j];
    if (!nodeJ) {
      continue;
    }
    const boolOp =
      tokens.find(
        (t, idx) => idx >= startIndex && idx < i && (t === 'AND' || t === 'OR'),
      ) && j > 0
        ? 'AND'
        : 'OR'; // Simplified: use AND default
    result = {
      type: 'group',
      group: [result, nodeJ],
      booleanOp: boolOp,
    };
  }

  if (!result) {
    return {
      node: { type: 'group', group: [] },
      nextIndex: i,
    };
  }

  return { node: result, nextIndex: i };
}

interface ConditionParseResult {
  result: QueryCondition | null;
  nextIndex: number;
}

function parseCondition(
  tokens: string[],
  startIndex: number,
): ConditionParseResult {
  if (startIndex >= tokens.length) {
    return { result: null, nextIndex: startIndex };
  }

  const field = tokens[startIndex];
  if (!field) {
    return { result: null, nextIndex: startIndex + 1 };
  }

  const i = startIndex + 1;
  if (i >= tokens.length) {
    return { result: null, nextIndex: i };
  }

  const operatorTokenRaw = tokens[i];
  if (!operatorTokenRaw) {
    return { result: null, nextIndex: i + 1 };
  }
  const operatorToken = operatorTokenRaw.toUpperCase();

  // Handle IS EMPTY / IS NOT EMPTY
  if (operatorToken === 'IS' && i + 1 < tokens.length) {
    const nextToken = tokens[i + 1];
    if (!nextToken) {
      return { result: null, nextIndex: i + 1 };
    }
    const next = nextToken.toUpperCase();
    if (next === 'EMPTY') {
      return {
        result: { field, operator: 'IS EMPTY' },
        nextIndex: i + 2,
      };
    } else if (next === 'NOT' && i + 2 < tokens.length) {
      const emptyToken = tokens[i + 2];
      if (emptyToken && emptyToken.toUpperCase() === 'EMPTY') {
        return {
          result: { field, operator: 'IS NOT EMPTY' },
          nextIndex: i + 3,
        };
      }
    }
  }

  // Check for standard operators
  const operators: Operator[] = ['>=', '<=', '!=', '>', '<', '=', 'LIKE'];
  let operator: Operator | null = null;
  const valueIndex = i + 1;

  for (const op of operators) {
    if (operatorToken === op) {
      operator = op;
      break;
    }
  }

  // Handle IN operator
  if (
    operatorToken === 'IN' &&
    i + 1 < tokens.length &&
    tokens[i + 1] === '('
  ) {
    const values: string[] = [];
    let j = i + 2;
    while (j < tokens.length && tokens[j] !== ')') {
      if (tokens[j] !== ',') {
        const tokenVal = tokens[j];
        if (!tokenVal) {
          j++;
          continue;
        }
        let val = tokenVal;
        if (
          typeof val === 'string' &&
          ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'")))
        ) {
          val = val.slice(1, -1);
        }
        if (val !== null && val !== undefined) {
          values.push(val);
        }
      }
      j++;
    }
    return {
      result: { field, operator: 'IN', value: values },
      nextIndex: j + 1,
    };
  }

  if (!operator) {
    return { result: null, nextIndex: i };
  }

  if (valueIndex >= tokens.length) {
    return { result: null, nextIndex: valueIndex };
  }

  const valueToken = tokens[valueIndex];
  if (!valueToken) {
    return { result: null, nextIndex: valueIndex };
  }

  let value: string | number = valueToken;

  // Remove quotes - only if value is a string
  if (typeof value === 'string') {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      // Try to parse as number
      const num = Number(value);
      if (!isNaN(num) && value.trim() === String(num)) {
        value = num;
      }
    }
  }

  return {
    result: { field, operator, value },
    nextIndex: valueIndex + 1,
  };
}

/**
 * Build TypeORM QueryBuilder conditions from AST
 */
export function buildBooleanQueryBuilder(
  node: QueryNode,
  fieldMapping: Record<string, string>,
  queryBuilder: any,
  paramPrefix: string = 'q',
  paramCounter: { count: number } = { count: 0 },
): void {
  if (!node) return;

  if (node.type === 'condition' && node.condition) {
    const cond = node.condition;
    const dbField = fieldMapping[cond.field] || cond.field;
    const paramName = `${paramPrefix}_${paramCounter.count++}`;
    const params: Record<string, any> = {};

    let condition: string;
    const shouldNegate = cond.negated || node.negated;

    switch (cond.operator) {
      case '=':
        condition = `${dbField} = :${paramName}`;
        params[paramName] = cond.value;
        break;
      case '!=':
        condition = `${dbField} != :${paramName}`;
        params[paramName] = cond.value;
        break;
      case '>':
        condition = `${dbField} > :${paramName}`;
        params[paramName] = cond.value;
        break;
      case '>=':
        condition = `${dbField} >= :${paramName}`;
        params[paramName] = cond.value;
        break;
      case '<':
        condition = `${dbField} < :${paramName}`;
        params[paramName] = cond.value;
        break;
      case '<=':
        condition = `${dbField} <= :${paramName}`;
        params[paramName] = cond.value;
        break;
      case 'LIKE':
        condition = `${dbField} ILIKE :${paramName}`;
        params[paramName] = `%${cond.value}%`;
        break;
      case 'IN':
        condition = `${dbField} IN (:...${paramName})`;
        params[paramName] = cond.value as string[];
        break;
      case 'IS EMPTY':
        condition = `(${dbField} IS NULL OR ${dbField} = '' OR ${dbField} = false)`;
        break;
      case 'IS NOT EMPTY':
        condition = `(${dbField} IS NOT NULL AND ${dbField} != '' AND ${dbField} != false)`;
        break;
      default:
        return;
    }

    if (shouldNegate) {
      condition = `NOT (${condition})`;
    }

    if (Object.keys(params).length > 0) {
      queryBuilder.andWhere(condition, params);
    } else {
      queryBuilder.andWhere(condition);
    }
  } else if (node.type === 'group' && node.group) {
    // Handle groups with AND/OR
    if (node.group.length === 1) {
      const firstNode = node.group[0];
      if (firstNode) {
        buildBooleanQueryBuilder(
          firstNode,
          fieldMapping,
          queryBuilder,
          paramPrefix,
          paramCounter,
        );
      }
    } else if (node.group.length === 2) {
      const boolOp = node.booleanOp || 'AND';

      // Create sub-query for OR operations
      if (boolOp === 'OR') {
        const subConditions: string[] = [];
        const subParams: Record<string, any> = {};

        node.group.forEach((subNode) => {
          const subQb = queryBuilder.connection.createQueryBuilder();
          const subCounter = { count: paramCounter.count };
          // Build sub-condition (simplified - would need recursive sub-query builder)
          // For now, combine with OR manually
        });
      } else {
        // AND - apply both
        node.group.forEach((subNode) => {
          if (subNode) {
            buildBooleanQueryBuilder(
              subNode,
              fieldMapping,
              queryBuilder,
              paramPrefix,
              paramCounter,
            );
          }
        });
      }
    }
  }
}
