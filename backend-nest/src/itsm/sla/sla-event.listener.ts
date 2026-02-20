import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SlaService } from './sla.service';

@Injectable()
export class SlaEventListener {
  constructor(private readonly slaService: SlaService) {}

  @OnEvent('incident.created')
  async onIncidentCreated(payload: {
    incidentId: string;
    tenantId: string;
    priority?: string;
    serviceId?: string;
  }): Promise<void> {
    await this.slaService.startSlaForRecord(
      payload.tenantId,
      'ItsmIncident',
      payload.incidentId,
      payload.priority,
      payload.serviceId,
    );
  }

  @OnEvent('incident.updated')
  async onIncidentUpdated(payload: {
    incidentId: string;
    tenantId: string;
    changes?: Record<string, unknown>;
  }): Promise<void> {
    const status = payload.changes?.status as string | undefined;
    if (!status) return;

    await this.slaService.evaluateOnStateChange(
      payload.tenantId,
      'ItsmIncident',
      payload.incidentId,
      status,
    );
  }

  @OnEvent('workflow.transition.executed')
  async onWorkflowTransitionExecuted(payload: {
    tenantId: string;
    tableName: string;
    workflowId: string;
    transitionName: string;
    fromState: string;
    toState: string;
    fieldUpdates?: Record<string, unknown>;
    recordId?: string;
  }): Promise<void> {
    if (!payload.recordId) return;

    await this.slaService.evaluateOnStateChange(
      payload.tenantId,
      payload.tableName,
      payload.recordId,
      payload.toState,
    );
  }
}
