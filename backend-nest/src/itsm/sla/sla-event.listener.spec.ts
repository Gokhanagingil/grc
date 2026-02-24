import { SlaEventListener } from './sla-event.listener';
import { SlaService } from './sla.service';
import { Repository } from 'typeorm';
import { ItsmChange } from '../change/change.entity';

describe('SlaEventListener', () => {
  let listener: SlaEventListener;
  let mockSlaService: {
    startSlaForRecord: jest.Mock;
    startSlaV2ForRecord: jest.Mock;
    evaluateOnStateChange: jest.Mock;
    reEvaluateV2: jest.Mock;
  };
  let mockChangeRepo: {
    findOne: jest.Mock;
  };

  beforeEach(() => {
    mockSlaService = {
      startSlaForRecord: jest.fn().mockResolvedValue([]),
      startSlaV2ForRecord: jest.fn().mockResolvedValue([]),
      evaluateOnStateChange: jest.fn().mockResolvedValue([]),
      reEvaluateV2: jest.fn().mockResolvedValue([]),
    };
    mockChangeRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    listener = new SlaEventListener(
      mockSlaService as unknown as SlaService,
      mockChangeRepo as unknown as Repository<ItsmChange>,
    );
  });

  describe('onIncidentCreated', () => {
    it('should start SLA v2 for new incident', async () => {
      await listener.onIncidentCreated({
        incidentId: 'inc-1',
        tenantId: 'tenant-1',
        priority: 'p1',
        serviceId: 'svc-1',
      });

      expect(mockSlaService.startSlaV2ForRecord).toHaveBeenCalledWith(
        'tenant-1',
        'ItsmIncident',
        'inc-1',
        expect.objectContaining({ priority: 'p1', serviceId: 'svc-1' }),
      );
    });
  });

  describe('onIncidentUpdated', () => {
    it('should evaluate state change when status changes', async () => {
      await listener.onIncidentUpdated({
        incidentId: 'inc-1',
        tenantId: 'tenant-1',
        changes: { status: 'resolved' },
      });

      expect(mockSlaService.evaluateOnStateChange).toHaveBeenCalledWith(
        'tenant-1',
        'ItsmIncident',
        'inc-1',
        'resolved',
      );
    });

    it('should skip when no status change and no SLA-relevant fields', async () => {
      await listener.onIncidentUpdated({
        incidentId: 'inc-1',
        tenantId: 'tenant-1',
        changes: { description: 'updated' },
      });

      expect(mockSlaService.evaluateOnStateChange).not.toHaveBeenCalled();
      expect(mockSlaService.reEvaluateV2).not.toHaveBeenCalled();
    });

    it('should re-evaluate v2 when SLA-relevant fields change', async () => {
      await listener.onIncidentUpdated({
        incidentId: 'inc-1',
        tenantId: 'tenant-1',
        changes: { priority: 'p2' },
        snapshot: { priority: 'p2', serviceId: 'svc-1' },
      });

      expect(mockSlaService.reEvaluateV2).toHaveBeenCalledWith(
        'tenant-1',
        'ItsmIncident',
        'inc-1',
        expect.objectContaining({ priority: 'p2', serviceId: 'svc-1' }),
      );
    });
  });

  describe('onWorkflowTransitionExecuted', () => {
    it('should evaluate state change on workflow transition', async () => {
      await listener.onWorkflowTransitionExecuted({
        tenantId: 'tenant-1',
        tableName: 'itsm_incidents',
        workflowId: 'wf-1',
        transitionName: 'resolve',
        fromState: 'in_progress',
        toState: 'resolved',
        recordId: 'inc-1',
      });

      expect(mockSlaService.evaluateOnStateChange).toHaveBeenCalledWith(
        'tenant-1',
        'itsm_incidents',
        'inc-1',
        'resolved',
      );
    });

    it('should skip when no recordId provided', async () => {
      await listener.onWorkflowTransitionExecuted({
        tenantId: 'tenant-1',
        tableName: 'itsm_incidents',
        workflowId: 'wf-1',
        transitionName: 'resolve',
        fromState: 'in_progress',
        toState: 'resolved',
      });

      expect(mockSlaService.evaluateOnStateChange).not.toHaveBeenCalled();
    });
  });

  // ── Change Task SLA Tests ───────────────────────────────────────────

  describe('onChangeTaskCreated', () => {
    it('should start SLA v2 for new change task', async () => {
      await listener.onChangeTaskCreated({
        taskId: 'task-1',
        changeId: 'chg-1',
        tenantId: 'tenant-1',
        priority: 'CRITICAL',
        status: 'OPEN',
        taskType: 'IMPLEMENTATION',
        assignmentGroupId: 'grp-1',
      });

      expect(mockSlaService.startSlaV2ForRecord).toHaveBeenCalledWith(
        'tenant-1',
        'CHANGE_TASK',
        'task-1',
        expect.objectContaining({
          priority: 'CRITICAL',
          status: 'OPEN',
          taskType: 'IMPLEMENTATION',
          assignmentGroupId: 'grp-1',
        }),
      );
    });

    it('should include derived parent change fields when change exists', async () => {
      mockChangeRepo.findOne.mockResolvedValue({
        id: 'chg-1',
        type: 'NORMAL',
        risk: 'HIGH',
        state: 'IMPLEMENT',
        serviceId: 'svc-1',
      });

      await listener.onChangeTaskCreated({
        taskId: 'task-1',
        changeId: 'chg-1',
        tenantId: 'tenant-1',
        priority: 'HIGH',
      });

      expect(mockSlaService.startSlaV2ForRecord).toHaveBeenCalledWith(
        'tenant-1',
        'CHANGE_TASK',
        'task-1',
        expect.objectContaining({
          priority: 'HIGH',
          'change.type': 'NORMAL',
          'change.risk': 'HIGH',
          'change.state': 'IMPLEMENT',
          'change.serviceId': 'svc-1',
        }),
      );
    });

    it('should not fail when parent change not found', async () => {
      mockChangeRepo.findOne.mockResolvedValue(null);

      await listener.onChangeTaskCreated({
        taskId: 'task-1',
        changeId: 'chg-missing',
        tenantId: 'tenant-1',
        priority: 'LOW',
      });

      expect(mockSlaService.startSlaV2ForRecord).toHaveBeenCalledWith(
        'tenant-1',
        'CHANGE_TASK',
        'task-1',
        expect.objectContaining({ priority: 'LOW' }),
      );
      // Should NOT have parent fields
      const ctx = mockSlaService.startSlaV2ForRecord.mock.calls[0][3];
      expect(ctx['change.type']).toBeUndefined();
    });

    it('should handle errors gracefully (no throw)', async () => {
      mockSlaService.startSlaV2ForRecord.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(
        listener.onChangeTaskCreated({
          taskId: 'task-1',
          changeId: 'chg-1',
          tenantId: 'tenant-1',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('onChangeTaskUpdated', () => {
    it('should evaluate state change when status changes', async () => {
      await listener.onChangeTaskUpdated({
        taskId: 'task-1',
        changeId: 'chg-1',
        tenantId: 'tenant-1',
        changes: { status: 'COMPLETED' },
      });

      expect(mockSlaService.evaluateOnStateChange).toHaveBeenCalledWith(
        'tenant-1',
        'CHANGE_TASK',
        'task-1',
        'COMPLETED',
      );
    });

    it('should re-evaluate v2 when SLA-relevant fields change', async () => {
      await listener.onChangeTaskUpdated({
        taskId: 'task-1',
        changeId: 'chg-1',
        tenantId: 'tenant-1',
        changes: { priority: 'CRITICAL' },
        snapshot: {
          priority: 'CRITICAL',
          status: 'IN_PROGRESS',
          taskType: 'IMPLEMENTATION',
        },
      });

      expect(mockSlaService.reEvaluateV2).toHaveBeenCalledWith(
        'tenant-1',
        'CHANGE_TASK',
        'task-1',
        expect.objectContaining({ priority: 'CRITICAL' }),
      );
    });

    it('should not re-evaluate when only non-SLA fields change', async () => {
      await listener.onChangeTaskUpdated({
        taskId: 'task-1',
        changeId: 'chg-1',
        tenantId: 'tenant-1',
        changes: { description: 'updated description' },
        snapshot: { priority: 'MEDIUM', status: 'OPEN' },
      });

      expect(mockSlaService.reEvaluateV2).not.toHaveBeenCalled();
    });

    it('should handle both status change and field re-evaluation', async () => {
      await listener.onChangeTaskUpdated({
        taskId: 'task-1',
        changeId: 'chg-1',
        tenantId: 'tenant-1',
        changes: { status: 'IN_PROGRESS', assignmentGroupId: 'grp-2' },
        snapshot: {
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          assignmentGroupId: 'grp-2',
        },
      });

      expect(mockSlaService.evaluateOnStateChange).toHaveBeenCalledWith(
        'tenant-1',
        'CHANGE_TASK',
        'task-1',
        'IN_PROGRESS',
      );
      expect(mockSlaService.reEvaluateV2).toHaveBeenCalled();
    });

    it('should handle errors gracefully (no throw)', async () => {
      mockSlaService.evaluateOnStateChange.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(
        listener.onChangeTaskUpdated({
          taskId: 'task-1',
          changeId: 'chg-1',
          tenantId: 'tenant-1',
          changes: { status: 'COMPLETED' },
        }),
      ).resolves.not.toThrow();
    });
  });
});
