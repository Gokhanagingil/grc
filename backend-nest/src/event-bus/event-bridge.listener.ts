import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventBusService } from './event-bus.service';
import { StructuredLoggerService } from '../common/logger';

interface IncidentEventPayload {
  incidentId: string;
  tenantId: string;
  userId: string;
  number?: string;
  changes?: Record<string, unknown>;
}

interface WorkflowEventPayload {
  tenantId: string;
  tableName: string;
  recordId: string;
  transitionName: string;
  fromState: string;
  toState: string;
  userId?: string;
}

interface SlaEventPayload {
  tenantId: string;
  instanceId: string;
  definitionName: string;
  tableName: string;
  recordId: string;
  type: string;
}

interface BusinessRuleEventPayload {
  tenantId: string;
  tableName: string;
  recordId: string;
  ruleName: string;
  action: string;
  userId?: string;
  message?: string;
}

@Injectable()
export class EventBridgeListener {
  private readonly logger: StructuredLoggerService;

  constructor(private readonly eventBusService: EventBusService) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('EventBridgeListener');
  }

  @OnEvent('incident.created')
  async onIncidentCreated(payload: IncidentEventPayload): Promise<void> {
    await this.safeEmit({
      tenantId: payload.tenantId,
      source: 'itsm.incident',
      eventName: 'record.created',
      tableName: 'itsm_incidents',
      recordId: payload.incidentId,
      payload: {
        number: payload.number,
        userId: payload.userId,
      },
      actorId: payload.userId,
    });
  }

  @OnEvent('incident.updated')
  async onIncidentUpdated(payload: IncidentEventPayload): Promise<void> {
    await this.safeEmit({
      tenantId: payload.tenantId,
      source: 'itsm.incident',
      eventName: 'record.updated',
      tableName: 'itsm_incidents',
      recordId: payload.incidentId,
      payload: {
        number: payload.number,
        userId: payload.userId,
        changes: payload.changes,
      },
      actorId: payload.userId,
    });
  }

  @OnEvent('incident.deleted')
  async onIncidentDeleted(payload: IncidentEventPayload): Promise<void> {
    await this.safeEmit({
      tenantId: payload.tenantId,
      source: 'itsm.incident',
      eventName: 'record.deleted',
      tableName: 'itsm_incidents',
      recordId: payload.incidentId,
      payload: {
        number: payload.number,
        userId: payload.userId,
      },
      actorId: payload.userId,
    });
  }

  @OnEvent('workflow.transition.executed')
  async onWorkflowTransition(payload: WorkflowEventPayload): Promise<void> {
    await this.safeEmit({
      tenantId: payload.tenantId,
      source: 'itsm.workflow',
      eventName: 'workflow.transition',
      tableName: payload.tableName,
      recordId: payload.recordId,
      payload: {
        transitionName: payload.transitionName,
        fromState: payload.fromState,
        toState: payload.toState,
      },
      actorId: payload.userId,
    });
  }

  @OnEvent('sla.breached')
  async onSlaBreached(payload: SlaEventPayload): Promise<void> {
    await this.safeEmit({
      tenantId: payload.tenantId,
      source: 'itsm.sla',
      eventName: 'sla.breached',
      tableName: payload.tableName,
      recordId: payload.recordId,
      payload: {
        instanceId: payload.instanceId,
        definitionName: payload.definitionName,
        type: payload.type,
      },
    });
  }

  @OnEvent('sla.warning')
  async onSlaWarning(payload: SlaEventPayload): Promise<void> {
    await this.safeEmit({
      tenantId: payload.tenantId,
      source: 'itsm.sla',
      eventName: 'sla.warning',
      tableName: payload.tableName,
      recordId: payload.recordId,
      payload: {
        instanceId: payload.instanceId,
        definitionName: payload.definitionName,
        type: payload.type,
      },
    });
  }

  @OnEvent('businessrule.reject')
  async onBusinessRuleReject(payload: BusinessRuleEventPayload): Promise<void> {
    await this.safeEmit({
      tenantId: payload.tenantId,
      source: 'itsm.business_rule',
      eventName: 'businessrule.reject',
      tableName: payload.tableName,
      recordId: payload.recordId,
      payload: {
        ruleName: payload.ruleName,
        action: payload.action,
        message: payload.message,
      },
      actorId: payload.userId,
    });
  }

  @OnEvent('businessrule.set_field')
  async onBusinessRuleSetField(
    payload: BusinessRuleEventPayload,
  ): Promise<void> {
    await this.safeEmit({
      tenantId: payload.tenantId,
      source: 'itsm.business_rule',
      eventName: 'businessrule.set_field',
      tableName: payload.tableName,
      recordId: payload.recordId,
      payload: {
        ruleName: payload.ruleName,
        action: payload.action,
      },
      actorId: payload.userId,
    });
  }

  private async safeEmit(
    options: Parameters<EventBusService['emit']>[0],
  ): Promise<void> {
    try {
      await this.eventBusService.emit(options);
    } catch (error) {
      this.logger.error('Failed to persist event', {
        eventName: options.eventName,
        tenantId: options.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
