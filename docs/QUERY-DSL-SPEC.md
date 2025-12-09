# Query DSL Specification

## Overview

The Query DSL (Domain Specific Language) provides a powerful, ServiceNow-level filtering capability for the GRC platform. It enables complex queries with multiple conditions, logical operators, and nested groups, all translated to TypeORM query builder operations.

## DSL Structure

### Basic Query

```json
{
  "conditions": [
    { "field": "title", "op": "contains", "value": "risk" },
    { "field": "status", "op": "eq", "value": "open" }
  ],
  "logical": "AND"
}
```

### Nested Groups

```json
{
  "conditions": [
    { "field": "status", "op": "eq", "value": "open" },
    {
      "conditions": [
        { "field": "severity", "op": "eq", "value": "high" },
        { "field": "severity", "op": "eq", "value": "critical" }
      ],
      "logical": "OR"
    }
  ],
  "logical": "AND"
}
```

## Operators

### Comparison Operators

| Operator | Description | SQL Equivalent | Example |
|----------|-------------|----------------|---------|
| `eq` | Equals | `=` | `{ "field": "status", "op": "eq", "value": "open" }` |
| `neq` | Not equals | `!=` | `{ "field": "status", "op": "neq", "value": "closed" }` |
| `gt` | Greater than | `>` | `{ "field": "score", "op": "gt", "value": 50 }` |
| `gte` | Greater than or equal | `>=` | `{ "field": "score", "op": "gte", "value": 50 }` |
| `lt` | Less than | `<` | `{ "field": "score", "op": "lt", "value": 100 }` |
| `lte` | Less than or equal | `<=` | `{ "field": "score", "op": "lte", "value": 100 }` |

### String Operators

| Operator | Description | SQL Equivalent | Example |
|----------|-------------|----------------|---------|
| `contains` | Contains substring | `ILIKE '%value%'` | `{ "field": "title", "op": "contains", "value": "risk" }` |
| `starts_with` | Starts with | `ILIKE 'value%'` | `{ "field": "title", "op": "starts_with", "value": "Risk" }` |
| `ends_with` | Ends with | `ILIKE '%value'` | `{ "field": "title", "op": "ends_with", "value": "Report" }` |

### Collection Operators

| Operator | Description | SQL Equivalent | Example |
|----------|-------------|----------------|---------|
| `in` | In list | `IN (...)` | `{ "field": "status", "op": "in", "value": ["open", "pending"] }` |
| `not_in` | Not in list | `NOT IN (...)` | `{ "field": "status", "op": "not_in", "value": ["closed", "archived"] }` |

### Range Operators

| Operator | Description | SQL Equivalent | Example |
|----------|-------------|----------------|---------|
| `between` | Between two values | `BETWEEN x AND y` | `{ "field": "score", "op": "between", "value": [0, 100] }` |

### Null Operators

| Operator | Description | SQL Equivalent | Example |
|----------|-------------|----------------|---------|
| `is_null` | Is null | `IS NULL` | `{ "field": "assignee", "op": "is_null" }` |
| `is_not_null` | Is not null | `IS NOT NULL` | `{ "field": "assignee", "op": "is_not_null" }` |

## Logical Operators

| Operator | Description |
|----------|-------------|
| `AND` | All conditions must match |
| `OR` | Any condition must match |

## TypeScript Interfaces

```typescript
type QueryOperator = 
  | 'eq' | 'neq' 
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'starts_with' | 'ends_with'
  | 'in' | 'not_in'
  | 'between'
  | 'is_null' | 'is_not_null';

type LogicalOperator = 'AND' | 'OR';

interface QueryCondition {
  field: string;
  op: QueryOperator;
  value?: unknown;
}

interface QueryDSL {
  conditions: (QueryCondition | QueryDSL)[];
  logical: LogicalOperator;
}
```

## Service Implementation

### QueryDSLService

