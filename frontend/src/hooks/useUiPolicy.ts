/**
 * useUiPolicy Hook
 * 
 * Provides UI policy evaluation functionality.
 * Evaluates conditions and applies actions (hide/show/readonly/mandatory/disable).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { uiPolicyApi, UiPolicy, UiPolicyActions, UiPolicyCondition } from '../services/platformApi';

export interface UseUiPolicyResult {
  policies: UiPolicy[];
  actions: UiPolicyActions;
  isLoading: boolean;
  error: string | null;
  isFieldHidden: (fieldName: string) => boolean;
  isFieldReadonly: (fieldName: string) => boolean;
  isFieldMandatory: (fieldName: string) => boolean;
  isFieldDisabled: (fieldName: string) => boolean;
  evaluatePolicies: (formData: Record<string, unknown>) => Promise<void>;
  refreshPolicies: () => Promise<void>;
}

const defaultActions: UiPolicyActions = {
  hiddenFields: [],
  shownFields: [],
  readonlyFields: [],
  editableFields: [],
  mandatoryFields: [],
  optionalFields: [],
  disabledFields: [],
};

export function useUiPolicy(tableName: string, initialFormData?: Record<string, unknown>): UseUiPolicyResult {
  useAuth();
  const [policies, setPolicies] = useState<UiPolicy[]>([]);
  const [actions, setActions] = useState<UiPolicyActions>(defaultActions);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    if (!tableName) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await uiPolicyApi.getForTable(tableName);
      setPolicies(response.data.policies);
    } catch (err) {
      console.error('Error fetching UI policies:', err);
      setError('Failed to load UI policies');
      setPolicies([]);
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  const evaluatePolicies = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!tableName) return;

      try {
        const response = await uiPolicyApi.evaluate(tableName, formData);
        setActions(response.data.actions);
      } catch (err) {
        console.error('Error evaluating UI policies:', err);
        // Keep current actions on error
      }
    },
    [tableName]
  );

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  useEffect(() => {
    if (initialFormData && policies.length > 0) {
      evaluatePolicies(initialFormData);
    }
  }, [initialFormData, policies.length, evaluatePolicies]);

  const hiddenFieldsSet = useMemo(
    () => new Set(actions.hiddenFields),
    [actions.hiddenFields]
  );

  const readonlyFieldsSet = useMemo(
    () => new Set(actions.readonlyFields),
    [actions.readonlyFields]
  );

  const mandatoryFieldsSet = useMemo(
    () => new Set(actions.mandatoryFields),
    [actions.mandatoryFields]
  );

  const disabledFieldsSet = useMemo(
    () => new Set(actions.disabledFields),
    [actions.disabledFields]
  );

  const isFieldHidden = useCallback(
    (fieldName: string): boolean => {
      // Hidden unless explicitly shown
      if (actions.shownFields.includes(fieldName)) return false;
      return hiddenFieldsSet.has(fieldName);
    },
    [hiddenFieldsSet, actions.shownFields]
  );

  const isFieldReadonly = useCallback(
    (fieldName: string): boolean => {
      // Readonly unless explicitly editable
      if (actions.editableFields.includes(fieldName)) return false;
      return readonlyFieldsSet.has(fieldName);
    },
    [readonlyFieldsSet, actions.editableFields]
  );

  const isFieldMandatory = useCallback(
    (fieldName: string): boolean => {
      // Mandatory unless explicitly optional
      if (actions.optionalFields.includes(fieldName)) return false;
      return mandatoryFieldsSet.has(fieldName);
    },
    [mandatoryFieldsSet, actions.optionalFields]
  );

  const isFieldDisabled = useCallback(
    (fieldName: string): boolean => {
      return disabledFieldsSet.has(fieldName);
    },
    [disabledFieldsSet]
  );

  return {
    policies,
    actions,
    isLoading,
    error,
    isFieldHidden,
    isFieldReadonly,
    isFieldMandatory,
    isFieldDisabled,
    evaluatePolicies,
    refreshPolicies: fetchPolicies,
  };
}

/**
 * Client-side condition evaluation
 * Useful for immediate UI updates without server round-trip
 */
export function evaluateCondition(
  condition: UiPolicyCondition,
  formData: Record<string, unknown>,
  context: { user?: { role: string } } = {}
): boolean {
  if (!condition) return false;

  // Always true condition
  if (condition.always === true) return true;

  // Field-based condition
  if (condition.field) {
    const fieldValue = formData[condition.field];
    const operator = condition.operator || 'equals';
    const value = condition.value;

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      case 'is_empty':
        return !fieldValue || fieldValue === '' || fieldValue === null;
      case 'is_not_empty':
        return fieldValue !== undefined && fieldValue !== '' && fieldValue !== null;
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'starts_with':
        return String(fieldValue).startsWith(String(value));
      case 'ends_with':
        return String(fieldValue).endsWith(String(value));
      default:
        return false;
    }
  }

  // Role-based condition
  if (condition.role && context.user) {
    if (Array.isArray(condition.role)) {
      return condition.role.includes(context.user.role);
    }
    return condition.role === context.user.role;
  }

  // AND condition (all must be true)
  if (condition.and && Array.isArray(condition.and)) {
    return condition.and.every((c) => evaluateCondition(c, formData, context));
  }

  // OR condition (at least one must be true)
  if (condition.or && Array.isArray(condition.or)) {
    return condition.or.some((c) => evaluateCondition(c, formData, context));
  }

  // NOT condition
  if (condition.not) {
    return !evaluateCondition(condition.not, formData, context);
  }

  return false;
}

export default useUiPolicy;
