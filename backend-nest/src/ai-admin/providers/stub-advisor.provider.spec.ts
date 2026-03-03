import { StubAdvisorProvider } from './stub-advisor.provider';
import { AiAdvisorInput } from './ai-advisor-provider.interface';

describe('StubAdvisorProvider', () => {
  let provider: StubAdvisorProvider;

  beforeEach(() => {
    provider = new StubAdvisorProvider();
  });

  it('should have providerName "stub"', () => {
    expect(provider.providerName).toBe('stub');
  });

  describe('generateAdvice', () => {
    const baseInput: AiAdvisorInput = {
      notificationType: 'GENERAL',
      notificationSeverity: 'INFO',
      notificationDueAt: null,
      entityType: 'todo_task',
      snapshot: {
        primaryLabel: 'Test Task',
        keyFields: [],
      },
    };

    it('should return deterministic output for ASSIGNMENT type', async () => {
      const input: AiAdvisorInput = { ...baseInput, notificationType: 'ASSIGNMENT' };
      const result = await provider.generateAdvice(input);

      expect(result.summary).toContain('Test Task');
      expect(result.suggestedSteps).toHaveLength(3);
      expect(result.whyThis).toBeTruthy();
      expect(result.suggestedActions).toHaveLength(3);
      expect(result.suggestedActions.map((a) => a.actionType)).toEqual([
        'ASSIGN_TO_ME',
        'SET_DUE_DATE',
        'CREATE_FOLLOWUP_TODO',
      ]);
      expect(result.provider).toBe('stub');
      expect(result.modelId).toBe('stub-v0');
      expect(result.generatedAt).toBeTruthy();
    });

    it('should return deterministic output for DUE_DATE type', async () => {
      const input: AiAdvisorInput = { ...baseInput, notificationType: 'DUE_DATE' };
      const result = await provider.generateAdvice(input);

      expect(result.summary).toContain('Test Task');
      expect(result.suggestedSteps).toHaveLength(3);
      expect(result.suggestedActions).toHaveLength(3);
      expect(result.suggestedActions[0].actionType).toBe('SET_DUE_DATE');
    });

    it('should return deterministic output for GROUP_ASSIGNMENT type', async () => {
      const input: AiAdvisorInput = { ...baseInput, notificationType: 'GROUP_ASSIGNMENT' };
      const result = await provider.generateAdvice(input);

      expect(result.summary).toContain('Test Task');
      expect(result.suggestedActions.map((a) => a.actionType)).toEqual([
        'ASSIGN_TO_ME',
        'SET_DUE_DATE',
      ]);
    });

    it('should return default output for unknown types', async () => {
      const result = await provider.generateAdvice(baseInput);

      expect(result.summary).toContain('Test Task');
      expect(result.suggestedActions.map((a) => a.actionType)).toEqual([
        'OPEN_ENTITY',
        'MARK_READ',
      ]);
    });

    it('should use "this item" when no primaryLabel', async () => {
      const input: AiAdvisorInput = {
        ...baseInput,
        snapshot: null,
      };
      const result = await provider.generateAdvice(input);
      expect(result.summary).toContain('this item');
    });

    it('should always include provider and modelId', async () => {
      const result = await provider.generateAdvice(baseInput);
      expect(result.provider).toBe('stub');
      expect(result.modelId).toBe('stub-v0');
    });

    it('should return valid generatedAt ISO string', async () => {
      const result = await provider.generateAdvice(baseInput);
      const date = new Date(result.generatedAt);
      expect(date.getTime()).not.toBeNaN();
    });

    it('should have all actions with non-empty labels and reasons', async () => {
      const input: AiAdvisorInput = { ...baseInput, notificationType: 'ASSIGNMENT' };
      const result = await provider.generateAdvice(input);

      for (const action of result.suggestedActions) {
        expect(action.label.length).toBeGreaterThan(0);
        expect(action.reason.length).toBeGreaterThan(0);
        expect(action.actionType.length).toBeGreaterThan(0);
      }
    });
  });
});
