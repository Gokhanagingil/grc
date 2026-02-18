import { Injectable, BadRequestException } from '@nestjs/common';
import {
  WorkflowDefinition,
  WorkflowState,
  WorkflowTransition,
  TransitionCondition,
  TransitionAction,
} from './workflow-definition.entity';

export interface TransitionResult {
  allowed: boolean;
  targetState: string;
  actions: TransitionAction[];
  reason?: string;
}

@Injectable()
export class WorkflowEngineService {
  getInitialState(definition: WorkflowDefinition): WorkflowState | undefined {
    return definition.states.find((s) => s.isInitial);
  }

  getFinalStates(definition: WorkflowDefinition): WorkflowState[] {
    return definition.states.filter((s) => s.isFinal);
  }

  getAvailableTransitions(
    definition: WorkflowDefinition,
    currentState: string,
    userRoles?: string[],
  ): WorkflowTransition[] {
    return definition.transitions.filter((t) => {
      if (t.from !== currentState) return false;
      if (t.requiredRoles && t.requiredRoles.length > 0 && userRoles) {
        const hasRole = t.requiredRoles.some((r) => userRoles.includes(r));
        if (!hasRole) return false;
      }
      return true;
    });
  }

  validateTransition(
    definition: WorkflowDefinition,
    currentState: string,
    transitionName: string,
    record: Record<string, unknown>,
    userRoles?: string[],
  ): TransitionResult {
    const transition = definition.transitions.find(
      (t) => t.name === transitionName && t.from === currentState,
    );

    if (!transition) {
      return {
        allowed: false,
        targetState: currentState,
        actions: [],
        reason: `No transition '${transitionName}' from state '${currentState}'`,
      };
    }

    if (
      transition.requiredRoles &&
      transition.requiredRoles.length > 0 &&
      userRoles
    ) {
      const hasRole = transition.requiredRoles.some((r) =>
        userRoles.includes(r),
      );
      if (!hasRole) {
        return {
          allowed: false,
          targetState: currentState,
          actions: [],
          reason: `User lacks required role for transition '${transitionName}'`,
        };
      }
    }

    if (transition.conditions && transition.conditions.length > 0) {
      for (const condition of transition.conditions) {
        if (!this.evaluateCondition(condition, record)) {
          return {
            allowed: false,
            targetState: currentState,
            actions: [],
            reason: `Condition not met: ${condition.field} ${condition.operator} ${String(condition.value ?? '')}`,
          };
        }
      }
    }

    return {
      allowed: true,
      targetState: transition.to,
      actions: transition.actions || [],
    };
  }

  executeTransition(
    definition: WorkflowDefinition,
    currentState: string,
    transitionName: string,
    record: Record<string, unknown>,
    userRoles?: string[],
  ): { newState: string; fieldUpdates: Record<string, unknown> } {
    const result = this.validateTransition(
      definition,
      currentState,
      transitionName,
      record,
      userRoles,
    );

    if (!result.allowed) {
      throw new BadRequestException(result.reason || 'Transition not allowed');
    }

    const fieldUpdates: Record<string, unknown> = {};

    for (const action of result.actions) {
      if (action.type === 'set_field' && action.field) {
        fieldUpdates[action.field] = action.value;
      } else if (action.type === 'set_timestamp' && action.field) {
        fieldUpdates[action.field] = new Date();
      }
    }

    return {
      newState: result.targetState,
      fieldUpdates,
    };
  }

  evaluateCondition(
    condition: TransitionCondition,
    record: Record<string, unknown>,
  ): boolean {
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
}
