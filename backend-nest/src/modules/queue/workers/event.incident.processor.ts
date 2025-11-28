import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { RulesService } from '../../rules/rules.service';

interface IncidentJobData {
  normalizedEventId: string;
  tenantId: string;
  severity: string;
  category: string;
  resource: string;
  message: string;
}

@Processor('events.incident', {
  concurrency: parseInt(
    process.env.QUEUE_EVENTS_INCIDENT_CONCURRENCY || '16',
    10,
  ),
})
export class EventIncidentProcessor extends WorkerHost {
  constructor(private readonly rulesService: RulesService) {
    super();
  }

  async process(job: Job<IncidentJobData>): Promise<void> {
    const {
      normalizedEventId,
      tenantId,
      severity,
      category,
      resource,
      message,
    } = job.data;

    // Evaluate rules
    const incident = await this.rulesService.evaluateIncident({
      tenantId,
      eventId: normalizedEventId,
      severity,
      category,
      resource,
      message,
    });

    if (incident) {
      // Incident created/updated
      console.log(`Incident created: ${incident.id} for resource ${resource}`);
    }
  }
}