```typescript
@Injectable()
export class QueryDSLService {
  applyDSL<T>(
    qb: SelectQueryBuilder<T>,
    dsl: QueryDSL,
    alias: string
  ): void {
    const whereClause = this.buildWhereClause(dsl, alias);
    qb.andWhere(whereClause.sql, whereClause.params);
  }

  private buildWhereClause(
    dsl: QueryDSL,
    alias: string,
    paramIndex = { value: 0 }
  ): { sql: string; params: Record<string, unknown> } {
    const parts: string[] = [];
    const params: Record<string, unknown> = {};

    for (const condition of dsl.conditions) {
      if ('conditions' in condition) {
        // Nested group
        const nested = this.buildWhereClause(condition, alias, paramIndex);
        parts.push(`(${nested.sql})`);
        Object.assign(params, nested.params);
      } else {
        // Simple condition
        const result = this.buildCondition(condition, alias, paramIndex);
        parts.push(result.sql);
        Object.assign(params, result.params);
      }
    }

    return {
      sql: parts.join(` ${dsl.logical} `),
      params,
    };
  }
}
```

## API Integration

### Search Endpoint

```
POST /grc/search
Body: {
  entity: 'risk',
  dsl: {
    conditions: [
      { field: 'status', op: 'eq', value: 'open' },
      { field: 'severity', op: 'in', value: ['high', 'critical'] }
    ],
    logical: 'AND'
  },
  page: 1,
  pageSize: 20
}
```

### Combined with Text Search

```
POST /grc/search
Body: {
  entity: 'risk',
  query: 'security',
  dsl: {
    conditions: [
      { field: 'status', op: 'eq', value: 'open' }
    ],
    logical: 'AND'
  }
}
```

## Examples

### Find Open High-Severity Risks

```json
{
  "conditions": [
    { "field": "status", "op": "eq", "value": "open" },
    { "field": "severity", "op": "in", "value": ["high", "critical"] }
  ],
  "logical": "AND"
}
```

### Find Risks Created This Month

```json
{
  "conditions": [
    { "field": "createdAt", "op": "gte", "value": "2024-01-01" },
    { "field": "createdAt", "op": "lt", "value": "2024-02-01" }
  ],
  "logical": "AND"
}
```

### Find Unassigned or Overdue Risks

```json
{
  "conditions": [
    { "field": "assignee", "op": "is_null" },
    { "field": "dueDate", "op": "lt", "value": "2024-01-15" }
  ],
  "logical": "OR"
}
```

### Complex Nested Query

```json
{
  "conditions": [
    { "field": "status", "op": "neq", "value": "closed" },
    {
      "conditions": [
        {
          "conditions": [
            { "field": "severity", "op": "eq", "value": "critical" },
            { "field": "assignee", "op": "is_null" }
          ],
          "logical": "AND"
        },
        {
          "conditions": [
            { "field": "dueDate", "op": "lt", "value": "2024-01-15" },
            { "field": "status", "op": "eq", "value": "open" }
          ],
          "logical": "AND"
        }
      ],
      "logical": "OR"
    }
  ],
  "logical": "AND"
}
```

## Security Considerations

### Field Validation

The service validates that requested fields exist on the entity to prevent SQL injection:

```typescript
private validateField(field: string, allowedFields: string[]): boolean {
  return allowedFields.includes(field);
}
```

### Parameter Binding

All values are passed as parameterized queries, never concatenated directly:

```typescript
// Safe: parameterized
qb.andWhere(`${alias}.status = :status`, { status: value });

// Unsafe: string concatenation (NEVER DO THIS)
qb.andWhere(`${alias}.status = '${value}'`);
```

## Frontend Integration (Future)

The Query DSL is designed to support a visual query builder UI:

```
┌─────────────────────────────────────────────────────────────┐
│ Filter: [AND ▼]                                    [+ Add]  │
├─────────────────────────────────────────────────────────────┤
│ [status ▼] [equals ▼] [open ▼]                    [×]      │
│ [severity ▼] [is one of ▼] [high, critical]       [×]      │
│ ┌─ Group: [OR ▼]                                  [×]      │
│ │ [assignee ▼] [is empty ▼]                       [×]      │
│ │ [dueDate ▼] [before ▼] [2024-01-15]             [×]      │
│ └───────────────────────────────────────────────────────── │
└─────────────────────────────────────────────────────────────┘
```

## Future Enhancements

- Visual query builder UI
- Saved filters/views
- Filter templates
- Aggregation support (COUNT, SUM, AVG)
- Relation traversal (e.g., `risk.owner.department`)
- Full-text search integration
- Query optimization hints
- Query explain/analysis
