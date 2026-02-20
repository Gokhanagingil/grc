import { Injectable } from '@nestjs/common';
import {
  BusinessRule,
  BusinessRuleCondition,
  BusinessRuleAction,
} from './business-rule.entity';

export interface BusinessRuleResult {
  ruleName: string;
  applied: boolean;
  rejected: boolean;
  rejectMessage?: string;
  fieldUpdates: Record<string, unknown>;
}

@Injectable()
export class BusinessRuleEngineService {
  evaluateRules(
    rules: BusinessRule[],
    record: Record<string, unknown>,
    changes?: Record<string, unknown>,
  ): BusinessRuleResult[] {
    const results: BusinessRuleResult[] = [];

    const sortedRules = [...rules].sort((a, b) => a.order - b.order);

    for (const rule of sortedRules) {
      if (!rule.isActive) continue;

      const conditionsMet = this.evaluateConditions(
        rule.conditions || [],
        record,
        changes,
      );

      if (!conditionsMet) {
        results.push({
          ruleName: rule.name,
          applied: false,
          rejected: false,
          fieldUpdates: {},
        });
        continue;
      }

      const result = this.executeActions(rule.actions);
      results.push({
        ruleName: rule.name,
        applied: true,
        ...result,
      });

      if (result.rejected) break;
      if (rule.stopProcessing) break;
    }

    return results;
  }

  applyBeforeRules(
    rules: BusinessRule[],
    record: Record<string, unknown>,
    changes?: Record<string, unknown>,
  ): {
    fieldUpdates: Record<string, unknown>;
    rejected: boolean;
    rejectMessage?: string;
  } {
    const results = this.evaluateRules(rules, record, changes);

    const fieldUpdates: Record<string, unknown> = {};
    for (const result of results) {
      if (result.applied && !result.rejected) {
        Object.assign(fieldUpdates, result.fieldUpdates);
      }
      if (result.rejected) {
        return {
          fieldUpdates,
          rejected: true,
          rejectMessage: result.rejectMessage,
        };
      }
    }

    return { fieldUpdates, rejected: false };
  }

  private evaluateConditions(
    conditions: BusinessRuleCondition[],
    record: Record<string, unknown>,
    changes?: Record<string, unknown>,
  ): boolean {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every((condition) =>
      this.evaluateCondition(condition, record, changes),
    );
  }

  private evaluateCondition(
    condition: BusinessRuleCondition,
    record: Record<string, unknown>,
    changes?: Record<string, unknown>,
  ): boolean {
    if (condition.operator === 'changed') {
      return changes !== undefined && condition.field in changes;
    }

    const fieldValue = record[condition.field];

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'neq':
        return fieldValue !== condition.value;
      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(String(fieldValue));
        }
        return false;
      case 'not_in':
        if (Array.isArray(condition.value)) {
          return !condition.value.includes(String(fieldValue));
        }
        return true;
      case 'is_set':
        return (
          fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
        );
      case 'is_empty':
        return (
          fieldValue === null || fieldValue === undefined || fieldValue === ''
        );
      default:
        return true;
    }
  }

  private executeActions(actions: BusinessRuleAction[]): {
    rejected: boolean;
    rejectMessage?: string;
    fieldUpdates: Record<string, unknown>;
  } {
    const fieldUpdates: Record<string, unknown> = {};

    for (const action of actions) {
      switch (action.type) {
        case 'set_field':
          if (action.field) {
            fieldUpdates[action.field] = action.value;
          }
          break;
        case 'reject':
          return {
            rejected: true,
            rejectMessage:
              action.message || 'Operation rejected by business rule',
            fieldUpdates,
          };
        case 'add_work_note':
          break;
        default:
          break;
      }
    }

    return { rejected: false, fieldUpdates };
  }
}
