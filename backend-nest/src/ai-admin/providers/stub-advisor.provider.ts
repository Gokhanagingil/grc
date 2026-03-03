import {
  AiAdvisorProvider,
  AiAdvisorInput,
  AiAdviceOutput,
} from './ai-advisor-provider.interface';

/**
 * Stub AI Advisor Provider
 *
 * Deterministic output for tests/CI. Returns plausible advice
 * based on notification type without making any external calls.
 */
export class StubAdvisorProvider implements AiAdvisorProvider {
  readonly providerName = 'stub';

  async generateAdvice(input: AiAdvisorInput): Promise<AiAdviceOutput> {
    const now = new Date().toISOString();
    const entityLabel = input.snapshot?.primaryLabel || 'this item';

    switch (input.notificationType) {
      case 'ASSIGNMENT':
        return {
          summary: `Task "${entityLabel}" has been assigned. Review priority and due date to plan your work.`,
          suggestedSteps: [
            'Review the task details and priority level',
            'Check if a due date is set and adjust if needed',
            'Accept the assignment or delegate if appropriate',
          ],
          whyThis: 'This task was recently assigned to you. Taking ownership quickly helps maintain team velocity.',
          suggestedActions: [
            {
              actionType: 'ASSIGN_TO_ME',
              label: 'Accept & Assign to Me',
              reason: 'Confirm ownership of this task',
            },
            {
              actionType: 'SET_DUE_DATE',
              label: 'Set Due Date',
              reason: 'Ensure the task has a clear deadline',
            },
            {
              actionType: 'CREATE_FOLLOWUP_TODO',
              label: 'Create Follow-up',
              reason: 'Track any sub-tasks or dependencies',
            },
          ],
          provider: 'stub',
          modelId: 'stub-v0',
          generatedAt: now,
        };

      case 'DUE_DATE':
        return {
          summary: `"${entityLabel}" is approaching its due date. Consider reprioritizing or extending the deadline.`,
          suggestedSteps: [
            'Check current progress on this item',
            'Determine if the deadline is achievable',
            'Update the due date or escalate if blocked',
          ],
          whyThis: 'Items approaching deadlines need attention to prevent overdue status.',
          suggestedActions: [
            {
              actionType: 'SET_DUE_DATE',
              label: 'Extend Due Date',
              reason: 'Adjust timeline if more time is needed',
            },
            {
              actionType: 'ASSIGN_TO_ME',
              label: 'Take Ownership',
              reason: 'Ensure someone is actively working on this',
            },
            {
              actionType: 'CREATE_FOLLOWUP_TODO',
              label: 'Create Follow-up',
              reason: 'Break down remaining work into smaller tasks',
            },
          ],
          provider: 'stub',
          modelId: 'stub-v0',
          generatedAt: now,
        };

      case 'GROUP_ASSIGNMENT':
        return {
          summary: `"${entityLabel}" has been assigned to your group. Someone should claim it.`,
          suggestedSteps: [
            'Review the item details and requirements',
            'Assign to yourself if you have capacity',
            'Set a due date to track progress',
          ],
          whyThis: 'Group-assigned items need a specific owner to avoid being overlooked.',
          suggestedActions: [
            {
              actionType: 'ASSIGN_TO_ME',
              label: 'Claim This Item',
              reason: 'Take personal ownership from the group queue',
            },
            {
              actionType: 'SET_DUE_DATE',
              label: 'Set Due Date',
              reason: 'Establish a timeline for completion',
            },
          ],
          provider: 'stub',
          modelId: 'stub-v0',
          generatedAt: now,
        };

      default:
        return {
          summary: `Review "${entityLabel}" and determine next steps.`,
          suggestedSteps: [
            'Open and review the item details',
            'Determine if action is needed',
            'Mark as read if no action required',
          ],
          whyThis: 'This notification requires your attention.',
          suggestedActions: [
            {
              actionType: 'OPEN_ENTITY',
              label: 'Open Item',
              reason: 'View full details',
            },
            {
              actionType: 'MARK_READ',
              label: 'Mark as Read',
              reason: 'Acknowledge this notification',
            },
          ],
          provider: 'stub',
          modelId: 'stub-v0',
          generatedAt: now,
        };
    }
  }
}
