import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SlaService } from './sla.service';
import { RecordContext } from './condition/sla-condition-evaluator';

/** Fields that trigger SLA re-evaluation when changed on an incident. */
const SLA_RELEVANT_FIELDS = [
  'priority',
  'impact',
  'urgency',
  'category',
  'subcategory',
  'serviceId',
  'offeringId',
  'assignmentGroup',
  'source',
  'status',
  'assignedTo',
  'relatedService',
];

@Injectable()
export class SlaEventListener {
  private readonly logger = new Logger(SlaEventListener.name);

  constructor(private readonly slaService: SlaService) {}

  @OnEvent('incident.created')
  async onIncidentCreated(payload: {
    incidentId: string;
    tenantId: string;
    priority?: string;
    serviceId?: string;
    impact?: string;
    urgency?: string;
    category?: string;
    subcategory?: string;
    assignmentGroup?: string;
    source?: string;
    status?: string;
    offeringId?: string;
    assignedTo?: string;
    relatedService?: string;
  }): Promise<void> {
    try {
      // Build v2 context from payload
      const context: RecordContext = {};
      if (payload.priority) context.priority = payload.priority;
      if (payload.serviceId) context.serviceId = payload.serviceId;
      if (payload.impact) context.impact = payload.impact;
      if (payload.urgency) context.urgency = payload.urgency;
      if (payload.category) context.category = payload.category;
      if (payload.subcategory) context.subcategory = payload.subcategory;
      if (payload.assignmentGroup)
        context.assignmentGroup = payload.assignmentGroup;
      if (payload.source) context.source = payload.source;
      if (payload.status) context.status = payload.status;
      if (payload.offeringId) context.offeringId = payload.offeringId;
      if (payload.assignedTo) context.assignedTo = payload.assignedTo;
      if (payload.relatedService)
        context.relatedService = payload.relatedService;

      await this.slaService.startSlaV2ForRecord(
        payload.tenantId,
        'ItsmIncident',
        payload.incidentId,
        context,
      );
    } catch (err) {
      // Failure safety: never crash incident save path
      this.logger.error(
        `SLA event listener error on incident.created: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  @OnEvent('incident.updated')
  async onIncidentUpdated(payload: {
    incidentId: string;
    tenantId: string;
    changes?: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const changes = payload.changes || {};

      // Always handle state changes for existing v1 SLA stop/pause logic
      const status = changes.status as string | undefined;
      if (status) {
        await this.slaService.evaluateOnStateChange(
          payload.tenantId,
          'ItsmIncident',
          payload.incidentId,
          status,
        );
      }

      // Check if any SLA-relevant fields changed → re-evaluate v2
      const hasSlaRelevantChange = SLA_RELEVANT_FIELDS.some(
        (f) => f in changes && f !== 'status',
      );

      if (hasSlaRelevantChange && payload.snapshot) {
        const context: RecordContext = {};
        for (const field of SLA_RELEVANT_FIELDS) {
          const val = payload.snapshot[field];
          if (val !== undefined && val !== null) {
            context[field] = val;
          }
        }

        await this.slaService.reEvaluateV2(
          payload.tenantId,
          'ItsmIncident',
          payload.incidentId,
          context,
        );
      }
    } catch (err) {
      this.logger.error(
        `SLA event listener error on incident.updated: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
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

    try {
      await this.slaService.evaluateOnStateChange(
        payload.tenantId,
        payload.tableName,
        payload.recordId,
        payload.toState,
      );
    } catch (err) {
      this.logger.error(
        `SLA event listener error on workflow.transition.executed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
