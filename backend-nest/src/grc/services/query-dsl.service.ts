import { Injectable, BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder, Brackets, ObjectLiteral } from 'typeorm';
import { QueryOperator, LogicalOperator } from '../enums';

/**
 * Query condition for DSL
 */
export interface QueryCondition {
  field: string;
  op: QueryOperator | string;
  value?: unknown;
  values?: unknown[];
}

/**
 * Query DSL input structure
 */
export interface QueryDSL {
  conditions: QueryCondition[];
  logical?: LogicalOperator;
  groups?: QueryDSLGroup[];
}

/**
 * Nested query group for complex conditions
 */
export interface QueryDSLGroup {
  conditions: QueryCondition[];
  logical: LogicalOperator;
}

/**
 * Query DSL Service
 *
 * Converts a JSON-based query DSL into TypeORM query builder conditions.
 * Supports various operators and logical grouping (AND/OR).
 */
@Injectable()
export class QueryDSLService {
  /**
   * Apply DSL conditions to a TypeORM query builder
   */
  applyDSL<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    dsl: QueryDSL,
    alias: string,
  ): SelectQueryBuilder<T> {
    const logical = dsl.logical || LogicalOperator.AND;

    if (dsl.conditions.length === 0 && (!dsl.groups || dsl.groups.length === 0)) {
      return queryBuilder;
    }

    if (logical === LogicalOperator.AND) {
      for (const condition of dsl.conditions) {
        this.applyCondition(queryBuilder, condition, alias, 'andWhere');
      }
    } else {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          let first = true;
          for (const condition of dsl.conditions) {
            if (first) {
              this.applyCondition(qb as SelectQueryBuilder<T>, condition, alias, 'where');
              first = false;
            } else {
              this.applyCondition(qb as SelectQueryBuilder<T>, condition, alias, 'orWhere');
            }
          }
        }),
      );
    }

    if (dsl.groups) {
      for (const group of dsl.groups) {
        this.applyGroup(queryBuilder, group, alias, logical);
      }
    }

    return queryBuilder;
  }

  /**
   * Apply a group of conditions
   */
  private applyGroup<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    group: QueryDSLGroup,
    alias: string,
    parentLogical: LogicalOperator,
  ): void {
    const method = parentLogical === LogicalOperator.AND ? 'andWhere' : 'orWhere';

    queryBuilder[method](
      new Brackets((qb) => {
        let first = true;
        for (const condition of group.conditions) {
          if (first) {
            this.applyCondition(qb as SelectQueryBuilder<T>, condition, alias, 'where');
            first = false;
          } else {
            const condMethod =
              group.logical === LogicalOperator.AND ? 'andWhere' : 'orWhere';
            this.applyCondition(qb as SelectQueryBuilder<T>, condition, alias, condMethod);
          }
        }
      }),
    );
  }

  /**
   * Apply a single condition to the query builder
   */
  private applyCondition<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    condition: QueryCondition,
    alias: string,
    method: 'where' | 'andWhere' | 'orWhere',
  ): void {
    const { field, op, value, values } = condition;
    const paramName = `${field}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const columnPath = `${alias}.${field}`;

    const operator = this.normalizeOperator(op);

    switch (operator) {
      case QueryOperator.EQUALS:
        queryBuilder[method](`${columnPath} = :${paramName}`, {
          [paramName]: value,
        });
        break;

      case QueryOperator.NOT_EQUALS:
        queryBuilder[method](`${columnPath} != :${paramName}`, {
          [paramName]: value,
        });
        break;

      case QueryOperator.CONTAINS:
        queryBuilder[method](`${columnPath} ILIKE :${paramName}`, {
          [paramName]: `%${value}%`,
        });
        break;

      case QueryOperator.STARTS_WITH:
        queryBuilder[method](`${columnPath} ILIKE :${paramName}`, {
          [paramName]: `${value}%`,
        });
        break;

      case QueryOperator.ENDS_WITH:
        queryBuilder[method](`${columnPath} ILIKE :${paramName}`, {
          [paramName]: `%${value}`,
        });
        break;

      case QueryOperator.IN:
        const inValues = values || (Array.isArray(value) ? value : [value]);
        queryBuilder[method](`${columnPath} IN (:...${paramName})`, {
          [paramName]: inValues,
        });
        break;

      case QueryOperator.NOT_IN:
        const notInValues = values || (Array.isArray(value) ? value : [value]);
        queryBuilder[method](`${columnPath} NOT IN (:...${paramName})`, {
          [paramName]: notInValues,
        });
        break;

      case QueryOperator.BETWEEN:
        if (!Array.isArray(value) || value.length !== 2) {
          throw new BadRequestException(
            'BETWEEN operator requires an array of two values',
          );
        }
        queryBuilder[method](
          `${columnPath} BETWEEN :${paramName}_start AND :${paramName}_end`,
          {
            [`${paramName}_start`]: value[0],
            [`${paramName}_end`]: value[1],
          },
        );
        break;

      case QueryOperator.GREATER_THAN:
        queryBuilder[method](`${columnPath} > :${paramName}`, {
          [paramName]: value,
        });
        break;

      case QueryOperator.GREATER_THAN_OR_EQUAL:
        queryBuilder[method](`${columnPath} >= :${paramName}`, {
          [paramName]: value,
        });
        break;

      case QueryOperator.LESS_THAN:
        queryBuilder[method](`${columnPath} < :${paramName}`, {
          [paramName]: value,
        });
        break;

      case QueryOperator.LESS_THAN_OR_EQUAL:
        queryBuilder[method](`${columnPath} <= :${paramName}`, {
          [paramName]: value,
        });
        break;

      case QueryOperator.IS_NULL:
        queryBuilder[method](`${columnPath} IS NULL`);
        break;

      case QueryOperator.IS_NOT_NULL:
        queryBuilder[method](`${columnPath} IS NOT NULL`);
        break;

      default:
        throw new BadRequestException(`Unknown operator: ${op}`);
    }
  }

  /**
   * Normalize operator string to QueryOperator enum
   */
  private normalizeOperator(op: string): QueryOperator {
    const normalized = op.toLowerCase();

    const mapping: Record<string, QueryOperator> = {
      eq: QueryOperator.EQUALS,
      equals: QueryOperator.EQUALS,
      '=': QueryOperator.EQUALS,
      neq: QueryOperator.NOT_EQUALS,
      not_equals: QueryOperator.NOT_EQUALS,
      '!=': QueryOperator.NOT_EQUALS,
      '<>': QueryOperator.NOT_EQUALS,
      contains: QueryOperator.CONTAINS,
      like: QueryOperator.CONTAINS,
      starts_with: QueryOperator.STARTS_WITH,
      startswith: QueryOperator.STARTS_WITH,
      ends_with: QueryOperator.ENDS_WITH,
      endswith: QueryOperator.ENDS_WITH,
      in: QueryOperator.IN,
      not_in: QueryOperator.NOT_IN,
      notin: QueryOperator.NOT_IN,
      between: QueryOperator.BETWEEN,
      gt: QueryOperator.GREATER_THAN,
      '>': QueryOperator.GREATER_THAN,
      gte: QueryOperator.GREATER_THAN_OR_EQUAL,
      '>=': QueryOperator.GREATER_THAN_OR_EQUAL,
      lt: QueryOperator.LESS_THAN,
      '<': QueryOperator.LESS_THAN,
      lte: QueryOperator.LESS_THAN_OR_EQUAL,
      '<=': QueryOperator.LESS_THAN_OR_EQUAL,
      is_null: QueryOperator.IS_NULL,
      isnull: QueryOperator.IS_NULL,
      is_not_null: QueryOperator.IS_NOT_NULL,
      isnotnull: QueryOperator.IS_NOT_NULL,
    };

    const result = mapping[normalized];
    if (!result) {
      if (Object.values(QueryOperator).includes(normalized as QueryOperator)) {
        return normalized as QueryOperator;
      }
      throw new BadRequestException(`Unknown operator: ${op}`);
    }

    return result;
  }

  /**
   * Validate a DSL structure
   */
  validateDSL(dsl: QueryDSL): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!dsl.conditions || !Array.isArray(dsl.conditions)) {
      errors.push('conditions must be an array');
    } else {
      for (let i = 0; i < dsl.conditions.length; i++) {
        const condition = dsl.conditions[i];
        if (!condition.field) {
          errors.push(`Condition ${i}: field is required`);
        }
        if (!condition.op) {
          errors.push(`Condition ${i}: op (operator) is required`);
        }
        try {
          this.normalizeOperator(condition.op);
        } catch {
          errors.push(`Condition ${i}: invalid operator '${condition.op}'`);
        }
      }
    }

    if (dsl.logical && !Object.values(LogicalOperator).includes(dsl.logical)) {
      errors.push(`Invalid logical operator: ${dsl.logical}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse a simple filter string into DSL
   * Format: "field:op:value,field2:op2:value2"
   */
  parseSimpleFilter(filterString: string): QueryDSL {
    const conditions: QueryCondition[] = [];

    const parts = filterString.split(',');
    for (const part of parts) {
      const [field, op, ...valueParts] = part.split(':');
      if (field && op) {
        conditions.push({
          field: field.trim(),
          op: op.trim(),
          value: valueParts.join(':').trim(),
        });
      }
    }

    return {
      conditions,
      logical: LogicalOperator.AND,
    };
  }
}
