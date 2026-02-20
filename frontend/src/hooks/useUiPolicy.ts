/**
 * useUiPolicy Hook
 * 
 * Provides UI policy evaluation functionality.
 * Evaluates conditions and applies actions (hide/show/readonly/mandatory/disable).
 * 
 * SAFETY: This hook is hardened against undefined/null/malformed API responses.
 * It will NEVER throw for any backend response shape - worst case it falls back
 * to defaultActions and empty policies.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { uiPolicyApi, UiPolicy, UiPolicyActions, UiPolicyCondition } from '../services/platformApi';
import { toStringArray, extractPoliciesArray, extractActionsObject } from '../utils/safeHelpers';

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

/**
 * Default actions object - single source of truth for safe defaults.
 * All field arrays default to empty arrays to prevent "cannot read property of undefined" errors.
 */
const DEFAULT_ACTIONS: UiPolicyActions = {
  hiddenFields: [],
  shownFields: [],
  readonlyFields: [],
  editableFields: [],
  mandatoryFields: [],
  optionalFields: [],
  disabledFields: [],
};

/**
 * Safely merges partial actions with defaults to ensure all fields are defined.
 * Handles undefined, null, or partial action objects from API responses.
 * 
 * Uses toStringArray to ensure each field is always an array of strings,
 * even if the API returns null, undefined, non-array values, or arrays
 * containing non-string items.
 */
function getSafeActions(actions: UiPolicyActions | undefined | null): UiPolicyActions {
  if (!actions) {
    return DEFAULT_ACTIONS;
  }
  
  // Use toStringArray for robust normalization - handles null, undefined,
  // non-array values, and filters to only valid strings
  return {
    hiddenFields: toStringArray(actions.hiddenFields),
    shownFields: toStringArray(actions.shownFields),
    readonlyFields: toStringArray(actions.readonlyFields),
    editableFields: toStringArray(actions.editableFields),
    mandatoryFields: toStringArray(actions.mandatoryFields),
    optionalFields: toStringArray(actions.optionalFields),
    disabledFields: toStringArray(actions.disabledFields),
  };
}

export function useUiPolicy(tableName: string, initialFormData?: Record<string, unknown>): UseUiPolicyResult {
  useAuth();
  const [policies, setPolicies] = useState<UiPolicy[]>([]);
  const [actions, setActions] = useState<UiPolicyActions>(DEFAULT_ACTIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    if (!tableName) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await uiPolicyApi.getForTable(tableName);
      // Use extractPoliciesArray to safely handle various response shapes:
      // - {data: {policies: [...]}}
      // - {success: true, data: {policies: [...]}}
      // - {success: true, data: {success: true, data: {policies: [...]}}} (double-wrapped)
      // - undefined/null responses
      const extractedPolicies = extractPoliciesArray<UiPolicy>(response.data);
      setPolicies(extractedPolicies);
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
        // Use extractActionsObject to safely handle various response shapes:
        // - {data: {actions: {...}}}
        // - {success: true, data: {actions: {...}}}
        // - {success: true, data: {success: true, data: {actions: {...}}}} (double-wrapped)
        // - undefined/null responses
        const extractedActions = extractActionsObject<UiPolicyActions>(response.data);
        // Safely merge with defaults to handle undefined/partial responses
        setActions(getSafeActions(extractedActions));
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

  // Create a safe actions object that guarantees all fields are defined arrays.
  // This is the single source of truth for all field checks below.
  const safeActions = useMemo(() => getSafeActions(actions), [actions]);

  const hiddenFieldsSet = useMemo(
    () => new Set(safeActions.hiddenFields),
    [safeActions.hiddenFields]
  );

  const readonlyFieldsSet = useMemo(
    () => new Set(safeActions.readonlyFields),
    [safeActions.readonlyFields]
  );

  const mandatoryFieldsSet = useMemo(
    () => new Set(safeActions.mandatoryFields),
    [safeActions.mandatoryFields]
  );

  const disabledFieldsSet = useMemo(
    () => new Set(safeActions.disabledFields),
    [safeActions.disabledFields]
  );

  const isFieldHidden = useCallback(
    (fieldName: string): boolean => {
      // Hidden unless explicitly shown
      if (safeActions.shownFields.includes(fieldName)) return false;
      return hiddenFieldsSet.has(fieldName);
    },
    [hiddenFieldsSet, safeActions.shownFields]
  );

  const isFieldReadonly = useCallback(
    (fieldName: string): boolean => {
      // Readonly unless explicitly editable
      if (safeActions.editableFields.includes(fieldName)) return false;
      return readonlyFieldsSet.has(fieldName);
    },
    [readonlyFieldsSet, safeActions.editableFields]
  );

  const isFieldMandatory = useCallback(
    (fieldName: string): boolean => {
      // Mandatory unless explicitly optional
      if (safeActions.optionalFields.includes(fieldName)) return false;
      return mandatoryFieldsSet.has(fieldName);
    },
    [mandatoryFieldsSet, safeActions.optionalFields]
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
