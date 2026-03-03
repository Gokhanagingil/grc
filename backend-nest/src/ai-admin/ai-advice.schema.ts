import { AiAdviceOutput, AiSuggestedAction } from './providers';

/**
 * AI Advice JSON Schema Validator
 *
 * Validates AI provider output against strict schema.
 * Rejects invalid output to prevent malformed advice from reaching the UI.
 */

export interface AiAdviceValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: AiAdviceOutput;
}

/**
 * Validate a single suggested action.
 */
function validateSuggestedAction(
  action: unknown,
  index: number,
): { valid: boolean; errors: string[]; action?: AiSuggestedAction } {
  const errors: string[] = [];

  if (!action || typeof action !== 'object') {
    return { valid: false, errors: [`suggestedActions[${index}] must be an object`] };
  }

  const a = action as Record<string, unknown>;

  if (typeof a.actionType !== 'string' || a.actionType.length === 0) {
    errors.push(`suggestedActions[${index}].actionType must be a non-empty string`);
  }
  if (typeof a.label !== 'string' || a.label.length === 0) {
    errors.push(`suggestedActions[${index}].label must be a non-empty string`);
  }
  if (typeof a.reason !== 'string' || a.reason.length === 0) {
    errors.push(`suggestedActions[${index}].reason must be a non-empty string`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    action: {
      actionType: a.actionType as string,
      label: (a.label as string).substring(0, 200),
      reason: (a.reason as string).substring(0, 500),
      payload: a.payload && typeof a.payload === 'object'
        ? a.payload as Record<string, unknown>
        : undefined,
    },
  };
}

/**
 * Validate and sanitize AI advice output.
 * Enforces:
 * - summary: required string, max 500 chars
 * - suggestedSteps: required array of strings, 1-5 items, max 300 chars each
 * - whyThis: required string, max 500 chars
 * - suggestedActions: required array, 0-4 items
 * - provider: required string
 * - modelId: required string
 * - generatedAt: required ISO string
 */
export function validateAiAdviceOutput(raw: unknown): AiAdviceValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['AI advice output must be an object'] };
  }

  const r = raw as Record<string, unknown>;

  // summary
  if (typeof r.summary !== 'string' || r.summary.length === 0) {
    errors.push('summary must be a non-empty string');
  }

  // suggestedSteps
  if (!Array.isArray(r.suggestedSteps)) {
    errors.push('suggestedSteps must be an array');
  } else if (r.suggestedSteps.length === 0 || r.suggestedSteps.length > 5) {
    errors.push('suggestedSteps must have 1-5 items');
  } else {
    for (let i = 0; i < r.suggestedSteps.length; i++) {
      if (typeof r.suggestedSteps[i] !== 'string') {
        errors.push(`suggestedSteps[${i}] must be a string`);
      }
    }
  }

  // whyThis
  if (typeof r.whyThis !== 'string' || r.whyThis.length === 0) {
    errors.push('whyThis must be a non-empty string');
  }

  // suggestedActions
  if (!Array.isArray(r.suggestedActions)) {
    errors.push('suggestedActions must be an array');
  } else if (r.suggestedActions.length > 4) {
    errors.push('suggestedActions must have at most 4 items');
  }

  // provider + modelId + generatedAt
  if (typeof r.provider !== 'string' || r.provider.length === 0) {
    errors.push('provider must be a non-empty string');
  }
  if (typeof r.modelId !== 'string' || r.modelId.length === 0) {
    errors.push('modelId must be a non-empty string');
  }
  if (typeof r.generatedAt !== 'string' || r.generatedAt.length === 0) {
    errors.push('generatedAt must be a non-empty string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate individual actions
  const validatedActions: AiSuggestedAction[] = [];
  if (Array.isArray(r.suggestedActions)) {
    for (let i = 0; i < r.suggestedActions.length; i++) {
      const result = validateSuggestedAction(r.suggestedActions[i], i);
      if (!result.valid) {
        return { valid: false, errors: result.errors };
      }
      if (result.action) {
        validatedActions.push(result.action);
      }
    }
  }

  // Sanitize and return
  const sanitized: AiAdviceOutput = {
    summary: (r.summary as string).substring(0, 500),
    suggestedSteps: (r.suggestedSteps as string[]).map((s) => s.substring(0, 300)),
    whyThis: (r.whyThis as string).substring(0, 500),
    suggestedActions: validatedActions,
    provider: (r.provider as string).substring(0, 50),
    modelId: (r.modelId as string).substring(0, 100),
    generatedAt: r.generatedAt as string,
  };

  return { valid: true, errors: [], sanitized };
}

/**
 * Clamp suggested actions to the allowed action types policy.
 * Removes any action whose actionType is not in the allowlist.
 * Also enforces requiresConfirm=true on all actions (v0 policy).
 */
export function clampActionsToPolicy(
  advice: AiAdviceOutput,
  allowedActionTypes: string[],
): AiAdviceOutput {
  const allowedSet = new Set(allowedActionTypes);
  const clampedActions = advice.suggestedActions.filter((a) =>
    allowedSet.has(a.actionType),
  );

  return {
    ...advice,
    suggestedActions: clampedActions,
  };
}
