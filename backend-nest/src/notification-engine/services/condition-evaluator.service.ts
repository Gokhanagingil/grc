import { Injectable } from '@nestjs/common';

export interface ConditionGroup {
  operator?: 'AND' | 'OR';
  conditions?: ConditionItem[];
}

export interface ConditionItem {
  field: string;
  op: string;
  value?: unknown;
}

@Injectable()
export class ConditionEvaluatorService {
  evaluate(
    condition: Record<string, unknown>,
    data: Record<string, unknown>,
  ): boolean {
    if (!condition || Object.keys(condition).length === 0) return true;

    if (condition.operator && condition.conditions) {
      return this.evaluateGroup(condition as unknown as ConditionGroup, data);
    }

    if (condition.field && condition.op) {
      return this.evaluateItem(condition as unknown as ConditionItem, data);
    }

    return true;
  }

  private evaluateGroup(
    group: ConditionGroup,
    data: Record<string, unknown>,
  ): boolean {
    const conditions = group.conditions || [];
    if (conditions.length === 0) return true;

    if (group.operator === 'OR') {
      return conditions.some((c) => this.evaluateItem(c, data));
    }

    return conditions.every((c) => this.evaluateItem(c, data));
  }

  private evaluateItem(
    item: ConditionItem,
    data: Record<string, unknown>,
  ): boolean {
    const fieldValue = this.resolveField(item.field, data);

    switch (item.op) {
      case 'eq':
        return fieldValue === item.value;
      case 'neq':
        return fieldValue !== item.value;
      case 'in':
        if (Array.isArray(item.value)) {
          return item.value.includes(String(fieldValue));
        }
        return false;
      case 'not_in':
        if (Array.isArray(item.value)) {
          return !item.value.includes(String(fieldValue));
        }
        return true;
      case 'contains': {
        const fv =
          fieldValue === null || fieldValue === undefined
            ? ''
            : `${fieldValue as string}`;
        const iv =
          item.value === null || item.value === undefined
            ? ''
            : `${item.value as string}`;
        return fv.includes(iv);
      }
      case 'is_set':
        return (
          fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
        );
      case 'is_empty':
        return (
          fieldValue === null || fieldValue === undefined || fieldValue === ''
        );
      case 'gt':
        return Number(fieldValue) > Number(item.value);
      case 'lt':
        return Number(fieldValue) < Number(item.value);
      case 'gte':
        return Number(fieldValue) >= Number(item.value);
      case 'lte':
        return Number(fieldValue) <= Number(item.value);
      default:
        return true;
    }
  }

  private resolveField(path: string, obj: Record<string, unknown>): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}
