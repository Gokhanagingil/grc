import { validateAiAdviceOutput, clampActionsToPolicy } from './ai-advice.schema';
import { AiAdviceOutput } from './providers';

describe('AI Advice Schema Validation', () => {
  const validOutput: AiAdviceOutput = {
    summary: 'Test summary',
    suggestedSteps: ['Step 1', 'Step 2'],
    whyThis: 'Test reason',
    suggestedActions: [
      {
        actionType: 'ASSIGN_TO_ME',
        label: 'Assign to Me',
        reason: 'Take ownership',
      },
    ],
    provider: 'stub',
    modelId: 'stub-v0',
    generatedAt: new Date().toISOString(),
  };

  describe('validateAiAdviceOutput', () => {
    it('should accept valid output', () => {
      const result = validateAiAdviceOutput(validOutput);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toBeDefined();
      expect(result.sanitized?.summary).toBe('Test summary');
    });

    it('should reject null input', () => {
      const result = validateAiAdviceOutput(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AI advice output must be an object');
    });

    it('should reject undefined input', () => {
      const result = validateAiAdviceOutput(undefined);
      expect(result.valid).toBe(false);
    });

    it('should reject non-object input', () => {
      const result = validateAiAdviceOutput('string');
      expect(result.valid).toBe(false);
    });

    it('should reject missing summary', () => {
      const result = validateAiAdviceOutput({ ...validOutput, summary: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('summary must be a non-empty string');
    });

    it('should reject empty suggestedSteps', () => {
      const result = validateAiAdviceOutput({ ...validOutput, suggestedSteps: [] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('suggestedSteps must have 1-5 items');
    });

    it('should reject more than 5 suggestedSteps', () => {
      const result = validateAiAdviceOutput({
        ...validOutput,
        suggestedSteps: ['1', '2', '3', '4', '5', '6'],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject non-string suggestedSteps items', () => {
      const result = validateAiAdviceOutput({
        ...validOutput,
        suggestedSteps: [123 as unknown as string],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject missing whyThis', () => {
      const result = validateAiAdviceOutput({ ...validOutput, whyThis: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject more than 4 suggestedActions', () => {
      const actions = Array.from({ length: 5 }, (_, i) => ({
        actionType: `ACTION_${i}`,
        label: `Action ${i}`,
        reason: `Reason ${i}`,
      }));
      const result = validateAiAdviceOutput({ ...validOutput, suggestedActions: actions });
      expect(result.valid).toBe(false);
    });

    it('should reject missing provider', () => {
      const result = validateAiAdviceOutput({ ...validOutput, provider: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject missing modelId', () => {
      const result = validateAiAdviceOutput({ ...validOutput, modelId: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject missing generatedAt', () => {
      const result = validateAiAdviceOutput({ ...validOutput, generatedAt: '' });
      expect(result.valid).toBe(false);
    });

    it('should truncate long summary to 500 chars', () => {
      const longSummary = 'a'.repeat(600);
      const result = validateAiAdviceOutput({ ...validOutput, summary: longSummary });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.summary.length).toBe(500);
    });

    it('should truncate long step to 300 chars', () => {
      const longStep = 'b'.repeat(400);
      const result = validateAiAdviceOutput({ ...validOutput, suggestedSteps: [longStep] });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.suggestedSteps[0].length).toBe(300);
    });

    it('should reject action with missing actionType', () => {
      const result = validateAiAdviceOutput({
        ...validOutput,
        suggestedActions: [{ actionType: '', label: 'Test', reason: 'Test' }],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject action with missing label', () => {
      const result = validateAiAdviceOutput({
        ...validOutput,
        suggestedActions: [{ actionType: 'TEST', label: '', reason: 'Test' }],
      });
      expect(result.valid).toBe(false);
    });

    it('should accept output with zero suggestedActions', () => {
      const result = validateAiAdviceOutput({ ...validOutput, suggestedActions: [] });
      expect(result.valid).toBe(true);
    });
  });

  describe('clampActionsToPolicy', () => {
    const adviceWithActions: AiAdviceOutput = {
      ...validOutput,
      suggestedActions: [
        { actionType: 'ASSIGN_TO_ME', label: 'Assign', reason: 'Take it' },
        { actionType: 'SET_DUE_DATE', label: 'Set Date', reason: 'Set deadline' },
        { actionType: 'DANGEROUS_ACTION', label: 'Danger', reason: 'Bad' },
      ],
    };

    it('should remove actions not in allowlist', () => {
      const result = clampActionsToPolicy(adviceWithActions, ['ASSIGN_TO_ME', 'SET_DUE_DATE']);
      expect(result.suggestedActions).toHaveLength(2);
      expect(result.suggestedActions.map((a) => a.actionType)).toEqual([
        'ASSIGN_TO_ME',
        'SET_DUE_DATE',
      ]);
    });

    it('should keep all actions when all are in allowlist', () => {
      const result = clampActionsToPolicy(adviceWithActions, [
        'ASSIGN_TO_ME',
        'SET_DUE_DATE',
        'DANGEROUS_ACTION',
      ]);
      expect(result.suggestedActions).toHaveLength(3);
    });

    it('should return empty actions when none are in allowlist', () => {
      const result = clampActionsToPolicy(adviceWithActions, ['OPEN_ENTITY']);
      expect(result.suggestedActions).toHaveLength(0);
    });

    it('should preserve other advice fields', () => {
      const result = clampActionsToPolicy(adviceWithActions, ['ASSIGN_TO_ME']);
      expect(result.summary).toBe(adviceWithActions.summary);
      expect(result.suggestedSteps).toEqual(adviceWithActions.suggestedSteps);
      expect(result.whyThis).toBe(adviceWithActions.whyThis);
    });
  });
});
