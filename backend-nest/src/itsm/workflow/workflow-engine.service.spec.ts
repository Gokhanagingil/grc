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

  describe('transition execution pipeline', () => {
    it('should deny transition for user lacking required role', () => {
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

    it('should allow transition for manager role', () => {
      const result = service.validateTransition(
        mockWorkflow,
        'resolved',
        'close',
        {},
        ['MANAGER'],
      );
      expect(result.allowed).toBe(true);
      expect(result.targetState).toBe('closed');
    });

    it('should allow transition for admin role', () => {
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

    it('should return 400-style reason for invalid transition', () => {
      const result = service.validateTransition(
        mockWorkflow,
        'open',
        'close',
        {},
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("No transition 'close' from state 'open'");
    });

    it('should persist state change via executeTransition', () => {
      const result = service.executeTransition(
        mockWorkflow,
        'in_progress',
        'resolve',
        { resolutionNotes: 'Fixed' },
      );
      expect(result.newState).toBe('resolved');
      expect(result.fieldUpdates).toHaveProperty('resolvedAt');
    });

    it('should throw for executeTransition when role denied', () => {
      expect(() =>
        service.executeTransition(
          mockWorkflow,
          'resolved',
          'close',
          {},
          ['USER'],
        ),
      ).toThrow('lacks required role');
    });

    it('should chain multiple transitions correctly', () => {
      const r1 = service.executeTransition(
        mockWorkflow,
        'open',
        'start_progress',
        {},
      );
      expect(r1.newState).toBe('in_progress');

      const r2 = service.executeTransition(
        mockWorkflow,
        r1.newState,
        'resolve',
        { resolutionNotes: 'Done' },
      );
      expect(r2.newState).toBe('resolved');

      const r3 = service.executeTransition(
        mockWorkflow,
        r2.newState,
        'close',
        {},
        ['ADMIN'],
      );
      expect(r3.newState).toBe('closed');
    });
  });

  describe('tenant isolation', () => {
    it('should use workflow with correct tenantId context', () => {
      const tenantAWorkflow: WorkflowDefinition = {
        ...mockWorkflow,
        tenantId: 'tenant-a',
        transitions: [
          {
            name: 'approve',
            label: 'Approve',
            from: 'open',
            to: 'closed',
            requiredRoles: ['APPROVER_A'],
          },
        ],
      };
      const tenantBWorkflow: WorkflowDefinition = {
        ...mockWorkflow,
        tenantId: 'tenant-b',
        transitions: [
          {
            name: 'approve',
            label: 'Approve',
            from: 'open',
            to: 'closed',
            requiredRoles: ['APPROVER_B'],
          },
        ],
      };

      const resultA = service.validateTransition(
        tenantAWorkflow,
        'open',
        'approve',
        {},
        ['APPROVER_A'],
      );
      expect(resultA.allowed).toBe(true);

      const resultB = service.validateTransition(
        tenantBWorkflow,
        'open',
        'approve',
        {},
        ['APPROVER_A'],
      );
      expect(resultB.allowed).toBe(false);
    });
  });
});
