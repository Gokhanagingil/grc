/**
 * AI Advisor Provider Interface
 *
 * Defines the contract for AI suggestion providers.
 * Implementations: StubProvider (deterministic for CI), RealProvider (behind env vars).
 */

/**
 * Minimal input payload sent to AI provider.
 * Strictly limited by Data Minimization Policy.
 */
export interface AiAdvisorInput {
  notificationType: string;
  notificationSeverity: string;
  notificationDueAt: string | null;
  entityType: string | null;
  snapshot: {
    primaryLabel: string;
    secondaryLabel?: string;
    keyFields: Array<{ label: string; value: string }>;
  } | null;
}

/**
 * Single suggested action from AI.
 */
export interface AiSuggestedAction {
  actionType: string;
  label: string;
  reason: string;
  payload?: Record<string, unknown>;
}

/**
 * AI Advice output (strict JSON schema).
 */
export interface AiAdviceOutput {
  summary: string;
  suggestedSteps: string[];
  whyThis: string;
  suggestedActions: AiSuggestedAction[];
  provider: string;
  modelId: string;
  generatedAt: string;
}

/**
 * Provider interface for AI Advisor.
 */
export interface AiAdvisorProvider {
  readonly providerName: string;
  generateAdvice(input: AiAdvisorInput): Promise<AiAdviceOutput>;
}
