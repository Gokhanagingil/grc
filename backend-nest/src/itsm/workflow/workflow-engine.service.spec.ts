import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowDefinition } from './workflow-definition.entity';

const mockWorkflow: WorkflowDefinition = {
  id: 'wf-1',
  tenantId: '00000000-0000-0000-0000-000000000001',
  name: 'Incident Workflow',
  description: null,
  tableName: 'itsm_incidents',
  states: [
    { name: 'open', label: 'Open', isInitial: true },
    { name: 'in_progress', label: 'In Progress' },
    { name: 'resolved', label: 'Resolved' },
    { name: 'closed', label: 'Closed', isFinal: true },
  ],
  transitions: [
    {
      name: 'start_progress',
      label: 'Start Progress',
      from: 'open',
      to: 'in_progress',
      actions: [{ type: 'set_timestamp', field: 'firstResponseAt' }],
    },
    {
      name: 'resolve',
      label: 'Resolve',
      from: 'in_progress',
      to: 'resolved',
      conditions: [{ field: 'resolutionNotes', operator: 'is_set' }],
      actions: [{ type: 'set_timestamp', field: 'resolvedAt' }],
    },
    {
      name: 'close',
      label: 'Close',
      from: 'resolved',
      to: 'closed',
      requiredRoles: ['ADMIN', 'MANAGER'],
    },
    {
      name: 'reopen',
      label: 'Reopen',
      from: 'resolved',
      to: 'in_progress',
    },
  ],
  isActive: true,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  updatedBy: null,
  isDeleted: false,
  tenant: {} as never,
};

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;

  beforeEach(() => {
    service = new WorkflowEngineService();
  });

  describe('getInitialState', () => {
    it('should return the initial state', () => {
      const state = service.getInitialState(mockWorkflow);
      expect(state).toBeDefined();
      expect(state?.name).toBe('open');
      expect(state?.isInitial).toBe(true);
    });
  });

  describe('getFinalStates', () => {
    it('should return final states', () => {
      const states = service.getFinalStates(mockWorkflow);
      expect(states).toHaveLength(1);
      expect(states[0].name).toBe('closed');
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return transitions from current state', () => {
      const transitions = service.getAvailableTransitions(mockWorkflow, 'open');
      expect(transitions).toHaveLength(1);
      expect(transitions[0].name).toBe('start_progress');
    });

    it('should return multiple transitions when available', () => {
      const transitions = service.getAvailableTransitions(
        mockWorkflow,
        'resolved',
      );
      expect(transitions).toHaveLength(2);
    });

    it('should filter by role when roles are required', () => {
      const transitions = service.getAvailableTransitions(
        mockWorkflow,
        'resolved',
        ['USER'],
      );
      expect(transitions).toHaveLength(1);
      expect(transitions[0].name).toBe('reopen');
    });

    it('should include role-restricted transitions for matching roles', () => {
      const transitions = service.getAvailableTransitions(
        mockWorkflow,
        'resolved',
        ['ADMIN'],
      );
      expect(transitions).toHaveLength(2);
    });

    it('should return empty array for final states', () => {
      const transitions = service.getAvailableTransitions(
        mockWorkflow,
        'closed',
      );
      expect(transitions).toHaveLength(0);
    });
  });

  describe('validateTransition', () => {
    it('should allow valid transition', () => {
      const result = service.validateTransition(
        mockWorkflow,
        'open',
        'start_progress',
        {},
      );
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('in_progress');
    });

    it('should reject invalid transition name', () => {
      const result = service.validateTransition(
        mockWorkflow,
        'open',
        'nonexistent',
        {},
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No transition');
    });

    it('should reject when conditions not met', () => {
      const result = service.validateTransition(
        mockWorkflow,
        'in_progress',
        'resolve',
        { resolutionNotes: null },
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Condition not met');
    });

    it('should allow when conditions are met', () => {
      const result = service.validateTransition(
        mockWorkflow,
        'in_progress',
        'resolve',
        { resolutionNotes: 'Fixed the issue' },
      );
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('resolved');
    });

    it('should reject when user lacks required role', () => {
      const result = service.validateTransition(
        mockWorkflow,
        'resolved',
        'close',
        {},
        ['USER'],
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('lacks required role');
    });

    it('should allow when user has required role', () => {
      const result = service.validateTransition(
        mockWorkflow,
        'resolved',
        'close',
        {},
        ['ADMIN'],
      );
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('closed');
    });
  });

  describe('executeTransition', () => {
    it('should execute transition and return field updates', () => {
      const result = service.executeTransition(
        mockWorkflow,
        'open',
        'start_progress',
        {},
      );
      expect(result.newState).toBe('in_progress');
      expect(result.fieldUpdates).toHaveProperty('firstResponseAt');
      expect(result.fieldUpdates['firstResponseAt']).toBeInstanceOf(Date);
    });

    it('should throw BadRequestException for invalid transition', () => {
      expect(() =>
        service.executeTransition(mockWorkflow, 'open', 'nonexistent', {}),
      ).toThrow("No transition 'nonexistent' from state 'open'");
    });

    it('should apply set_field actions', () => {
      const workflowWithSetField = {
        ...mockWorkflow,
        transitions: [
          {
            name: 'auto_assign',
            label: 'Auto Assign',
            from: 'open',
            to: 'in_progress',
            actions: [
              {
                type: 'set_field' as const,
                field: 'assignmentGroup',
                value: 'IT Support',
              },
            ],
          },
        ],
      };
      const result = service.executeTransition(
        workflowWithSetField,
        'open',
        'auto_assign',
        {},
      );
      expect(result.fieldUpdates['assignmentGroup']).toBe('IT Support');
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate eq operator', () => {
      expect(
        service.evaluateCondition(
          { field: 'status', operator: 'eq', value: 'open' },
          { status: 'open' },
        ),
      ).toBe(true);
      expect(
        service.evaluateCondition(
          { field: 'status', operator: 'eq', value: 'closed' },
          { status: 'open' },
        ),
      ).toBe(false);
    });

    it('should evaluate neq operator', () => {
      expect(
        service.evaluateCondition(
          { field: 'status', operator: 'neq', value: 'closed' },
          { status: 'open' },
        ),
      ).toBe(true);
    });

    it('should evaluate in operator', () => {
      expect(
        service.evaluateCondition(
          { field: 'priority', operator: 'in', value: ['p1', 'p2'] },
          { priority: 'p1' },
        ),
      ).toBe(true);
      expect(
        service.evaluateCondition(
          { field: 'priority', operator: 'in', value: ['p1', 'p2'] },
          { priority: 'p4' },
        ),
      ).toBe(false);
    });

    it('should evaluate is_set operator', () => {
      expect(
        service.evaluateCondition(
          { field: 'assignee', operator: 'is_set' },
          { assignee: 'user-1' },
        ),
      ).toBe(true);
      expect(
        service.evaluateCondition(
          { field: 'assignee', operator: 'is_set' },
          { assignee: null },
        ),
      ).toBe(false);
    });

    it('should evaluate is_empty operator', () => {
      expect(
        service.evaluateCondition(
          { field: 'assignee', operator: 'is_empty' },
          { assignee: null },
        ),
      ).toBe(true);
      expect(
        service.evaluateCondition(
          { field: 'assignee', operator: 'is_empty' },
          { assignee: '' },
        ),
      ).toBe(true);
    });
  });
});
