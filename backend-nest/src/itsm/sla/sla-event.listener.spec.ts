import { SlaEventListener } from './sla-event.listener';
import { SlaService } from './sla.service';

describe('SlaEventListener', () => {
  let listener: SlaEventListener;
  let mockSlaService: {
    startSlaForRecord: jest.Mock;
    startSlaV2ForRecord: jest.Mock;
    evaluateOnStateChange: jest.Mock;
    reEvaluateV2: jest.Mock;
  };

  beforeEach(() => {
    mockSlaService = {
      startSlaForRecord: jest.fn().mockResolvedValue([]),
      startSlaV2ForRecord: jest.fn().mockResolvedValue([]),
      evaluateOnStateChange: jest.fn().mockResolvedValue([]),
      reEvaluateV2: jest.fn().mockResolvedValue([]),
    };
    listener = new SlaEventListener(mockSlaService as unknown as SlaService);
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
});
