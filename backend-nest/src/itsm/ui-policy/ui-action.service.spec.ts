import { UiActionService } from './ui-action.service';
import { UiAction } from './ui-action.entity';
import { WorkflowTransition } from '../workflow/workflow-definition.entity';

function makeAction(overrides: Partial<UiAction>): UiAction {
  return {
    id: 'action-1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    name: 'test_action',
    label: 'Test Action',
    description: null,
    tableName: 'itsm_incidents',
    workflowTransition: null,
    requiredRoles: null,
    showConditions: null,
    style: 'secondary',
    order: 100,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: false,
    tenant: {} as never,
    ...overrides,
  } as UiAction;
}

function makeTransition(
  overrides: Partial<WorkflowTransition>,
): WorkflowTransition {
  return {
    name: 'start_progress',
    label: 'Start Progress',
    from: 'open',
    to: 'in_progress',
    ...overrides,
  };
}

describe('UiActionService (unit)', () => {
  let service: UiActionService;

  beforeEach(() => {
    service = new UiActionService({} as never);
  });

  describe('getActionsForRecord', () => {
    it('should return active actions', () => {
      const actions = [
        makeAction({ id: 'a1', isActive: true }),
        makeAction({ id: 'a2', isActive: false }),
      ];
      const result = service.getActionsForRecord(actions, {});
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });

    it('should filter by required roles', () => {
      const actions = [
        makeAction({
          id: 'a1',
          requiredRoles: ['ADMIN'],
        }),
      ];
      const noAccess = service.getActionsForRecord(actions, {}, ['USER']);
      expect(noAccess).toHaveLength(0);

      const hasAccess = service.getActionsForRecord(actions, {}, ['ADMIN']);
      expect(hasAccess).toHaveLength(1);
    });

    it('should filter by show conditions', () => {
      const actions = [
        makeAction({
          id: 'a1',
          showConditions: [{ field: 'state', operator: 'eq', value: 'open' }],
        }),
      ];
      const match = service.getActionsForRecord(actions, { state: 'open' });
      expect(match).toHaveLength(1);

      const noMatch = service.getActionsForRecord(actions, {
        state: 'closed',
      });
      expect(noMatch).toHaveLength(0);
    });
  });

  describe('getActionsWithTransitionValidation', () => {
    it('should keep actions without workflowTransition', () => {
      const actions = [makeAction({ id: 'a1', workflowTransition: null })];
      const transitions = [makeTransition({ name: 'start_progress' })];
      const result = service.getActionsWithTransitionValidation(
        actions,
        {},
        'open',
        transitions,
      );
      expect(result).toHaveLength(1);
    });

    it('should keep actions whose workflowTransition is available', () => {
      const actions = [
        makeAction({
          id: 'a1',
          workflowTransition: 'start_progress',
        }),
      ];
      const transitions = [
        makeTransition({ name: 'start_progress', from: 'open' }),
      ];
      const result = service.getActionsWithTransitionValidation(
        actions,
        {},
        'open',
        transitions,
      );
      expect(result).toHaveLength(1);
    });

    it('should hide actions whose workflowTransition is NOT available', () => {
      const actions = [
        makeAction({
          id: 'a1',
          workflowTransition: 'close',
        }),
      ];
      const transitions = [
        makeTransition({ name: 'start_progress', from: 'open' }),
      ];
      const result = service.getActionsWithTransitionValidation(
        actions,
        {},
        'open',
        transitions,
      );
      expect(result).toHaveLength(0);
    });

    it('should combine role check + transition validation', () => {
      const actions = [
        makeAction({
          id: 'admin-close',
          workflowTransition: 'close',
          requiredRoles: ['ADMIN'],
        }),
        makeAction({
          id: 'user-reopen',
          workflowTransition: 'reopen',
        }),
      ];
      const transitions = [
        makeTransition({ name: 'close', from: 'resolved' }),
        makeTransition({ name: 'reopen', from: 'resolved' }),
      ];

      const userResult = service.getActionsWithTransitionValidation(
        actions,
        {},
        'resolved',
        transitions,
        ['USER'],
      );
      expect(userResult).toHaveLength(1);
      expect(userResult[0].id).toBe('user-reopen');

      const adminResult = service.getActionsWithTransitionValidation(
        actions,
        {},
        'resolved',
        transitions,
        ['ADMIN'],
      );
      expect(adminResult).toHaveLength(2);
    });

    it('should hide actions when no transitions available (final state)', () => {
      const actions = [
        makeAction({
          id: 'a1',
          workflowTransition: 'start_progress',
        }),
      ];
      const result = service.getActionsWithTransitionValidation(
        actions,
        {},
        'closed',
        [],
      );
      expect(result).toHaveLength(0);
    });

    it('should filter inactive actions before transition check', () => {
      const actions = [
        makeAction({
          id: 'a1',
          workflowTransition: 'start_progress',
          isActive: false,
        }),
      ];
      const transitions = [makeTransition({ name: 'start_progress' })];
      const result = service.getActionsWithTransitionValidation(
        actions,
        {},
        'open',
        transitions,
      );
      expect(result).toHaveLength(0);
    });
  });
});
